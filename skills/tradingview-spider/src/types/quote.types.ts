/**
 * 实时报价快照类型
 *
 * 上游 `qsd` 是**增量推送** —— 同一标的会在短时间内分多条推来不同字段子集，
 * 客户端必须按标的合并成完整快照；只取最后一条会丢字段。
 */

import type { TvItemStatus, TvWsDiagnostics } from "./ws.types";

// ============================================================================
// ② 领域对象（① Raw 见 ws.types.ts 的 RawQsdPayload）
// ============================================================================

/** 单标的合并后的报价快照 */
export interface TvQuote {
  ticker: string;
  status: TvItemStatus;
  /** 合并后的原始字段袋（投影层按需取字段，raw 模式下可整体透出） */
  values: Record<string, unknown>;
}

export interface TvQuoteResult {
  query: {
    symbols: string[];
    fields: string[];
    timeoutMs: number;
  };
  quotes: TvQuote[];
  diagnostics: TvWsDiagnostics;
  crawledAt: Date;
}
