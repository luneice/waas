/**
 * HTML → Markdown 转换工具
 *
 * 使用 Readability 提纯网页内容，Turndown 转换为 Markdown。
 */
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

/** Readability 提取结果 */
interface ReadableResult {
  title: string;
  html: string;
  markdown: string;
  excerpt: string;
}

/**
 * 从 HTML 中移除噪声标签和元素，减少 JSDOM/Readability 干扰
 *
 * 注意：所有清理都在 HTML 字符串级别进行，不修改 Puppeteer 页面 DOM。
 * 浏览器页面保持原样，确保人机验证等功能不受影响。
 *
 * 移除范围：
 * - <style>：避免 JSDOM "Could not parse CSS stylesheet" 错误
 * - <svg>：内联 SVG 图标（工具栏、分享按钮等）
 * - <noscript>：fallback 图片/内容，干扰正文提取
 * - <script>：脚本
 * - <iframe>：嵌入内容
 * - <nav>：导航区域
 * - <link>：外部资源引用
 */
function stripNoiseTags(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<link\b[^>]*\/?>(?:<\/link>)?/gi, "");
}

/**
 * 在 JSDOM document 上移除 class/attribute 级别的噪声元素
 *
 * 比正则更精准，处理工具栏、分享按钮、广告、cookie 弹窗等
 * 依赖嵌套 DOM 的元素。
 */
function stripNoiseElements(doc: Document): void {
  const selectors = [
    '[role="navigation"]',
    '[role="banner"]',
    '[role="complementary"]',
    '[aria-label*="Share"]',
    '[aria-label*="share"]',
    '[data-testid*="Toolbar"]',
    '[data-testid*="toolbar"]',
    '[data-testid*="ShareBar"]',
    '[data-testid*="Ad"]',
    '[class*="toolbar"]',
    '[class*="share"]',
    '[class*="social"]',
    '[class*="newsletter"]',
    '[class*="cookie"]',
    '[class*="consent"]',
    '[class*="read-next"]',
    '[class*="related"]',
    '[class*="sidebar"]',
    '[class*="ad-slot"]',
    '[class*="advertisement"]',
    "footer",
    "header",
    "aside",
  ];
  for (const sel of selectors) {
    doc.querySelectorAll(sel).forEach((el) => el.remove());
  }
}

/**
 * 使用 Readability 提取网页核心内容并转换格式
 *
 * @returns 提取结果，Readability 无法解析时返回 null
 */
export function extractReadableContent(
  html: string,
  url: string,
): ReadableResult | null {
  const cleanHtml = stripNoiseTags(html);
  const doc = new JSDOM(cleanHtml, { url });

  // 在 JSDOM DOM 上移除 class/attribute 级别的噪声元素
  stripNoiseElements(doc.window.document);

  const reader = new Readability(doc.window.document);
  const article = reader.parse();
  if (!article) return null;

  const markdown = turndown.turndown(article.content);
  return {
    title: article.title,
    html: article.content,
    markdown,
    excerpt: article.excerpt ?? "",
  };
}
