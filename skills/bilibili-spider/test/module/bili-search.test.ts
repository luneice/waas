/**
 * bili-search 模块测试（L2，docs/TESTING.md §3.3 标准三件）。
 *
 * 本包与 xhs / cninfo 最大的结构差异：**几乎每个 Goal 的第一跳都是
 * `/x/web-interface/nav`**，用来取当日的 WBI 签名密钥，随后每个业务请求都要
 * 带 `w_rid` + `wts`。这条前置链路是 bilibili 独有的，也是本文件的重点：
 *
 *  1. **两跳顺序**（§②）。nav 必须先于 search，且 search 的 query 必须带上
 *     由 nav 密钥算出的 w_rid。签名错了上游返回 code=-403，不会 HTTP 报错 ——
 *     只测「有没有 w_rid」不够，得测它**确实由 nav 的密钥算出**。
 *
 *  2. **@Expanded 逐页展开 + 跨页去重**（§③）。dynamic_offset 翻页时上游会
 *     重复吐同一条（偏移窗口滑动的真实现象），fixture 里第 1 页第 3 条与
 *     第 2 页第 1 条 bvid 相同，净增只有 1 条。去重逻辑在 aggregate 里，
 *     L1 的投影快照喂的是**聚合后**结果，结构上测不到这一段。
 *
 *  3. **kind 决定解析分支**（§④）。live 的 result 是 `{live_room, live_user}`
 *     分组对象、翻页元数据在 pageinfo；其余 kind 的 result 是数组。同一个
 *     Goal 走两条完全不同的解析路径。
 *
 * 断言纪律（§8 红线）：只锁 `kind` 不锁 message；每个用例尾部
 * `provider.assertBalanced()` —— 失败路径同样必须还租约。
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { testing, createGoalExecutor, type SkillFailureKind } from "@spider/core";

import { BiliSearchSkill } from "@src/skills/search/search.skill";
import type { BiliSearchParams, BiliSearchProjected } from "@src/types/search.types";
import { getMixinKey, md5 } from "@src/thrall/wbi";

import { expectSnapshot } from "../helpers/snapshot";
import {
  biliErr,
  biliOk,
  navFixture,
  navMissingWbiFixture,
  searchLiveRaw,
  searchUserRaw,
  searchVideoEmptyRaw,
  searchVideoPage1Raw,
  searchVideoPage2Raw,
  searchVideoShapeDriftRaw,
} from "../fixtures/search-upstream.fixture";

const { FakeUpstream, runSkillWithFixtures } = testing;

const NAV_PATH = "/x/web-interface/nav";
const SEARCH_PATH = "/x/web-interface/wbi/search/type";

/**
 * 每个用例新建 skill —— harness 会反射改写 deps.sessionProvider，实例不可跨用例复用。
 * goalExecutor 用真实现：L2 测的就是 nav → 签名 → 分页 → 归一化 → 去重 → 投影
 * 这条完整链路，替掉它就只剩薄壳。
 */
const skill = (): BiliSearchSkill =>
  new BiliSearchSkill({
    sessionProvider: undefined as never, // harness 注入
    goalExecutor: createGoalExecutor(),
  });

/** 常规两跳：nav 正常 + search 给定 body（可给多个，按命中次序轮换） */
function upstreamWith(...searchReplies: Array<{ status?: number; body: unknown }>) {
  const up = new FakeUpstream().route(NAV_PATH, { body: biliOk(navFixture) });
  return up.route(SEARCH_PATH, ...searchReplies);
}

function run(
  params: BiliSearchParams,
  upstream: ReturnType<typeof upstreamWith>,
): ReturnType<typeof runSkillWithFixtures<BiliSearchProjected>> {
  return runSkillWithFixtures<BiliSearchProjected>(skill(), params, { upstream });
}

/** 从 URL 取单个 query 值 */
function q(url: string, key: string): string | null {
  return new URL(url, "https://x.example.invalid").searchParams.get(key);
}

/** 错误矩阵一行 */
async function expectKind(
  upstream: ReturnType<typeof upstreamWith>,
  kind: SkillFailureKind,
  label: string,
): Promise<void> {
  const outcome = await run({ keyword: "测试" } as BiliSearchParams, upstream);
  assert.equal(outcome.expectFailureKind(), kind, label);
  outcome.provider.assertBalanced();
}

