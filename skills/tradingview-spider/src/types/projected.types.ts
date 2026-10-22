/**
 * 全包 `*Projected` 汇总 —— 三段式第 ③ 段
 *
 * 对外信封的最终形态。四个 Skill 统一用 `TvListEnvelope`（body 字段名 `items`）。
 */

import type {
  TvListEnvelope,
  TvTransportMeta,
} from "@src/projections/envelope";
import type { TvIdNamespace } from "@src/projections/id-namespace";

// ============================================================================
// tv-search
// ============================================================================

export interface TvSearchItemProjected {
  ticker: string;
  code: string;
  exchange: string;
  description: string;
  assetType: string;
  typespecs: string[];
  country: string | null;
  currency: string | null;
  isin: string | null;
  isPrimaryListing: boolean | null;
  economicCategory: string | null;
  /** 该 ticker 所属的命名空间（决定它能投喂给哪些下游 Skill） */
  namespace: TvIdNamespace;
  alsoListedOn: Array<{
    ticker: string;
    exchange: string;
    currency: string | null;
  }>;
}

export interface TvSearchMeta {
  text: string;
  searchType: string | null;
  exchange: string | null;
  lang: string;
  pagesFetched: number;
  returnedCount: number;
  /** 上游报告的**剩余**匹配数（不是总数） */
  remaining: number;
  hasMore: boolean;
  nextStart: number;
  idNamespace: TvIdNamespace;
  idConsumers: string[];
  idWarning?: string;
}

export type TvSearchProjected = TvListEnvelope<
  TvSearchItemProjected,
  TvSearchMeta
>;

// ============================================================================
// tv-scan
// ============================================================================

export interface TvScanItemProjected {
  ticker: string;
  values: Record<string, unknown>;
}

export interface TvScanMeta {
  market: string;
  /** ★ 必须回显：响应 d 是位置数组，请求侧 columns 顺序是唯一解码键 */
  columns: string[];
  totalCount: number;
  returnedCount: number;
  range: [number, number];
  preset: string | null;
  sortBy: string | null;
  sortOrder: string | null;
  /** 因不在扫描索引内被丢弃的 ticker */
  droppedTickers: string[];
  idNamespace: TvIdNamespace;
  idConsumers: string[];
  idWarning?: string;
}

export type TvScanProjected = TvListEnvelope<TvScanItemProjected, TvScanMeta>;

// ============================================================================
// tv-quote
// ============================================================================

export interface TvQuoteItemProjected {
  ticker: string;
  status: string;
  description: string | null;
  assetType: string | null;
  typespecs: string[];
  currency: string | null;
  price: number | null;
  changeAbs: number | null;
  changePercent: number | null;
  bid: number | null;
  ask: number | null;
  volume: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  prevClose: number | null;
  /** 报价时间（ISO 8601，由 lp_time 秒级时间戳换算） */
  quoteTime: string | null;
  /** streaming = 实时推送；其它值意味着延迟行情或已收盘，别当实时用 */
  updateMode: string | null;
  priceScale: number | null;
  minMov: number | null;
  /** includeRawFields=true 时附带的未投影原始字段 */
  raw?: Record<string, unknown>;
}

export interface TvQuoteMeta {
  /** 数值字段单位字典（信封级字段，投影层就地给出） */
  units?: Record<string, string>;
  requestedCount: number;
  returnedCount: number;
  okCount: number;
  failedCount: number;
  fields: string[];
  transport: TvTransportMeta;
}

export type TvQuoteProjected = TvListEnvelope<
  TvQuoteItemProjected,
  TvQuoteMeta
>;

// ============================================================================
// tv-history
// ============================================================================

/** 紧凑 bar：t=Unix 秒（UTC），v=成交量（null 表示该类标的无此概念） */
export interface TvBarProjected {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number | null;
}

export interface TvSeriesStats {
  first: number | null;
  last: number | null;
  min: number | null;
  max: number | null;
  changeAbs: number | null;
  changePercent: number | null;
}

export interface TvHistoryItemProjected {
  ticker: string;
  resolution: string;
  status: string;
  /**
   * ★ 本序列的**生效**复权口径（服务端回显，非请求值回显）。
   *
   * 价格类字段（o/h/l/c、stats）的含义完全取决于它，回写给用户时必须带上。
   */
  adjustment: {
    /** 请求的口径 */
    requested: string;
    /** 服务端实际生效的口径；null = 上游未回显 */
    effective: string | null;
    /** 该标的允许的口径；"none" = 本标的无复权概念，请求任何口径都不改变数值 */
    allowed: string | null;
    /** 中文口径说明，回写时照用不自造词 */
    semantics: string;
    /** true = 请求口径未被上游采纳（该标的不支持），价格是未复权原值 */
    ignored: boolean;
  };
  symbolMeta: {
    description: string | null;
    assetType: string | null;
    typespecs: string[];
    timezone: string | null;
    dataFrequency: string | null;
    currency: string | null;
    priceScale: number | null;
    minMov: number | null;
  } | null;
  range: {
    fromTime: number | null;
    toTime: number | null;
    fromISO: string | null;
    toISO: string | null;
  };
  barCount: number;
  /** true = 已到该序列最早可用数据（数据边界，非采集失败） */
  dataCompleted: boolean;
  roundsUsed: number;
  /** true = 因 maxRounds 上限提前停止，未覆盖到请求的 from */
  truncatedByMaxRounds: boolean;
  stats: TvSeriesStats;
  errorReason: string | null;
  /** includeBars=false 时省略 */
  bars?: TvBarProjected[];
}

