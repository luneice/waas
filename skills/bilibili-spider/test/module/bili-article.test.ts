/**
 * article 模块测试（bili-article，L2，docs/TESTING.md §3.3 标准三件）。
 *
 * 与其余 Goal 型模块不同：正文来自登录态详情页 DOM（`.opus-module-content`），
 * 不走独立 JSON 接口。fixture 因此分两路：`FakePage({ html })`（linkedom 渲染
 * 的详情页 HTML，见 fixtures/article.fixture.ts）承担 DOM 解析路径；
 * `FakeUpstream` 承担 fetchMeta（web-dynamic detail 补充元信息）与配图下载
 * 两条真实网络请求。
 *
 * 本模块含落盘产物（article.md + meta.json + images/），用
 * `runSkillWithFixtures` 的 `storageRoot` 选项落到临时目录并断言产物真实写入
 * （docs/TESTING.md §3.1 注入纪律：只有显式给了 storageRoot/artifactSink 才
 * 注入，此时是明确要测落盘）。
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

import { BiliArticleSkill } from "@src/skills/article/extract.skill";
import type { BiliArticleParams } from "@src/types/article.types";

import { expectSnapshot } from "../helpers/snapshot";
import {
  opusDetailHtmlFixture,
  opusDetailEmptyBodyHtmlFixture,
  opusDetailMissingContainerHtmlFixture,
  opusDetailChargeBlockedHtmlFixture,
  webDynamicDetailFixture,
  webDynamicDetailMissingItemFixture,
  DETAIL_PATH,
  tinyPngReply,
  IMAGE_URL,
} from "../fixtures/article.fixture";

const { FakeUpstream, runSkillWithFixtures } = testing;

const deps = () => ({
  sessionProvider: undefined as never, // harness 注入
  goalExecutor: createGoalExecutor(),
});

let outputDir: string;

beforeEach(async () => {
  outputDir = await mkdtemp(join(tmpdir(), "bili-article-test-"));
});

afterEach(async () => {
  await rm(outputDir, { recursive: true, force: true });
});

// ============================================================================
// ① 成功信封（含落盘产物断言）
// ============================================================================

test("成功信封：DOM 解析正文 + 配图下载 + 落盘 article.md/meta.json/images", async () => {
  const upstream = new FakeUpstream()
    .route(DETAIL_PATH, { body: webDynamicDetailFixture("820000000000001") })
    .route(IMAGE_URL, tinyPngReply);
  const outcome = await runSkillWithFixtures(
    new BiliArticleSkill(deps(), { outputDir }),
    { opusId: "820000000000001" } as BiliArticleParams,
    { upstream, html: opusDetailHtmlFixture, storageRoot: outputDir },
  );

  // outputDir 是每次用例随机生成的临时目录（mkdtemp），快照前归一为占位符，
  // 否则每次跑测试快照都会因目录名不同而失配。
  const snapshotBody = JSON.parse(JSON.stringify(outcome.result).split(outputDir).join("<tmpdir>"));
  expectSnapshot("bili-article-envelope", snapshotBody);

  const data = outcome.expectSuccess() as unknown as {
    meta: { skill: string; title: string; opusId: string; paragraphs: { total: number; text: number; image: number; linkCard: number } };
    content: unknown[];
  };
  assert.equal(data.meta.skill, "bili-article");
  assert.equal(data.meta.title, "测试专栏标题");
  assert.equal(data.meta.opusId, "820000000000001");
  assert.equal(data.meta.paragraphs.total, 3);
  assert.equal(data.meta.paragraphs.text, 1);
  assert.equal(data.meta.paragraphs.image, 1);
  assert.equal(data.meta.paragraphs.linkCard, 1);
  assert.equal(data.content.length, 3);

  // 落盘产物真实存在（storageRoot 已注入 FileArtifactSink + ContentStore 同根）
  const result = outcome.result as unknown as {
    data: { meta: { files: { markdown: string; meta: string; images: string[] } } };
  };
  const files = result.data.meta.files;
  const markdown = await readFile(join(outputDir, files.markdown), "utf-8");
  assert.ok(markdown.includes("测试专栏标题"), "article.md 应含标题");
  assert.ok(markdown.includes("正文第一段纯文本"), "article.md 应含正文文字段");
  const metaJson = JSON.parse(await readFile(join(outputDir, files.meta), "utf-8"));
  assert.equal(metaJson.kind, "article");
  assert.equal(metaJson.platform, "bilibili");
  assert.equal(files.images.length, 1, "配图应下载 1 张");
  const manifestRaw = await readFile(join(outputDir, "manifest.jsonl"), "utf-8");
  assert.ok(manifestRaw.trim().length > 0, "manifest.jsonl 应追加一条记录");

  outcome.provider.assertBalanced();
});

test("成功信封：downloadImages=false 时不下载配图，正文保留远程 URL", async () => {
  const upstream = new FakeUpstream().route(DETAIL_PATH, {
    body: webDynamicDetailFixture("820000000000001"),
  });
  const outcome = await runSkillWithFixtures(
    new BiliArticleSkill(deps(), { outputDir }),
    { opusId: "820000000000001", downloadImages: false } as BiliArticleParams,
    { upstream, html: opusDetailHtmlFixture, storageRoot: outputDir },
  );

  const data = outcome.expectSuccess() as unknown as {
    content: Array<{ type: string; images?: Array<{ src: string; localized: boolean }> }>;
  };
  const imagePara = data.content.find((p) => p.type === "image");
  assert.ok(imagePara?.images);
  assert.equal(imagePara!.images![0].localized, false);
  assert.equal(imagePara!.images![0].src, IMAGE_URL);
  assert.equal(
    upstream.callsMatching(IMAGE_URL).length,
    0,
    "downloadImages=false 不该触发配图下载请求",
  );
  outcome.provider.assertBalanced();
});

// ============================================================================
// ② 入口解析（url/opusId/cvId/id 多形态归一）
// ============================================================================

test("入口解析：cvId 走 /read/cv{id} 直连，opusId 优先于 url", async () => {
  const upstream = new FakeUpstream().route(DETAIL_PATH, {
    body: webDynamicDetailMissingItemFixture,
  });
  const outcome = await runSkillWithFixtures(
    new BiliArticleSkill(deps(), { outputDir }),
    { cvId: "12345678" } as BiliArticleParams,
    { upstream, html: opusDetailHtmlFixture, storageRoot: outputDir },
  );

  const data = outcome.expectSuccess() as unknown as { meta: { source: { input: string } } };
  assert.equal(data.meta.source.input, "cv12345678");
  outcome.provider.assertBalanced();
});

// ============================================================================
// ③ 错误 kind 矩阵
// ============================================================================

test("矩阵·充电专属拦截：正文区出现 upower 链接 → access-denied", async () => {
  const upstream = new FakeUpstream();
  const outcome = await runSkillWithFixtures(
    new BiliArticleSkill(deps(), { outputDir }),
    { opusId: "820000000000099" } as BiliArticleParams,
    { upstream, html: opusDetailChargeBlockedHtmlFixture, storageRoot: outputDir },
  );

  assert.equal(outcome.expectFailureKind(), "access-denied");
  outcome.provider.assertBalanced();
});

test("矩阵·正文容器不存在（改版/受限/未渲染完成）→ upstream-shape-changed", async () => {
  const upstream = new FakeUpstream();
  const outcome = await runSkillWithFixtures(
    new BiliArticleSkill(deps(), { outputDir }),
    { opusId: "820000000000001" } as BiliArticleParams,
    { upstream, html: opusDetailMissingContainerHtmlFixture, storageRoot: outputDir },
  );

  assert.equal(outcome.expectFailureKind(), "upstream-shape-changed");
  outcome.provider.assertBalanced();
});

test("矩阵·正文容器存在但无段落 → upstream-shape-changed（found=false）", async () => {
  const upstream = new FakeUpstream();
  const outcome = await runSkillWithFixtures(
    new BiliArticleSkill(deps(), { outputDir }),
    { opusId: "820000000000001" } as BiliArticleParams,
    { upstream, html: opusDetailEmptyBodyHtmlFixture, storageRoot: outputDir },
  );

  assert.equal(outcome.expectFailureKind(), "upstream-shape-changed");
  outcome.provider.assertBalanced();
});

test("矩阵·fetchMeta 内部异常（detail 接口无 item）→ 降级为 null，不影响正文提取成功", async () => {
  const upstream = new FakeUpstream().route(DETAIL_PATH, {
    body: webDynamicDetailMissingItemFixture,
  });
  const outcome = await runSkillWithFixtures(
    new BiliArticleSkill(deps(), { outputDir }),
    { opusId: "820000000000001" } as BiliArticleParams,
    { upstream, html: opusDetailHtmlFixture, storageRoot: outputDir },
  );

  assert.equal(outcome.result.success, true, "meta 缺失只是降级，不应让正文提取失败");
  const data = outcome.expectSuccess() as unknown as { meta: { author: { mid: number | null } } };
  assert.equal(data.meta.author.mid, null);
  outcome.provider.assertBalanced();
});

test("矩阵·配图下载失败：图片端点 404 → 降级为远程 URL + warning，不让整体失败", async () => {
  const upstream = new FakeUpstream()
    .route(DETAIL_PATH, { body: webDynamicDetailFixture("820000000000001") })
    .route(IMAGE_URL, { status: 404, body: "not found" });
  const outcome = await runSkillWithFixtures(
    new BiliArticleSkill(deps(), { outputDir }),
    { opusId: "820000000000001" } as BiliArticleParams,
    { upstream, html: opusDetailHtmlFixture, storageRoot: outputDir },
  );

  assert.equal(outcome.result.success, true, "配图下载失败应降级为 warning，不影响整体成功");
  const data = outcome.expectSuccess() as unknown as {
    content: Array<{ type: string; images?: Array<{ src: string; localized: boolean }> }>;
  };
  const imagePara = data.content.find((p) => p.type === "image");
  assert.equal(imagePara!.images![0].localized, false);
  assert.equal(imagePara!.images![0].src, IMAGE_URL);
  outcome.provider.assertBalanced();
});

test("矩阵·非法参数：url/opusId/cvId/id 全缺 → invalid-params，不导航", async () => {
  const upstream = new FakeUpstream();
  const outcome = await runSkillWithFixtures(
    new BiliArticleSkill(deps(), { outputDir }),
    {} as BiliArticleParams,
    { upstream, html: opusDetailHtmlFixture, storageRoot: outputDir },
  );

  assert.equal(outcome.expectFailureKind(), "invalid-params");
  assert.equal(outcome.page.navigations.length, 0, "参数校验必须早于导航");
  outcome.provider.assertBalanced();
});

test("矩阵·非法参数：imageTimeoutMs 小于 1000 → invalid-params", async () => {
  const upstream = new FakeUpstream();
  const outcome = await runSkillWithFixtures(
    new BiliArticleSkill(deps(), { outputDir }),
    { opusId: "820000000000001", imageTimeoutMs: 500 } as BiliArticleParams,
    { upstream, html: opusDetailHtmlFixture, storageRoot: outputDir },
  );

  assert.equal(outcome.expectFailureKind(), "invalid-params");
  assert.equal(outcome.page.navigations.length, 0);
  outcome.provider.assertBalanced();
});

// ============================================================================
// ④ RAII —— 失败路径同样要还租约
// ============================================================================

test("RAII：无论成功失败，页面租约都被释放", async () => {
  for (const [label, html] of [
    ["成功", opusDetailHtmlFixture],
    ["失败（充电拦截）", opusDetailChargeBlockedHtmlFixture],
  ] as const) {
    const upstream = new FakeUpstream().route(DETAIL_PATH, {
      body: webDynamicDetailFixture("820000000000001"),
    });
    const outcome = await runSkillWithFixtures(
      new BiliArticleSkill(deps(), { outputDir }),
      { opusId: "820000000000001" } as BiliArticleParams,
      { upstream, html, storageRoot: outputDir },
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
