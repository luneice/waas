/**
 * comment 模块测试（bili-comments，L2，docs/TESTING.md §3.3 标准三件）。
 *
 * 本模块是全包最复杂的独立模块：
 *   - 评论区定位是**策略模式**（direct/article 纯解析，video/opus 需一次页内
 *     fetch 换 oid+type），由 `CommentSubjectResolver` 按入参形态委派；
 *   - 主楼抓取是 offset 游标类，但与 creator articles/feed（单次 execute()
 *     只抓一页）不同：本 Skill 在**单次 execute() 内部**按 maxPages 循环
 *     连抓（crawlPages），更接近 videos/audios 的"一次调用拿多页"语义，
 *     只是分页参数是 offset 字符串而非 page_num；
 *   - includeReplies=true 时逐条主楼再发一次楼中楼请求（无 WBI）；
 *   - 含配图落盘产物，用 `runSkillWithFixtures` 的 `storageRoot` 断言真实写入。
 *
 * 断言纪律（§8 红线）：只锁 `kind` 不锁 message；每个用例尾部
 * `provider.assertBalanced()`。
 */
import { test, beforeEach, afterEach } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { testing, createGoalExecutor } from "@spider/core";

import { BiliCommentsSkill } from "@src/skills/comment/extract.skill";
import type { BiliCommentParams } from "@src/types/comment.types";

import { expectSnapshot } from "../helpers/snapshot";
import {
  biliOk,
  biliErr,
  navFixture,
  mainPage1Fixture,
  mainPage2Fixture,
  mainEmptyFixture,
  mainShapeDriftFixture,
  repliesPageFixture,
  viewFixture,
  viewNotFoundFixture,
  dynamicDetailFixture,
  dynamicDetailMissingFixture,
  tinyPngReply,
} from "../fixtures/comment.fixture";

const { FakeUpstream, runSkillWithFixtures } = testing;

const NAV_PATH = "/x/web-interface/nav";
const MAIN_PATH = "/x/v2/reply/wbi/main";
const REPLIES_PATH = "/x/v2/reply/reply";
const VIEW_PATH = "/x/web-interface/view";
const DYNAMIC_DETAIL_PATH = "/x/polymer/web-dynamic/v1/detail";
const IMAGE_URL = "https://img.example.invalid/bfs/comment/mock-1000000002.jpg";

const deps = () => ({
  sessionProvider: undefined as never, // harness 注入
  goalExecutor: createGoalExecutor(),
});

let outputDir: string;

beforeEach(async () => {
  outputDir = await mkdtemp(join(tmpdir(), "bili-comments-test-"));
});

afterEach(async () => {
  await rm(outputDir, { recursive: true, force: true });
});

// ============================================================================
// ① 成功信封（含落盘产物断言）
// ============================================================================

test("成功信封：direct oid+type 单页，含置顶楼 + 配图下载 + 落盘 comments.md/meta.json/images", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(MAIN_PATH, { body: biliOk(mainPage1Fixture) })
    .route(IMAGE_URL, tinyPngReply);
  const outcome = await runSkillWithFixtures(
    new BiliCommentsSkill(deps(), { outputDir }),
    { oid: "113000000000201", type: 1, maxPages: 1 } as BiliCommentParams,
    { upstream, storageRoot: outputDir },
  );

  const snapshotBody = JSON.parse(JSON.stringify(outcome.result).split(outputDir).join("<tmpdir>"));
  expectSnapshot("bili-comments-envelope", snapshotBody);

  const data = outcome.expectSuccess() as unknown as {
    meta: { skill: string; total: number | null; returnedCount: number; pagesFetched: number };
    topItems: unknown[];
    items: unknown[];
  };
  assert.equal(data.meta.skill, "bili-comments");
  assert.equal(data.meta.total, 100);
  assert.equal(data.meta.pagesFetched, 1);
  assert.equal(data.topItems.length, 1);
  assert.equal(data.items.length, 2);

  const result = outcome.result as unknown as {
    data: { meta: { files: { markdown: string; meta: string; images: string[] } } };
  };
  const files = result.data.meta.files;
  const markdown = await readFile(join(outputDir, files.markdown!), "utf-8");
  assert.ok(markdown.includes("测试评论甲"), "comments.md 应含主楼文字");
  const metaJson = JSON.parse(await readFile(join(outputDir, files.meta!), "utf-8"));
  assert.equal(metaJson.kind, "comments");
  assert.equal(files.images.length, 1, "配图应下载 1 张");
  outcome.provider.assertBalanced();
});

