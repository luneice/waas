/**
 * Browser Enricher — item 级策略 B
 *
 * 策略：Puppeteer 打开 item URL → 逐策略提取页面内容
 * 页面只打开一次，多个 IPageExtractor 共享同一个 page 实例。
 */
import type { IItemEnricher, IPageExtractor } from "./interfaces";
import type { IBrowserSessionProvider, PageSession } from "@spider/core";
import type { Configuration } from "@src/config";
import type { RssItem } from "@src/types";
import { isGoogleNewsUrl } from "@src/utils/google-news-decoder";
import { extractPageWithFrames } from "./page-extractor-chain";

/** BrowserEnricher 依赖 */
export interface BrowserEnricherDeps {
  sessionProvider: IBrowserSessionProvider;
  extractors: IPageExtractor[];
  config: Configuration;
}

/**
 * 标题选择：通用启发式判断提取标题是否优于原始标题。
 *
 * 浏览器 document.title 经常是低信息量的站点通用标题（如"微博正文 - 微博"），
 * 不应覆盖 RSS feed 里更具描述性的原始标题。
 *
 * 判断规则（无硬编码站点名）：
 * 1. 去掉常见分隔符后缀（"… - SiteName", "… | SiteName"）
 * 2. 剩余部分若 ≤ 4 个字符，视为通用标题 → 保留原始
 * 3. 原始标题更长时保留原始（RSS 标题通常更完整）
 */
const SITE_SUFFIX_RE = /\s*[-|·–—]\s*[^-|·–—]{1,20}$/;

function normalize(value?: string): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function chooseEnrichedTitle(
  originalTitle?: string,
  extractedTitle?: string,
): string | undefined {
  const original = normalize(originalTitle);
  const extracted = normalize(extractedTitle);

  if (!extracted) return original || undefined;
  if (!original) return extracted;

  // 去掉 "内容 - 站点名" 式后缀后看核心部分
  const core = extracted.replace(SITE_SUFFIX_RE, "").trim();
  if (core.length <= 4) return original;

  // RSS 原始标题通常更完整，长度更优时保留
  return original.length >= extracted.length ? original : extracted;
}

export class BrowserEnricher implements IItemEnricher {
  private readonly sessionProvider: IBrowserSessionProvider;
  private readonly extractors: IPageExtractor[];
  private readonly config: Configuration;

  constructor(deps: BrowserEnricherDeps) {
    this.sessionProvider = deps.sessionProvider;
    this.extractors = deps.extractors;
    this.config = deps.config;
  }

  async tryEnrich(item: RssItem): Promise<RssItem | null> {
    if (!item.link) return null;

    let session: PageSession | undefined;
    try {
      session = await this.sessionProvider.acquire();
      const page = session.page;

      await this.navigateToItem(page, item.link);
      const resolvedUrl = page.url();

      const result = await extractPageWithFrames({
        page,
        url: resolvedUrl,
        extractors: this.extractors,
        minFrameContentLength: this.config.minContentLength,
      });
      if (result?.content) {
        return {
          ...item,
          link: resolvedUrl,
          title: chooseEnrichedTitle(item.title, result.title) || item.title,
          description: result.content,
          author: result.author || item.author,
          pubDate: result.publishedAt || item.pubDate,
        };
      }

      return null;
    } finally {
      if (session) {
        await session.release().catch(() => {});
      }
    }
  }

  private async navigateToItem(
    page: import("puppeteer-core").Page,
    url: string,
  ): Promise<void> {
    const timeout = this.config.pageNavigationTimeout;

    if (isGoogleNewsUrl(url)) {
      await page.goto(url, { waitUntil: "networkidle2", timeout });
      if (page.url().includes("news.google.com")) {
        await page
          .waitForNavigation({
            waitUntil: "domcontentloaded",
            timeout,
          })
          .catch(() => {});
      }
    } else {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout });
    }
  }
}
