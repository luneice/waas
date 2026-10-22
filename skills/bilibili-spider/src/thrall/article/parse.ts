import { UpstreamShapeChangedError } from "@spider/core";
import type {
  BiliArticleContent,
  BiliArticleImage,
  BiliArticleLinkCard,
  BiliArticleParagraph,
  BiliArticleStat,
} from "@src/types/article.types";

/**
 * 专栏 SSR 解析 —— 纯函数，无副作用。
 *
 * B 站专栏正文不走独立接口，而是内联在详情页主文档的
 * `window.__INITIAL_STATE__.detail`（详见 docs/article-extract-analysis.md）。
 *
 * 设计要点：
 *   - 不用贪婪正则（正文含大量 {}）：定位 `__INITIAL_STATE__` 后第一个 `{`，
 *     做带字符串状态机的括号配对截取再 JSON.parse。
 *   - modules 按 module_type 查找而非下标（顺序/数量随文章而异）。
 *   - 段落/节点是开放集：已知类型结构化，未知类型降级保留 + 记 warning，
 *     不因上游新增类型而中断提取。
 */

const SCOPE = "bili-article-parse";
const STATE_MARKER = "window.__INITIAL_STATE__";

export function parseOpusInitialState(html: string): BiliArticleContent {
  const detail = extractDetail(html);
  const warnings: string[] = [];

  const modules = Array.isArray(detail.modules) ? detail.modules : [];
  const basic = isRecord(detail.basic) ? detail.basic : {};

  const titleModule = findModule(modules, "MODULE_TYPE_TITLE");
  const authorModule = findModule(modules, "MODULE_TYPE_AUTHOR");
  const contentModule = findModule(modules, "MODULE_TYPE_CONTENT");
  const statModule = findModule(modules, "MODULE_TYPE_STAT");

  const title =
    asString(getPath(titleModule, ["module_title", "text"])) ||
    asString(basic.title) ||
    "";

  const author = parseAuthor(authorModule);
  const stat = parseStat(statModule);
  const paragraphs = parseParagraphs(contentModule, warnings);

  return {
    opusId: asString(detail.id_str) || "",
    cvId: asString(basic.comment_id_str) || null,
    articleType: asNumber(basic.article_type),
    title,
    author,
    stat,
    paragraphs,
    warnings,
  };
}

// ── __INITIAL_STATE__ 截取 ──────────────────────────────────────────────

function extractDetail(html: string): Record<string, unknown> {
  const markerAt = html.indexOf(STATE_MARKER);
  if (markerAt < 0) {
    throw new UpstreamShapeChangedError(
      "专栏详情页缺少 window.__INITIAL_STATE__，可能上游改版或正文改由接口下发",
      { scope: SCOPE },
    );
  }
  const braceAt = html.indexOf("{", markerAt);
  if (braceAt < 0) {
    throw new UpstreamShapeChangedError(
      "window.__INITIAL_STATE__ 后未找到 JSON 对象起始 `{`",
      { scope: SCOPE },
    );
  }

  const json = sliceBalancedObject(html, braceAt);
  let state: unknown;
  try {
    state = JSON.parse(json);
  } catch (err) {
    throw new UpstreamShapeChangedError(
      "window.__INITIAL_STATE__ JSON 解析失败",
      { scope: SCOPE, cause: err as Error },
    );
  }

  const detail = isRecord(state) ? state.detail : undefined;
  if (!isRecord(detail)) {
    throw new UpstreamShapeChangedError(
      "__INITIAL_STATE__.detail 缺失：专栏可能改版、或为受限内容（充电/付费）需登录",
      { scope: SCOPE },
    );
  }
  return detail;
}

/** 从 `start`（必须指向 `{`）开始做带字符串状态机的括号配对，返回完整对象子串。 */
function sliceBalancedObject(text: string, start: number): string {
  let depth = 0;
  let inStr = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  throw new UpstreamShapeChangedError(
    "window.__INITIAL_STATE__ 括号未闭合，截取失败",
    { scope: SCOPE },
  );
}

// ── 模块解析 ────────────────────────────────────────────────────────────

function findModule(
  modules: unknown[],
  type: string,
): Record<string, unknown> | null {
  for (const m of modules) {
    if (isRecord(m) && m.module_type === type) return m;
  }
  return null;
}

function parseAuthor(
  authorModule: Record<string, unknown> | null,
): BiliArticleContent["author"] {
  const a = isRecord(getPath(authorModule, ["module_author"]))
    ? (getPath(authorModule, ["module_author"]) as Record<string, unknown>)
    : {};
  return {
    mid: asNumber(a.mid),
    name: asString(a.name) || null,
    pubTime: asString(a.pub_time) || null,
  };
}