// ============================================================================
// ① 成功信封
// ============================================================================

test("成功信封：单页 video 搜索全量快照", async () => {
  const outcome = await run(
    { keyword: "测试", kind: "video" } as BiliSearchParams,
    upstreamWith({ body: biliOk(searchVideoPage1Raw) }),
  );

  // 快照锁顶层 SkillResult。⚠ qvId 每次随机生成（generateQvId），会进
  // metadata.params —— 所以这里显式传了固定值，见下一个断言。
  const data = outcome.expectSuccess();
  assert.equal(data.meta.total, 1000);
  assert.equal(data.meta.totalPages, 24);
  assert.equal(data.meta.pagesFetched, 1);
  assert.equal(data.meta.returnedCount, 3);
  assert.equal(data.meta.duplicatesRemoved, 0);
  assert.equal(data.items.length, 3);

  // 上游给命中词包 <em class="keyword">，投影必须剥成纯文本
  assert.equal(data.items[1].title, "盘点测试瞬间");
  assert.ok(
    !JSON.stringify(data).includes("<em"),
    "HTML 高亮标签泄漏到投影输出 —— stripHtml 失效",
  );

  outcome.provider.assertBalanced();
});

test("成功信封：固定 qvId 后可做全量快照（含 metadata.params 回显）", async () => {
  const outcome = await run(
    { keyword: "测试", kind: "video", qvId: "mock-qv-id-0001" } as BiliSearchParams,
    upstreamWith({ body: biliOk(searchVideoPage1Raw) }),
  );
  // qvId 显式给出时 normalizeParams 不再随机生成，快照才稳定
  expectSnapshot("bili-search-envelope", outcome.result);
  outcome.provider.assertBalanced();
});

test("成功信封：噪声字段一个都不许漏出去", async () => {
  const outcome = await run(
    { keyword: "测试", kind: "video" } as BiliSearchParams,
    upstreamWith({ body: biliOk(searchVideoPage1Raw) }),
  );
  const json = JSON.stringify(outcome.expectSuccess());
  for (const leak of [
    "badgepay",
    "cny_flag",
    "hit_columns",
    "new_rec_tags",
    "vt_display",
    "is_union_video",
    "spread_id",
    "watched_show",
  ]) {
    assert.equal(json.includes(leak), false, `上游字段 ${leak} 泄漏 —— 检查是否写了 {...raw}`);
  }
  outcome.provider.assertBalanced();
});

// ============================================================================
// ② WBI 两跳 —— 本包独有的前置链路
// ============================================================================

test("WBI：nav 必须先于 search，且只取一次密钥供多页复用", async () => {
  const upstream = upstreamWith(
    { body: biliOk(searchVideoPage1Raw) },
    { body: biliOk(searchVideoPage2Raw) },
  );
  const outcome = await run(
    { keyword: "测试", kind: "video", maxPages: 2 } as BiliSearchParams,
    upstream,
  );
  outcome.expectSuccess();

  const order = upstream.calls.map((c) =>
    c.url.includes(NAV_PATH) ? "nav" : "search",
  );
  assert.deepEqual(
    order,
    ["nav", "search", "search"],
    "nav 必须是第一跳；密钥应跨页复用而非每页重取",
  );
  outcome.provider.assertBalanced();
});

