/**
 * video 模块测试（bili-video，L2，docs/TESTING.md §3.3 标准三件）。
 *
 * 全包最复杂的 Skill——混合模式（PuppeteerGoalSkill + 覆写 fetchData）：
 *   - `BiliVideoGoal` 声明式解析 nav/view/playurl/字幕（多个 `@Expanded`，
 *     concurrency:1，按 part/partMode 选中的分 P 逐个签名请求）；
 *   - Skill 层在解析结果之上做真实媒体下载（`page.evaluate` 内 fetch，
 *     由 `FakeUpstream` 正常应答）+ ffmpeg 合并（真实 ffmpeg 二进制，
 *     不 mock，验证生产态合并链路真的能跑通）+ 字幕落盘（`downloadSubtitle`
 *     用裸 Node fetch，须 `vi.stubGlobal` 桩替）。
 *
 * 落盘产物用 `runSkillWithFixtures` 的 `storageRoot` 断言真实写入
 * （docs/TESTING.md §3.1 注入纪律）。
 *
 * 断言纪律（§8 红线）：只锁 `kind` 不锁 message；每个用例尾部
 * `provider.assertBalanced()`。
 */
import { test, vi, beforeEach, afterEach } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { testing, createGoalExecutor } from "@spider/core";

import { BiliVideoSkill } from "@src/skills/video/download.skill";
import type { BiliVideoDownloadParams } from "@src/types/video.types";

import { expectSnapshot } from "../helpers/snapshot";
import {
  biliOk,
  biliErr,
  navFixture,
  navMissingWbiFixture,
  viewSinglePageFixture,
  viewTwoPagesFixture,
  viewMissingIdentityFixture,
  viewMissingPagesFixture,
  playUrlFixture,
  playUrlUnavailableFixture,
  subtitleV2Fixture,
  subtitleV2EmptyFixture,
  subtitleWebViewEmptyBody,
  subtitleWebViewPaidBody,
  TEST_VIDEO_M4S_BASE64,
  TEST_AUDIO_M4S_BASE64,
  stubSubtitleContentFetch,
} from "../fixtures/video-fetch.fixture";

const { FakeUpstream, runSkillWithFixtures } = testing;

const NAV_PATH = "/x/web-interface/nav";
const VIEW_PATH = "/x/web-interface/view";
const PLAYURL_PATH = "/x/player/wbi/playurl";
const SUBTITLE_V2_PATH = "/x/player/wbi/v2";
const SUBTITLE_WEB_VIEW_PATH = "/x/v2/subtitle/web/view";
const VIDEO_STREAM_URL = "/video/mock-80.m4s";
const AUDIO_STREAM_URL = "/audio/mock-30280.m4s";

const videoBinary = Buffer.from(TEST_VIDEO_M4S_BASE64, "base64").toString("binary");
const audioBinary = Buffer.from(TEST_AUDIO_M4S_BASE64, "base64").toString("binary");

const deps = () => ({
  sessionProvider: undefined as never, // harness 注入
  goalExecutor: createGoalExecutor(),
});

let outputDir: string;

beforeEach(async () => {
  outputDir = await mkdtemp(join(tmpdir(), "bili-video-test-"));
});

afterEach(async () => {
  await rm(outputDir, { recursive: true, force: true });
  vi.unstubAllGlobals();
});

/** 常规装配：nav + view(单P) + playurl + 字幕元信息(wbi/v2 有明文 URL)。 */
function fullUpstream(): InstanceType<typeof FakeUpstream> {
  return new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(VIEW_PATH, { body: biliOk(viewSinglePageFixture) })
    .route(PLAYURL_PATH, { body: biliOk(playUrlFixture) })
    .route(SUBTITLE_V2_PATH, { body: biliOk(subtitleV2EmptyFixture) })
    .route(SUBTITLE_WEB_VIEW_PATH, { body: subtitleWebViewEmptyBody })
    .route(VIDEO_STREAM_URL, { body: videoBinary, contentType: "video/mp4" })
    .route(AUDIO_STREAM_URL, { body: audioBinary, contentType: "audio/mp4" });
}

