/**
 * RSSHub 路由 Feed 来源
 *
 * 将 RSSHub 路由路径委托给 IRsshubRuntime 获取数据。
 */
import type { IFeedProvider } from "./interfaces";
import { MissingContextError } from "@spider/core";
import type { IRsshubRuntime } from "@src/rsshub/interfaces";
import type { RssFeed } from "@src/types";
import { normalizeRoute, buildRouteUrl } from "@src/rsshub/route-resolver";

/** 错误 scope 标识 */
const SCOPE = "rsshub-feed-provider";

export class RsshubFeedProvider implements IFeedProvider {
  readonly type = "rsshub";
  readonly sourceUrl: string;
  private readonly normalizedRoute: string;
  private readonly overrideBaseUrl: string | undefined;

  constructor(
    private readonly runtime: IRsshubRuntime,
    route: string,
    baseUrl?: string,
  ) {
    if (!route?.trim()) {
      throw new MissingContextError("RsshubFeedProvider: route 不能为空", {
        scope: SCOPE,
      });
    }
    this.normalizedRoute = normalizeRoute(route);
    this.overrideBaseUrl = baseUrl;
    const resolution = runtime.resolveRoute(route, baseUrl);
    this.sourceUrl = buildRouteUrl(
      resolution.resolvedBaseUrl,
      this.normalizedRoute,
    );
  }

  async fetch(): Promise<RssFeed> {
    return this.runtime.fetchRoute(this.normalizedRoute, this.overrideBaseUrl);
  }
}
