/**
 * page-extract 模块测试（L2，docs/TESTING.md §3.3 标准三件）。
 *
 * 主线注入 fake `IPageExtractor[]`（见 fixtures/page-extract.fixture.ts 文件
 * 头注释：真实 extractor 开头的字符串 `page.evaluate("if (typeof __name...")`
 * 会让 FakePage 的 vm 重建抛 SyntaxError，真实提取质量已在
 * test/unit/html-to-markdown.test.ts 里绕开 page 直接测）。
 *
 * 覆盖策略链编排（顺序 / 首个命中即返回 / 全部失败降级）+ emit 落盘两种
 * sink 分支（FileArtifactSink / DocumentArtifactSink）+ 错误矩阵。
 *
 * 断言纪律（§8 红线）：只锁 kind 不锁 message；每个用例尾部
 * `provider.assertBalanced()`。
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Frame } from "puppeteer-core";
import {
  testing,
  FileArtifactSink,
  DocumentArtifactSink,
  FlatLayout,
} from "@spider/core";
import { IntelSidecarStrategy } from "@spider/sidecar-intel";

import type {
  IPageExtractor,
  PageExtractionContext,
} from "@src/enrichment/interfaces";
import { PageExtractSkill } from "@src/skill/page-extract.skill";
import { Configuration } from "@src/config";

import {
  fakeExtractor,
  fakeExtractorRecording,
  throwingExtractor,
  sampleExtractResult,
} from "../fixtures/page-extract.fixture";

const { FakeUpstream, runSkillWithFixtures } = testing;

const noopUpstream = () => new FakeUpstream();

function fakeFrame(url: string, textLength: number): Frame {
  return {
    url: () => url,
    evaluate: async () => textLength,
  } as unknown as Frame;
}

class FramedFakePage extends testing.FakePage {
  readonly shortFrame = fakeFrame("https://example.invalid/ad-frame", 20);
  readonly contentFrame = fakeFrame(
    "https://example.invalid/article-frame",
    2_000,
  );

  mainFrame(): Frame {
    return this as unknown as Frame;
  }

  frames(): Frame[] {
    return [this.mainFrame(), this.shortFrame, this.contentFrame];
  }

  async title(): Promise<string> {
    return "顶层文档中的完整文章标题";
  }
}

// ============================================================================
// ① 成功信封 —— 策略链编排
// ============================================================================

test("成功信封：第一个 extractor 命中即返回，不再尝试后续策略", async () => {
  const order: string[] = [];
  const skill = new PageExtractSkill({
    sessionProvider: undefined as never,
    config: new Configuration(),
    extractors: [
      { async tryExtract() { order.push("first"); return sampleExtractResult; } },
      fakeExtractorRecording(order, "second"),
    ],
  });
  const outcome = await runSkillWithFixtures(
    skill,
    { url: "https://example.invalid/article" },
    { upstream: noopUpstream() },
  );

  const data = outcome.expectSuccess() as unknown as {
    title: string; link: string; description: string; author?: string; pubDate?: string;
  };
  assert.equal(data.title, "测试文章标题");
  assert.equal(data.author, "测试作者");
  assert.equal(data.description, sampleExtractResult.content);
  assert.deepEqual(order, ["first"], "第一个策略命中后不应再调用第二个");
  outcome.provider.assertBalanced();
});

test("成功信封：第一个策略返回 null（不适用），链式交给第二个", async () => {
  const order: string[] = [];
  const skill = new PageExtractSkill({
    sessionProvider: undefined as never,
    config: new Configuration(),
    extractors: [
      fakeExtractorRecording(order, "first"),
      { async tryExtract() { order.push("second"); return sampleExtractResult; } },
    ],
  });
  const outcome = await runSkillWithFixtures(
    skill,
    { url: "https://example.invalid/article" },
    { upstream: noopUpstream() },
  );

  outcome.expectSuccess();
  assert.deepEqual(order, ["first", "second"]);
  outcome.provider.assertBalanced();
});

test("成功信封：主文档无正文时从内容 iframe 提取，仍回显顶层 URL", async () => {
  const page = new FramedFakePage({ upstream: noopUpstream() });
  const provider = new testing.FakeSessionProvider(page);
  const calls: string[] = [];
  const iframeContent = sampleExtractResult.content.repeat(10);
  const extractor: IPageExtractor = {
    async tryExtract(context: PageExtractionContext, url: string) {
      calls.push(url);
      if (context !== page.contentFrame) return null;
      return {
        ...sampleExtractResult,
        title: "iframe 通用标题",
        content: iframeContent,
      };
    },
  };
  const skill = new PageExtractSkill({
    sessionProvider: undefined as never,
    config: new Configuration(),
    extractors: [extractor],
  });
  const url = "https://example.invalid/article";
  const outcome = await runSkillWithFixtures(
    skill,
    { url },
    { upstream: noopUpstream(), page, provider },
  );

  const data = outcome.expectSuccess() as unknown as {
    title: string;
    link: string;
    description: string;
  };
  assert.equal(data.title, "顶层文档中的完整文章标题");
  assert.equal(data.link, url, "iframe 只是正文载体，投递 URI 应保留顶层文章 URL");
  assert.equal(data.description, iframeContent);
  assert.deepEqual(calls, [url, "https://example.invalid/article-frame"]);
  outcome.provider.assertBalanced();
});

test("成功信封：全部策略返回 null → 降级为最小结果（title=page.title()，description=undefined）", async () => {
  const skill = new PageExtractSkill({
    sessionProvider: undefined as never,
    config: new Configuration(),
    extractors: [fakeExtractor(null), fakeExtractor(null)],
  });
  const outcome = await runSkillWithFixtures(
    skill,
    { url: "https://example.invalid/no-match" },
    { upstream: noopUpstream() },
  );

  const data = outcome.expectSuccess() as unknown as { title: string; description?: string };
  assert.equal(data.title, "fake-page", "FakePage.title() 固定返回 fake-page");
  assert.equal(data.description, undefined);
  outcome.provider.assertBalanced();
});

// ============================================================================
// ② 落盘（emit 阶段，两种 sink 分支）
// ============================================================================

let outputDir: string;

test.each([
  ["FileArtifactSink（无 intel 边车）"],
  ["DocumentArtifactSink（含 intel 边车）"],
] as const)("落盘：提取成功且 description 非空时落盘 —— %s", async ([label]) => {
  outputDir = await mkdtemp(join(tmpdir(), "rss-page-extract-test-"));
  try {
    const fileSink = new FileArtifactSink(outputDir);
    const sink =
      label.includes("DocumentArtifactSink")
        ? new DocumentArtifactSink(
            fileSink,
            new FlatLayout("media"),
            new IntelSidecarStrategy({ sourceId: "media", genre: "official_media" }),
          )
        : fileSink;

    const skill = new PageExtractSkill({
      sessionProvider: undefined as never,
      config: new Configuration(),
      extractors: [fakeExtractor(sampleExtractResult)],
      artifactSink: sink,
    });
    const outcome = await runSkillWithFixtures(
      skill,
      { url: "https://example.invalid/article" },
      { upstream: noopUpstream(), storageRoot: outputDir, artifactSink: sink },
    );

    const result = outcome.result as unknown as { artifacts?: Array<{ path: string; role: string }> };
    assert.ok(result.artifacts && result.artifacts.length >= 1, "应产生至少一个 artifact");
    const doc = result.artifacts!.find((a) => a.role === "document-text");
    assert.ok(doc, "应含 document-text 角色的产物");
    const content = await readFile(join(outputDir, doc!.path), "utf-8");
    assert.ok(content.includes("提取出的正文内容"));

    if (label.includes("DocumentArtifactSink")) {
      const sidecarPath = `${doc!.path}.meta.json`;
      const sidecarRaw = await readFile(join(outputDir, sidecarPath), "utf-8");
      const sidecar = JSON.parse(sidecarRaw);
      assert.equal(sidecar.source_id, "media");
    } else {
      assert.equal(result.artifacts!.length, 1, "FileArtifactSink 分支不应产生额外的边车文件");
    }
    outcome.provider.assertBalanced();
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("落盘：全部策略降级（description=undefined）时不产生任何 artifact", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "rss-page-extract-empty-"));
  try {
    const sink = new FileArtifactSink(tmp);
    const skill = new PageExtractSkill({
      sessionProvider: undefined as never,
      config: new Configuration(),
      extractors: [fakeExtractor(null)],
      artifactSink: sink,
    });
    const outcome = await runSkillWithFixtures(
      skill,
      { url: "https://example.invalid/empty" },
      { upstream: noopUpstream(), storageRoot: tmp, artifactSink: sink },
    );

    const result = outcome.result as unknown as { artifacts?: unknown[] };
    assert.ok(!result.artifacts || result.artifacts.length === 0, "空提取不该产任何文件");
    outcome.provider.assertBalanced();
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

// ============================================================================
// ③ 错误 kind 矩阵
// ============================================================================

test("矩阵·非法参数：url 缺失 → missing-context，不导航", async () => {
  const skill = new PageExtractSkill({
    sessionProvider: undefined as never,
    config: new Configuration(),
    extractors: [],
  });
  const outcome = await runSkillWithFixtures(
    skill,
    {} as { url: string },
    { upstream: noopUpstream() },
  );

  assert.equal(outcome.expectFailureKind(), "missing-context");
  assert.equal(outcome.page.navigations.length, 0, "参数校验必须早于导航");
  outcome.provider.assertBalanced();
});

test("矩阵·导航失败：page.goto 抛错 → pipeline-error（navigate 被覆写，绕过 navigation-failed 包装，如实记录现状）", async () => {
  const { FakePage, FakeSessionProvider } = testing;
  const page = new FakePage({ upstream: noopUpstream(), gotoError: "net::ERR_CONNECTION_REFUSED" });
  const provider = new FakeSessionProvider(page);
  const skill = new PageExtractSkill({
    sessionProvider: undefined as never,
    config: new Configuration(),
    extractors: [],
  });
  const outcome = await runSkillWithFixtures(
    skill,
    { url: "https://example.invalid/unreachable" },
    { upstream: noopUpstream(), page, provider },
  );

  assert.equal(outcome.expectFailureKind(), "pipeline-error");
  outcome.provider.assertBalanced();
});

test("矩阵·extractor 内部抛错 → 原样冒泡，兜底为 pipeline-error", async () => {
  const skill = new PageExtractSkill({
    sessionProvider: undefined as never,
    config: new Configuration(),
    extractors: [throwingExtractor("提取器内部崩溃")],
  });
  const outcome = await runSkillWithFixtures(
    skill,
    { url: "https://example.invalid/throw" },
    { upstream: noopUpstream() },
  );

  assert.equal(outcome.expectFailureKind(), "pipeline-error");
  outcome.provider.assertBalanced();
});

// ============================================================================
// ④ RAII —— 失败路径同样要还租约
// ============================================================================

test("RAII：无论成功失败，页面租约都被释放", async () => {
  for (const [label, extractors] of [
    ["成功", [fakeExtractor(sampleExtractResult)]],
    ["失败（extractor 抛错）", [throwingExtractor("boom")]],
  ] as const) {
    const skill = new PageExtractSkill({
      sessionProvider: undefined as never,
      config: new Configuration(),
      extractors: [...extractors],
    });
    const outcome = await runSkillWithFixtures(
      skill,
      { url: "https://example.invalid/raii" },
      { upstream: noopUpstream() },
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
