import { AccessDeniedError, UpstreamShapeChangedError } from "@spider/core";
import type {
  BiliArticleContent,
  BiliArticleImage,
  BiliArticleParagraph,
  BiliArticleStat,
} from "@src/types/article.types";
import type { Page } from "puppeteer-core";

/**
 * 专栏（opus）DOM 提取 —— 登录态浏览器适配。
 *
 * 背景：B 站登录态下的 opus 详情页已改为客户端渲染（CSR），主文档不再内联
 * `window.__INITIAL_STATE__`，正文由前端 hydration 后写入 DOM；而 web-dynamic
 * detail 接口只返回折叠摘要（has_more），无法取全文。因此唯一可靠的全文来源是
 * 渲染后的 DOM `.opus-module-content`。详见 docs/article-extract-analysis.md。
 *
 * 设计：
 *   - 单次 page.evaluate 完成「DOM 正文 + 标题/作者 + 充电拦截判定 + detail 接口
 *     补充元信息」，减少往返。
 *   - 段落是开放集：已知结构化（文字/图片/链接卡），未知降级保留 + warning。
 *   - 充电专属（is_only_fans）正文被服务端替换为充电提示，检测后抛 AccessDenied。
 */

const SCOPE = "bili-article-dom";

interface RawDomImage {
  url: string;
  comment?: string;
}

type RawDomParagraph =
  | { type: "text"; text: string }
  | { type: "image"; images: RawDomImage[] }
  | { type: "link_card"; lines: string[]; jumpUrl?: string };

interface RawOpusMeta {
  mid: number | null;
  commentId: string | null;
  stat: { like?: number; coin?: number; favorite?: number; forward?: number; comment?: number };
}

interface RawOpusDom {
  found: boolean;
  blocked: { hint: string } | null;
  title: string;
  author: { name: string | null; pubTime: string | null };
  paragraphs: RawDomParagraph[];
  meta: RawOpusMeta | null;
}

/** 渲染等待：导航后调用，确保正文容器或充电拦截块已挂载。 */
export async function waitForOpusRender(page: Page, timeoutMs: number): Promise<void> {
  try {
    await page.waitForSelector(".opus-module-content", { timeout: timeoutMs });
  } catch {
    // 容器未出现：交由 extractOpusFromDom 给出更精确的诊断（充电/改版/受限）。
  }
}

/** 在页面上下文抓取 opus 正文与元信息，映射为 BiliArticleContent（纯结构）。 */
export async function extractOpusFromDom(
  page: Page,
  opusId: string,
): Promise<BiliArticleContent> {
  const raw = await page.evaluate(extractRawInPage, opusId);

  if (raw.blocked) {
    throw new AccessDeniedError(
      `专栏为充电专属/付费内容，当前登录态无权查看完整正文：${raw.blocked.hint || "需加入 UP 主充电"}`,
      { scope: SCOPE, details: { opusId } },
    );
  }

  if (!raw.found) {
    throw new UpstreamShapeChangedError(
      "未找到专栏正文容器 .opus-module-content：可能上游改版、内容受限或页面未完成渲染",
      { scope: SCOPE, details: { opusId } },
    );
  }

  return mapRawDom(raw, opusId);
}

// ── 纯映射（Node 侧）─────────────────────────────────────────────────────

function mapRawDom(raw: RawOpusDom, opusId: string): BiliArticleContent {
  const warnings: string[] = [];
  const paragraphs: BiliArticleParagraph[] = [];

  for (const p of raw.paragraphs) {
    if (p.type === "text") {
      paragraphs.push({ type: "text", text: p.text, rawParaType: 1 });
    } else if (p.type === "image") {
      const images: BiliArticleImage[] = p.images.map((img) => ({
        url: img.url,
        comment: img.comment || undefined,
      }));
      paragraphs.push({ type: "image", images, rawParaType: 2 });
    } else {
      paragraphs.push({
        type: "link_card",
        card: mapLinkCard(p),
        rawParaType: 6,
      });
    }
  }

  const stat: BiliArticleStat = {};
  if (raw.meta) {
    for (const key of ["like", "coin", "favorite", "forward", "comment"] as const) {
      const v = raw.meta.stat[key];
      if (typeof v === "number") stat[key] = v;
    }
  }

  return {
    opusId,
    cvId: raw.meta?.commentId ?? null,
    articleType: null,
    title: raw.title,
    author: {
      mid: raw.meta?.mid ?? null,
      name: raw.author.name,
      pubTime: raw.author.pubTime,
    },
    stat,
    paragraphs,
    warnings,
  };
}

function mapLinkCard(p: { lines: string[]; jumpUrl?: string }) {
  const lines = p.lines.map((l) => l.trim()).filter(Boolean);
  const SKIP = new Set(["UP主的推荐", "去看看", "查看详情", "立即购买"]);
  const price = lines.find((l) => /[¥￥]|起$|^\d+(\.\d+)?\s*元/.test(l));
  const title = lines.find((l) => !SKIP.has(l) && l !== price);
  return {
    kind: "LINK_CARD_TYPE_GOODS",
    title: title || undefined,
    price: price || undefined,
    jumpUrl: p.jumpUrl || undefined,
  };
}

