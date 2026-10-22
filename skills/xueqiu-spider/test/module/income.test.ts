/**
 * xueqiu-income 模块测试（L2）
 *
 * 本包最典型的 Skill：单 Goal、游标类翻页、无 Hook、无落盘。
 *
 * 重点锁住四类**只在边界暴露**的行为（都对应过真实缺陷或分析结论）：
 *   ① 翻页游标 `+1` 与终止判据 —— 上游不返回 has_more，只能靠条数不足
 *   ② `maxPages` 真实生效 —— CLAUDE.md §2.5 记录过超发 20 次的事故
 *   ③ `error_code` 类型漂移 + 鉴权失败时 list 也为空 —— 混淆会误报"无数据"
 *   ④ 二元组三态 —— `[0.0, null]` 是真实的零，不能被 `||` 吞成 null
 *
 * 断言纪律（docs/TESTING.md §8）：只锁 kind 不锁 message；
 * 每个用例尾部 `provider.assertBalanced()`。
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { testing, createGoalExecutor } from "@spider/core";

import { IncomeStatementSkill } from "@src/skills/finance/income.skill";
import type { FinanceSkillParams } from "@src/skills/finance/_base";

import { expectSnapshot } from "../helpers/snapshot";
import {
  incomeEnvelopeFixture,
  incomePeriodsFixture,
  notLoggedInFixture,
  emptyResultFixture,
  financialOrgFixture,
} from "../fixtures/income.fixture";

const { FakeUpstream, runSkillWithFixtures } = testing;

const INCOME_PATH = "/v5/stock/finance/cn/income.json";

const deps = () => ({
  sessionProvider: undefined as never, // harness 注入
  goalExecutor: createGoalExecutor(),
});

const run = (params: Partial<FinanceSkillParams>, upstream: InstanceType<typeof FakeUpstream>) =>
  runSkillWithFixtures(
    new IncomeStatementSkill(deps()),
    params as FinanceSkillParams,
    { upstream },
  );

/** 构造一页响应：给定期次数量，report_date 从 base 递减 */
function pageOf(count: number, base = 1774886400000) {
  const list = Array.from({ length: count }, (_, i) => ({
    ...incomePeriodsFixture[0],
    report_date: base - i * 7776000000,
    report_name: `期次-${base - i * 7776000000}`,
  }));
  return { body: { ...incomeEnvelopeFixture, data: { ...incomeEnvelopeFixture.data, list } } };
}

// ============================================================================
// ① 成功信封
// ============================================================================

test("成功信封：单页数据，投影为 AI-Ready 结构", async () => {
  const upstream = new FakeUpstream().route(INCOME_PATH, { body: incomeEnvelopeFixture });
  const outcome = await run({ symbol: "SH601127", maxPages: 1 }, upstream);

  expectSnapshot("income-envelope", outcome.result);

  const data = outcome.expectSuccess() as unknown as {
    meta: { symbol: string; quoteName: string; periodCount: number; semantics: string };
    items: Array<{ reportName: string; totalRevenue: { value: number; yoy: number } }>;
    insights: string[];
  };

  assert.equal(data.meta.symbol, "SH601127");
  assert.equal(data.meta.quoteName, "赛力斯");
  assert.equal(data.meta.periodCount, 2);
  assert.match(data.meta.semantics, /累计/, "利润表是期间流量表，口径必须说累计");
  assert.equal(data.items[0].totalRevenue.value, 25745711786.75, "金额原样透传，不做单位换算");
  assert.equal(data.items[0].totalRevenue.yoy, 0.3446285931858831, "同比保持小数，不 ×100");
  outcome.provider.assertBalanced();
});

