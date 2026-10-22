/**
 * creator 模块测试（profile / videos / audios，L2，docs/TESTING.md §3.3 标准三件）。
 *
 * 覆盖本模块三种代表性形态：
 *   - **profile**：7 端点聚合（1 个 nav 前置 + 6 个业务端点，互不依赖，
 *     只有 acc/info 依赖 nav 做 WBI 签名），含隐私墙（53013）降级。
 *   - **videos**：WBI 签名 + `@Expanded` 按 page+maxPages 生成页号逐页抓取，
 *     跨页按 aid 去重（与 bili-search 同一套 dedupeBy 范式）。
 *   - **audios**：无 WBI，同样是 `@Expanded` page 类翻页，按 auid 去重。
 *
 * 断言纪律（§8 红线）：只锁 `kind` 不锁 message；每个用例尾部
 * `provider.assertBalanced()`。
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { testing, createGoalExecutor, type SkillFailureKind } from "@spider/core";

import { BiliCreatorSkill } from "@src/skills/creator/profile.skill";
import { BiliCreatorVideosSkill } from "@src/skills/creator/videos.skill";
import type { BiliCreatorVideosParams } from "@src/types/creator.types";
import { BiliCreatorAudiosSkill } from "@src/skills/creator/audios.skill";
import type { BiliCreatorAudiosParams } from "@src/types/creator.types";

import { expectSnapshot } from "../helpers/snapshot";
import {
  biliOk,
  biliErr,
  navFixture,
  navMissingWbiFixture,
  accInfoFixture,
  relationStatFixture,
  upstatFixture,
  navnumFixture,
  noticeFixture,
  masterpieceFixture,
  masterpiecePrivacyFixture,
  arcSearchPage1Fixture,
  arcSearchPage2Fixture,
  arcSearchEmptyFixture,
  arcSearchShapeDriftFixture,
  songUpperPage1Fixture,
  songUpperPage2Fixture,
  songUpperEmptyFixture,
  songUpperShapeDriftFixture,
} from "../fixtures/creator-upstream.fixture";

const { FakeUpstream, runSkillWithFixtures } = testing;

const NAV_PATH = "/x/web-interface/nav";
const ACC_INFO_PATH = "/x/space/wbi/acc/info";
const RELATION_STAT_PATH = "/x/relation/stat";
const UPSTAT_PATH = "/x/space/upstat";
const NAVNUM_PATH = "/x/space/navnum";
const NOTICE_PATH = "/x/space/notice";
const MASTERPIECE_PATH = "/x/space/masterpiece";
const ARC_SEARCH_PATH = "/x/space/wbi/arc/search";
const SONG_UPPER_PATH = "/audio/music-service/web/song/upper";

const deps = () => ({
  sessionProvider: undefined as never, // harness 注入
  goalExecutor: createGoalExecutor(),
});

/** profile 常规装配：nav + 6 个业务端点各给一份数据 */
function profileUpstream(masterpieceReply: unknown = biliOk(masterpieceFixture)): InstanceType<typeof FakeUpstream> {
  return new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(ACC_INFO_PATH, { body: biliOk(accInfoFixture) })
    .route(RELATION_STAT_PATH, { body: biliOk(relationStatFixture) })
    .route(UPSTAT_PATH, { body: biliOk(upstatFixture) })
    .route(NAVNUM_PATH, { body: biliOk(navnumFixture) })
    .route(NOTICE_PATH, { body: biliOk(noticeFixture) })
    .route(MASTERPIECE_PATH, { body: masterpieceReply });
}

// ============================================================================
// ① 成功信封
// ============================================================================

test("成功信封：profile 聚合 7 端点（nav + 6 业务端点）", async () => {
  const outcome = await runSkillWithFixtures(
    new BiliCreatorSkill(deps()),
    { mid: "546195" },
    { upstream: profileUpstream() },
  );

  expectSnapshot("bili-creator-profile-envelope", outcome.result);

  const data = outcome.expectSuccess() as unknown as {
    meta: { skill: string; mid: string };
    detail: { name: string; relation: { follower: number } };
  };
  assert.equal(data.meta.skill, "bili-creator");
  assert.equal(data.meta.mid, "546195");
  assert.equal(data.detail.name, "测试UP主甲");
  assert.equal(data.detail.relation.follower, 500000);
  outcome.provider.assertBalanced();
});