test("成功信封：downloadImages=false 时不下载配图，正文保留远程 URL", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(MAIN_PATH, { body: biliOk(mainPage1Fixture) });
  const outcome = await runSkillWithFixtures(
    new BiliCommentsSkill(deps(), { outputDir }),
    { oid: "113000000000201", type: 1, maxPages: 1, downloadImages: false } as BiliCommentParams,
    { upstream, storageRoot: outputDir },
  );

  const data = outcome.expectSuccess() as unknown as {
    items: Array<{ images: Array<{ localized: boolean; src: string }> }>;
  };
  const withImage = data.items.find((it) => it.images.length > 0);
  assert.ok(withImage);
  assert.equal(withImage!.images[0].localized, false);
  assert.equal(
    upstream.callsMatching(IMAGE_URL).length,
    0,
    "downloadImages=false 不该触发配图下载请求",
  );
  outcome.provider.assertBalanced();
});

test("成功信封：includeReplies=true 时为有回复的主楼追加完整楼中楼", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(MAIN_PATH, { body: biliOk(mainPage1Fixture) })
    .route(REPLIES_PATH, { body: biliOk(repliesPageFixture) })
    .route(IMAGE_URL, tinyPngReply);
  const outcome = await runSkillWithFixtures(
    new BiliCommentsSkill(deps(), { outputDir }),
    { oid: "113000000000201", type: 1, maxPages: 1, includeReplies: true } as BiliCommentParams,
    { upstream, storageRoot: outputDir },
  );

  const data = outcome.expectSuccess() as unknown as {
    items: Array<{ replyCount: number; replies: unknown[] }>;
  };
  // 只有 rcount>0 的主楼（评论乙，rcount=3）触发楼中楼请求
  const withReplies = data.items.find((it) => it.replyCount === 3);
  assert.ok(withReplies);
  assert.equal(withReplies!.replies.length, 2, "楼中楼接口返回的完整子回复应覆盖内嵌热评");
  assert.equal(upstream.callsMatching(REPLIES_PATH).length, 1, "只有一条主楼 rcount>0，只发一次楼中楼请求");
  outcome.provider.assertBalanced();
});

// ============================================================================
// ② 评论区定位（策略模式：direct/article 纯解析，video/opus 需网络换取）
// ============================================================================

test("定位：cvId 走 article 策略，oid=cvId type=12，纯解析不发额外请求", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(MAIN_PATH, { body: biliOk(mainEmptyFixture) });
  const data = (
    await runSkillWithFixtures(
      new BiliCommentsSkill(deps(), { outputDir }),
      { cvId: "12345678", maxPages: 1 } as BiliCommentParams,
      { upstream, storageRoot: outputDir },
    )
  ).expectSuccess() as unknown as { meta: { source: { oid: string; type: number; origin: string } } };

  assert.equal(data.meta.source.oid, "12345678");
  assert.equal(data.meta.source.type, 12);
  assert.equal(data.meta.source.origin, "article");
  assert.equal(upstream.callsMatching(VIEW_PATH).length, 0);
  assert.equal(upstream.callsMatching(DYNAMIC_DETAIL_PATH).length, 0);
});

test("定位：bvid 走 video 策略，经 /x/web-interface/view 换 aid", async () => {
  const upstream = new FakeUpstream()
    .route(VIEW_PATH, { body: viewFixture(113000000000201) })
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(MAIN_PATH, { body: biliOk(mainEmptyFixture) });
  const outcome = await runSkillWithFixtures(
    new BiliCommentsSkill(deps(), { outputDir }),
    { bvid: "BV1dd4y1d7d1", maxPages: 1 } as BiliCommentParams,
    { upstream, storageRoot: outputDir },
  );

  const data = outcome.expectSuccess() as unknown as {
    meta: { source: { oid: string; type: number; origin: string } };
  };
  assert.equal(data.meta.source.oid, "113000000000201");
  assert.equal(data.meta.source.type, 1);
  assert.equal(data.meta.source.origin, "video");
  outcome.provider.assertBalanced();
});