function parseStat(
  statModule: Record<string, unknown> | null,
): BiliArticleStat {
  const s = isRecord(getPath(statModule, ["module_stat"]))
    ? (getPath(statModule, ["module_stat"]) as Record<string, unknown>)
    : {};
  const stat: BiliArticleStat = {};
  for (const key of [
    "like",
    "coin",
    "favorite",
    "forward",
    "comment",
  ] as const) {
    const count = asNumber(getPath(s, [key, "count"]));
    if (count !== null) stat[key] = count;
  }
  return stat;
}

// ── 段落解析（开放集）──────────────────────────────────────────────────

function parseParagraphs(
  contentModule: Record<string, unknown> | null,
  warnings: string[],
): BiliArticleParagraph[] {
  const raw = getPath(contentModule, ["module_content", "paragraphs"]);
  if (!Array.isArray(raw)) return [];

  const out: BiliArticleParagraph[] = [];
  for (const p of raw) {
    if (!isRecord(p)) continue;
    const paraType = asNumber(p.para_type) ?? -1;
    switch (paraType) {
      case 1:
        out.push(parseTextParagraph(p, warnings));
        break;
      case 2:
        out.push(parseImageParagraph(p));
        break;
      case 6:
        out.push(parseLinkCardParagraph(p, warnings));
        break;
      default:
        warnings.push(`未知 para_type=${paraType}，已降级保留原始结构`);
        out.push({ type: "unknown", rawParaType: paraType });
    }
  }
  return out;
}

function parseTextParagraph(
  p: Record<string, unknown>,
  warnings: string[],
): BiliArticleParagraph {
  const nodes = getPath(p, ["text", "nodes"]);
  let text = "";
  if (Array.isArray(nodes)) {
    for (const node of nodes) {
      if (!isRecord(node)) continue;
      const nodeType = asString(node.type);
      if (nodeType === "TEXT_NODE_TYPE_WORD") {
        text += asString(getPath(node, ["word", "words"]));
      } else if (nodeType === "TEXT_NODE_TYPE_RICH") {
        text += asString(getPath(node, ["rich", "text"]));
      } else {
        // 未知 node：尽力取可见文本，记一次告警
        const fallback =
          asString(getPath(node, ["word", "words"])) ||
          asString(getPath(node, ["rich", "text"]));
        if (fallback) text += fallback;
        warnings.push(
          `未知文本节点类型 ${nodeType || "(空)"}，已尝试降级取可见文本`,
        );
      }
    }
  }
  return { type: "text", text, rawParaType: 1 };
}

function parseImageParagraph(
  p: Record<string, unknown>,
): BiliArticleParagraph {
  const pics = getPath(p, ["pic", "pics"]);
  const images: BiliArticleImage[] = [];
  if (Array.isArray(pics)) {
    for (const pic of pics) {
      if (!isRecord(pic)) continue;
      const url = asString(pic.url);
      if (!url) continue;
      images.push({
        url: toHttps(url),
        width: asNumber(pic.width) ?? undefined,
        height: asNumber(pic.height) ?? undefined,
        comment: asString(pic.comment) || undefined,
      });
    }
  }
  return { type: "image", images, rawParaType: 2 };
}

function parseLinkCardParagraph(
  p: Record<string, unknown>,
  warnings: string[],
): BiliArticleParagraph {
  const card = getPath(p, ["link_card", "card"]);
  const kind = asString(getPath(card, ["type"])) || "UNKNOWN";

  let parsed: BiliArticleLinkCard = { kind };
  if (kind === "LINK_CARD_TYPE_GOODS") {
    // card.goods.goods[] 为商品数组（实测 HAR）
    const item = firstGoodsItem(getPath(card, ["goods"]));
    if (item) {
      parsed = {
        kind,
        title: asString(item.name) || undefined,
        price: asString(item.price) || undefined,
        jumpUrl: normalizeJumpUrl(asString(item.jump_url)),
      };
    }
  } else {
    warnings.push(`未知链接卡类型 ${kind}，已降级保留 kind`);
  }

  return { type: "link_card", card: parsed, rawParaType: 6 };
}

function firstGoodsItem(goods: unknown): Record<string, unknown> | null {
  if (Array.isArray(goods)) {
    const first = goods.find(isRecord);
    return first ?? null;
  }
  if (isRecord(goods)) {
    const items = goods.items ?? goods.goods ?? goods.list;
    if (Array.isArray(items)) {
      const first = items.find(isRecord);
      return first ?? null;
    }
  }
  return null;
}

// ── 工具 ────────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getPath(obj: unknown, path: (string | number)[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== "object") return undefined;
    cur = (cur as Record<string | number, unknown>)[key];
  }
  return cur;
}

function asString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function toHttps(url: string): string {
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("http://")) return `https://${url.slice("http://".length)}`;
  return url;
}

function normalizeJumpUrl(url: string): string | undefined {
  if (!url) return undefined;
  return toHttps(url);
}