export interface TvHistoryMeta {
  /** 数值字段单位字典（信封级字段，投影层就地给出） */
  units?: Record<string, string>;
  resolution: string;
  /** 请求的复权口径（各标的的**生效**口径见 items[].adjustment） */
  adjustment: string;
  requestedFrom: string | null;
  requestedTo: string | null;
  requestedCount: number;
  returnedCount: number;
  okCount: number;
  failedCount: number;
  totalBars: number;
  /** bar 位置字段的含义声明（bar 不逐根带 ISO，靠这里说明布局） */
  barSchema: string;
  includeBars: boolean;
  transport: TvTransportMeta;
}

export type TvHistoryProjected = TvListEnvelope<
  TvHistoryItemProjected,
  TvHistoryMeta
>;

// ============================================================================
// tv-indicator-list
// ============================================================================

export interface TvStudyCatalogItemProjected {
  /** ★ 下游 tv-indicator.pineId 的取值来源，原样透传上游值 */
  pineId: string;
  name: string;
  shortName: string | null;
  version: string;
  /** free=可直接用；restricted=需付费权限；unknown=上游给了未知取值 */
  access: string;
  kind: string | null;
  /** true=叠加主图价格轴；false=独立副图 */
  isPriceStudy: boolean | null;
  plotCount: number | null;
  category: string;
  fundamentalCategory: string | null;
  financialPeriod: string | null;
  tags: string[];
}

export interface TvStudyCatalogMeta {
  categories: string[];
  keyword: string | null;
  accessFilter: string | null;
  kind: string | null;
  /** 各分组的原始条目数（本地过滤前） */
  categoryCounts: Record<string, number>;
  totalBeforeFilter: number;
  returnedCount: number;
  /** 因 limit 截断未返回的条数（>0 时应调大 limit 或收窄 keyword） */
  truncatedCount: number;
  freeCount: number;
  restrictedCount: number;
  idNamespace: TvIdNamespace;
  idConsumers: string[];
  idWarning?: string;
}

export type TvStudyCatalogProjected = TvListEnvelope<
  TvStudyCatalogItemProjected,
  TvStudyCatalogMeta
>;

// ============================================================================
// tv-indicator
// ============================================================================

/** 紧凑指标点：t=Unix 秒（UTC），v=各输出通道值（与 plots 按下标对应） */
export interface TvStudyPointProjected {
  t: number;
  v: Array<number | null>;
}

export interface TvStudyItemProjected {
  ticker: string;
  pineId: string;
  pineVersion: string;
  resolution: string;
  status: string;
  studyMeta: {
    name: string | null;
    shortName: string | null;
    isPriceStudy: boolean | null;
    /** true=历史值可能随数据增补被上游重算（repaint 类），做回测要留意 */
    historyMayRepaint: boolean | null;
  } | null;
  symbolMeta: {
    description: string | null;
    assetType: string | null;
    timezone: string | null;
    currency: string | null;
  } | null;
  /** ★ 解码键：points[].v 按此数组顺序对应 */
  plots: Array<{
    id: string;
    type: string;
    title: string | null;
    target: string | null;
  }>;
  /** 本次生效的参数（含默认值，便于二次调参） */
  inputs: Array<{
    id: string;
    name: string;
    type: string;
    value: unknown;
    defaultValue: unknown;
  }>;
  range: {
    fromTime: number | null;
    toTime: number | null;
    fromISO: string | null;
    toISO: string | null;
  };
  pointCount: number;
  /** 每个 line 型通道的末值与区间（快速判读用，不含 colorer/alertcondition） */
  latest: Array<{ plotId: string; title: string | null; value: number | null }>;
  errorReason: string | null;
  /** includePoints=false 时省略 */
  points?: TvStudyPointProjected[];
}

export interface TvStudyMeta {
  units?: Record<string, string>;
  pineId: string;
  pineVersion: string;
  resolution: string;
  requestedCount: number;
  returnedCount: number;
  okCount: number;
  failedCount: number;
  totalPoints: number;
  /** points 位置字段的含义声明 */
  pointSchema: string;
  includePoints: boolean;
  transport: TvTransportMeta;
  idNamespace: TvIdNamespace;
  idConsumers: string[];
}

export type TvStudyProjected = TvListEnvelope<TvStudyItemProjected, TvStudyMeta>;

