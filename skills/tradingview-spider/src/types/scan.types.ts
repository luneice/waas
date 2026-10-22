/**
 * 批量截面扫描类型
 *
 * 上游响应的 `d` 是**位置数组**（与请求 `columns` 严格按下标对应），不是键值对象。
 * 领域层负责把它按请求侧顺序还原成 `Record<column, unknown>` —— 请求侧的 columns
 * 顺序是唯一解码键，因此必须一路带到投影层并回显到 meta。
 */

// ============================================================================
// ① Raw
// ============================================================================

export interface RawScanRow {
  /** 标的全局标识 EXCHANGE:CODE */
  s?: string;
  /** 与请求 columns 下标对应的位置数组 */
  d?: unknown[];
  [k: string]: unknown;
}

export interface RawScanResponse {
  totalCount?: number;
  data?: RawScanRow[];
  /** 服务端最终生效的查询条件回显（含 preset 展开后的完整 filter） */
  params?: Record<string, unknown>;
  [k: string]: unknown;
}

// ============================================================================
// ② 领域对象
// ============================================================================

/** 单个过滤条件 */
export interface TvScanFilter {
  left: string;
  operation: string;
  right?: unknown;
}

/**
 * 扫描域（URL 路径段）。
 *
 * 刻意用 `string` 而非字面量联合：本站覆盖全球市场，扫描域是**开放集合**
 * （实测至少 20 个，且随时可能新增国别域）。用联合类型会诱导出白名单拦截，
 * 把未来新增的域拒之门外。已验证可用的域见 constants.ts 的 SCAN_MARKETS。
 */
export type TvScanMarket = string;

export interface TvScanRow {
  ticker: string;
  /** 按请求 columns 顺序还原的键值对 */
  values: Record<string, unknown>;
}

export interface TvScanResult {
  query: {
    market: TvScanMarket;
    columns: string[];
    tickers: string[] | null;
    filter: TvScanFilter[] | null;
    preset: string | null;
    sortBy: string | null;
    sortOrder: string | null;
    range: [number, number];
    lang: string;
  };
  rows: TvScanRow[];
  /** 上游命中总数 */
  totalCount: number;
  /**
   * 因数据源不在扫描索引内而被丢弃的 ticker（如 FRED 前缀）。
   * 非空时投影层要落告警并在 insights 里给出改用建议。
   */
  droppedTickers: string[];
  crawledAt: Date;
}