// ============================================================================
// ① 成功信封（含真实 ffmpeg 合并 + 落盘产物断言）
// ============================================================================

test("成功信封：解析+下载+ffmpeg 真实合并+落盘 merged.mp4/m4s/meta.json", async () => {
  const outcome = await runSkillWithFixtures(
    new BiliVideoSkill(deps(), { outputDir }),
    { bvid: "BV1ff4y1f7f1" } as BiliVideoDownloadParams,
    { upstream: fullUpstream(), storageRoot: outputDir },
  );

  const snapshotBody = JSON.parse(JSON.stringify(outcome.result).split(outputDir).join("<tmpdir>"));
  expectSnapshot("bili-video-envelope", snapshotBody);

  const data = outcome.expectSuccess() as unknown as {
    meta: { skill: string; video: { bvid: string; title: string }; files: { mergedCount: number; mediaCount: number } };
    content: { pages: Array<{ merged: { path: string } | null; files: unknown[] }> };
  };
  assert.equal(data.meta.skill, "bili-video");
  assert.equal(data.meta.video.bvid, "BV1ff4y1f7f1");
  assert.equal(data.meta.files.mergedCount, 1, "ffmpeg 应真实合并出 1 个成品");
  assert.ok(data.content.pages[0].merged);

  // 落盘产物真实存在
  const result = outcome.result as unknown as {
    data: { content: { pages: Array<{ merged: { path: string; absolutePath: string } | null }> } };
  };
  const mergedPath = result.data.content.pages[0].merged!.path;
  const stats = await stat(join(outputDir, mergedPath));
  assert.ok(stats.size > 0, "合并后的 mp4 文件应有真实字节");

  outcome.provider.assertBalanced();
});

test("成功信封：download=false 时只解析选流，不下载媒体（无需 ffmpeg）", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(VIEW_PATH, { body: biliOk(viewSinglePageFixture) })
    .route(PLAYURL_PATH, { body: biliOk(playUrlFixture) })
    .route(SUBTITLE_V2_PATH, { body: biliOk(subtitleV2EmptyFixture) })
    .route(SUBTITLE_WEB_VIEW_PATH, { body: subtitleWebViewEmptyBody });
  const outcome = await runSkillWithFixtures(
    new BiliVideoSkill(deps(), { outputDir }),
    { bvid: "BV1ff4y1f7f1", download: false } as BiliVideoDownloadParams,
    { upstream, storageRoot: outputDir },
  );

  const data = outcome.expectSuccess() as unknown as {
    content: { pages: Array<{ selected: { video: unknown; audio: unknown }; files: unknown[]; merged: unknown }> };
    insights: string[];
  };
  assert.ok(data.content.pages[0].selected.video, "download=false 仍应返回选流元数据");
  assert.deepEqual(data.content.pages[0].files, []);
  assert.equal(data.content.pages[0].merged, null);
  assert.equal(upstream.callsMatching(VIDEO_STREAM_URL).length, 0, "download=false 不该下载媒体");
  assert.ok(data.insights.some((s) => s.includes("download=false")));
  outcome.provider.assertBalanced();
});