test("WBI：w_rid 确实由 nav 返回的密钥算出，不是随手填的占位", async () => {
  const upstream = upstreamWith({ body: biliOk(searchVideoPage1Raw) });
  const outcome = await run(
    { keyword: "测试", kind: "video", qvId: "mock-qv-id-0001" } as BiliSearchParams,
    upstream,
  );
  outcome.expectSuccess();

  const url = upstream.callsMatching(SEARCH_PATH)[0].url;
  const wRid = q(url, "w_rid");
  const wts = q(url, "wts");
  assert.ok(wRid && /^[0-9a-f]{32}$/.test(wRid), `w_rid 应是 32 位 md5：${wRid}`);
  assert.ok(wts && Number(wts) > 0, "wts 缺失或非正数");

  // 独立复算一遍：拿 fixture 里 nav 的两个 URL 尾段做 mixinKey，
  // 用请求里除 w_rid 外的全部参数按字典序拼串再 md5。
  // 签名算错时上游只回 code=-403，HTTP 仍是 200 —— 只断言"有 w_rid"抓不到。
  const mixinKey = getMixinKey(
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  );
  const sp = new URL(url, "https://x.example.invalid").searchParams;
  sp.delete("w_rid");
  const query = [...sp.keys()]
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(sp.get(k)).replace(/[!'()*]/g, ""))}`)
    .join("&");
  assert.equal(wRid, md5(query + mixinKey), "w_rid 与本地复算不符 —— 签名链路串了");

  outcome.provider.assertBalanced();
});

test("WBI：nav 缺 wbi_img → upstream-shape-changed，且不再打 search", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navMissingWbiFixture) })
    .route(SEARCH_PATH, { body: biliOk(searchVideoPage1Raw) });
  const outcome = await run({ keyword: "测试" } as BiliSearchParams, upstream);

  // 拿不到密钥就没法签名，继续打 search 只会被上游拒 —— 必须在这里断链
  assert.equal(outcome.expectFailureKind(), "upstream-shape-changed");
  assert.equal(
    upstream.callsMatching(SEARCH_PATH).length,
    0,
    "密钥缺失后不应继续请求业务端点",
  );
  outcome.provider.assertBalanced();
});

// ============================================================================
// ③ 翻页与去重 —— @Expanded 逐页展开
// ============================================================================

test("翻页：maxPages=2 逐页请求，dynamic_offset 按 offsetStep 递增", async () => {
  const upstream = upstreamWith(
    { body: biliOk(searchVideoPage1Raw) },
    { body: biliOk(searchVideoPage2Raw) },
  );
  const outcome = await run(
    { keyword: "测试", kind: "video", maxPages: 2 } as BiliSearchParams,
    upstream,
  );
  outcome.expectSuccess();

  const [c1, c2] = upstream.callsMatching(SEARCH_PATH);
  assert.equal(q(c1.url, "page"), "1");
  assert.equal(q(c1.url, "dynamic_offset"), "0");
  assert.equal(q(c2.url, "page"), "2");
  // offsetStep 默认 24：第 N 页的偏移是 (N-1)*24，与 PC 搜索页行为一致
  assert.equal(q(c2.url, "dynamic_offset"), "24");
  outcome.provider.assertBalanced();
});

test("翻页：跨页重复条目被去重，duplicatesRemoved 如实计数", async () => {
  const outcome = await run(
    { keyword: "测试", kind: "video", maxPages: 2 } as BiliSearchParams,
    upstreamWith(
      { body: biliOk(searchVideoPage1Raw) },
      { body: biliOk(searchVideoPage2Raw) },
    ),
  );

  const data = outcome.expectSuccess();
  // 3 + 2 = 5 条进来，第 2 页首条与第 1 页第 3 条 bvid 相同 → 净 4 条
  assert.equal(data.meta.returnedCount, 4);
  assert.equal(data.meta.duplicatesRemoved, 1, "重复数必须如实上报，不能悄悄吞掉");
  assert.equal(data.items.length, 4);
  assert.equal(
    new Set(data.items.map((it) => it.id)).size,
    4,
    "输出里仍有重复 id —— 去重失效",
  );
  assert.equal(data.meta.pagesFetched, 2);
  outcome.provider.assertBalanced();
});

test("翻页：maxPages 超过硬上限 20 → invalid-params，一次上游都不打", async () => {
  const upstream = upstreamWith({ body: biliOk(searchVideoPage1Raw) });
  const outcome = await run(
    { keyword: "测试", maxPages: 21 } as BiliSearchParams,
    upstream,
  );
  assert.equal(outcome.expectFailureKind(), "invalid-params");
  assert.equal(upstream.calls.length, 0, "参数校验必须早于任何网络请求");
  outcome.provider.assertBalanced();
});

// ============================================================================
// ④ kind 决定解析分支
// ============================================================================

test("分派：live 的 result 是分组对象，翻页元数据取自 pageinfo.live_room", async () => {
  const outcome = await run(
    { keyword: "测试", kind: "live" } as BiliSearchParams,
    upstreamWith({ body: biliOk(searchLiveRaw) }),
  );

  const data = outcome.expectSuccess();
  // 顶层 numResults=0，真值在 pageinfo.live_room.total —— 取错就会报 0 条
  assert.equal(data.meta.total, 621);
  assert.equal(data.meta.totalPages, 15);
  // live_room + live_user 合并成一个列表，靠 type 区分（投影把 itemType 改名为 type）
  assert.equal(data.items.length, 2);
  assert.deepEqual(
    data.items.map((it) => it.type),
    ["live_room", "live_user"],
  );
  // 直播间没有 arcurl，投影按 roomid 兜出 URL
  assert.ok(data.items[0].url?.includes("1787655699"), "直播间 URL 应含 roomid");
  outcome.provider.assertBalanced();
});

