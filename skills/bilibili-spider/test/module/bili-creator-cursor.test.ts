/**
 * creator 模块测试（channels / articles / feed，L2，docs/TESTING.md §3.3 标准三件）。
 *
 * 覆盖本模块两种未被 profile/videos/audios 覆盖的翻页范式：
 *   - **channels**：无 WBI + page 类翻页（page_num/page_size），与 videos 的
 *     WBI 版本形成对照；合集(season)/系列(series)按 `kind:id` 去重；
 *   - **articles / feed**：WBI + **offset 游标翻页**——单次执行只抓一页，
 *     结果含 `nextOffset`/`hasMore`，由调用方携带 offset 续取（与 dedao
 *     续取范式对齐，docs/TESTING.md §3.3 强调这是与 page 类完全不同的
 *     翻页语义：没有 maxPages，一次调用一页）。
 *
 * 断言纪律（§8 红线）：只锁 `kind` 不锁 message；每个用例尾部
 * `provider.assertBalanced()`。
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { testing, createGoalExecutor, type SkillFailureKind } from "@spider/core";

import { BiliCreatorChannelsSkill } from "@src/skills/creator/channels.skill";
import type { BiliCreatorChannelsParams } from "@src/types/creator.types";
import { BiliCreatorArticlesSkill } from "@src/skills/creator/articles.skill";
import type { BiliCreatorArticlesParams } from "@src/types/creator.types";
import { BiliCreatorFeedSkill } from "@src/skills/creator/feed.skill";
import type { BiliCreatorFeedParams } from "@src/types/creator.types";

import { expectSnapshot } from "../helpers/snapshot";
import {
  biliOk,
  biliErr,
  navFixture,
  navMissingWbiFixture,
  seasonsSeriesPage1Fixture,
  seasonsSeriesPage2Fixture,
  seasonsSeriesEmptyFixture,
  seasonsSeriesShapeDriftFixture,
  opusFeedPage1Fixture,
  opusFeedPage2Fixture,
  opusFeedEmptyFixture,
  opusFeedShapeDriftFixture,
  dynamicFeedPage1Fixture,
  dynamicFeedEmptyFixture,
  dynamicFeedShapeDriftFixture,
} from "../fixtures/creator-cursor.fixture";

const { FakeUpstream, runSkillWithFixtures } = testing;

const NAV_PATH = "/x/web-interface/nav";
const CHANNELS_PATH = "/x/polymer/web-space/seasons_series_list";
const ARTICLES_PATH = "/x/polymer/web-dynamic/v1/opus/feed/space";
const FEED_PATH = "/x/polymer/web-dynamic/v1/feed/space";

const deps = () => ({
  sessionProvider: undefined as never, // harness 注入
  goalExecutor: createGoalExecutor(),
});

// ============================================================================
// ① 成功信封
// ============================================================================

test("成功信封：channels 合并 season+series，按 kind:id 去重", async () => {
  const upstream = new FakeUpstream().route(CHANNELS_PATH, { body: biliOk(seasonsSeriesPage1Fixture) });
  const outcome = await runSkillWithFixtures(
    new BiliCreatorChannelsSkill(deps()),
    { mid: "546195" } as BiliCreatorChannelsParams,
    { upstream },
  );

  expectSnapshot("bili-creator-channels-envelope", outcome.result);

  const data = outcome.expectSuccess() as unknown as {
    meta: { skill: string; total: number | null };
    items: Array<{ kind: string; id: number }>;
  };
  assert.equal(data.meta.skill, "bili-creator-channels");
  assert.equal(data.meta.total, 3);
  assert.equal(data.items.length, 2, "1 个 season + 1 个 series");
  assert.deepEqual(
    data.items.map((it) => it.kind),
    ["season", "series"],
  );
  assert.equal(
    upstream.callsMatching(NAV_PATH).length,
    0,
    "channels 无 WBI 签名，不该触发 nav 请求",
  );
  outcome.provider.assertBalanced();
});

test("成功信封：articles 单页返回 + nextOffset/hasMore 续取信号", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(ARTICLES_PATH, { body: biliOk(opusFeedPage1Fixture) });
  const outcome = await runSkillWithFixtures(
    new BiliCreatorArticlesSkill(deps()),
    { mid: "546195" } as BiliCreatorArticlesParams,
    { upstream },
  );

  expectSnapshot("bili-creator-articles-envelope", outcome.result);

  const data = outcome.expectSuccess() as unknown as {
    meta: { skill: string; pagesFetched: number; nextOffset: string | null; hasMore: boolean };
    items: unknown[];
  };
  assert.equal(data.meta.skill, "bili-creator-articles");
  assert.equal(data.meta.pagesFetched, 1, "单次执行只抓一页，与 page 类不同");
  assert.equal(data.meta.hasMore, true);
  assert.equal(data.meta.nextOffset, "opus-offset-0001");
  assert.equal(data.items.length, 2);
  outcome.provider.assertBalanced();
});

test("成功信封：feed 混合时间线（archive/word/forward），按 kind 分类", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(FEED_PATH, { body: biliOk(dynamicFeedPage1Fixture) });
  const outcome = await runSkillWithFixtures(
    new BiliCreatorFeedSkill(deps()),
    { mid: "546195" } as BiliCreatorFeedParams,
    { upstream },
  );

  expectSnapshot("bili-creator-feed-envelope", outcome.result);

  const data = outcome.expectSuccess() as unknown as {
    meta: { skill: string };
    items: Array<{ kind: string }>;
  };
  assert.equal(data.meta.skill, "bili-creator-feed");
  assert.equal(data.items.length, 3);
  assert.deepEqual(
    data.items.map((it) => it.kind),
    ["archive", "word", "forward"],
  );
  outcome.provider.assertBalanced();
});

// ============================================================================
// ② 翻页 —— 两种范式对照
// ============================================================================

test("翻页：channels 是 page 类，maxPages=2 逐页请求 page_num", async () => {
  const upstream = new FakeUpstream().route(
    CHANNELS_PATH,
    { body: biliOk(seasonsSeriesPage1Fixture) },
    { body: biliOk(seasonsSeriesPage2Fixture) },
  );
  const data = (
    await runSkillWithFixtures(
      new BiliCreatorChannelsSkill(deps()),
      { mid: "546195", maxPages: 2 } as BiliCreatorChannelsParams,
      { upstream },
    )
  ).expectSuccess() as unknown as { items: unknown[] };

  // page1: 1 season + 1 series；page2: 1 season（不同 id，不重复）
  assert.equal(data.items.length, 3);
  assert.equal(upstream.callsMatching(CHANNELS_PATH).length, 2);
});

test("翻页：articles/feed 是 offset 游标类，续取需显式传上一次的 nextOffset", async () => {
  // 第一次调用：不传 offset，拿到 page1 + nextOffset
  const upstream1 = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(ARTICLES_PATH, { body: biliOk(opusFeedPage1Fixture) });
  const first = (
    await runSkillWithFixtures(
      new BiliCreatorArticlesSkill(deps()),
      { mid: "546195" } as BiliCreatorArticlesParams,
      { upstream: upstream1 },
    )
  ).expectSuccess() as unknown as { meta: { nextOffset: string | null; hasMore: boolean } };
  assert.equal(first.meta.hasMore, true);
  const cursor = first.meta.nextOffset;
  assert.ok(cursor, "第一次调用应返回可续取的 nextOffset");

  // 第二次调用：显式传 offset，验证请求带上了游标
  const upstream2 = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(ARTICLES_PATH, { body: biliOk(opusFeedPage2Fixture) });
  const second = (
    await runSkillWithFixtures(
      new BiliCreatorArticlesSkill(deps()),
      { mid: "546195", offset: cursor as string } as BiliCreatorArticlesParams,
      { upstream: upstream2 },
    )
  ).expectSuccess() as unknown as { meta: { hasMore: boolean; pagesFetched: number } };
  assert.equal(second.meta.hasMore, false, "第二页 has_more=false 应终止续取");
  assert.equal(second.meta.pagesFetched, 1, "offset 游标类每次调用只算一页，不是累计");

  const call = upstream2.callsMatching(ARTICLES_PATH)[0];
  assert.ok(
    new URL(call.url, "https://x.example.invalid").searchParams.get("offset") === cursor,
    "续取请求应带上第一次返回的 nextOffset",
  );
});

test("翻页：channels maxPages 超过硬上限 20 → invalid-params", async () => {
  const upstream = new FakeUpstream().route(CHANNELS_PATH, { body: biliOk(seasonsSeriesPage1Fixture) });
  const outcome = await runSkillWithFixtures(
    new BiliCreatorChannelsSkill(deps()),
    { mid: "546195", maxPages: 21 } as BiliCreatorChannelsParams,
    { upstream },
  );

  assert.equal(outcome.expectFailureKind(), "invalid-params");
  assert.equal(upstream.calls.length, 0, "参数校验必须早于任何网络请求");
  outcome.provider.assertBalanced();
});

// ============================================================================
// ③ 错误 kind 矩阵（集中在 articles，代表 WBI + offset 游标组合的通用故障路径）
// ============================================================================

test("矩阵·风控拦截页：HTML 顶替 JSON → risk-control，不重试", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(ARTICLES_PATH, {
      body: '<!DOCTYPE html><html><head><title>验证</title></head><body><div id="captcha">请完成验证</div></body></html>',
    });
  const outcome = await runSkillWithFixtures(
    new BiliCreatorArticlesSkill(deps()),
    { mid: "546195" } as BiliCreatorArticlesParams,
    { upstream },
  );

  assert.equal(outcome.expectFailureKind(), "risk-control");
  assert.equal(upstream.callsMatching(ARTICLES_PATH).length, 1);
  outcome.provider.assertBalanced();
});

test("矩阵·空壳响应：0 字节 body 判为可重试", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(ARTICLES_PATH, { body: "" }, { body: biliOk(opusFeedPage1Fixture) });
  const outcome = await runSkillWithFixtures(
    new BiliCreatorArticlesSkill(deps()),
    { mid: "546195" } as BiliCreatorArticlesParams,
    { upstream },
  );

  assert.equal(outcome.result.success, true);
  assert.equal(upstream.callsMatching(ARTICLES_PATH).length, 2);
  outcome.provider.assertBalanced();
});

test("矩阵·HTTP 非 2xx → 走满退避后落 retry-exhausted", async () => {
  // ⚠ 真的会等满 3 次退避（BILI_GOAL_DEFAULTS.delay=1000）。
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(ARTICLES_PATH, { status: 503, body: { msg: "unavailable" } });
  const outcome = await runSkillWithFixtures(
    new BiliCreatorArticlesSkill(deps()),
    { mid: "546195" } as BiliCreatorArticlesParams,
    { upstream },
  );

  assert.equal(outcome.expectFailureKind(), "retry-exhausted");
  assert.equal(upstream.callsMatching(ARTICLES_PATH).length, 4, "count=3 → 共 4 次尝试");
  outcome.provider.assertBalanced();
});

test("矩阵·业务码 code≠0 → upstream-shape-changed（articles/feed 都主动校验）", async () => {
  const upstreamArticles = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(ARTICLES_PATH, { body: biliErr(-400, "请求错误") });
  const outcomeArticles = await runSkillWithFixtures(
    new BiliCreatorArticlesSkill(deps()),
    { mid: "546195" } as BiliCreatorArticlesParams,
    { upstream: upstreamArticles },
  );
  assert.equal(outcomeArticles.expectFailureKind(), "upstream-shape-changed");
  outcomeArticles.provider.assertBalanced();

  const upstreamFeed = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(FEED_PATH, { body: biliErr(-400, "请求错误") });
  const outcomeFeed = await runSkillWithFixtures(
    new BiliCreatorFeedSkill(deps()),
    { mid: "546195" } as BiliCreatorFeedParams,
    { upstream: upstreamFeed },
  );
  assert.equal(outcomeFeed.expectFailureKind(), "upstream-shape-changed");
  outcomeFeed.provider.assertBalanced();
});

test("矩阵·契约漂移：items 从数组变成对象 → 宽容降级为空集，不崩溃", async () => {
  // 与 profile/videos/audios 同款正向现状：aggregate 用
  // `Array.isArray(data.items) ? data.items : []` 兜底，非数组时安全降级。
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(ARTICLES_PATH, { body: biliOk(opusFeedShapeDriftFixture) });
  const outcome = await runSkillWithFixtures(
    new BiliCreatorArticlesSkill(deps()),
    { mid: "546195" } as BiliCreatorArticlesParams,
    { upstream },
  );

  assert.equal(outcome.result.success, true, "非数组 items 不该让整个 Skill 崩溃");
  const data = outcome.expectSuccess() as unknown as { items: unknown[] };
  assert.deepEqual(data.items, []);
  outcome.provider.assertBalanced();
});

test("矩阵·channels 契约漂移：seasons_list 从数组变成对象 → 宽容降级", async () => {
  const upstream = new FakeUpstream().route(CHANNELS_PATH, { body: biliOk(seasonsSeriesShapeDriftFixture) });
  const outcome = await runSkillWithFixtures(
    new BiliCreatorChannelsSkill(deps()),
    { mid: "546195" } as BiliCreatorChannelsParams,
    { upstream },
  );

  assert.equal(outcome.result.success, true);
  const data = outcome.expectSuccess() as unknown as { items: unknown[] };
  // series_list 仍是空数组，season 那半因非数组被跳过 → 整体为空
  assert.deepEqual(data.items, []);
  outcome.provider.assertBalanced();
});

test("矩阵·nav 缺 wbi_img → upstream-shape-changed，且不再打业务端点", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navMissingWbiFixture) })
    .route(ARTICLES_PATH, { body: biliOk(opusFeedPage1Fixture) });
  const outcome = await runSkillWithFixtures(
    new BiliCreatorArticlesSkill(deps()),
    { mid: "546195" } as BiliCreatorArticlesParams,
    { upstream },
  );

  assert.equal(outcome.expectFailureKind(), "upstream-shape-changed");
  assert.equal(upstream.callsMatching(ARTICLES_PATH).length, 0);
  outcome.provider.assertBalanced();
});

test("矩阵·非法参数：mid 缺失 → invalid-params，一次上游都不打", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(ARTICLES_PATH, { body: biliOk(opusFeedPage1Fixture) });
  const outcome = await runSkillWithFixtures(
    new BiliCreatorArticlesSkill(deps()),
    {} as BiliCreatorArticlesParams,
    { upstream },
  );

  assert.equal(outcome.expectFailureKind(), "invalid-params");
  assert.equal(upstream.calls.length, 0);
  outcome.provider.assertBalanced();
});

// ============================================================================
// ④ 正常空集
// ============================================================================

test("正常空集：channels 无合集系列 → success + items:[]", async () => {
  const upstream = new FakeUpstream().route(CHANNELS_PATH, { body: biliOk(seasonsSeriesEmptyFixture) });
  const outcome = await runSkillWithFixtures(
    new BiliCreatorChannelsSkill(deps()),
    { mid: "546195" } as BiliCreatorChannelsParams,
    { upstream },
  );

  const data = outcome.expectSuccess() as unknown as { items: unknown[] };
  assert.deepEqual(data.items, []);
  assert.equal(
    outcome.upstream.callsMatching(CHANNELS_PATH).length,
    1,
    "空集不该触发框架重试",
  );
  outcome.provider.assertBalanced();
});

test("正常空集：articles 无公开图文 → success + items:[]，insights 明确提示", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(ARTICLES_PATH, { body: biliOk(opusFeedEmptyFixture) });
  const data = (
    await runSkillWithFixtures(
      new BiliCreatorArticlesSkill(deps()),
      { mid: "546195" } as BiliCreatorArticlesParams,
      { upstream },
    )
  ).expectSuccess() as unknown as { items: unknown[]; insights: string[] };

  assert.deepEqual(data.items, []);
  assert.ok(data.insights.some((s) => s.includes("无公开图文")));
});

test("正常空集：feed 无公开动态 → success + items:[]", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(FEED_PATH, { body: biliOk(dynamicFeedEmptyFixture) });
  const data = (
    await runSkillWithFixtures(
      new BiliCreatorFeedSkill(deps()),
      { mid: "546195" } as BiliCreatorFeedParams,
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
    [
      "成功",
      new FakeUpstream()
        .route(NAV_PATH, { body: biliOk(navFixture) })
        .route(ARTICLES_PATH, { body: biliOk(opusFeedPage1Fixture) }),
    ],
    [
      "失败",
      new FakeUpstream()
        .route(NAV_PATH, { body: biliOk(navFixture) })
        .route(ARTICLES_PATH, { body: biliErr(-403, "访问权限不足") }),
    ],
  ] as const) {
    const outcome = await runSkillWithFixtures(
      new BiliCreatorArticlesSkill(deps()),
      { mid: "546195" } as BiliCreatorArticlesParams,
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