test("insights：少数股东损益为负时，警告归母净利润高于合并净利润", async () => {
  const upstream = new FakeUpstream().route(INCOME_PATH, { body: incomeEnvelopeFixture });
  const outcome = await run({ symbol: "SH601127", maxPages: 1 }, upstream);

  const data = outcome.expectSuccess() as unknown as { insights: string[] };
  const warn = data.insights.find((s) => s.includes("少数股东损益"));
  assert.ok(warn, "少数股东损益为负是易错点，必须给出警告");
  assert.match(warn!, /高于/, "须明确指出归母高于合并，避免张冠李戴");
  outcome.provider.assertBalanced();
});

// ============================================================================
// ② 翻页：游标推进、+1 去重、终止判据
// ============================================================================

test("翻页：满页则续取，游标为上页末条 report_date + 1", async () => {
  const upstream = new FakeUpstream()
    .route(INCOME_PATH, pageOf(5, 1774886400000), pageOf(3, 1735574400000));
  const outcome = await run({ symbol: "SH601127", count: 5, maxPages: 5 }, upstream);

  const calls = upstream.callsMatching(INCOME_PATH);
  assert.equal(calls.length, 2, "第二页不足 5 条 → 终止，不再发第三次");

  // 首页 timestamp 为空串；续页为上页末条 report_date + 1
  assert.match(calls[0].url, /timestamp=(&|$)/, "首页应传空串");
  const lastOfPage1 = 1774886400000 - 4 * 7776000000;
  assert.ok(
    calls[1].url.includes(`timestamp=${lastOfPage1 + 1}`),
    `续页游标须为末条 report_date + 1（期望 ${lastOfPage1 + 1}），` +
      "比较为闭区间，不 +1 会重复返回该条",
  );
  outcome.provider.assertBalanced();
});

test("翻页：首页不足一页即终止，只请求一次", async () => {
  const upstream = new FakeUpstream().route(INCOME_PATH, pageOf(2));
  const outcome = await run({ symbol: "SH601127", count: 5, maxPages: 8 }, upstream);

  assert.equal(
    upstream.callsMatching(INCOME_PATH).length,
    1,
    "上游不返回 has_more，条数不足一页即到底",
  );
  outcome.provider.assertBalanced();
});

test("翻页：maxPages=1 时实际只发 1 次请求（防超发回归）", async () => {
  // CLAUDE.md §2.5 记录的事故：用户传 maxPages=1 但上游被打了 20 次，
  // 而输出因裁剪过仍显示 1 页 —— 从结果完全看不出超发。
  const upstream = new FakeUpstream().route(
    INCOME_PATH,
    pageOf(5, 1774886400000),
    pageOf(5, 1735574400000),
    pageOf(5, 1700000000000),
  );
  const outcome = await run({ symbol: "SH601127", count: 5, maxPages: 1 }, upstream);

  assert.equal(
    upstream.callsMatching(INCOME_PATH).length,
    1,
    "maxPages 必须真实限制请求次数，不能只在输出层裁剪",
  );
  const data = outcome.expectSuccess() as unknown as { meta: { pagesFetched: number } };
  assert.equal(data.meta.pagesFetched, 1);
  outcome.provider.assertBalanced();
});

test("翻页：跨页重复期次被去重", async () => {
  const dup = 1774886400000;
  const upstream = new FakeUpstream()
    .route(INCOME_PATH, pageOf(5, dup), pageOf(5, dup - 4 * 7776000000));
  const outcome = await run({ symbol: "SH601127", count: 5, maxPages: 3 }, upstream);

  const data = outcome.expectSuccess() as unknown as {
    items: Array<{ reportName: string }>;
  };
  const names = data.items.map((i) => i.reportName);
  assert.equal(new Set(names).size, names.length, "同一 report_date 不得重复出现");
  outcome.provider.assertBalanced();
});

// ============================================================================
// ③ 错误 kind 矩阵
// ============================================================================

test("矩阵·未登录：error_code 为 string 400016 → not-logged-in（不是 no-results）", async () => {
  const upstream = new FakeUpstream().route(INCOME_PATH, { body: notLoggedInFixture });
  const outcome = await run({ symbol: "SH601127", maxPages: 1 }, upstream);

  assert.equal(
    outcome.expectFailureKind(),
    "not-logged-in",
    "鉴权失败时 data.list 也是空数组 —— 若先判 list 会误报成「无数据」",
  );
  outcome.provider.assertBalanced();
});