test("分派：bili_user 的 stats 是 fans/videos，不是 play/danmaku", async () => {
  const upstream = upstreamWith({ body: biliOk(searchUserRaw) });
  const outcome = await run(
    { keyword: "测试", kind: "bili_user" } as BiliSearchParams,
    upstream,
  );

  const data = outcome.expectSuccess();
  assert.equal(data.items.length, 1);
  assert.deepEqual(data.items[0].stats, { fans: 1234567, videos: 321 });
  // 用户搜索的 id 取 mid，title 取 uname（其余 kind 取 title）
  assert.equal(data.items[0].id, "546195");
  assert.equal(data.items[0].title, "测试用户甲", "uname 的高亮标签应被剥掉");

  // ⚠ 钉住的是**现状而非应然**：normalizer 明明为 bili_user 专门算了
  //   description（走 usign 而非 desc，见 pickDescription），投影层 projectItem
  //   却没把这个字段输出 —— 一路算到底又丢掉。已记为待修缺陷；
  //   修好后本断言应改成 `assert.equal(..., "测试个性签名")`。
  assert.equal(
    (data.items[0] as { description?: string }).description,
    undefined,
    "description 已被投影层输出了？请同步修正本断言",
  );

  // kind 还决定 query：user 有 order_sort/user_type，video 没有
  const url = upstream.callsMatching(SEARCH_PATH)[0].url;
  assert.equal(q(url, "search_type"), "bili_user");
  assert.equal(q(url, "order_sort"), "0");
  assert.equal(q(url, "user_type"), "0");
  assert.equal(q(url, "page_size"), "36", "用户搜索默认 page_size=36，与 video 的 42 不同");
  outcome.provider.assertBalanced();
});

// ============================================================================
// ⑤ 错误 kind 矩阵（§3.3 模板，≥5 场景）
// ============================================================================

test("矩阵·风控拦截页：HTML 顶替 JSON → risk-control，且一次都不重试", async () => {
  const upstream = upstreamWith({
    body:
      '<!DOCTYPE html><html><head><title>验证</title></head>' +
      "<body><div id='captcha'>请完成验证</div></body></html>",
  });
  const outcome = await run({ keyword: "测试" } as BiliSearchParams, upstream);

  assert.equal(outcome.result.success, false);
  assert.equal(
    outcome.expectFailureKind(),
    "risk-control",
    "拦截页必须可判定为风控 —— 落到 endpoint-http 会被当瞬时故障退避重试",
  );
  // 要害：风控不可重试。继续打只会加剧封禁。
  assert.equal(
    upstream.callsMatching(SEARCH_PATH).length,
    1,
    "风控页触发了重试 —— 请检查 isRetryable 短路是否失效",
  );
  outcome.provider.assertBalanced();
});

test("矩阵·空壳响应：0 字节 body 判为可重试，退避一次后恢复", async () => {
  // 与风控页同为 non-json，处置却相反 —— core 按 bodyHead 长度分流：
  // 空壳是上游对超大响应的偶发故障，该退避重试；有内容才是拦截页。
  const upstream = upstreamWith(
    { body: "" },
    { body: biliOk(searchVideoPage1Raw) },
  );
  const outcome = await run({ keyword: "测试" } as BiliSearchParams, upstream);

  assert.equal(outcome.expectSuccess().items.length, 3, "第二次尝试应拿到数据");
  assert.equal(
    upstream.callsMatching(SEARCH_PATH).length,
    2,
    "空壳未被判为可重试 —— 检查 bodyHead 分流",
  );
  outcome.provider.assertBalanced();
});