// ── 页面上下文执行体（序列化注入浏览器）─────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
function extractRawInPage(opusId: string): Promise<RawOpusDom> {
  const text = (el: Element | null): string | null => {
    const t = el && (el as HTMLElement).innerText;
    return t ? t.trim() : null;
  };

  const toHttps = (u: string): string => {
    let url = (u || "").trim();
    if (!url) return url;
    const at = url.indexOf("@");
    if (at >= 0) url = url.slice(0, at); // 去掉 @1192w_1192h.avif 等裁剪/转码后缀
    if (url.startsWith("//")) url = "https:" + url;
    else if (url.startsWith("http://")) url = "https://" + url.slice(7);
    return url;
  };

  const root = document.querySelector(".opus-module-content");

  // 充电拦截：正文区域出现 upower 充电入口即视为付费专属
  const chargeAnchor =
    document.querySelector('.opus-module-content a[href*="upower"]') ||
    document.querySelector('a[href*="upower"][href*="' + opusId + '"]');
  const blockedText =
    text(document.querySelector('[class*="blocked"]')) ||
    (root && /充电|解锁观看|专属/.test((root as HTMLElement).innerText)
      ? (root as HTMLElement).innerText.trim()
      : null);

  const title =
    text(document.querySelector(".opus-module-title__text")) ||
    text(document.querySelector(".opus-module-title")) ||
    "";
  const author = {
    name: text(document.querySelector(".opus-module-author__name")),
    pubTime: text(document.querySelector(".opus-module-author__pub__text")),
  };

  const paragraphs: RawDomParagraph[] = [];
  if (root) {
    const PIC = "opus-para-pic";
    const CARD = "opus-para-link-card";

    const collectImages = (el: Element): RawDomImage[] => {
      const images: RawDomImage[] = [];
      for (const img of Array.from(el.querySelectorAll("img"))) {
        const src =
          img.getAttribute("data-src") || img.getAttribute("src") || "";
        const url = toHttps(src);
        if (url) images.push({ url, comment: img.getAttribute("alt") || undefined });
      }
      return images;
    };

    // 递归遍历：opus 段落或为 .opus-module-content 直接子节点，或包裹在中间容器
    // （如 .opus-paragraph-children）内。遇结构化段落即收集；遇无类名的包裹容器
    // 且其内含已知段落时下钻；否则取其整体文本为一段。
    const walk = (parent: Element): void => {
      for (const child of Array.from(parent.children)) {
        const cls = child.className || "";
        if (cls.indexOf(PIC) >= 0) {
          const images = collectImages(child);
          if (images.length > 0) paragraphs.push({ type: "image", images });
        } else if (cls.indexOf(CARD) >= 0) {
          const anchor = child.querySelector("a[href]");
          const lines = ((child as HTMLElement).innerText || "")
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean);
          paragraphs.push({
            type: "link_card",
            lines,
            jumpUrl: anchor ? anchor.getAttribute("href") || undefined : undefined,
          });
        } else if (
          child.children.length > 0 &&
          child.querySelector(`[class*="${PIC}"], [class*="${CARD}"]`)
        ) {
          // 包裹容器：内部含结构化段落，下钻以免丢失图片/链接卡
          walk(child);
        } else {
          const t = ((child as HTMLElement).innerText || "").trim();
          if (t) paragraphs.push({ type: "text", text: t });
        }
      }
    };

    walk(root);
  }

  // 元信息补充：web-dynamic detail 接口（folded 摘要，但 author/stat/comment_id 可靠）
  const fetchMeta = async (): Promise<RawOpusMeta | null> => {
    try {
      const resp = await fetch(
        "https://api.bilibili.com/x/polymer/web-dynamic/v1/detail?id=" +
          encodeURIComponent(opusId) +
          "&features=itemOpusStyle",
        { credentials: "include" },
      );
      const json: any = await resp.json();
      const item = json && json.data && json.data.item;
      if (!item) return null;
      const modules = item.modules || {};
      const a = modules.module_author || {};
      const s = modules.module_stat || {};
      const num = (x: any): number | undefined =>
        typeof x === "number" ? x : typeof x === "string" && x.trim() !== "" && !isNaN(Number(x)) ? Number(x) : undefined;
      const cnt = (node: any): number | undefined =>
        node ? num(node.count) : undefined;
      return {
        mid: num(a.mid) ?? null,
        commentId:
          (item.basic && (item.basic.comment_id_str || item.basic.rid_str)) || null,
        stat: {
          like: cnt(s.like),
          forward: cnt(s.forward),
          comment: cnt(s.comment),
          coin: cnt(s.coin),
          favorite: cnt(s.favorite),
        },
      };
    } catch {
      return null;
    }
  };

  return fetchMeta().then((meta) => ({
    found: !!root && paragraphs.length > 0,
    blocked: chargeAnchor ? { hint: blockedText || "需加入 UP 主充电解锁" } : null,
    title,
    author,
    paragraphs,
    meta,
  }));
}
/* eslint-enable @typescript-eslint/no-explicit-any */