test("成功信封：videos 全量快照 + WBI 签名 + 跨页去重", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(ARC_SEARCH_PATH, { body: biliOk(arcSearchPage1Fixture) }, { body: biliOk(arcSearchPage2Fixture) });
  const outcome = await runSkillWithFixtures(
    new BiliCreatorVideosSkill(deps()),
    { mid: "546195", maxPages: 2 } as BiliCreatorVideosParams,
    { upstream },
  );

  expectSnapshot("bili-creator-videos-envelope", outcome.result);

  const data = outcome.expectSuccess() as unknown as {
    meta: { skill: string; total: number | null; returnedCount: number; duplicatesRemoved: number };
    items: unknown[];
  };
  assert.equal(data.meta.skill, "bili-creator-videos");
  assert.equal(data.meta.total, 300);
  // 2(page1) + 2(page2) = 4 条进来，page2 首条与 page1 第 2 条 aid 相同 → 净 3 条
  assert.equal(data.meta.returnedCount, 3);
  assert.equal(data.meta.duplicatesRemoved, 1);
  assert.equal(data.items.length, 3);
  outcome.provider.assertBalanced();
});

test("成功信封：audios 全量快照（无 WBI）", async () => {
  const upstream = new FakeUpstream().route(SONG_UPPER_PATH, { body: biliOk(songUpperPage1Fixture) });
  const outcome = await runSkillWithFixtures(
    new BiliCreatorAudiosSkill(deps()),
    { mid: "546195" } as BiliCreatorAudiosParams,
    { upstream },
  );

  expectSnapshot("bili-creator-audios-envelope", outcome.result);

  const data = outcome.expectSuccess() as unknown as {
    meta: { skill: string; total: number | null; returnedCount: number };
    items: unknown[];
  };
  assert.equal(data.meta.skill, "bili-creator-audios");
  assert.equal(data.meta.total, 60);
  assert.equal(data.meta.returnedCount, 2);
  assert.equal(data.items.length, 2);
  assert.equal(
    upstream.callsMatching(NAV_PATH).length,
    0,
    "audios 无 WBI 签名，不该触发 nav 请求",
  );
  outcome.provider.assertBalanced();
});

test("成功信封：profile 命中隐私墙 → masterpiece 降级为空数组，不报错", async () => {
  const outcome = await runSkillWithFixtures(
    new BiliCreatorSkill(deps()),
    { mid: "546195" },
    { upstream: profileUpstream(masterpiecePrivacyFixture as unknown) },
  );

  const data = outcome.expectSuccess() as unknown as {
    detail: { masterpiece: unknown[] };
  };
  assert.deepEqual(data.detail.masterpiece, []);
  outcome.provider.assertBalanced();
});

// ============================================================================
// ② 翻页（page 类：page/maxPages）
// ============================================================================

test("翻页：videos maxPages=2 逐页请求 pn，密钥只取一次跨页复用", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(ARC_SEARCH_PATH, { body: biliOk(arcSearchPage1Fixture) }, { body: biliOk(arcSearchPage2Fixture) });
  await runSkillWithFixtures(
    new BiliCreatorVideosSkill(deps()),
    { mid: "546195", maxPages: 2 } as BiliCreatorVideosParams,
    { upstream },
  );

  const order = upstream.calls.map((c) => (c.url.includes(NAV_PATH) ? "nav" : "arc"));
  assert.deepEqual(order, ["nav", "arc", "arc"], "nav 应只取一次密钥，跨页复用");

  const [c1, c2] = upstream.callsMatching(ARC_SEARCH_PATH);
  assert.ok(new URL(c1.url, "https://x.example.invalid").searchParams.get("pn") === "1");
  assert.ok(new URL(c2.url, "https://x.example.invalid").searchParams.get("pn") === "2");
});

test("翻页：audios maxPages=2 逐页请求 pn", async () => {
  const upstream = new FakeUpstream().route(
    SONG_UPPER_PATH,
    { body: biliOk(songUpperPage1Fixture) },
    { body: biliOk(songUpperPage2Fixture) },
  );
  const data = (
    await runSkillWithFixtures(
      new BiliCreatorAudiosSkill(deps()),
      { mid: "546195", maxPages: 2 } as BiliCreatorAudiosParams,
      { upstream },
    )
  ).expectSuccess() as unknown as { items: unknown[] };

  // 2(page1) + 1(page2) = 3 条全部合并（无重复 auid）
  assert.equal(data.items.length, 3);
  assert.equal(upstream.callsMatching(SONG_UPPER_PATH).length, 2);
});