test("矩阵·HTTP 非 2xx → 走满退避后落 retry-exhausted，首因保留", async () => {
  // ⚠ 本例真的会等满 3 次退避（BILI_GOAL_DEFAULTS.delay=1000）——
  // 慢是它在验证的东西的一部分：可重试 kind 必须真的重试。
  // 退避时长是站点节流基线，不为测试提速而调（调了就测不到真实节奏）。
  const upstream = upstreamWith({ status: 503, body: { msg: "service unavailable" } });
  const outcome = await run({ keyword: "测试" } as BiliSearchParams, upstream);

  assert.equal(outcome.expectFailureKind(), "retry-exhausted");
  assert.equal(
    outcome.result.metadata.errorInfo?.details?.lastKind,
    "endpoint-http",
    "首因必须保留 —— 只报 retry-exhausted 的话 Agent 不知道到底是什么故障",
  );
  assert.equal(
    upstream.callsMatching(SEARCH_PATH).length,
    4,
    "count=3 → 共 4 次尝试",
  );
  outcome.provider.assertBalanced();
});

test("矩阵·业务码 code≠0 → upstream-shape-changed（本包主动校验，不静默降级）", async () => {
  // 值得对照：xhs 的 68/69 个 handler 把 code≠200 吞成空集，
  // bilibili 的 search handler 显式抛错。后者是对的 ——
  // 「上游拒绝了这次查询」与「该筛选下无数据」对 Agent 是两回事。
  await expectKind(
    upstreamWith({ body: biliErr(-400, "请求错误") }),
    "upstream-shape-changed",
    "code=-400",
  );
});

test("矩阵·契约漂移：result 从数组变对象 → upstream-shape-changed", async () => {
  await expectKind(
    upstreamWith({ body: biliOk(searchVideoShapeDriftRaw) }),
    "upstream-shape-changed",
    "result 变对象",
  );
});

test("矩阵·非法参数：keyword 为空 → invalid-params，一次上游都不打", async () => {
  const upstream = upstreamWith({ body: biliOk(searchVideoPage1Raw) });
  const outcome = await run({ keyword: "   " } as BiliSearchParams, upstream);
  assert.equal(outcome.expectFailureKind(), "invalid-params");
  assert.equal(upstream.calls.length, 0, "参数校验必须早于任何网络请求");
  outcome.provider.assertBalanced();
});

test("矩阵·非法参数：kind 不在白名单 → invalid-params", async () => {
  const upstream = upstreamWith({ body: biliOk(searchVideoPage1Raw) });
  const outcome = await run(
    { keyword: "测试", kind: "topic" as never } as BiliSearchParams,
    upstream,
  );
  assert.equal(outcome.expectFailureKind(), "invalid-params");
  assert.equal(upstream.calls.length, 0);
  outcome.provider.assertBalanced();
});

// ============================================================================
// ⑥ 正常空集 —— 「不报错」本身是契约
// ============================================================================

test("正常空集：result=[] + numResults=0 → success + items:[]，不重试", async () => {
  const upstream = upstreamWith({ body: biliOk(searchVideoEmptyRaw) });
  const outcome = await run(
    { keyword: "不存在的关键词" } as BiliSearchParams,
    upstream,
  );

  const data = outcome.expectSuccess();
  assert.deepEqual(data.items, []);
  assert.equal(data.meta.total, 0);
  assert.equal(data.meta.returnedCount, 0);
  assert.equal(data.meta.pagesFetched, 1, "空集也算抓过一页");
  assert.equal(
    upstream.callsMatching(SEARCH_PATH).length,
    1,
    "空集不该触发框架重试",
  );
  outcome.provider.assertBalanced();
});

// ============================================================================
// ⑦ RAII —— 失败路径同样要还租约
// ============================================================================

test("RAII：无论成功失败，页面租约都被释放", async () => {
  const cases: Array<[string, ReturnType<typeof upstreamWith>]> = [
    ["成功", upstreamWith({ body: biliOk(searchVideoPage1Raw) })],
    ["失败", upstreamWith({ body: biliErr(-403, "访问权限不足") })],
  ];
  for (const [label, upstream] of cases) {
    const outcome = await run({ keyword: "测试" } as BiliSearchParams, upstream);
    outcome.provider.assertBalanced();
    assert.equal(outcome.provider.acquireCount, 1, `${label}路径应只取一次会话`);
    assert.equal(
      outcome.provider.acquisitions[0].releaseCount,
      1,
      `${label}路径的 release 次数应恰好 1（漏放会泄漏 Page，多放说明 finally 与 catch 重复兜底）`,
    );
  }
});
