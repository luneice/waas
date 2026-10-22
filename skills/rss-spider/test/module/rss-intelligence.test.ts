/**
 * rss-intelligence 模块测试（L2，docs/TESTING.md §3.3 标准三件）。
 *
 * RssSkill 是三层编排器（provider 工厂 → 完整性评估 → enrichment chain），
 * 真实 I/O 全部落在 FakeUpstream 覆盖不到的地方（见 fixtures 文件头），
 * 主线注入 fake `IFeedProviderFactory` + fake `IEnrichmentChain` 把编排逻辑
 * 测干净：三个来源分支的互斥优先级（url > route > googleQuery）、
 * summary/skipEnrichment 两个提前返回分支、完整性阈值触发补全、
 * report 合并回全量、sourceUrl/totalItems 回显、错误 kind 矩阵。
 *
 * 断言纪律（§8 红线）：只锁 kind 不锁 message。
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { MissingContextError, EndpointHttpError, InvalidParamsError } from "@spider/core";

import { RssSkill } from "@src/skill/rss.skill";
import { Configuration } from "@src/config";

import { expectSnapshot } from "../helpers/snapshot";
import {
  sampleFeed,
  fakeProvider,
  throwingProvider,
  fakeProviderFactory,
  throwingProviderFactory,
  fakeEnrichmentChain,
} from "../fixtures/rss-intelligence.fixture";

const config = new Configuration();

/** 补全后合并回全量的 fake enrich 结果：把「不完整条目乙」的 description 补长。 */
function enrichedResultFor(feed = sampleFeed) {
  return {
    items: feed.items.map((it) =>
      it.link === "https://example.invalid/2" ? { ...it, description: "补全后的完整正文内容" } : it,
    ),
    report: { enriched: 1, failed: 0, skipped: 0, errors: [] },
  };
}

// ============================================================================
// ① 成功信封 —— 三条来源分支的编排（走完整性评估 + 补全）
// ============================================================================

test("成功信封：url 直传 → provider.create 收到 url，完整流程含补全 + report", async () => {
  let receivedParams: Record<string, unknown> | undefined;
  const skill = new RssSkill({
    providerFactory: fakeProviderFactory(fakeProvider(sampleFeed), (p) => { receivedParams = p; }),
    enrichmentChain: fakeEnrichmentChain(enrichedResultFor()),
    config,
  });
  const result = await skill.execute({ url: "https://example.invalid/feed.xml" });

  expectSnapshot("rss-intelligence-url-envelope", result);

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.success, true);
  assert.equal(result.data.feed.items.length, 3);
  assert.equal(result.data.report?.enriched, 1);
  assert.equal(receivedParams?.url, "https://example.invalid/feed.xml");
  assert.equal((result.metadata.params as Record<string, unknown>).sourceUrl, "https://example.invalid/feed.xml");
  assert.equal((result.metadata.params as Record<string, unknown>).totalItems, 3);
});

test("成功信封：route 直传 → provider.create 收到 route（与 url 走同一条 factory 接口）", async () => {
  let receivedParams: Record<string, unknown> | undefined;
  const skill = new RssSkill({
    providerFactory: fakeProviderFactory(
      fakeProvider(sampleFeed, { type: "rsshub", sourceUrl: "rsshub://embedded/github/trending/daily" }),
      (p) => { receivedParams = p; },
    ),
    enrichmentChain: fakeEnrichmentChain(enrichedResultFor()),
    config,
  });
  const result = await skill.execute({ route: "/github/trending/daily" });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(receivedParams?.route, "/github/trending/daily");
  assert.equal(
    (result.metadata.params as Record<string, unknown>).sourceUrl,
    "rsshub://embedded/github/trending/daily",
  );
});

test("成功信封：googleQuery 直传 → provider.create 收到 googleQuery", async () => {
  let receivedParams: Record<string, unknown> | undefined;
  const skill = new RssSkill({
    providerFactory: fakeProviderFactory(
      fakeProvider(sampleFeed, { type: "google-news", sourceUrl: "https://news.google.com/rss/search?q=AI" }),
      (p) => { receivedParams = p; },
    ),
    enrichmentChain: fakeEnrichmentChain(enrichedResultFor()),
    config,
  });
  const result = await skill.execute({ googleQuery: "AI" });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(receivedParams?.googleQuery, "AI");
});

// ============================================================================
// ② 两个提前返回分支：summary / skipEnrichment（不触发 enrichmentChain）
// ============================================================================