test("翻页：maxPages 超过硬上限 20 → invalid-params，一次上游都不打", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(ARC_SEARCH_PATH, { body: biliOk(arcSearchPage1Fixture) });
  const outcome = await runSkillWithFixtures(
    new BiliCreatorVideosSkill(deps()),
    { mid: "546195", maxPages: 21 } as BiliCreatorVideosParams,
    { upstream },
  );

  assert.equal(outcome.expectFailureKind(), "invalid-params");
  assert.equal(upstream.calls.length, 0, "参数校验必须早于任何网络请求");
  outcome.provider.assertBalanced();
});

// ============================================================================
// ③ 错误 kind 矩阵（集中在 videos，代表 WBI 签名 + 翻页组合的通用故障路径）
// ============================================================================

test("矩阵·风控拦截页：HTML 顶替 JSON → risk-control，不重试", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(ARC_SEARCH_PATH, {
      body: '<!DOCTYPE html><html><head><title>验证</title></head><body><div id="captcha">请完成验证</div></body></html>',
    });
  const outcome = await runSkillWithFixtures(
    new BiliCreatorVideosSkill(deps()),
    { mid: "546195" } as BiliCreatorVideosParams,
    { upstream },
  );

  assert.equal(outcome.expectFailureKind(), "risk-control");
  assert.equal(upstream.callsMatching(ARC_SEARCH_PATH).length, 1);
  outcome.provider.assertBalanced();
});

test("矩阵·空壳响应：0 字节 body 判为可重试，退避一次后恢复", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(ARC_SEARCH_PATH, { body: "" }, { body: biliOk(arcSearchPage1Fixture) });
  const outcome = await runSkillWithFixtures(
    new BiliCreatorVideosSkill(deps()),
    { mid: "546195" } as BiliCreatorVideosParams,
    { upstream },
  );

  assert.equal(outcome.result.success, true);
  assert.equal(upstream.callsMatching(ARC_SEARCH_PATH).length, 2);
  outcome.provider.assertBalanced();
});

test("矩阵·HTTP 非 2xx → 走满退避后落 retry-exhausted，首因保留", async () => {
  // ⚠ 真的会等满 3 次退避（BILI_GOAL_DEFAULTS.delay=1000，比 xhs 快很多）。
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(ARC_SEARCH_PATH, { status: 503, body: { msg: "unavailable" } });
  const outcome = await runSkillWithFixtures(
    new BiliCreatorVideosSkill(deps()),
    { mid: "546195" } as BiliCreatorVideosParams,
    { upstream },
  );

  assert.equal(outcome.expectFailureKind(), "retry-exhausted");
  assert.equal(
    outcome.result.metadata.errorInfo?.details?.lastKind,
    "endpoint-http",
  );
  assert.equal(upstream.callsMatching(ARC_SEARCH_PATH).length, 4, "count=3 → 共 4 次尝试");
  outcome.provider.assertBalanced();
});

test("矩阵·业务码 code≠0 → upstream-shape-changed（本包主动校验，不静默降级）", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(ARC_SEARCH_PATH, { body: biliErr(-400, "请求错误") });
  const outcome = await runSkillWithFixtures(
    new BiliCreatorVideosSkill(deps()),
    { mid: "546195" } as BiliCreatorVideosParams,
    { upstream },
  );

  assert.equal(outcome.expectFailureKind(), "upstream-shape-changed");
  outcome.provider.assertBalanced();
});

test("矩阵·契约漂移：vlist 从数组变成对象 → 宽容降级为空集，不崩溃", async () => {
  // 与 xhs 多个模块的同类正向现状一致：fetchArcPage 显式
  // `Array.isArray(data.list?.vlist) ? data.list.vlist : []` 判断，非数组时
  // 安全降级为空数组，不抛异常。total/partitions 等其余字段仍会正常透出。
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(ARC_SEARCH_PATH, { body: biliOk(arcSearchShapeDriftFixture) });
  const outcome = await runSkillWithFixtures(
    new BiliCreatorVideosSkill(deps()),
    { mid: "546195" } as BiliCreatorVideosParams,
    { upstream },
  );

  assert.equal(outcome.result.success, true, "非数组 vlist 不该让整个 Skill 崩溃");
  const data = outcome.expectSuccess() as unknown as { items: unknown[] };
  assert.deepEqual(data.items, []);
  outcome.provider.assertBalanced();
});

