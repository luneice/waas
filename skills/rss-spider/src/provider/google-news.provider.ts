/**
 * Google News RSS Feed 来源
 *
 * 通过 Puppeteer 访问 Google News RSS 搜索接口获取完整 RSS 内容。
 * Google News 对普通 HTTP 请求会截断结果，使用浏览器可获取完整列表。
 */
import type { IFeedProvider } from "./interfaces";
import { MissingContextError } from "@spider/core";
import type { IBrowserSessionProvider, PageSession } from "@spider/core";
import type { Configuration } from "@src/config";
import type { RssFeed, GoogleNewsLocale } from "@src/types";
import { parseXmlFeed } from "@src/utils/feed-parser";

/** 错误 scope 标识 */
const SCOPE = "google-news-feed-provider";

const DEFAULT_LOCALE: GoogleNewsLocale = {
  hl: "en",
  gl: "US",
  ceid: "US:en",
};

export class GoogleNewsFeedProvider implements IFeedProvider {
  readonly type = "google-news";
  readonly sourceUrl: string;

  constructor(
    private readonly query: string,
    private readonly locale: GoogleNewsLocale = DEFAULT_LOCALE,
    private readonly sessionProvider: IBrowserSessionProvider,
    private readonly config: Configuration,
    private readonly source?: string,
    private readonly when?: string,
  ) {
    if (!query?.trim()) {
      throw new MissingContextError("GoogleNewsFeedProvider: query 不能为空", {
        scope: SCOPE,
      });
    }
    this.sourceUrl = this.buildUrl();
  }

  async fetch(): Promise<RssFeed> {
    const xml = await this.fetchXmlViaBrowser();
    return parseXmlFeed(xml);
  }

  private async fetchXmlViaBrowser(): Promise<string> {
    let session: PageSession | undefined;
    try {
      session = await this.sessionProvider.acquire();
      const page = session.page;
      const timeout = this.config.pageNavigationTimeout;

      // 监听所有响应，取第一个 content-type 含 xml/rss/atom 的响应体
      let resolveXml!: (xml: string) => void;
      const xmlPromise = new Promise<string | null>((resolve) => {
        resolveXml = resolve;
        setTimeout(() => resolve(null), timeout);
      });

      const responseHandler = async (response: any) => {
        const url: string = response.url();
        if (!url.includes("news.google.com/rss")) return;
        try {
          const ct: string = response.headers()["content-type"] || "";
          if (ct.includes("xml") || ct.includes("rss") || ct.includes("atom")) {
            const text: string = await response.text();
            if (text.trim().startsWith("<")) resolveXml(text);
          }
        } catch {
          // ignore individual response errors
        }
      };

      page.on("response", responseHandler);

      await page
        .goto(this.sourceUrl, { waitUntil: "networkidle2", timeout })
        .catch(() => {});

      const xmlBody = await xmlPromise;
      page.off("response", responseHandler);

      if (xmlBody) return xmlBody;

      // fallback: 从渲染后的页面提取（部分环境会把 XML 直接渲染成 <pre>）
      const content = await page.content();
      const preMatch = content.match(/<pre[^>]*>(.*)<\/pre>/s);
      if (preMatch) return this.unescapeHtml(preMatch[1]);

      return content;
    } finally {
      if (session) {
        await session.release().catch(() => {});
      }
    }
  }

  private unescapeHtml(html: string): string {
    return html
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  private buildQuery(): string {
    let q = this.query;
    if (this.source) q += ` site:${this.source}`;
    if (this.when) q += ` when:${this.when}`;
    return q;
  }

  private buildUrl(): string {
    const params = new URLSearchParams({
      hl: this.locale.hl,
      gl: this.locale.gl,
      ceid: this.locale.ceid,
      oc: "3",
      q: this.buildQuery(),
      filter: "0",
    });
    return `https://news.google.com/rss/search?${params.toString()}`;
  }
}
