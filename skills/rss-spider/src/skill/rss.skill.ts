/**
 * RSS 情报采集 Skill（主 Skill）
 *
 * 三步漏斗编排：Feed 获取 → 完整性评估 → 按需补全。
 * 继承 BaseSkill，不继承 PuppeteerSkill（因为它是编排器，不是单页 Skill）。
 */
import {
  BaseSkill,
  type SkillParamSchema,
  type SkillResult,
  type BrowserSkillOptions,
} from "@spider/core";
import type { IFeedProviderFactory } from "@src/provider/interfaces";
import type { IEnrichmentChain } from "@src/enrichment/interfaces";
import type { Configuration } from "@src/config";
import type {
  RssParams,
  RssResult,
  RssFeed,
  RssItem,
  CompletenessResult,
  EnrichReport,
} from "@src/types";

/** RssSkill 依赖 */
export interface RssSkillDeps {
  providerFactory: IFeedProviderFactory;
  enrichmentChain: IEnrichmentChain;
  config: Configuration;
}

/**
 * 完整性评估 — 纯函数
 * 将 RSS items 按内容完整度分类。
 */
function assessCompleteness(
  items: RssItem[],
  minContentLength: number,
): CompletenessResult {
  const complete: RssItem[] = [];
  const incomplete: RssItem[] = [];
  const unenrichable: RssItem[] = [];

  for (const item of items) {
    if (!item.link) {
      unenrichable.push(item);
      continue;
    }
    const textLength = plainTextLength(item.description);
    if (textLength >= minContentLength) {
      complete.push(item);
    } else {
      incomplete.push(item);
    }
  }

  return { complete, incomplete, unenrichable };
}

function plainTextLength(content?: string): number {
  if (!content) return 0;
  return content
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim().length;
}

function summarizeFeed(feed: RssFeed): RssFeed {
  return {
    ...feed,
    items: feed.items.map(({ title, link, pubDate, author, category }) => ({
      title,
      link,
      pubDate,
      author,
      category,
    })),
  };
}

function emptyResult(error?: string): RssResult {
  return {
    success: false,
    feed: { title: "", link: "", description: "", items: [] },
    report: null,
    error,
  };
}

export class RssSkill extends BaseSkill<
  RssParams,
  RssResult,
  RssResult,
  BrowserSkillOptions
> {
  readonly id = "rss-intelligence";
  readonly name = "RSS 情报采集";
  readonly description =
    "从 RSS 源获取情报信息，自动判断内容完整性并补全不完整条目。支持直接 URL、RSSHub 路由和 Google News 三种来源。";
  readonly paramSchema: SkillParamSchema[] = [
    {
      name: "url",
      type: "string",
      required: false,
      description:
        "直接 RSS/Atom/JSON feed 地址（与 route 二选一，优先级最高）",
    },
    {
      name: "route",
      type: "string",
      required: false,
      description:
        "RSSHub 路由路径（如 /bilibili/user/video/2267573），与 url 二选一",
    },
    {
      name: "rsshubBase",
      type: "string",
      required: false,
      description:
        "RSSHub 实例地址（仅 route 模式生效；未提供时使用内嵌 RSSHub runtime）",
    },
    {
      name: "googleQuery",
      type: "string",
      required: false,
      description: "Google News 搜索关键词，与 url / route 三选一",
    },
    {
      name: "googleLocale",
      type: "object",
      required: false,
      description: "Google News 地区配置 { hl, gl, ceid }",
    },
    {
      name: "googleSource",
      type: "string",
      required: false,
      description:
        '限定 Google News 来源域名（如 "techcrunch.com"、"36kr.com"），仅 googleQuery 模式生效',
    },
    {
      name: "googleWhen",
      type: "string",
      required: false,
      description:
        'Google News 时间范围筛选："1h"（1小时）、"1d"（1天）、"7d"（7天）、"30d"（30天）、"1y"（1年），仅 googleQuery 模式生效',
    },
    {
      name: "maxItems",
      type: "number",
      required: false,
      default: 15,
      description: "最大深入爬取条数",
    },
    {
      name: "summary",
      type: "boolean",
      required: false,
      default: false,
      description: "摘要模式：只返回 title + link + pubDate + author",
    },
    {
      name: "skipEnrichment",
      type: "boolean",
      required: false,
      default: false,
      description: "跳过内容补全",
    },
    {
      name: "minContentLength",
      type: "number",
      required: false,
      description: "纯文本最小字符数，低于此值触发补全",
    },
    {
      name: "maxEnrichItems",
      type: "number",
      required: false,
      description: "最大补全条数",
    },
    {
      name: "concurrency",
      type: "number",
      required: false,
      description: "补全并发数",
    },
    {
      name: "format",
      type: "string",
      required: false,
      default: "markdown",
      description: '输出正文格式："markdown"（默认）或 "html"',
    },
    {
      name: "detailSelectors",
      type: "object",
      required: false,
      description: "详情页自定义 CSS 选择器 { content, title, author, time }",
    },
  ];

  private readonly deps: RssSkillDeps;

  constructor(deps: RssSkillDeps) {
    super();
    this.deps = deps;
  }

  async execute(
    params: RssParams,
    _options?: BrowserSkillOptions,
  ): Promise<SkillResult<RssResult>> {
    const startedAt = new Date();
    const normalized = this.normalizeParams(params);

    try {
      // ① 获取 Feed
      const provider = this.deps.providerFactory.create(
        normalized as unknown as Record<string, unknown>,
      );
      const feed = await provider.fetch();

      // 摘要模式 — 提前返回
      if (normalized.summary) {
        const result: RssResult = {
          success: true,
          feed: summarizeFeed(feed),
          report: null,
        };
        return this.buildSuccess(
          result,
          {
            ...normalized,
            sourceUrl: provider.sourceUrl,
          } as RssParams,
          startedAt,
        );
      }

      // ② 评估完整性
      const minLength =
        (normalized.minContentLength as number) ??
        this.deps.config.minContentLength;
      const { incomplete } = assessCompleteness(feed.items, minLength);

      // 无需补全 — 提前返回
      if (normalized.skipEnrichment || incomplete.length === 0) {
        const result: RssResult = { success: true, feed, report: null };
        return this.buildSuccess(
          result,
          {
            ...normalized,
            sourceUrl: provider.sourceUrl,
          } as RssParams,
          startedAt,
        );
      }

      // ③ 补全
      const enrichResult = await this.deps.enrichmentChain.enrich(
        feed.items,
        incomplete,
        {
          maxItems:
            (normalized.maxItems as number) ||
            (normalized.maxEnrichItems as number) ||
            15,
          concurrency: normalized.concurrency as number | undefined,
          format: (normalized.format as "markdown" | "html") || "markdown",
          selectors: normalized.detailSelectors as any,
        },
      );

      const result: RssResult = {
        success: true,
        feed: { ...feed, items: enrichResult.items },
        report: enrichResult.report,
      };

      return this.buildSuccess(
        result,
        {
          ...normalized,
          sourceUrl: provider.sourceUrl,
          totalItems: feed.items.length,
        } as RssParams,
        startedAt,
      );
    } catch (err) {
      // 直接透传原始错误：SpiderError 的 kind 由 buildFailure 保留
      return this.buildFailure(err, normalized, startedAt);
    }
  }
}