test("矩阵·audios 契约漂移：data 从数组变成对象 → 宽容降级为空集，不崩溃", async () => {
  const upstream = new FakeUpstream().route(SONG_UPPER_PATH, { body: biliOk(songUpperShapeDriftFixture) });
  const outcome = await runSkillWithFixtures(
    new BiliCreatorAudiosSkill(deps()),
    { mid: "546195" } as BiliCreatorAudiosParams,
    { upstream },
  );

  assert.equal(outcome.result.success, true, "非数组 data 不该让整个 Skill 崩溃");
  const data = outcome.expectSuccess() as unknown as { items: unknown[] };
  assert.deepEqual(data.items, []);
  outcome.provider.assertBalanced();
});

test("矩阵·nav 缺 wbi_img → upstream-shape-changed，且不再打业务端点", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navMissingWbiFixture) })
    .route(ARC_SEARCH_PATH, { body: biliOk(arcSearchPage1Fixture) });
  const outcome = await runSkillWithFixtures(
    new BiliCreatorVideosSkill(deps()),
    { mid: "546195" } as BiliCreatorVideosParams,
    { upstream },
  );

  assert.equal(outcome.expectFailureKind(), "upstream-shape-changed");
  assert.equal(upstream.callsMatching(ARC_SEARCH_PATH).length, 0);
  outcome.provider.assertBalanced();
});

test("矩阵·非法参数：mid 缺失 → invalid-params，一次上游都不打", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(ARC_SEARCH_PATH, { body: biliOk(arcSearchPage1Fixture) });
  const outcome = await runSkillWithFixtures(
    new BiliCreatorVideosSkill(deps()),
    {} as BiliCreatorVideosParams,
    { upstream },
  );

  assert.equal(outcome.expectFailureKind(), "invalid-params");
  assert.equal(upstream.calls.length, 0);
  outcome.provider.assertBalanced();
});

test("矩阵·非法参数：order 不在白名单 → invalid-params", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(ARC_SEARCH_PATH, { body: biliOk(arcSearchPage1Fixture) });
  const outcome = await runSkillWithFixtures(
    new BiliCreatorVideosSkill(deps()),
    { mid: "546195", order: "hot" as never } as BiliCreatorVideosParams,
    { upstream },
  );

  assert.equal(outcome.expectFailureKind(), "invalid-params");
  assert.equal(upstream.calls.length, 0);
  outcome.provider.assertBalanced();
});

// ============================================================================
// ④ 正常空集
// ============================================================================

test("正常空集：videos vlist=[] → success + items:[]，不重试", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(ARC_SEARCH_PATH, { body: biliOk(arcSearchEmptyFixture) });
  const outcome = await runSkillWithFixtures(
    new BiliCreatorVideosSkill(deps()),
    { mid: "546195" } as BiliCreatorVideosParams,
    { upstream },
  );

  const data = outcome.expectSuccess() as unknown as { items: unknown[] };
  assert.deepEqual(data.items, []);
  assert.equal(
    outcome.upstream.callsMatching(ARC_SEARCH_PATH).length,
    1,
    "空集不该触发框架重试",
  );
  outcome.provider.assertBalanced();
});

test("正常空集：audios data=[] → success + items:[]", async () => {
  const upstream = new FakeUpstream().route(SONG_UPPER_PATH, { body: biliOk(songUpperEmptyFixture) });
  const data = (
    await runSkillWithFixtures(
      new BiliCreatorAudiosSkill(deps()),
      { mid: "546195" } as BiliCreatorAudiosParams,
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
        .route(ARC_SEARCH_PATH, { body: biliOk(arcSearchPage1Fixture) }),
    ],
    [
      "失败",
      new FakeUpstream()
        .route(NAV_PATH, { body: biliOk(navFixture) })
        .route(ARC_SEARCH_PATH, { body: biliErr(-403, "访问权限不足") }),
    ],
  ] as const) {
    const outcome = await runSkillWithFixtures(
      new BiliCreatorVideosSkill(deps()),
      { mid: "546195" } as BiliCreatorVideosParams,
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
