/**
 * 环境变量配置
 *
 * 集中管理所有可配置项，从环境变量读取，提供合理默认值。
 */

export class Configuration {
  // ── RSSHub Runtime ──

  get defaultRsshubServiceBaseUrl(): string {
    return "rsshub://embedded";
  }

  get rsshubRuntimeLabel(): string {
    return "默认内嵌 RSSHub runtime";
  }

  get rsshubRuntimeMode(): "embedded-package" {
    return "embedded-package";
  }

  get rsshubPuppeteerWsEndpoint(): string | null {
    return process.env.RSSHUB_PUPPETEER_WS_ENDPOINT?.trim() || null;
  }

  get rsshubCacheType(): string {
    return process.env.RSSHUB_CACHE_TYPE?.trim() || "memory";
  }

  get rsshubMemoryMax(): number | null {
    const value = Number(process.env.RSSHUB_MEMORY_MAX || "");
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  get rsshubRequestTimeout(): number {
    return Number(process.env.RSSHUB_REQUEST_TIMEOUT) || this.feedFetchTimeout;
  }

  get rsshubUserAgent(): string | null {
    return process.env.RSSHUB_UA?.trim() || null;
  }

  get rsshubNoRandomUa(): boolean {
    return ["1", "true", "yes"].includes(
      (process.env.RSSHUB_NO_RANDOM_UA || "").trim().toLowerCase(),
    );
  }

  // ── Browser ──

  get browserUrl(): string {
    return process.env.BROWSER_URL || "http://127.0.0.1:4444";
  }

  get browserPort(): number {
    try {
      return Number(new URL(this.browserUrl).port) || 4444;
    } catch {
      return 4444;
    }
  }

  get browserHost(): string {
    try {
      return new URL(this.browserUrl).hostname || "127.0.0.1";
    } catch {
      return "127.0.0.1";
    }
  }

  get browserConnectTimeout(): number {
    return Number(process.env.BROWSER_CONNECT_TIMEOUT) || 30_000;
  }

  // ── Feed / Enrichment ──

  get feedFetchTimeout(): number {
    return Number(process.env.FEED_FETCH_TIMEOUT) || 30_000;
  }

  get minContentLength(): number {
    return Math.max(0, Number(process.env.MIN_CONTENT_LENGTH) || 200);
  }

  get maxFeedItems(): number {
    return Math.max(0, Number(process.env.MAX_FEED_ITEMS) || 0);
  }

  get maxEnrichItems(): number {
    return Math.max(1, Number(process.env.MAX_ENRICH_ITEMS) || 20);
  }

  get enrichConcurrency(): number {
    return Math.max(1, Number(process.env.ENRICH_CONCURRENCY) || 3);
  }

  // ── Page ──

  get pageNavigationTimeout(): number {
    return Number(process.env.PAGE_NAVIGATION_TIMEOUT) || 90_000;
  }

  get pageContentTimeout(): number {
    return Number(process.env.PAGE_CONTENT_TIMEOUT) || 60_000;
  }

  // ── Service ──

  get serviceHealthTimeout(): number {
    return 10_000;
  }

  // ── CLI ──

  get globalTimeout(): number {
    return Number(process.env.GLOBAL_TIMEOUT) || 300_000;
  }
}
