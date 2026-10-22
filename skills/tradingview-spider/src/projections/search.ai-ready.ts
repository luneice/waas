/**
 * 标的检索 —— AI-Ready 信封
 *
 * insights 的选材原则：写「Agent 拿到后最可能立刻算的东西」，而非复述字段。
 * 本 Skill 最有价值的一条是**命名空间分流提示** —— 宏观标的按数据源前缀分成
 * 两类，可用链路不同，不提示的话 Agent 会把查不到的前缀投给截面扫描拿到空集。
 */

import { isoTime } from "@src/projections/envelope";
import {
  ID_NAMESPACES,
  classifyTicker,
  producerMeta,
} from "@src/projections/id-namespace";
import type { TvSearchResult, TvSymbolHit } from "@src/types/search.types";
import type {
  TvSearchItemProjected,
  TvSearchMeta,
  TvSearchProjected,
} from "@src/types/projected.types";

/** 逐条投影：显式枚举字段，禁止 spread（§3.5） */
function projectItem(hit: TvSymbolHit): TvSearchItemProjected {
  return {
    ticker: hit.ticker,
    code: hit.code,
    exchange: hit.exchange,
    description: hit.description,
    assetType: hit.assetType,
    typespecs: hit.typespecs,
    country: hit.country,
    currency: hit.currency,
    isin: hit.isin,
    isPrimaryListing: hit.isPrimaryListing,
    economicCategory: hit.economicCategory,
    namespace: classifyTicker(hit.ticker).namespace,
    alsoListedOn: hit.alsoListedOn.map((r) => ({
      ticker: r.ticker,
      exchange: r.exchange,
      currency: r.currency,
    })),
  };
}

/** 取 top N 的分布描述，如 "FRED(12) / ECONOMICS(8)" */
function topDistribution(values: string[], topN: number): string {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([k, n]) => `${k}(${n})`)
    .join(" / ");
}

function buildSearchInsights(
  items: TvSearchItemProjected[],
  result: TvSearchResult,
): string[] {
  const out: string[] = [];

  if (items.length === 0) {
    out.push(
      `关键词「${result.query.text}」没有匹配到任何标的。` +
        `可尝试：改用英文关键词、放宽 searchType（宏观指标须传 economic）、或缩短关键词。`,
    );
    return out;
  }

  out.push(
    `关键词「${result.query.text}」命中 ${items.length} 个标的` +
      `（抓取 ${result.pagesFetched} 页${result.hasMore ? `，上游还剩约 ${result.remaining} 条未取` : "，已取完"}）。`,
  );

  out.push(
    `按数据源分布：${topDistribution(
      items.map((i) => i.exchange),
      3,
    )}。`,
  );
  out.push(
    `按资产类别分布：${topDistribution(
      items.map((i) => i.assetType),
      3,
    )}。`,
  );

  // ★ 命名空间分流 —— 本 Skill 最关键的一条要点
  const fredItems = items.filter(
    (i) => i.namespace === ID_NAMESPACES.TICKER_FRED,
  );
  const econItems = items.filter(
    (i) => i.namespace === ID_NAMESPACES.TICKER_ECONOMICS,
  );
  if (fredItems.length > 0 || econItems.length > 0) {
    const parts: string[] = [];
    if (fredItems.length > 0) {
      parts.push(
        `${fredItems.length} 个属美联储口径（前缀 FRED），` +
          `**只能**投给 tv-history / tv-quote，投给 tv-scan 会得到空集`,
      );
    }
    if (econItems.length > 0) {
      parts.push(
        `${econItems.length} 个属全球央行口径（前缀 ECONOMICS），三条链路都可用；` +
          `多国横向对比优先用它（一次 tv-scan 即可）`,
      );
    }
    out.push(`宏观标的分流提示：${parts.join("；")}。`);
  }

  const top = items[0];
  out.push(`首条结果：${top.ticker}（${top.description || "无名称"}）。`);

  if (result.hasMore) {
    out.push(`续取下一页请传 start=${result.nextStart}。`);
  }

  return out;
}

export function projectSearchAiReady(
  result: TvSearchResult,
): TvSearchProjected {
  const items = result.hits.map(projectItem);

  const meta: TvSearchMeta & {
    skill: string;
    semantics: string;
    crawledAt: string;
  } = {
    skill: "tv-search",
    semantics:
      `标的检索：关键词「${result.query.text}」的匹配标的清单；` +
      `ticker = 交易所前缀:代码，是报价/K线/截面三条下游链路唯一的标的入口`,
    crawledAt: isoTime(result.crawledAt),
    text: result.query.text,
    searchType: result.query.searchType,
    exchange: result.query.exchange,
    lang: result.query.lang,
    pagesFetched: result.pagesFetched,
    returnedCount: items.length,
    remaining: result.remaining,
    hasMore: result.hasMore,
    nextStart: result.nextStart,
    ...producerMeta(ID_NAMESPACES.TICKER),
  };

  return { meta, insights: buildSearchInsights(items, result), items };
}
