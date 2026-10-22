/**
 * Feed XML/JSON 解析工具
 *
 * 从原 FeedFetcher 中提取的纯解析逻辑，零副作用。
 * 支持 RSS 2.0 / Atom / JSON Feed 三种格式。
 */
import { XMLParser } from "fast-xml-parser";
import { InvalidParamsError } from "@spider/core";
import type { RssFeed, RssItem } from "@src/types";

/** 错误 scope 标识 */
const SCOPE = "feed-parser";

// ── 公共 API ──

/** 将 JSON 对象解析为 RssFeed（适用于 JSON Feed 格式） */
export function parseJsonFeed(json: any): RssFeed {
  const items: RssItem[] = (json.items || []).map((item: any) => ({
    title: item.title || "",
    link: item.url || item.link || "",
    pubDate: item.date_published || item.date_modified || "",
    description: item.content_html || item.content_text || item.summary || "",
    author:
      typeof item.author === "string"
        ? item.author
        : item.author?.name || item.authors?.[0]?.name || "",
    category: item.tags || [],
  }));

  return {
    title: json.title || "",
    link: json.home_page_url || json.feed_url || "",
    description: json.description || "",
    items,
  };
}

/**
 * 将 XML 字符串解析为 RssFeed（自动识别 RSS 2.0 / Atom）
 *
 * 解析失败一律归为 invalid-params：这里做的是「这份文档到底是不是 feed」的
 * 整体类型判定，而 XML 来自调用方给出的资源地址（url / rsshubBase+route）。
 * 最常见的现场是用户把普通 HTML 网页当成 feed 传进来——正确处置是换 URL 或
 * 改用 page-extract / list-extract，而不是 upstream-shape-changed 所暗示的
 * 「上游改版、报告维护者」。真正的字段级 schema 漂移不会走到这里：
 * parseAtom / parseRss2 对缺字段全部容错降级。
 */
export function parseXmlFeed(xml: string): RssFeed {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    trimValues: true,
    isArray: (_name, jpath) => {
      const arrayPaths = [
        "rss.channel.item",
        "feed.entry",
        "rss.channel.item.category",
        "feed.entry.link",
        "feed.link",
      ];
      return arrayPaths.includes(jpath);
    },
  });

  // fast-xml-parser 对不闭合标签 / 非法标签名 / 超深嵌套会抛裸 Error，
  // 不接住会被兜底成 pipeline-error（"框架内部异常"），与实情不符。
  let doc: any;
  try {
    doc = parser.parse(xml);
  } catch (err) {
    throw new InvalidParamsError(
      `目标地址返回的内容不是可解析的 XML（${err instanceof Error ? err.message : String(err)}）——` +
        "请确认该 URL 是 RSS/Atom feed 地址；若是普通网页，请改用 page-extract / list-extract",
      { scope: SCOPE, phase: "parse", cause: err },
    );
  }

  if (doc.feed) return parseAtom(doc.feed);
  if (doc.rss?.channel) return parseRss2(doc.rss.channel);
  if (doc.channel) return parseRss2(doc.channel);

  throw new InvalidParamsError(
    "无法识别的 XML feed 格式（非 RSS 2.0 / Atom）——" +
      "请确认该 URL 是 RSS/Atom feed 地址；若是普通网页，请改用 page-extract / list-extract",
    { scope: SCOPE, phase: "parse" },
  );
}

// ── Atom 解析 ──

function parseAtom(feed: any): RssFeed {
  const entries: any[] = feed.entry || [];

  const items: RssItem[] = entries.map((entry) => {
    const link = extractAtomLink(entry.link);
    return {
      title: textOf(entry.title),
      link,
      pubDate: entry.published || entry.updated || "",
      description: textOf(entry.content) || textOf(entry.summary) || "",
      author: entry.author?.name || "",
    };
  });

  return {
    title: textOf(feed.title),
    link: extractAtomLink(feed.link, "alternate"),
    description: textOf(feed.subtitle) || "",
    items,
  };
}

// ── RSS 2.0 解析 ──

function parseRss2(channel: any): RssFeed {
  const itemBlocks: any[] = channel.item || [];

  const items: RssItem[] = itemBlocks.map((block) => {
    const categories: string[] = Array.isArray(block.category)
      ? block.category.map((c: any) => textOf(c))
      : block.category
        ? [textOf(block.category)]
        : [];

    return {
      title: textOf(block.title),
      link: textOf(block.link),
      pubDate: textOf(block.pubDate),
      description: textOf(block.description),
      author: textOf(block.author) || textOf(block["dc:creator"]),
      category: categories.length > 0 ? categories : undefined,
    };
  });

  return {
    title: textOf(channel.title),
    link: textOf(channel.link),
    description: textOf(channel.description) || "",
    items,
  };
}

// ── 辅助函数 ──

/** 从 Atom link 元素中提取 href（支持对象、数组、字符串） */
function extractAtomLink(link: any, preferRel?: string): string {
  if (!link) return "";
  if (typeof link === "string") return link;

  const links: any[] = Array.isArray(link) ? link : [link];

  if (preferRel) {
    const preferred = links.find((l) => l?.["@_rel"] === preferRel);
    if (preferred) return preferred["@_href"] || "";
  }

  for (const l of links) {
    if (l?.["@_href"]) return l["@_href"];
  }
  return "";
}

/** 安全地提取文本值（可能是字符串、对象、数字等） */
function textOf(value: any): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (value["#text"] != null) return String(value["#text"]);
  return "";
}