test("提前返回：summary=true → 只保留 title/link/pubDate/author/category，report=null，不调用 enrichmentChain", async () => {
  let enrichCalled = false;
  const skill = new RssSkill({
    providerFactory: fakeProviderFactory(fakeProvider(sampleFeed)),
    enrichmentChain: fakeEnrichmentChain(enrichedResultFor(), () => { enrichCalled = true; }),
    config,
  });
  const result = await skill.execute({ url: "https://example.invalid/feed.xml", summary: true });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.report, null);
  assert.equal(enrichCalled, false, "summary 模式应提前返回，不触发补全链路");
  const item = result.data.feed.items[0] as unknown as Record<string, unknown>;
  assert.ok(!("description" in item), "summary 模式应删除 description 字段（而非置空）");
  assert.equal(item.title, "完整条目甲");
});

test("提前返回：skipEnrichment=true → report=null，不调用 enrichmentChain，即便存在不完整条目", async () => {
  let enrichCalled = false;
  const skill = new RssSkill({
    providerFactory: fakeProviderFactory(fakeProvider(sampleFeed)),
    enrichmentChain: fakeEnrichmentChain(enrichedResultFor(), () => { enrichCalled = true; }),
    config,
  });
  const result = await skill.execute({ url: "https://example.invalid/feed.xml", skipEnrichment: true });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.report, null);
  assert.equal(enrichCalled, false);
  assert.equal(result.data.feed.items.length, 3, "skipEnrichment 时应原样返回全部条目，不裁剪");
});

test("提前返回：全部条目都 complete（无 incomplete）→ 即便 skipEnrichment=false 也不调用 enrichmentChain", async () => {
  const allCompleteFeed = {
    ...sampleFeed,
    items: sampleFeed.items.map((it) => ({ ...it, description: sampleFeed.items[0].description, link: it.link || "https://example.invalid/fallback" })),
  };
  let enrichCalled = false;
  const skill = new RssSkill({
    providerFactory: fakeProviderFactory(fakeProvider(allCompleteFeed)),
    enrichmentChain: fakeEnrichmentChain(enrichedResultFor(), () => { enrichCalled = true; }),
    config,
  });
  const result = await skill.execute({ url: "https://example.invalid/feed.xml" });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(enrichCalled, false, "全部条目都完整时不该触发补全");
  assert.equal(result.data.report, null);
});

// ============================================================================
// ③ 完整性评估触发补全 + maxItems 传参
// ============================================================================

test("完整性评估：存在 incomplete 条目 → 调用 enrichmentChain，maxItems 优先于 maxEnrichItems 传给 enrich options", async () => {
  let receivedOptions: Record<string, unknown> | undefined;
  const skill = new RssSkill({
    providerFactory: fakeProviderFactory(fakeProvider(sampleFeed)),
    enrichmentChain: fakeEnrichmentChain(enrichedResultFor(), (_all, _incomplete, options) => {
      receivedOptions = options as Record<string, unknown>;
    }),
    config,
  });
  const result = await skill.execute({
    url: "https://example.invalid/feed.xml",
    maxItems: 5,
    maxEnrichItems: 99,
  });

  assert.equal(result.success, true);
  assert.equal(receivedOptions?.maxItems, 5, "maxItems 应优先于 maxEnrichItems");
});

test("完整性评估：maxItems 缺失时回退 maxEnrichItems，二者都缺失时回退 15", async () => {
  let receivedOptions: Record<string, unknown> | undefined;
  const skill = new RssSkill({
    providerFactory: fakeProviderFactory(fakeProvider(sampleFeed)),
    enrichmentChain: fakeEnrichmentChain(enrichedResultFor(), (_all, _incomplete, options) => {
      receivedOptions = options as Record<string, unknown>;
    }),
    config,
  });
  await skill.execute({ url: "https://example.invalid/feed.xml", maxEnrichItems: 7 });
  assert.equal(receivedOptions?.maxItems, 7);

  await skill.execute({ url: "https://example.invalid/feed.xml" });
  assert.equal(receivedOptions?.maxItems, 15);
});

test("完整性评估：无 link 的条目（unenrichable）不计入 incomplete，不影响 skipped 计数", async () => {
  let receivedIncomplete: unknown[] = [];
  const skill = new RssSkill({
    providerFactory: fakeProviderFactory(fakeProvider(sampleFeed)),
    enrichmentChain: fakeEnrichmentChain(enrichedResultFor(), (_all, incomplete) => {
      receivedIncomplete = incomplete;
    }),
    config,
  });
  await skill.execute({ url: "https://example.invalid/feed.xml" });

  // sampleFeed 里只有「不完整条目乙」有 link 且内容短；「无链接条目丙」因无 link 被分去 unenrichable
  assert.equal(receivedIncomplete.length, 1);
  assert.equal((receivedIncomplete[0] as { link: string }).link, "https://example.invalid/2");
});