test("定位：opusId 走 opus 策略，经 web-dynamic detail 换 oid+type", async () => {
  const upstream = new FakeUpstream()
    .route(DYNAMIC_DETAIL_PATH, { body: dynamicDetailFixture({ commentId: "930000000000001", commentType: 17 }) })
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(MAIN_PATH, { body: biliOk(mainEmptyFixture) });
  const outcome = await runSkillWithFixtures(
    new BiliCommentsSkill(deps(), { outputDir }),
    { opusId: "930000000000001", maxPages: 1 } as BiliCommentParams,
    { upstream, storageRoot: outputDir },
  );

  const data = outcome.expectSuccess() as unknown as {
    meta: { source: { oid: string; type: number; origin: string } };
  };
  assert.equal(data.meta.source.oid, "930000000000001");
  assert.equal(data.meta.source.type, 17);
  assert.equal(data.meta.source.origin, "opus");
  outcome.provider.assertBalanced();
});

test("定位失败：bvid 换 aid 时上游 code≠0 → upstream-shape-changed，不再打主楼接口", async () => {
  const upstream = new FakeUpstream()
    .route(VIEW_PATH, { body: viewNotFoundFixture })
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(MAIN_PATH, { body: biliOk(mainEmptyFixture) });
  const outcome = await runSkillWithFixtures(
    new BiliCommentsSkill(deps(), { outputDir }),
    { bvid: "BV1dd4y1d7d1", maxPages: 1 } as BiliCommentParams,
    { upstream, storageRoot: outputDir },
  );

  assert.equal(outcome.expectFailureKind(), "upstream-shape-changed");
  assert.equal(upstream.callsMatching(MAIN_PATH).length, 0);
  outcome.provider.assertBalanced();
});

test("定位失败：opusId 换 oid+type 时 detail 缺 basic → upstream-shape-changed", async () => {
  const upstream = new FakeUpstream().route(DYNAMIC_DETAIL_PATH, { body: dynamicDetailMissingFixture });
  const outcome = await runSkillWithFixtures(
    new BiliCommentsSkill(deps(), { outputDir }),
    { opusId: "930000000000001", maxPages: 1 } as BiliCommentParams,
    { upstream, storageRoot: outputDir },
  );

  assert.equal(outcome.expectFailureKind(), "upstream-shape-changed");
  outcome.provider.assertBalanced();
});

// ============================================================================
// ③ 翻页（offset 游标类，但单次 execute() 内部循环连抓，与 creator articles/feed 不同）
// ============================================================================

test("翻页：maxPages=2 单次调用内循环连抓，按 rpid 跨页去重，抓到底提前终止", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(MAIN_PATH, { body: biliOk(mainPage1Fixture) }, { body: biliOk(mainPage2Fixture) });
  const data = (
    await runSkillWithFixtures(
      new BiliCommentsSkill(deps(), { outputDir }),
      { oid: "113000000000201", type: 1, maxPages: 2 } as BiliCommentParams,
      { upstream, storageRoot: outputDir },
    )
  ).expectSuccess() as unknown as { meta: { pagesFetched: number; hasMore: boolean }; items: unknown[] };

  // page1: 2 条，page2: 2 条（首条与 page1 第 2 条 rpid 相同）→ 净 3 条
  assert.equal(data.items.length, 3);
  assert.equal(data.meta.pagesFetched, 2);
  assert.equal(data.meta.hasMore, false, "page2 is_end=true 应终止续取");

  const calls = upstream.callsMatching(MAIN_PATH);
  assert.equal(calls.length, 2);
  assert.ok(new URL(calls[1].url, "https://x.example.invalid").searchParams.get("pagination_str")?.includes("cm-offset-0001"));
});

