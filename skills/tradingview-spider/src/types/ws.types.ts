/**
 * WebSocket 协议类型
 *
 * 分帧格式：`~m~<字节长度>~m~<payload>`，一个 TCP 帧可能拼接多条消息；
 * 心跳帧的 payload 是 `~h~<序号>`，必须原样回声。
 * 业务消息统一为 `{ m: <方法名>, p: [<会话ID>, ...] }`。
 */

// ============================================================================
// ① Raw —— 协议原始消息
// ============================================================================

/** 出站消息（Node → 上游） */
export interface TvOutMessage {
  m: string;
  p: unknown[];
}

/** 入站业务消息（上游 → Node） */
export interface TvInMessage {
  m: string;
  p: unknown[];
  /** 服务端时间戳（秒），部分消息携带 */
  t?: number;
  t_ms?: number;
  [k: string]: unknown;
}

/** 拆帧结果 */
export type TvFrameChunk =
  | { kind: "heartbeat"; text: string }
  | { kind: "payload"; text: string };

/** 握手 hello 帧 */
export interface TvHello {
  session_id?: string;
  timestamp?: number;
  release?: string;
  protocol?: string;
  [k: string]: unknown;
}

/** `symbol_resolved` 的第三个参数 */
export interface RawSymbolResolved {
  pro_name?: string;
  name?: string;
  description?: string;
  short_description?: string;
  type?: string;
  typespecs?: string[];
  exchange?: string;
  timezone?: string;
  pricescale?: number;
  minmov?: number;
  /** 该指标的**原始发布频率**（D/W/M…），与请求分辨率是两回事 */
  data_frequency?: string;
  currency_code?: string;
  country?: string;
  /** 生效复权口径（splits / dividends / none…） */
  adjustment?: string;
  /** 允许的复权口径（none = 该标的无复权概念） */
  allowed_adjustment?: string;
  [k: string]: unknown;
}

/** `timescale_update` 里单个 series 的载荷 */
export interface RawSeriesUpdate {
  /** bar 数组；`i` 是服务端相对序号（翻页后转负），`v` 是 [t,o,h,l,c,volume?] */
  s?: Array<{ i?: number; v?: number[] }>;
  [k: string]: unknown;
}

/** `qsd` 消息的载荷 */
export interface RawQsdPayload {
  /** 标的 EXCHANGE:CODE */
  n?: string;
  /** "ok" | "error" */
  s?: string;
  /** **增量**字段（同一标的会分多条推送，需客户端合并） */
  v?: Record<string, unknown>;
  [k: string]: unknown;
}

// ============================================================================
// ② 领域对象
// ============================================================================

/** 单个标的的取数状态 */
export type TvItemStatus = "ok" | "error" | "timeout";

/** 标的静态元信息（来自 symbol_resolved） */
export interface TvSymbolMeta {
  ticker: string;
  description: string | null;
  assetType: string | null;
  typespecs: string[];
  timezone: string | null;
  /** 原始发布频率；比请求分辨率粗时会出现阶梯状重复值，属正常 */
  dataFrequency: string | null;
  currency: string | null;
  /** 价格精度换算参数（原样透传，不代为换算） */
  priceScale: number | null;
  minMov: number | null;
  /**
   * 服务端回显的**生效**复权口径（splits / dividends / none…）。
   * null = 上游未回显该字段（多见于无复权概念的标的）。
   * 这是生效值不是请求值——两者可能不同，见 allowedAdjustment。
   */
  adjustment: string | null;
  /**
   * 该标的**允许**的复权口径（none / any…）。
   * `none` 表示这个标的没有复权概念（指数、汇率、利率等），
   * 此时请求任何口径都不会改变数值。
   */
  allowedAdjustment: string | null;
}

/**
 * 单根 K 线。
 *
 * `volume` 为 `null` 表示**该类标的没有成交量概念**（收益率/利率类），
 * 与真实成交量为 `0` 语义不同，二者不可混同（CLAUDE.md §3.5）。
 */
export interface TvBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

/** WS 传输诊断（对外只暴露脱敏子集，见 projections/envelope.ts） */
export interface TvWsDiagnostics {
  rounds: number;
  drainCalls: number;
  droppedFrames: number;
  unknownMessageKinds: string[];
  /** 上游集群标识 —— 仅供本地排查，绝不进对外信封 */
  sessionId: string | null;
}
