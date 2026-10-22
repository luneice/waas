/**
 * rss-intelligence fixture —— L2 专用。
 *
 * RssSkill 的真实 I/O 全部落在 FakeUpstream 覆盖不到的地方（Node 裸 fetch /
 * import("rsshub") / page.on("response") 事件流），构造函数注入
 * fake `IFeedProviderFactory` + fake `IEnrichmentChain` 即可把编排逻辑
 * （三来源分支 / 完整性评估 / summary / skipEnrichment / report 合并 /
 * sourceUrl 回显 / 错误 kind）全部锁死，不依赖任何网络或浏览器。
 */
import type { IFeedProvider, IFeedProviderFactory } from "@src/provider/interfaces";
import type { IEnrichmentChain } from "@src/enrichment/interfaces";
import type { RssFeed, RssItem, EnrichResult } from "@src/types";

export const sampleFeed: RssFeed = {
  title: "测试频道",
  link: "https://example.invalid/",
  description: "测试描述",
  items: [
    {
      title: "完整条目甲",
      link: "https://example.invalid/1",
      pubDate: "2026-01-01T00:00:00Z",
      description: "这是一段足够长的正文内容，用于确保完整性评估把它判为 complete，不触发补全流程，长度必须达到默认阈值 200 字符以上才行，所以这里需要写很多很多的填充文字来凑够长度，继续填充继续填充继续填充继续填充继续填充继续填充继续填充继续填充继续填充继续填充继续填充继续填充继续填充继续填充继续填充继续填充继续填充继续填充继续填充继续填充继续填充继续填充继续填充继续填充继续填充继续填充继续填充继续填充继续填充继续填充继续填充继续填充继续填充继续填充继续填充继续填充。",
      author: "作者甲",
      category: ["科技"],
    },
    {
      title: "不完整条目乙",
      link: "https://example.invalid/2",
      pubDate: "2026-01-02T00:00:00Z",
      description: "太短",
      author: "作者乙",
    },
    {
      title: "无链接条目丙（unenrichable）",
      link: "",
      pubDate: "2026-01-03T00:00:00Z",
      description: "太短",
    },
  ],
};

/** 创建一个总是返回给定 feed 的 fake provider。 */
export function fakeProvider(feed: RssFeed, opts: { type?: string; sourceUrl?: string } = {}): IFeedProvider {
  return {
    type: opts.type ?? "url",
    sourceUrl: opts.sourceUrl ?? "https://example.invalid/feed.xml",
    async fetch() {
      return feed;
    },
  };
}

/** 抛错的 fake provider（模拟 HTTP 失败 / 解析失败等）。 */
export function throwingProvider(error: unknown, opts: { type?: string; sourceUrl?: string } = {}): IFeedProvider {
  return {
    type: opts.type ?? "url",
    sourceUrl: opts.sourceUrl ?? "https://example.invalid/feed.xml",
    async fetch(): Promise<RssFeed> {
      throw error;
    },
  };
}

/** 记录 factory.create 收到的 params，返回给定 provider。 */
export function fakeProviderFactory(
  provider: IFeedProvider,
  onCreate?: (params: Record<string, unknown>) => void,
): IFeedProviderFactory {
  return {
    create(params: Record<string, unknown>): IFeedProvider {
      onCreate?.(params);
      return provider;
    },
  };
}

/** factory.create 直接抛错（模拟三入口全缺时的 missing-context）。 */
export function throwingProviderFactory(error: unknown): IFeedProviderFactory {
  return {
    create(): IFeedProvider {
      throw error;
    },
  };
}

/** 总是返回给定 EnrichResult 的 fake chain，记录调用参数供断言。 */
export function fakeEnrichmentChain(
  result: EnrichResult,
  onEnrich?: (allItems: RssItem[], incomplete: RssItem[], options?: unknown) => void,
): IEnrichmentChain {
  return {
    async enrich(allItems, incomplete, options) {
      onEnrich?.(allItems, incomplete, options);
      return result;
    },
  };
}
