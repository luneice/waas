/**
 * channel 模块测试（bili-channel，L2，docs/TESTING.md §3.3 标准三件）。
 *
 * 与 bili-creator-channels（目录 + 预览）正交：本 Skill 按 season_id/series_id
 * 拉取单个合集/系列内的全量稿件。`createGoal(params)` 按 `kind` 分派到
 * `BiliChannelSeasonGoal`（season，无 WBI，page_num/page_size，首页带 meta）或
 * `BiliChannelSeriesGoal`（series，无 WBI，pn/ps，不返回 meta），两个 Goal 类
 * 共享同一个 `@Goal({id:"bili-channel"})`，与 cninfo report-search 的
 * dispatch-by-param 模式一致。
 *
 * 断言纪律（§8 红线）：只锁 `kind` 不锁 message；每个用例尾部
 * `provider.assertBalanced()`。
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { testing, createGoalExecutor } from "@spider/core";

import { BiliChannelSkill } from "@src/skills/channel/detail.skill";
import type { BiliChannelParams } from "@src/types/channel.types";

import { expectSnapshot } from "../helpers/snapshot";
import {
  biliOk,
  biliErr,
  seasonArchivesPage1Fixture,
  seasonArchivesPage2Fixture,
  seasonArchivesEmptyFixture,
  seasonArchivesShapeDriftFixture,
  seriesArchivesPage1Fixture,
  seriesArchivesPage2Fixture,
  seriesArchivesEmptyFixture,
  seriesArchivesShapeDriftFixture,
} from "../fixtures/channel.fixture";

const { FakeUpstream, runSkillWithFixtures } = testing;

const SEASON_PATH = "/x/polymer/web-space/seasons_archives_list";
const SERIES_PATH = "/x/series/archives";

const deps = () => ({
  sessionProvider: undefined as never, // harness 注入
  goalExecutor: createGoalExecutor(),
});

// ============================================================================
// ① 成功信封
// ============================================================================

test("成功信封：season 全量快照，含 meta（合集名/封面/简介）", async () => {
  const upstream = new FakeUpstream().route(SEASON_PATH, { body: biliOk(seasonArchivesPage1Fixture) });
  const outcome = await runSkillWithFixtures(
    new BiliChannelSkill(deps()),
    { kind: "season", id: "30001", mid: "546195" } as BiliChannelParams,
    { upstream },
  );

  expectSnapshot("bili-channel-season-envelope", outcome.result);

  const data = outcome.expectSuccess() as unknown as {
    meta: { skill: string; kind: string; name: string; total: number | null };
    items: unknown[];
  };
  assert.equal(data.meta.skill, "bili-channel");
  assert.equal(data.meta.kind, "season");
  assert.equal(data.meta.name, "测试合集甲");
  assert.equal(data.meta.total, 3);
  assert.equal(data.items.length, 2);
  assert.equal(
    upstream.callsMatching("/x/web-interface/nav").length,
    0,
    "channel 无 WBI 签名，不该触发 nav 请求",
  );
  outcome.provider.assertBalanced();
});

test("成功信封：series 全量快照，无 meta（接口不返回，留空占位）", async () => {
  const upstream = new FakeUpstream().route(SERIES_PATH, { body: biliOk(seriesArchivesPage1Fixture) });
  const outcome = await runSkillWithFixtures(
    new BiliChannelSkill(deps()),
    { kind: "series", id: "40001", mid: "546195" } as BiliChannelParams,
    { upstream },
  );

  expectSnapshot("bili-channel-series-envelope", outcome.result);

  const data = outcome.expectSuccess() as unknown as {
    meta: { skill: string; kind: string; name: string; total: number | null };
    items: unknown[];
  };
  assert.equal(data.meta.skill, "bili-channel");
  assert.equal(data.meta.kind, "series");
  assert.equal(data.meta.name, "");
  assert.equal(data.meta.total, 3);
  assert.equal(data.items.length, 2);
  outcome.provider.assertBalanced();
});

// ============================================================================
// ② 翻页（page 类：page/maxPages，按 aid 去重）
// ============================================================================

test("翻页：season maxPages=2 逐页请求 page_num，按 aid 跨页去重", async () => {
  const upstream = new FakeUpstream().route(
    SEASON_PATH,
    { body: biliOk(seasonArchivesPage1Fixture) },
    { body: biliOk(seasonArchivesPage2Fixture) },
  );
  const data = (
    await runSkillWithFixtures(
      new BiliChannelSkill(deps()),
      { kind: "season", id: "30001", mid: "546195", maxPages: 2 } as BiliChannelParams,
      { upstream },
    )
  ).expectSuccess() as unknown as { items: unknown[] };

  // page1: 2 条，page2: 2 条（首条与 page1 第 2 条 aid 相同）→ 净 3 条
  assert.equal(data.items.length, 3);

  const [c1, c2] = upstream.callsMatching(SEASON_PATH);
  assert.ok(new URL(c1.url, "https://x.example.invalid").searchParams.get("page_num") === "1");
  assert.ok(new URL(c2.url, "https://x.example.invalid").searchParams.get("page_num") === "2");
});

test("翻页：series maxPages=2 逐页请求 pn，按 aid 跨页去重", async () => {
  const upstream = new FakeUpstream().route(
    SERIES_PATH,
    { body: biliOk(seriesArchivesPage1Fixture) },
    { body: biliOk(seriesArchivesPage2Fixture) },
  );
  const data = (
    await runSkillWithFixtures(
      new BiliChannelSkill(deps()),
      { kind: "series", id: "40001", mid: "546195", maxPages: 2 } as BiliChannelParams,
      { upstream },
    )
  ).expectSuccess() as unknown as { items: unknown[] };

  assert.equal(data.items.length, 3);

  const [c1, c2] = upstream.callsMatching(SERIES_PATH);
  assert.ok(new URL(c1.url, "https://x.example.invalid").searchParams.get("pn") === "1");
  assert.ok(new URL(c2.url, "https://x.example.invalid").searchParams.get("pn") === "2");
});

test("翻页：maxPages 超过硬上限 50 → invalid-params，一次上游都不打", async () => {
  const upstream = new FakeUpstream().route(SEASON_PATH, { body: biliOk(seasonArchivesPage1Fixture) });
  const outcome = await runSkillWithFixtures(
    new BiliChannelSkill(deps()),
    { kind: "season", id: "30001", mid: "546195", maxPages: 51 } as BiliChannelParams,
    { upstream },
  );

  assert.equal(outcome.expectFailureKind(), "invalid-params");
  assert.equal(upstream.calls.length, 0, "参数校验必须早于任何网络请求");
  outcome.provider.assertBalanced();
});

// ============================================================================
// ③ 错误 kind 矩阵（集中在 season，代表 page 类翻页的通用故障路径）
// ============================================================================

test("矩阵·风控拦截页：HTML 顶替 JSON → risk-control，不重试", async () => {
  const upstream = new FakeUpstream().route(SEASON_PATH, {
    body: '<!DOCTYPE html><html><head><title>验证</title></head><body><div id="captcha">请完成验证</div></body></html>',
  });
  const outcome = await runSkillWithFixtures(
    new BiliChannelSkill(deps()),
    { kind: "season", id: "30001", mid: "546195" } as BiliChannelParams,
    { upstream },
  );

  assert.equal(outcome.expectFailureKind(), "risk-control");
  assert.equal(upstream.callsMatching(SEASON_PATH).length, 1);
  outcome.provider.assertBalanced();
});

test("矩阵·空壳响应：0 字节 body 判为可重试，退避一次后恢复", async () => {
  const upstream = new FakeUpstream().route(SEASON_PATH, { body: "" }, { body: biliOk(seasonArchivesPage1Fixture) });
  const outcome = await runSkillWithFixtures(
    new BiliChannelSkill(deps()),
    { kind: "season", id: "30001", mid: "546195" } as BiliChannelParams,
    { upstream },
  );

  assert.equal(outcome.result.success, true);
  assert.equal(upstream.callsMatching(SEASON_PATH).length, 2);
  outcome.provider.assertBalanced();
});

test("矩阵·HTTP 非 2xx → 走满退避后落 retry-exhausted", async () => {
  // ⚠ 真的会等满 3 次退避（BILI_GOAL_DEFAULTS.delay=1000）。
  const upstream = new FakeUpstream().route(SEASON_PATH, { status: 503, body: { msg: "unavailable" } });
  const outcome = await runSkillWithFixtures(
    new BiliChannelSkill(deps()),
    { kind: "season", id: "30001", mid: "546195" } as BiliChannelParams,
    { upstream },
  );

  assert.equal(outcome.expectFailureKind(), "retry-exhausted");
  assert.equal(upstream.callsMatching(SEASON_PATH).length, 4, "count=3 → 共 4 次尝试");
  outcome.provider.assertBalanced();
});

test("矩阵·业务码 code≠0 → upstream-shape-changed（season/series 都主动校验）", async () => {
  const upstreamSeason = new FakeUpstream().route(SEASON_PATH, { body: biliErr(-400, "请求错误") });
  const outcomeSeason = await runSkillWithFixtures(
    new BiliChannelSkill(deps()),
    { kind: "season", id: "30001", mid: "546195" } as BiliChannelParams,
    { upstream: upstreamSeason },
  );
  assert.equal(outcomeSeason.expectFailureKind(), "upstream-shape-changed");
  outcomeSeason.provider.assertBalanced();

  const upstreamSeries = new FakeUpstream().route(SERIES_PATH, { body: biliErr(-400, "请求错误") });
  const outcomeSeries = await runSkillWithFixtures(
    new BiliChannelSkill(deps()),
    { kind: "series", id: "40001", mid: "546195" } as BiliChannelParams,
    { upstream: upstreamSeries },
  );
  assert.equal(outcomeSeries.expectFailureKind(), "upstream-shape-changed");
  outcomeSeries.provider.assertBalanced();
});

test("矩阵·契约漂移：season archives 从数组变成对象 → 宽容降级为空集，不崩溃", async () => {
  const upstream = new FakeUpstream().route(SEASON_PATH, { body: biliOk(seasonArchivesShapeDriftFixture) });
  const outcome = await runSkillWithFixtures(
    new BiliChannelSkill(deps()),
    { kind: "season", id: "30001", mid: "546195" } as BiliChannelParams,
    { upstream },
  );

  assert.equal(outcome.result.success, true, "非数组 archives 不该让整个 Skill 崩溃");
  const data = outcome.expectSuccess() as unknown as { items: unknown[] };
  assert.deepEqual(data.items, []);
  outcome.provider.assertBalanced();
});

test("矩阵·契约漂移：series archives 从数组变成对象 → 宽容降级为空集，不崩溃", async () => {
  const upstream = new FakeUpstream().route(SERIES_PATH, { body: biliOk(seriesArchivesShapeDriftFixture) });
  const outcome = await runSkillWithFixtures(
    new BiliChannelSkill(deps()),
    { kind: "series", id: "40001", mid: "546195" } as BiliChannelParams,
    { upstream },
  );

  assert.equal(outcome.result.success, true);
  const data = outcome.expectSuccess() as unknown as { items: unknown[] };
  assert.deepEqual(data.items, []);
  outcome.provider.assertBalanced();
});

test("矩阵·非法参数：kind 非 season/series → invalid-params，一次上游都不打", async () => {
  const upstream = new FakeUpstream().route(SEASON_PATH, { body: biliOk(seasonArchivesPage1Fixture) });
  const outcome = await runSkillWithFixtures(
    new BiliChannelSkill(deps()),
    { kind: "playlist", id: "30001", mid: "546195" } as unknown as BiliChannelParams,
    { upstream },
  );

  assert.equal(outcome.expectFailureKind(), "invalid-params");
  assert.equal(upstream.calls.length, 0);
  outcome.provider.assertBalanced();
});

test("矩阵·非法参数：id 缺失 → invalid-params", async () => {
  const upstream = new FakeUpstream().route(SEASON_PATH, { body: biliOk(seasonArchivesPage1Fixture) });
  const outcome = await runSkillWithFixtures(
    new BiliChannelSkill(deps()),
    { kind: "season", mid: "546195" } as unknown as BiliChannelParams,
    { upstream },
  );

  assert.equal(outcome.expectFailureKind(), "invalid-params");
  assert.equal(upstream.calls.length, 0);
  outcome.provider.assertBalanced();
});

test("矩阵·非法参数：mid 缺失 → invalid-params", async () => {
  const upstream = new FakeUpstream().route(SEASON_PATH, { body: biliOk(seasonArchivesPage1Fixture) });
  const outcome = await runSkillWithFixtures(
    new BiliChannelSkill(deps()),
    { kind: "season", id: "30001" } as unknown as BiliChannelParams,
    { upstream },
  );

  assert.equal(outcome.expectFailureKind(), "invalid-params");
  assert.equal(upstream.calls.length, 0);
  outcome.provider.assertBalanced();
});

// ============================================================================
// ④ 正常空集
// ============================================================================

test("正常空集：season 无稿件 → success + items:[]，不重试", async () => {
  const upstream = new FakeUpstream().route(SEASON_PATH, { body: biliOk(seasonArchivesEmptyFixture) });
  const outcome = await runSkillWithFixtures(
    new BiliChannelSkill(deps()),
    { kind: "season", id: "30001", mid: "546195" } as BiliChannelParams,
    { upstream },
  );

  const data = outcome.expectSuccess() as unknown as { items: unknown[] };
  assert.deepEqual(data.items, []);
  assert.equal(
    outcome.upstream.callsMatching(SEASON_PATH).length,
    1,
    "空集不该触发框架重试",
  );
  outcome.provider.assertBalanced();
});

test("正常空集：series 无稿件 → success + items:[]", async () => {
  const upstream = new FakeUpstream().route(SERIES_PATH, { body: biliOk(seriesArchivesEmptyFixture) });
  const data = (
    await runSkillWithFixtures(
      new BiliChannelSkill(deps()),
      { kind: "series", id: "40001", mid: "546195" } as BiliChannelParams,
      { upstream },
    )
  ).expectSuccess() as unknown as { items: unknown[] };

  assert.deepEqual(data.items, []);
});

// ============================================================================
// ⑤ RAII —— 失败路径同样要还租约
// ============================================================================

test("RAII：无论成功失败，页面租约都被释放", async () => {
  for (const [label, upstream] of [
    ["成功", new FakeUpstream().route(SEASON_PATH, { body: biliOk(seasonArchivesPage1Fixture) })],
    ["失败", new FakeUpstream().route(SEASON_PATH, { body: biliErr(-403, "访问权限不足") })],
  ] as const) {
    const outcome = await runSkillWithFixtures(
      new BiliChannelSkill(deps()),
      { kind: "season", id: "30001", mid: "546195" } as BiliChannelParams,
      { upstream },
    );
    outcome.provider.assertBalanced();
    assert.equal(outcome.provider.acquireCount, 1, `${label}路径应只取一次会话`);
    assert.equal(
      outcome.provider.acquisitions[0].releaseCount,
      1,
      `${label}路径的 release 次数应恰好 1`,
    );
  }
});
