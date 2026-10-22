/**
 * 标的检索类型 —— 三段式第 ①②③ 段
 *
 * ① `Raw*`：1:1 上游 JSON，保留原字段名（含 `currency-logoid` 这类连字符命名），
 *    带 `[k: string]: unknown` 兜底。上游改字段时映射函数编译报错 —— 刻意的早期预警。
 * ② 领域对象：camelCase 语义字段。
 * ③ `*Projected`：对外信封（见 projections/search.ai-ready.ts）。
 */

// ============================================================================
// ① Raw —— 上游原始结构
// ============================================================================

export interface RawSymbolSearchLogo {
  style?: string;
  logoid?: string;
  [k: string]: unknown;
}

export interface RawSymbolSearchSource2 {
  id?: string;
  name?: string;
  description?: string;
  country?: string;
  [k: string]: unknown;
}

export interface RawSymbolSearchItem {
  symbol?: string;
  description?: string;
  type?: string;
  exchange?: string;
  country?: string;
  currency_code?: string;
  isin?: string;
  cusip?: string;
  cik_code?: string;
  provider_id?: string;
  logoid?: string;
  logo?: RawSymbolSearchLogo;
  source_id?: string;
  source2?: RawSymbolSearchSource2;
  typespecs?: string[];
  is_primary_listing?: boolean;
  ipo_offer_time?: number;
  /** 宏观类标的专有：经济指标分类 */
  economic_category?: { id?: string; name?: string; [k: string]: unknown };
  /** enable_grouping=true 时出现：同公司在其它交易所的挂牌 */
  grouped_symbols?: RawSymbolSearchItem[];
  [k: string]: unknown;
}

export interface RawSymbolSearchResponse {
  /** 尚未返回的**剩余**匹配数（不是总数） */
  symbols_remaining?: number;
  symbols?: RawSymbolSearchItem[];
  [k: string]: unknown;
}

// ============================================================================
// ② 领域对象
// ============================================================================

/** 同公司其它交易所挂牌的精简引用 */
export interface TvListingRef {
  ticker: string;
  exchange: string;
  currency: string | null;
  country: string | null;
}

export interface TvSymbolHit {
  /** 全局主键 `EXCHANGE:CODE` —— 下游三条链路的唯一入口 */
  ticker: string;
  /** 冒号右半的代码段 */
  code: string;
  /** 交易所 / 数据源前缀 */
  exchange: string;
  /** 名称（已剥离检索高亮标记） */
  description: string;
  /** 资产类别：stock / bond / economic / fund / futures / forex / index / … */
  assetType: string;
  /** 细分标签，如 ["government","yield","benchmark"] */
  typespecs: string[];
  country: string | null;
  currency: string | null;
  isin: string | null;
  /** 是否为该证券的主要挂牌地 */
  isPrimaryListing: boolean | null;
  /** 宏观指标分类名（仅 economic 类标的有） */
  economicCategory: string | null;
  /** 同公司其它挂牌（grouping 开启时才有值） */
  alsoListedOn: TvListingRef[];
}

export interface TvSearchResult {
  /** 入参回显 */
  query: {
    text: string;
    searchType: string | null;
    exchange: string | null;
    lang: string;
    start: number;
    maxPages: number;
    grouping: boolean;
  };
  hits: TvSymbolHit[];
  /** 实际发起的请求页数 */
  pagesFetched: number;
  /** 上游报告的剩余匹配数（最后一页的 symbols_remaining） */
  remaining: number;
  /** 是否还有更多（remaining > 0） */
  hasMore: boolean;
  /** 下次续取的 start 偏移 */
  nextStart: number;
  crawledAt: Date;
}