test("成功信封：字幕明文 URL（wbi/v2）下载并落盘 json", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(VIEW_PATH, { body: biliOk(viewSinglePageFixture) })
    .route(PLAYURL_PATH, { body: biliOk(playUrlFixture) })
    .route(SUBTITLE_V2_PATH, { body: biliOk(subtitleV2Fixture) })
    .route(SUBTITLE_WEB_VIEW_PATH, { body: subtitleWebViewEmptyBody })
    .route(VIDEO_STREAM_URL, { body: videoBinary, contentType: "video/mp4" })
    .route(AUDIO_STREAM_URL, { body: audioBinary, contentType: "audio/mp4" });
  vi.stubGlobal("fetch", stubSubtitleContentFetch());

  const outcome = await runSkillWithFixtures(
    new BiliVideoSkill(deps(), { outputDir }),
    { bvid: "BV1ff4y1f7f1" } as BiliVideoDownloadParams,
    { upstream, storageRoot: outputDir },
  );

  const data = outcome.expectSuccess() as unknown as {
    content: { pages: Array<{ subtitles: Array<{ lan: string; path: string }> }> };
  };
  assert.equal(data.content.pages[0].subtitles.length, 1);
  assert.equal(data.content.pages[0].subtitles[0].lan, "ai-zh");
  const subJson = JSON.parse(await readFile(join(outputDir, data.content.pages[0].subtitles[0].path), "utf-8"));
  assert.equal(subJson.body[0].content, "测试字幕内容");
  outcome.provider.assertBalanced();
});

test("成功信封：subtitle=false 时字幕接口仍会被 Goal 调用（无条件端点），但不落盘字幕文件", async () => {
  // ⚠ 现状：Goal 层的 fetchSubtitles/fetchSubtitlesV2 是无条件端点（core 框架
  // 不支持按参数跳过某个 @Endpoint，见 docs/TESTING.md 已有的同类踩坑记录）；
  // `subtitle` 参数只控制 Skill.fetchData 里是否执行 downloadSubtitle 落盘，
  // 不影响 Goal 是否请求这两个接口。
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(VIEW_PATH, { body: biliOk(viewSinglePageFixture) })
    .route(PLAYURL_PATH, { body: biliOk(playUrlFixture) })
    .route(SUBTITLE_V2_PATH, { body: biliOk(subtitleV2Fixture) })
    .route(SUBTITLE_WEB_VIEW_PATH, { body: subtitleWebViewEmptyBody })
    .route(VIDEO_STREAM_URL, { body: videoBinary, contentType: "video/mp4" })
    .route(AUDIO_STREAM_URL, { body: audioBinary, contentType: "audio/mp4" });
  const outcome = await runSkillWithFixtures(
    new BiliVideoSkill(deps(), { outputDir }),
    { bvid: "BV1ff4y1f7f1", subtitle: false } as BiliVideoDownloadParams,
    { upstream, storageRoot: outputDir },
  );

  const data = outcome.expectSuccess() as unknown as {
    content: { pages: Array<{ subtitles: unknown[] }> };
  };
  assert.equal(upstream.callsMatching(SUBTITLE_V2_PATH).length, 1, "Goal 端点无条件调用");
  assert.deepEqual(data.content.pages[0].subtitles, [], "subtitle=false 不落盘字幕，结果里字幕列表为空");
  outcome.provider.assertBalanced();
});

// ============================================================================
// ② 分 P 选择（partMode: selected vs all）
// ============================================================================

test("分P：partMode=all 逐个分 P 解析选流并合并", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(VIEW_PATH, { body: biliOk(viewTwoPagesFixture) })
    .route(PLAYURL_PATH, { body: biliOk(playUrlFixture) })
    .route(SUBTITLE_V2_PATH, { body: biliOk(subtitleV2EmptyFixture) })
    .route(SUBTITLE_WEB_VIEW_PATH, { body: subtitleWebViewEmptyBody })
    .route(VIDEO_STREAM_URL, { body: videoBinary, contentType: "video/mp4" })
    .route(AUDIO_STREAM_URL, { body: audioBinary, contentType: "audio/mp4" });
  const data = (
    await runSkillWithFixtures(
      new BiliVideoSkill(deps(), { outputDir }),
      { bvid: "BV1ff4y1f7f1", partMode: "all" } as BiliVideoDownloadParams,
      { upstream, storageRoot: outputDir },
    )
  ).expectSuccess() as unknown as { content: { pages: unknown[] } };

  assert.equal(data.content.pages.length, 2);
  // concurrency:1 → playurl 应被调用 2 次（每个分 P 各一次）
  assert.equal(upstream.callsMatching(PLAYURL_PATH).length, 2);
});

