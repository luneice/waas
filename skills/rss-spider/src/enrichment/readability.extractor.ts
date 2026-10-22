/**
 * Readability 页面提取策略 — page 级策略 A
 *
 * 使用 @mozilla/readability 提纯 → Turndown 转 markdown。
 * 成熟开源方案，适合大多数文章型页面。
 *
 * 内部含质量门槛：提取结果纯文本长度低于阈值时返回 null，
 * 让下一个策略（如 CustomExtractor）接手。
 */
import type {
  IPageExtractor,
  PageExtractionContext,
} from "./interfaces";
import type { ExtractResult } from "@src/types";
import { extractReadableContent } from "@src/utils/html-to-markdown";

export class ReadabilityExtractor implements IPageExtractor {
  constructor(
    private readonly minContentLength: number,
    private readonly format: "markdown" | "html" = "markdown",
  ) {}

  async tryExtract(
    page: PageExtractionContext,
    url: string,
  ): Promise<ExtractResult | null> {
    // Inject __name polyfill: esbuild (used by tsx) injects __name() calls inside
    // page.evaluate() callbacks for named functions, but the browser has no __name defined.
    await page.evaluate(
      `if (typeof __name === "undefined") window.__name = (f, n) => { try { Object.defineProperty(f, "name", { value: n, configurable: true }); } catch (e) {} return f; }`,
    );

    // 等待内容出现
    await this.waitForContent(page);

    // 获取页面 HTML
    const html = await page.content();

    // 提取元数据 (author / publishedAt)
    const metadata = await this.extractMetadata(page);

    // Readability 提取
    const extracted = extractReadableContent(html, url);
    if (!extracted) return null;

    const content =
      this.format === "markdown" ? extracted.markdown : extracted.html;

    // 质量门槛
    if (plainTextLength(content) < this.minContentLength) {
      return null;
    }

    return {
      title: extracted.title,
      content,
      author: metadata.author,
      publishedAt: metadata.publishedAt,
    };
  }

  private async waitForContent(page: PageExtractionContext): Promise<void> {
    try {
      await page.waitForFunction(
        () => {
          const candidates = [
            "article",
            "h1",
            "main",
            ".post-body",
            ".entry-content",
            '[class*="content"]',
            '[class*="article"]',
            '[role="main"]',
          ];
          return candidates.some((s) => document.querySelector(s));
        },
        { timeout: 10_000 },
      );
    } catch {
      // 超时不抛错，尝试直接提取
    }
  }

  private async extractMetadata(
    page: PageExtractionContext,
  ): Promise<{ author?: string; publishedAt?: string }> {
    const metadata = await page.evaluate(() => {
      function getText(...selectors: string[]): string {
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) return (el.textContent || "").trim();
        }
        return "";
      }

      function getTime(): string {
        const timeElements = document.querySelectorAll(
          "time, [datetime], [class*='date'], [class*='time'], [itemprop='datePublished']",
        );
        for (let i = 0; i < timeElements.length; i++) {
          const time = timeElements[i];
          const value = (
            time.getAttribute("datetime") ||
            time.getAttribute("content") ||
            time.textContent ||
            ""
          ).trim();
          if (value) return value;
        }
        const metas = document.querySelectorAll(
          'meta[property="article:published_time"], meta[name="publishdate"], meta[name="date"]',
        );
        for (let i = 0; i < metas.length; i++) {
          const meta = metas[i];
          const value = (meta.getAttribute("content") || "").trim();
          if (value) return value;
        }
        return "";
      }

      const author = getText(
        '[class*="author"]',
        '[rel="author"]',
        '[itemprop="author"]',
        ".byline",
      );
      const publishedAt = getTime();

      return {
        author: author || undefined,
        publishedAt: publishedAt || undefined,
        pageText: publishedAt
          ? undefined
          : (document.body?.innerText || "").slice(0, 20_000),
      };
    });

    return {
      author: metadata.author,
      publishedAt:
        metadata.publishedAt || extractPublishedAtFromText(metadata.pageText),
    };
  }
}

/** 从带语义标签的页面文本中回退提取原发布时间。 */
export function extractPublishedAtFromText(text?: string): string | undefined {
  if (!text) return undefined;
  const match =
    /(?:发布时间|发布日期|发布于|发稿时间|刊登时间|published(?:\s+(?:on|at))?|publication\s+date|posted(?:\s+on)?)\s*[：:]?\s*([12]\d{3}(?:[-/.]\d{1,2}[-/.]\d{1,2}|年\d{1,2}月\d{1,2}日?)(?:[T\s]\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:Z|[+-]\d{2}:?\d{2}))?)?)/i.exec(
      text,
    );
  if (!match) return undefined;
  return match[1]
    .replace("年", "-")
    .replace("月", "-")
    .replace("日", "")
    .replace(/\s+/g, " ")
    .trim();
}

function plainTextLength(content?: string): number {
  if (!content) return 0;
  return content
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim().length;
}