test("翻页：maxPages 超过硬上限 20 → 静默 clamp 到硬上限（与 channel/creator 的 invalid-params 不同）", async () => {
  // ⚠ 与 bili-channel / bili-creator-videos 不同：本 Skill 的 normalizeParams
  // 用 Math.min(..., BILI_COMMENTS_MAX_PAGES_CAP) 静默 clamp，不抛错。
  // page2 给 is_end=true 止损，避免真的循环请求 21 次。
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(MAIN_PATH, { body: biliOk(mainPage1Fixture) }, { body: biliOk(mainPage2Fixture) });
  const data = (
    await runSkillWithFixtures(
      new BiliCommentsSkill(deps(), { outputDir }),
      { oid: "113000000000201", type: 1, maxPages: 21 } as BiliCommentParams,
      { upstream, storageRoot: outputDir },
    )
  ).expectSuccess() as unknown as { meta: { pagesFetched: number } };

  assert.equal(data.meta.pagesFetched, 2, "page2 is_end=true 应提前终止，未真的抓满 20 页");
});

// ============================================================================
// ④ 错误 kind 矩阵
// ============================================================================

test("矩阵·风控拦截页：HTML 顶替 JSON → risk-control，不重试", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(MAIN_PATH, {
      body: '<!DOCTYPE html><html><head><title>验证</title></head><body><div id="captcha">请完成验证</div></body></html>',
    });
  const outcome = await runSkillWithFixtures(
    new BiliCommentsSkill(deps(), { outputDir }),
    { oid: "113000000000201", type: 1, maxPages: 1 } as BiliCommentParams,
    { upstream, storageRoot: outputDir },
  );

  assert.equal(outcome.expectFailureKind(), "risk-control");
  assert.equal(upstream.callsMatching(MAIN_PATH).length, 1);
  outcome.provider.assertBalanced();
});

test("矩阵·空壳响应：0 字节 body 判为可重试，退避一次后恢复", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(MAIN_PATH, { body: "" }, { body: biliOk(mainPage1Fixture) });
  const outcome = await runSkillWithFixtures(
    new BiliCommentsSkill(deps(), { outputDir }),
    { oid: "113000000000201", type: 1, maxPages: 1 } as BiliCommentParams,
    { upstream, storageRoot: outputDir },
  );

  assert.equal(outcome.result.success, true);
  assert.equal(upstream.callsMatching(MAIN_PATH).length, 2);
  outcome.provider.assertBalanced();
});

test("矩阵·HTTP 非 2xx → 走满退避后落 retry-exhausted", async () => {
  // ⚠ 真的会等满 3 次退避（BILI_GOAL_DEFAULTS.delay=1000）。
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(MAIN_PATH, { status: 503, body: { msg: "unavailable" } });
  const outcome = await runSkillWithFixtures(
    new BiliCommentsSkill(deps(), { outputDir }),
    { oid: "113000000000201", type: 1, maxPages: 1 } as BiliCommentParams,
    { upstream, storageRoot: outputDir },
  );

  assert.equal(outcome.expectFailureKind(), "retry-exhausted");
  assert.equal(upstream.callsMatching(MAIN_PATH).length, 4, "count=3 → 共 4 次尝试");
  outcome.provider.assertBalanced();
});

test("矩阵·业务码 code≠0 → upstream-shape-changed", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(MAIN_PATH, { body: biliErr(-400, "请求错误") });
  const outcome = await runSkillWithFixtures(
    new BiliCommentsSkill(deps(), { outputDir }),
    { oid: "113000000000201", type: 1, maxPages: 1 } as BiliCommentParams,
    { upstream, storageRoot: outputDir },
  );

  assert.equal(outcome.expectFailureKind(), "upstream-shape-changed");
  outcome.provider.assertBalanced();
});

test("矩阵·契约漂移：replies 从数组变成对象 → 宽容降级为空集，不崩溃", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(MAIN_PATH, { body: biliOk(mainShapeDriftFixture) });
  const outcome = await runSkillWithFixtures(
    new BiliCommentsSkill(deps(), { outputDir }),
    { oid: "113000000000201", type: 1, maxPages: 1 } as BiliCommentParams,
    { upstream, storageRoot: outputDir },
  );

  assert.equal(outcome.result.success, true, "非数组 replies 不该让整个 Skill 崩溃");
  const data = outcome.expectSuccess() as unknown as { items: unknown[] };
  assert.deepEqual(data.items, []);
  outcome.provider.assertBalanced();
});

