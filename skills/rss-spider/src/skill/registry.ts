/**
 * Skill 注册表 — Composition Root
 *
 * 所有依赖在此处创建并组装，IoC 链从此处贯穿到底层。
 * 支持 DI：通过 deps 参数部分覆盖依赖（便于测试 / 定制）。
 */
import {
  SkillRegistry,
  ChromeSessionProvider,
  FileArtifactSink,
  DocumentArtifactSink,
  FlatLayout,
} from "@spider/core";
import type { IBrowserSessionProvider, IArtifactSink } from "@spider/core";
import {
  IntelSidecarStrategy,
  type IntelGenre,
} from "@spider/sidecar-intel";
import type { IRsshubRuntime, IRsshubDiscovery } from "@src/rsshub/interfaces";
import type { IFeedProviderFactory } from "@src/provider/interfaces";
import type {
  IEnrichmentChain,
  IItemEnricher,
  IPageExtractor,
} from "@src/enrichment/interfaces";

import { Configuration } from "@src/config";
import { EmbeddedRsshubRuntime } from "@src/rsshub/embedded-runtime";
import { RsshubDiscovery } from "@src/rsshub/discovery";
import { FeedProviderFactory } from "@src/provider/factory";
import { EnrichmentChain } from "@src/enrichment/enrichment-chain";
import { RsshubEnricher } from "@src/enrichment/rsshub.enricher";
import { BrowserEnricher } from "@src/enrichment/browser.enricher";
import { ReadabilityExtractor } from "@src/enrichment/readability.extractor";
import { CustomExtractor } from "@src/enrichment/custom.extractor";

import { RssSkill } from "./rss.skill";
import { PageExtractSkill } from "./page-extract.skill";
import { ListExtractSkill } from "./list-extract.skill";
import { RouteDiscoverSkill } from "./route-discover.skill";

/** 本源在 intel 的 source_id；由本包持有，core 不认识具体源。 */
export const RSS_SOURCE_ID = "media";
/** rss 条目默认体裁；来源多样时可经 createDefaultRegistry 覆盖。 */
export const RSS_DEFAULT_GENRE: IntelGenre = "official_media";

/** Composition Root 可覆盖的全部依赖 */
export interface RegistryDeps {
  config: Configuration;
  sessionProvider: IBrowserSessionProvider;
  rsshubRuntime: IRsshubRuntime;
  discovery: IRsshubDiscovery;
  extractors: IPageExtractor[];
  enrichers: IItemEnricher[];
  enrichmentChain: IEnrichmentChain;
  providerFactory: IFeedProviderFactory;
  /** 单页深读的文档产物落盘（默认 DocumentArtifactSink，写 intel 边车）。 */
  artifactSink: IArtifactSink;
}

export function createDefaultRegistry(
  deps?: Partial<RegistryDeps>,
  browserURL?: string,
  outputDir?: string,
  genre: IntelGenre = RSS_DEFAULT_GENRE,
): SkillRegistry {
  // ── Layer 0: Infrastructure ──
  const config = deps?.config ?? new Configuration();
  const sessionProvider =
    deps?.sessionProvider ?? new ChromeSessionProvider({ browserURL });

  // 单页深读产物落盘：FlatLayout("media") + IntelSidecarStrategy。
  // 仅 page-extract（AI 甄别后逐篇深读）落盘，其余 skill 纯 stdout。
  const artifactSink =
    deps?.artifactSink ??
    new DocumentArtifactSink(
      new FileArtifactSink(outputDir ?? process.cwd()),
      new FlatLayout(RSS_SOURCE_ID),
      new IntelSidecarStrategy({ sourceId: RSS_SOURCE_ID, genre }),
    );

  // ── Layer 1: RSSHub Module ──
  const rsshubRuntime =
    deps?.rsshubRuntime ?? new EmbeddedRsshubRuntime(sessionProvider, config);
  const discovery = deps?.discovery ?? new RsshubDiscovery();

  // ── Layer 2: Page Extractors (ordered by priority) ──
  const extractors = deps?.extractors ?? [
    new ReadabilityExtractor(config.minContentLength),
    new CustomExtractor(),
  ];

  // ── Layer 3: Item Enrichers (ordered by priority) ──
  const enrichers = deps?.enrichers ?? [
    new RsshubEnricher({ discovery, runtime: rsshubRuntime, config }),
    new BrowserEnricher({ sessionProvider, extractors, config }),
  ];

  // ── Layer 4: Enrichment Chain ──
  const enrichmentChain =
    deps?.enrichmentChain ?? new EnrichmentChain({ enrichers, config });

  // ── Layer 5: Provider Factory ──
  const providerFactory =
    deps?.providerFactory ??
    new FeedProviderFactory({
      rsshubRuntime,
      discovery,
      sessionProvider,
      config,
    });

  // ── Skill Registration ──
  return new SkillRegistry()
    .register(new RssSkill({ providerFactory, enrichmentChain, config }))
    .register(
      new PageExtractSkill({
        sessionProvider,
        extractors,
        config,
        artifactSink,
      }),
    )
    .register(new ListExtractSkill({ sessionProvider, config }))
    .register(new RouteDiscoverSkill({ discovery }));
}