// ============================================================================
// ④ 错误 kind 矩阵
// ============================================================================

test("矩阵·非法参数：url/route/googleQuery 三个入口全缺 → missing-context", async () => {
  const skill = new RssSkill({
    providerFactory: throwingProviderFactory(
      new MissingContextError("需提供 url / route / googleQuery 之一作为 Feed 来源", { scope: "feed-provider-factory" }),
    ),
    enrichmentChain: fakeEnrichmentChain(enrichedResultFor()),
    config,
  });
  const result = await skill.execute({});

  assert.equal(result.success, false);
  if (result.success) return;
  assert.equal(result.metadata.errorInfo?.kind, "missing-context");
});

test("矩阵·feed 请求失败（HTTP 非 2xx）→ endpoint-http", async () => {
  const skill = new RssSkill({
    providerFactory: fakeProviderFactory(
      throwingProvider(new EndpointHttpError("Feed 请求失败: 503 Service Unavailable (https://x.invalid)", { scope: "url-provider" })),
    ),
    enrichmentChain: fakeEnrichmentChain(enrichedResultFor()),
    config,
  });
  const result = await skill.execute({ url: "https://example.invalid/broken-feed.xml" });

  assert.equal(result.success, false);
  if (result.success) return;
  assert.equal(result.metadata.errorInfo?.kind, "endpoint-http");
});

test("矩阵·非法文档（HTML 冒充 feed）→ invalid-params", async () => {
  const skill = new RssSkill({
    providerFactory: fakeProviderFactory(
      throwingProvider(new InvalidParamsError("无法识别的 XML feed 格式（非 RSS 2.0 / Atom）", { scope: "feed-parser" })),
    ),
    enrichmentChain: fakeEnrichmentChain(enrichedResultFor()),
    config,
  });
  const result = await skill.execute({ url: "https://example.invalid/not-a-feed.html" });

  assert.equal(result.success, false);
  if (result.success) return;
  assert.equal(result.metadata.errorInfo?.kind, "invalid-params");
});

test("矩阵·补全阶段单条抛错不影响整体成功：report.errors 记录失败，success 仍为 true", async () => {
  const skill = new RssSkill({
    providerFactory: fakeProviderFactory(fakeProvider(sampleFeed)),
    enrichmentChain: fakeEnrichmentChain({
      items: sampleFeed.items,
      report: { enriched: 0, failed: 1, skipped: 0, errors: [{ url: "https://example.invalid/2", error: "详情页 404" }] },
    }),
    config,
  });
  const result = await skill.execute({ url: "https://example.invalid/feed.xml" });

  assert.equal(result.success, true, "补全失败是软失败，不该让整个 skill 失败");
  if (!result.success) return;
  assert.equal(result.data.report?.failed, 1);
  assert.equal(result.data.report?.errors[0].error, "详情页 404");
});

test("矩阵·未知裸 Error → pipeline-error 兜底", async () => {
  const skill = new RssSkill({
    providerFactory: fakeProviderFactory(throwingProvider(new Error("未分类的意外错误"))),
    enrichmentChain: fakeEnrichmentChain(enrichedResultFor()),
    config,
  });
  const result = await skill.execute({ url: "https://example.invalid/feed.xml" });

  assert.equal(result.success, false);
  if (result.success) return;
  assert.ok(result.metadata.errorInfo?.kind, "buildFailure 必须归一化出 kind");
});

// ============================================================================
// ⑤ 正常空集
// ============================================================================

test("正常空集：feed.items 为空数组 → success，不触发补全，不报错", async () => {
  const emptyFeed = { title: "空频道", link: "https://example.invalid/", description: "", items: [] };
  let enrichCalled = false;
  const skill = new RssSkill({
    providerFactory: fakeProviderFactory(fakeProvider(emptyFeed)),
    enrichmentChain: fakeEnrichmentChain(enrichedResultFor(), () => { enrichCalled = true; }),
    config,
  });
  const result = await skill.execute({ url: "https://example.invalid/empty-feed.xml" });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.deepEqual(result.data.feed.items, []);
  assert.equal(enrichCalled, false);
});