test("分P：part 超出范围 → invalid-params", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(VIEW_PATH, { body: biliOk(viewSinglePageFixture) });
  const outcome = await runSkillWithFixtures(
    new BiliVideoSkill(deps(), { outputDir }),
    { bvid: "BV1ff4y1f7f1", part: 5 } as BiliVideoDownloadParams,
    { upstream, storageRoot: outputDir },
  );

  assert.equal(outcome.expectFailureKind(), "invalid-params");
  outcome.provider.assertBalanced();
});

// ============================================================================
// ③ 错误 kind 矩阵
// ============================================================================

test("矩阵·风控拦截页：HTML 顶替 JSON → risk-control，不重试", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(VIEW_PATH, {
      body: '<!DOCTYPE html><html><head><title>验证</title></head><body><div id="captcha">请完成验证</div></body></html>',
    });
  const outcome = await runSkillWithFixtures(
    new BiliVideoSkill(deps(), { outputDir }),
    { bvid: "BV1ff4y1f7f1" } as BiliVideoDownloadParams,
    { upstream, storageRoot: outputDir },
  );

  assert.equal(outcome.expectFailureKind(), "risk-control");
  assert.equal(upstream.callsMatching(VIEW_PATH).length, 1);
  outcome.provider.assertBalanced();
});

test("矩阵·空壳响应：0 字节 body 判为可重试，退避一次后恢复", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(VIEW_PATH, { body: "" }, { body: biliOk(viewSinglePageFixture) })
    .route(PLAYURL_PATH, { body: biliOk(playUrlFixture) })
    .route(SUBTITLE_V2_PATH, { body: biliOk(subtitleV2EmptyFixture) })
    .route(SUBTITLE_WEB_VIEW_PATH, { body: subtitleWebViewEmptyBody })
    .route(VIDEO_STREAM_URL, { body: videoBinary, contentType: "video/mp4" })
    .route(AUDIO_STREAM_URL, { body: audioBinary, contentType: "audio/mp4" });
  const outcome = await runSkillWithFixtures(
    new BiliVideoSkill(deps(), { outputDir }),
    { bvid: "BV1ff4y1f7f1" } as BiliVideoDownloadParams,
    { upstream, storageRoot: outputDir },
  );

  assert.equal(outcome.result.success, true);
  assert.equal(upstream.callsMatching(VIEW_PATH).length, 2);
  outcome.provider.assertBalanced();
});

test("矩阵·HTTP 非 2xx → 走满退避后落 retry-exhausted", async () => {
  // ⚠ 真的会等满 3 次退避（BILI_GOAL_DEFAULTS.delay=1000）。
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(VIEW_PATH, { status: 503, body: { msg: "unavailable" } });
  const outcome = await runSkillWithFixtures(
    new BiliVideoSkill(deps(), { outputDir }),
    { bvid: "BV1ff4y1f7f1" } as BiliVideoDownloadParams,
    { upstream, storageRoot: outputDir },
  );

  assert.equal(outcome.expectFailureKind(), "retry-exhausted");
  assert.equal(upstream.callsMatching(VIEW_PATH).length, 4, "count=3 → 共 4 次尝试");
  outcome.provider.assertBalanced();
});

test("矩阵·业务码 code≠0 → upstream-shape-changed（view 主动校验）", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(VIEW_PATH, { body: biliErr(-400, "请求错误") });
  const outcome = await runSkillWithFixtures(
    new BiliVideoSkill(deps(), { outputDir }),
    { bvid: "BV1ff4y1f7f1" } as BiliVideoDownloadParams,
    { upstream, storageRoot: outputDir },
  );

  assert.equal(outcome.expectFailureKind(), "upstream-shape-changed");
  outcome.provider.assertBalanced();
});