test("矩阵·nav 缺 wbi_img → upstream-shape-changed，且不再打主楼接口", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk({ isLogin: false }) })
    .route(MAIN_PATH, { body: biliOk(mainPage1Fixture) });
  const outcome = await runSkillWithFixtures(
    new BiliCommentsSkill(deps(), { outputDir }),
    { oid: "113000000000201", type: 1, maxPages: 1 } as BiliCommentParams,
    { upstream, storageRoot: outputDir },
  );

  assert.equal(outcome.expectFailureKind(), "upstream-shape-changed");
  assert.equal(upstream.callsMatching(MAIN_PATH).length, 0);
  outcome.provider.assertBalanced();
});

test("矩阵·非法参数：定位信息全缺 → invalid-params，一次上游都不打", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(MAIN_PATH, { body: biliOk(mainPage1Fixture) });
  const outcome = await runSkillWithFixtures(
    new BiliCommentsSkill(deps(), { outputDir }),
    {} as BiliCommentParams,
    { upstream, storageRoot: outputDir },
  );

  assert.equal(outcome.expectFailureKind(), "invalid-params");
  assert.equal(upstream.calls.length, 0);
  outcome.provider.assertBalanced();
});

test("矩阵·非法参数：oid 与 type 只传一个 → invalid-params", async () => {
  const upstream = new FakeUpstream();
  const outcome = await runSkillWithFixtures(
    new BiliCommentsSkill(deps(), { outputDir }),
    { oid: "113000000000201" } as BiliCommentParams,
    { upstream, storageRoot: outputDir },
  );

  assert.equal(outcome.expectFailureKind(), "invalid-params");
  assert.equal(upstream.calls.length, 0);
  outcome.provider.assertBalanced();
});

test("矩阵·非法参数：imageTimeoutMs 小于 1000 → invalid-params", async () => {
  const upstream = new FakeUpstream();
  const outcome = await runSkillWithFixtures(
    new BiliCommentsSkill(deps(), { outputDir }),
    { oid: "113000000000201", type: 1, imageTimeoutMs: 500 } as BiliCommentParams,
    { upstream, storageRoot: outputDir },
  );

  assert.equal(outcome.expectFailureKind(), "invalid-params");
  assert.equal(upstream.calls.length, 0);
  outcome.provider.assertBalanced();
});

// ============================================================================
// ⑤ 正常空集
// ============================================================================

test("正常空集：评论区无内容 → success + items:[]/topItems:[]，不重试", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(MAIN_PATH, { body: biliOk(mainEmptyFixture) });
  const outcome = await runSkillWithFixtures(
    new BiliCommentsSkill(deps(), { outputDir }),
    { oid: "113000000000201", type: 1, maxPages: 1 } as BiliCommentParams,
    { upstream, storageRoot: outputDir },
  );

  const data = outcome.expectSuccess() as unknown as { items: unknown[]; topItems: unknown[] };
  assert.deepEqual(data.items, []);
  assert.deepEqual(data.topItems, []);
  assert.equal(
    outcome.upstream.callsMatching(MAIN_PATH).length,
    1,
    "空集不该触发框架重试",
  );
  outcome.provider.assertBalanced();
});

// ============================================================================
// ⑥ RAII —— 失败路径同样要还租约
// ============================================================================

test("RAII：无论成功失败，页面租约都被释放", async () => {
  for (const [label, upstream] of [
    [
      "成功",
      new FakeUpstream()
        .route(NAV_PATH, { body: biliOk(navFixture) })
        .route(MAIN_PATH, { body: biliOk(mainPage1Fixture) }),
    ],
    [
      "失败",
      new FakeUpstream()
        .route(NAV_PATH, { body: biliOk(navFixture) })
        .route(MAIN_PATH, { body: biliErr(-403, "访问权限不足") }),
    ],
  ] as const) {
    const outcome = await runSkillWithFixtures(
      new BiliCommentsSkill(deps(), { outputDir }),
      { oid: "113000000000201", type: 1, maxPages: 1 } as BiliCommentParams,
      { upstream, storageRoot: outputDir },
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
