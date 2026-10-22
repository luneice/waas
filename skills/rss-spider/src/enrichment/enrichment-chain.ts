/**
 * 补全编排器 — Chain of Responsibility
 *
 * 批量补全不完整条目：
 * 1. 对每条 item 按优先级尝试各个 IItemEnricher
 * 2. 用 Map<string, RssItem>（按 link）做结果映射，避免引用相等问题
 * 3. 统一错误收集
 */
import type { IEnrichmentChain, IItemEnricher } from "./interfaces";
import type {
  RssItem,
  EnrichOptions,
  EnrichResult,
  EnrichReport,
  EnrichError,
} from "@src/types";
import type { Configuration } from "@src/config";
import { runWithConcurrency } from "@src/utils/concurrency";

/** EnrichmentChain 依赖 */
export interface EnrichmentChainDeps {
  enrichers: IItemEnricher[];
  config: Configuration;
}

export class EnrichmentChain implements IEnrichmentChain {
  private readonly enrichers: IItemEnricher[];
  private readonly config: Configuration;

  constructor(deps: EnrichmentChainDeps) {
    this.enrichers = deps.enrichers;
    this.config = deps.config;
  }

  async enrich(
    allItems: RssItem[],
    incompleteItems: RssItem[],
    options?: EnrichOptions,
  ): Promise<EnrichResult> {
    const maxItems = options?.maxItems ?? this.config.maxEnrichItems;
    const concurrency = options?.concurrency ?? this.config.enrichConcurrency;

    const toEnrich = incompleteItems.slice(0, maxItems);
    const skipped = incompleteItems.length - toEnrich.length;

    const errors: EnrichError[] = [];
    let enriched = 0;
    let failed = 0;

    // 按 link 做映射，避免 WeakMap 引用相等问题
    const enrichedByLink = new Map<string, RssItem>();

    await runWithConcurrency(toEnrich, concurrency, async (item) => {
      const result = await this.tryEnrichItem(item, errors);
      if (result) {
        enrichedByLink.set(item.link, result);
        enriched++;
      } else {
        failed++;
      }
    });

    // 按 link 合并结果
    const mergedItems = allItems.map(
      (item) => enrichedByLink.get(item.link) ?? item,
    );

    const report: EnrichReport = { enriched, failed, skipped, errors };
    return { items: mergedItems, report };
  }

  /**
   * 对单条 item 尝试所有 enricher（按注入顺序 = 优先级）
   */
  private async tryEnrichItem(
    item: RssItem,
    errors: EnrichError[],
  ): Promise<RssItem | null> {
    for (const enricher of this.enrichers) {
      try {
        const result = await enricher.tryEnrich(item);
        if (result) return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ url: item.link, error: msg });
      }
    }
    return null;
  }
}