test("矩阵·缺参：symbol 缺失 → missing-context，不发任何请求", async () => {
  const upstream = new FakeUpstream().route(INCOME_PATH, { body: incomeEnvelopeFixture });
  const outcome = await run({ maxPages: 1 }, upstream);

  assert.equal(outcome.expectFailureKind(), "missing-context");
  assert.equal(upstream.calls.length, 0, "参数校验应在导航前完成");
  outcome.provider.assertBalanced();
});

test("矩阵·非法参数：symbol 形状不合法 → invalid-params", async () => {
  const upstream = new FakeUpstream().route(INCOME_PATH, { body: incomeEnvelopeFixture });
  const outcome = await run({ symbol: "不存在", maxPages: 1 }, upstream);

  assert.equal(outcome.expectFailureKind(), "invalid-params");
  assert.equal(upstream.calls.length, 0);
  outcome.provider.assertBalanced();
});

test("上游枚举不做白名单拦截：未见过的 type 照常发给上游判定", async () => {
  // CLAUDE.md §3.6：type 是上游定义的枚举，只做形状校验。
  // 利润表 HAR 只出现 all/Q1-Q4，据此写白名单会拦掉真实存在的 S0-S4。
  const upstream = new FakeUpstream().route(INCOME_PATH, { body: incomeEnvelopeFixture });
  const outcome = await run({ symbol: "SH601127", type: "S9", maxPages: 1 }, upstream);

  assert.equal(outcome.result.success, true, "未列出的取值不应被本地拦截");
  assert.ok(
    upstream.callsMatching(INCOME_PATH)[0].url.includes("type=S9"),
    "取值须原样透传给上游",
  );
  outcome.provider.assertBalanced();
});

// ============================================================================
// ④ 正常空集 与 特殊机构类型
// ============================================================================

test("正常空集：已登录但无数据 → success + items:[]，不重试", async () => {
  const upstream = new FakeUpstream().route(INCOME_PATH, { body: emptyResultFixture });
  const outcome = await run({ symbol: "SZ000001", maxPages: 1 }, upstream);

  const data = outcome.expectSuccess() as unknown as {
    items: unknown[];
    insights: string[];
  };
  assert.deepEqual(data.items, []);
  assert.match(data.insights[0], /无公开数据/);
  assert.equal(upstream.callsMatching(INCOME_PATH).length, 1, "空集不该触发重试");
  outcome.provider.assertBalanced();
});

test("金融企业 org_type≠1 → insights 给出科目结构差异警告", async () => {
  const upstream = new FakeUpstream().route(INCOME_PATH, { body: financialOrgFixture });
  const outcome = await run({ symbol: "SH601398", maxPages: 1 }, upstream);

  const data = outcome.expectSuccess() as unknown as { insights: string[] };
  assert.ok(
    data.insights.some((s) => s.includes("org_type")),
    "非工商企业的科目结构不同，必须提示核对，否则字段字典会被误用",
  );
  outcome.provider.assertBalanced();
});

// ============================================================================
// ⑤ RAII
// ============================================================================

test("RAII：无论成功失败，页面租约都被释放", async () => {
  for (const [label, upstream] of [
    ["成功", new FakeUpstream().route(INCOME_PATH, { body: incomeEnvelopeFixture })],
    ["失败", new FakeUpstream().route(INCOME_PATH, { body: notLoggedInFixture })],
  ] as const) {
    const outcome = await run({ symbol: "SH601127", maxPages: 1 }, upstream);
    outcome.provider.assertBalanced();
    assert.equal(outcome.provider.acquireCount, 1, `${label}路径应只取一次会话`);
    assert.equal(
      outcome.provider.acquisitions[0].releaseCount,
      1,
      `${label}路径的 release 次数应恰好 1`,
    );
  }
});
