/**
 * Feed 来源工厂
 *
 * 根据参数决定使用哪种 FeedProvider：
 * - url 提供了 → UrlFeedProvider
 * - route 提供了 → RsshubFeedProvider
 * - googleQuery 提供了 → GoogleNewsFeedProvider
 *
 * 内部利用 IRsshubDiscovery 实现 URL → RSSHub 路由的自动检测。
 */
import type { IFeedProvider, IFeedProviderFactory } from "./interfaces";
import { MissingContextError } from "@spider/core";
import type { IRsshubRuntime } from "@src/rsshub/interfaces";
import type { IRsshubDiscovery } from "@src/rsshub/interfaces";
import type { IBrowserSessionProvider } from "@spider/core";
import type { Configuration } from "@src/config";
import type { GoogleNewsLocale } from "@src/types";
import { UrlFeedProvider } from "./url.provider";
import { RsshubFeedProvider } from "./rsshub.provider";
import { GoogleNewsFeedProvider } from "./google-news.provider";

/** 错误 scope 标识 */
const SCOPE = "feed-provider-factory";

/** FeedProviderFactory 依赖 */
export interface FeedProviderFactoryDeps {
  rsshubRuntime: IRsshubRuntime;
  discovery: IRsshubDiscovery;
  sessionProvider: IBrowserSessionProvider;
  config: Configuration;
}

export class FeedProviderFactory implements IFeedProviderFactory {
  private readonly runtime: IRsshubRuntime;
  private readonly discovery: IRsshubDiscovery;
  private readonly sessionProvider: IBrowserSessionProvider;
  private readonly config: Configuration;

  constructor(deps: FeedProviderFactoryDeps) {
    this.runtime = deps.rsshubRuntime;
    this.discovery = deps.discovery;
    this.sessionProvider = deps.sessionProvider;
    this.config = deps.config;
  }

  create(params: Record<string, unknown>): IFeedProvider {
    const url = params.url as string | undefined;
    const route = params.route as string | undefined;
    const googleQuery = params.googleQuery as string | undefined;

    // 优先级: url > route > googleQuery
    if (url) {
      return this.createFromUrl(url, params);
    }
    if (route) {
      return this.createFromRoute(route, params);
    }
    if (googleQuery) {
      return this.createFromGoogleQuery(googleQuery, params);
    }

    throw new MissingContextError(
      "需提供 url / route / googleQuery 之一作为 Feed 来源",
      { scope: SCOPE },
    );
  }

  private createFromUrl(
    url: string,
    params: Record<string, unknown>,
  ): IFeedProvider {
    // 尝试通过 Discovery 检测 URL 是否有对应的 RSSHub 路由
    const detections = this.discovery.detect(url);
    if (detections.length > 0 && detections[0].confidence >= 0.7) {
      return new RsshubFeedProvider(this.runtime, detections[0].resolvedPath);
    }
    // 兜底: 当作直接 RSS feed URL 处理
    return new UrlFeedProvider(url, this.config.feedFetchTimeout);
  }

  private createFromRoute(
    route: string,
    params: Record<string, unknown>,
  ): IFeedProvider {
    const rsshubBase =
      typeof params.rsshubBase === "string" && params.rsshubBase.trim()
        ? params.rsshubBase.trim()
        : undefined;
    return new RsshubFeedProvider(this.runtime, route, rsshubBase);
  }

  private createFromGoogleQuery(
    query: string,
    params: Record<string, unknown>,
  ): IFeedProvider {
    const locale = params.googleLocale as GoogleNewsLocale | undefined;
    const source = params.googleSource as string | undefined;
    const when = params.googleWhen as string | undefined;
    return new GoogleNewsFeedProvider(
      query,
      locale,
      this.sessionProvider,
      this.config,
      source,
      when,
    );
  }
}
