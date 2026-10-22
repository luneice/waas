/**
 * 补全层接口
 *
 * 两级策略链：
 * - IItemEnricher: item 级，决定用什么手段获取全文
 * - IPageExtractor: page 级，决定用什么方式从页面提取内容
 */
import type { Frame, Page } from "puppeteer-core";
import type {
  RssItem,
  EnrichOptions,
  EnrichResult,
  ExtractResult,
  DetailSelectors,
} from "@src/types";

// ============================================================================
// Item 级 — 用什么手段获取全文
// ============================================================================

/**
 * 单条 item 补全策略
 *
 * Chain of Responsibility 模式：
 * - 返回 RssItem → 补全成功
 * - 返回 null   → 该策略不适用/失败，交给下一个
 * - 抛异常      → 意外错误（chain 捕获并记录）
 */
export interface IItemEnricher {
  tryEnrich(item: RssItem): Promise<RssItem | null>;
}

/**
 * 批量补全编排器
 */
export interface IEnrichmentChain {
  enrich(
    allItems: RssItem[],
    incompleteItems: RssItem[],
    options?: EnrichOptions,
  ): Promise<EnrichResult>;
}

// ============================================================================
// Page 级 — 用什么方式从页面提取内容
// ============================================================================

/**
 * 可执行正文提取的浏览器上下文。
 *
 * 部分站点把正文放在 iframe 中；Page 与 Frame 都提供
 * evaluate/content/waitForFunction，同一组 extractor 可直接复用。
 */
export type PageExtractionContext = Page | Frame;

/**
 * 页面内容提取策略
 *
 * 策略模式：
 * - 返回 ExtractResult → 提取成功且质量达标
 * - 返回 null          → 提取失败或质量不达标，让下一个策略试
 */
export interface IPageExtractor {
  tryExtract(
    page: PageExtractionContext,
    url: string,
    selectors?: DetailSelectors,
  ): Promise<ExtractResult | null>;
}
