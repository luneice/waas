/**
 * Custom 页面提取策略 — page 级策略 B
 *
 * 基于 CSS 选择器和启发式规则提取页面内容。
 * 用户传入 selectors 时精确匹配，未传入时使用通用候选选择器。
 *
 * 作为 Readability 的回退方案：
 * - 某些站点 Readability 提取效果差（SPA、非标准 HTML）
 * - 用户提供了精确选择器时可跳过 Readability 直接使用
 */
import type {
  IPageExtractor,
  PageExtractionContext,
} from "./interfaces";
import type { ExtractResult, DetailSelectors } from "@src/types";

export class CustomExtractor implements IPageExtractor {
  async tryExtract(
    page: PageExtractionContext,
    url: string,
    selectors?: DetailSelectors,
  ): Promise<ExtractResult | null> {
    // Inject __name polyfill needed by esbuild-transformed code in page.evaluate contexts
    await page.evaluate(
      `if (typeof __name === "undefined") window.__name = (f, n) => { try { Object.defineProperty(f, "name", { value: n, configurable: true }); } catch (e) {} return f; }`,
    );
    const result = await page.evaluate(
      (sel, pageUrl) => {
        if (!pageUrl) return {};

        function getText(selector?: string, fallbacks?: string[]): string {
          if (selector) {
            const el = document.querySelector(selector);
            if (el) return (el.textContent || "").trim();
          }
          if (fallbacks) {
            for (const fb of fallbacks) {
              const el = document.querySelector(fb);
              if (el) return (el.textContent || "").trim();
            }
          }
          return "";
        }

        function getCleanText(selector?: string, fallbacks?: string[]): string {
          const el = selector ? document.querySelector(selector) : null;
          const target =
            el ||
            (fallbacks
              ? fallbacks.reduce<Element | null>(
                  (found, fb) => found || document.querySelector(fb),
                  null,
                )
              : null);
          if (!target) return "";

          const blocks = target.querySelectorAll(
            "p, h1, h2, h3, h4, h5, h6, li, blockquote, [data-testid*=paragraph]",
          );
          const paragraphs: string[] = [];
          if (blocks.length > 0) {
            blocks.forEach((b) => {
              const text = (b.textContent || "").trim();
              if (text) paragraphs.push(text);
            });
          } else {
            const text = (target.textContent || "").trim();
            if (text) paragraphs.push(text);
          }
          return paragraphs.join("\n\n");
        }

        function getTime(selector?: string): string {
          if (selector) {
            const el = document.querySelector(selector);
            if (el) {
              return (
                el.getAttribute("datetime") || (el.textContent || "").trim()
              );
            }
          }
          const time = document.querySelector(
            "time, [datetime], [class*='date'], [class*='time'], [itemprop='datePublished']",
          );
          if (time) {
            return (
              time.getAttribute("datetime") ||
              time.getAttribute("content") ||
              (time.textContent || "").trim()
            );
          }
          const meta = document.querySelector(
            'meta[property="article:published_time"], meta[name="publishdate"], meta[name="date"]',
          );
          return meta?.getAttribute("content") || "";
        }

        const title =
          getText(sel?.title, ["h1", '[class*="title"]', "article h1"]) ||
          document.title;

        const content = getCleanText(sel?.content, [
          "article",
          '[class*="content"]',
          '[class*="article"]',
          '[role="main"]',
          "main",
          ".post-body",
          ".entry-content",
        ]);

        const author = getText(sel?.author, [
          '[class*="author"]',
          '[rel="author"]',
          '[itemprop="author"]',
          ".byline",
        ]);

        const publishedAt = getTime(sel?.time);

        return {
          title: title || undefined,
          content: content || undefined,
          author: author || undefined,
          publishedAt: publishedAt || undefined,
        };
      },
      selectors || {},
      url,
    );

    if (!result.content) return null;
    return result as ExtractResult;
  }
}
