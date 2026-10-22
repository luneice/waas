/**
 * rss-spider 公共 API
 */

// ── 类型 ──
export type {
  RssItem,
  RssFeed,
  RssParams,
  RssResult,
  DetailSelectors,
  ListSelectors,
  GoogleNewsLocale,
  EnrichOptions,
  EnrichResult,
  EnrichReport,
  EnrichError,
  CompletenessResult,
  ExtractResult,
  RouteInfo,
  DetectionResult,
  RouteResolution,
} from "./types";

// ── 接口 ──
export type {
  IFeedProvider,
  IFeedProviderFactory,
} from "./provider/interfaces";
export type {
  IItemEnricher,
  IEnrichmentChain,
  IPageExtractor,
  PageExtractionContext,
} from "./enrichment/interfaces";
export type { IRsshubRuntime, IRsshubDiscovery } from "./rsshub/interfaces";

// ── Skills ──
export { RssSkill } from "./skill/rss.skill";
export { PageExtractSkill } from "./skill/page-extract.skill";
export { ListExtractSkill } from "./skill/list-extract.skill";
export { RouteDiscoverSkill } from "./skill/route-discover.skill";

// ── Composition Root ──
export { createDefaultRegistry } from "./skill/registry";
export type { RegistryDeps } from "./skill/registry";

// ── Config ──
export { Configuration } from "./config";