test("矩阵·契约漂移：view 缺 aid/bvid → upstream-shape-changed", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(VIEW_PATH, { body: biliOk(viewMissingIdentityFixture) });
  const outcome = await runSkillWithFixtures(
    new BiliVideoSkill(deps(), { outputDir }),
    { bvid: "BV1ff4y1f7f1" } as BiliVideoDownloadParams,
    { upstream, storageRoot: outputDir },
  );

  assert.equal(outcome.expectFailureKind(), "upstream-shape-changed");
  outcome.provider.assertBalanced();
});

test("矩阵·契约漂移：pages 缺 cid → upstream-shape-changed（归一化后过滤为空）", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(VIEW_PATH, { body: biliOk(viewMissingPagesFixture) });
  const outcome = await runSkillWithFixtures(
    new BiliVideoSkill(deps(), { outputDir }),
    { bvid: "BV1ff4y1f7f1" } as BiliVideoDownloadParams,
    { upstream, storageRoot: outputDir },
  );

  assert.equal(outcome.expectFailureKind(), "upstream-shape-changed");
  outcome.provider.assertBalanced();
});

test("矩阵·nav 缺 wbi_img → upstream-shape-changed，且不再打 view 接口", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navMissingWbiFixture) })
    .route(VIEW_PATH, { body: biliOk(viewSinglePageFixture) });
  const outcome = await runSkillWithFixtures(
    new BiliVideoSkill(deps(), { outputDir }),
    { bvid: "BV1ff4y1f7f1" } as BiliVideoDownloadParams,
    { upstream, storageRoot: outputDir },
  );

  assert.equal(outcome.expectFailureKind(), "upstream-shape-changed");
  outcome.provider.assertBalanced();
});

test("矩阵·付费未购买：playurl 无 dash → 降级为 streamUnavailable，字幕仍可解析", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(VIEW_PATH, { body: biliOk(viewSinglePageFixture) })
    .route(PLAYURL_PATH, { body: biliOk(playUrlUnavailableFixture) })
    .route(SUBTITLE_V2_PATH, { body: biliOk(subtitleV2Fixture) })
    .route(SUBTITLE_WEB_VIEW_PATH, { body: subtitleWebViewEmptyBody });
  vi.stubGlobal("fetch", stubSubtitleContentFetch());

  const outcome = await runSkillWithFixtures(
    new BiliVideoSkill(deps(), { outputDir }),
    { bvid: "BV1ff4y1f7f1" } as BiliVideoDownloadParams,
    { upstream, storageRoot: outputDir },
  );

  assert.equal(outcome.result.success, true, "无 DASH 流不该让整个 Skill 失败");
  const data = outcome.expectSuccess() as unknown as {
    content: { pages: Array<{ streamUnavailable: string | null; selected: { video: unknown }; subtitles: unknown[] }> };
  };
  assert.ok(data.content.pages[0].streamUnavailable);
  assert.equal(data.content.pages[0].selected.video, null);
  assert.equal(data.content.pages[0].subtitles.length, 1, "字幕不受媒体流缺失影响");
  outcome.provider.assertBalanced();
});

test("矩阵·付费视频字幕回退：wbi/v2 为空但 subtitle/web/view protobuf 有字幕 → 回退解析成功", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(VIEW_PATH, { body: biliOk(viewSinglePageFixture) })
    .route(PLAYURL_PATH, { body: biliOk(playUrlUnavailableFixture) })
    .route(SUBTITLE_V2_PATH, { body: biliOk(subtitleV2EmptyFixture) })
    .route(SUBTITLE_WEB_VIEW_PATH, { body: subtitleWebViewPaidBody });
  vi.stubGlobal("fetch", stubSubtitleContentFetch());

  const outcome = await runSkillWithFixtures(
    new BiliVideoSkill(deps(), { outputDir }),
    { bvid: "BV1ff4y1f7f1" } as BiliVideoDownloadParams,
    { upstream, storageRoot: outputDir },
  );

  const data = outcome.expectSuccess() as unknown as {
    content: { pages: Array<{ subtitles: Array<{ lan: string }> }> };
  };
  assert.equal(data.content.pages[0].subtitles.length, 1, "wbi/v2 为空时应回退到 protobuf 解密结果");
  assert.equal(data.content.pages[0].subtitles[0].lan, "ai-zh");
  outcome.provider.assertBalanced();
});

