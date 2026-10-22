/**
 * URL Feed 来源
 *
 * 通过 HTTP 获取任意 RSS/Atom/JSON feed URL 并解析为统一 RssFeed 结构。
 */
import type { IFeedProvider } from "./interfaces";
import { EndpointHttpError, MissingContextError } from "@spider/core";
import type { RssFeed } from "@src/types";
import { parseJsonFeed, parseXmlFeed } from "@src/utils/feed-parser";

/** 错误 scope 标识 */
const SCOPE = "url-feed-provider";

const DEFAULT_FEED_FETCH_TIMEOUT = 30_000;

export class UrlFeedProvider implements IFeedProvider {
  readonly type = "url";

  get sourceUrl(): string {
    return this.url;
  }

  constructor(
    private readonly url: string,
    private readonly timeout: number = DEFAULT_FEED_FETCH_TIMEOUT,
  ) {
    if (!url?.trim()) {
      throw new MissingContextError("UrlFeedProvider: url 不能为空", {
        scope: SCOPE,
      });
    }
  }

  async fetch(): Promise<RssFeed> {
    const response = await fetch(this.url, {
      headers: { Accept: "application/json, application/xml, text/xml, */*" },
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      throw new EndpointHttpError(
        `Feed 请求失败: ${response.status} ${response.statusText} (${this.url})`,
        {
          scope: SCOPE,
          phase: "fetch",
          details: {
            status: response.status,
            statusText: response.statusText,
            url: this.url,
          },
        },
      );
    }

    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("json")) {
      const json = await response.json();
      return parseJsonFeed(json);
    }

    const xml = await response.text();
    return parseXmlFeed(xml);
  }
}
