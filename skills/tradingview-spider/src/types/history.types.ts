/**
 * 历史 K 线序列类型
 */

import type {
  TvBar,
  TvItemStatus,
  TvSymbolMeta,
  TvWsDiagnostics,
} from "./ws.types";

// ============================================================================
// ② 领域对象（① Raw 见 ws.types.ts 的 RawSeriesUpdate / RawSymbolResolved）
// ============================================================================

/** 单标的的一条时间序列 */
export interface TvSeries {
  ticker: string;
  resolution: string;
  status: TvItemStatus;
  symbolMeta: TvSymbolMeta | null;
  /** 按 time 升序、已去重的 bar 序列 */
  bars: TvBar[];
  /**
   * 是否已翻到该序列的**最早可用数据**（上游 `data_completed:"end"`）。
   * true 表示「数据边界」而非「采集失败」——投影层必须在 insights 里说清。
   */
  dataCompleted: boolean;
  /** 实际执行的翻页轮数 */
  rounds: number;
  /** 因 maxRounds 上限提前停止（未覆盖到请求的 from） */
  truncatedByMaxRounds: boolean;
  /** 该标的的失败原因（status !== "ok" 时有值） */
  errorReason: string | null;
}

export interface TvHistoryResult {
  query: {
    symbols: string[];
    resolution: string;
    /** 请求的复权口径（生效口径见 series[].symbolMeta.adjustment） */
    adjustment: string;
    from: number | null;
    to: number | null;
    bars: number;
    pageBars: number;
    maxRounds: number;
    timezone: string;
    includeBars: boolean;
  };
  series: TvSeries[];
  diagnostics: TvWsDiagnostics;
  crawledAt: Date;
}