test("矩阵·媒体下载失败：视频流 404 → 整体失败（endpoint-http，非可重试来源亦不降级）", async () => {
  const upstream = new FakeUpstream()
    .route(NAV_PATH, { body: biliOk(navFixture) })
    .route(VIEW_PATH, { body: biliOk(viewSinglePageFixture) })
    .route(PLAYURL_PATH, { body: biliOk(playUrlFixture) })
    .route(SUBTITLE_V2_PATH, { body: biliOk(subtitleV2EmptyFixture) })
    .route(SUBTITLE_WEB_VIEW_PATH, { body: subtitleWebViewEmptyBody })
    .route(VIDEO_STREAM_URL, { status: 404, body: "" })
    .route(AUDIO_STREAM_URL, { body: audioBinary, contentType: "audio/mp4" });
  const outcome = await runSkillWithFixtures(
    new BiliVideoSkill(deps(), { outputDir }),
    { bvid: "BV1ff4y1f7f1" } as BiliVideoDownloadParams,
    { upstream, storageRoot: outputDir },
  );

  assert.equal(outcome.expectFailureKind(), "endpoint-http");
  outcome.provider.assertBalanced();
});

test("矩阵·非法参数：url/bvid/aid/id 全缺 → invalid-params，不导航", async () => {
  const upstream = new FakeUpstream();
  const outcome = await runSkillWithFixtures(
    new BiliVideoSkill(deps(), { outputDir }),
    {} as BiliVideoDownloadParams,
    { upstream, storageRoot: outputDir },
  );

  assert.equal(outcome.expectFailureKind(), "invalid-params");
  assert.equal(outcome.page.navigations.length, 0, "参数校验必须早于导航");
  outcome.provider.assertBalanced();
});

test("矩阵·非法参数：preferCodec 不在白名单 → invalid-params", async () => {
  const upstream = new FakeUpstream();
  const outcome = await runSkillWithFixtures(
    new BiliVideoSkill(deps(), { outputDir }),
    { bvid: "BV1ff4y1f7f1", preferCodec: "hq" as never } as BiliVideoDownloadParams,
    { upstream, storageRoot: outputDir },
  );

  assert.equal(outcome.expectFailureKind(), "invalid-params");
  outcome.provider.assertBalanced();
});

test("矩阵·非法参数：chunkSizeBytes 小于 256KiB → invalid-params", async () => {
  const upstream = new FakeUpstream();
  const outcome = await runSkillWithFixtures(
    new BiliVideoSkill(deps(), { outputDir }),
    { bvid: "BV1ff4y1f7f1", chunkSizeBytes: 1024 } as BiliVideoDownloadParams,
    { upstream, storageRoot: outputDir },
  );

  assert.equal(outcome.expectFailureKind(), "invalid-params");
  outcome.provider.assertBalanced();
});

// ============================================================================
// ④ RAII —— 失败路径同样要还租约
// ============================================================================

test("RAII：无论成功失败，页面租约都被释放", async () => {
  for (const [label, upstream] of [
    ["成功", fullUpstream()],
    [
      "失败",
      new FakeUpstream()
        .route(NAV_PATH, { body: biliOk(navFixture) })
        .route(VIEW_PATH, { body: biliErr(-403, "访问权限不足") }),
    ],
  ] as const) {
    const outcome = await runSkillWithFixtures(
      new BiliVideoSkill(deps(), { outputDir }),
      { bvid: "BV1ff4y1f7f1" } as BiliVideoDownloadParams,
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
