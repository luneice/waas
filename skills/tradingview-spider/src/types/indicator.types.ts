/**
 * 技术指标（Study/Indicator）类型 —— 三段式
 *
 * 本模块横跨两个上游服务，类型也分两组：
 *   ① 指标编译服务（HTTP）：`RawPineListItem` / `RawTranslateResponse`
 *   ② 行情长连接（WS）：指标数值由 `du` 消息推送，Raw 形状见 ws.types.ts
 *
 * ══════════════ 为什么 plots 契约必须显式建模 ══════════════
 *
 * `du.st[].v` 是**位置数组**：`v[0]` 是时间戳，`v[1..]` 与编译响应里的
 * `metaInfo.plots[]` **按下标严格对应**。请求侧拿到的 plots 顺序是唯一解码键
 * ——丢了它，一串裸数字就再也对不上哪根线是哪个输出（同 tv-scan 的 columns
 * 与 d 数组的关系）。因此 `TvStudyPlotSpec` 必须原样保留并回显进信封。
 */

import type { TvItemStatus, TvSymbolMeta, TvWsDiagnostics } from "./ws.types";

// ============================================================================
// ① Raw —— 1:1 上游 JSON（保留上游字段名，含 snake_case）
// ============================================================================

/** `pine-facade/list` 的单个条目 */
export interface RawPineListItem {
  userId?: number;
  scriptName?: string;
  scriptSource?: string;
  /**
   * 访问级别。实测仅两种取值：
   *   `open_no_auth`   —— 免费/公开，translate 可正常拿到编译产物
   *   `closed_no_auth` —— 需付费/特定权限，translate 真实行为**未验证**
   *                       （抓包样本响应体被工具丢失，不能假设一定失败）
   */
  scriptAccess?: string;
  /** 指标唯一标识，形如 `STD;Aroon_Oscillator`（`%1` 转义空格） */
  scriptIdPart?: string;
  version?: string;
  extra?: {
    isBuiltIn?: boolean;
    kind?: string;
    shortDescription?: string;
    sourceInputsCount?: number;
    is_price_study?: boolean;
    is_hidden_study?: boolean;
    isFundamentalStudy?: boolean;
    fund_id?: string;
    financialPeriod?: string;
    fundamentalCategory?: string;
    stats?: Record<string, number>;
    tags?: string[];
    [k: string]: unknown;
  };
  lastVersionMaj?: string;
  [k: string]: unknown;
}

/** `metaInfo.inputs[]` 单项 */
export interface RawPineInput {
  id?: string;
  name?: string;
  /** integer / float / text / bool / source / resolution */
  type?: string;
  defval?: unknown;
  isFake?: boolean | null;
  isHidden?: boolean;
  options?: unknown[];
  min?: number;
  max?: number;
  group?: string;
  [k: string]: unknown;
}

/** `metaInfo.plots[]` 单项 */
export interface RawPinePlot {
  id?: string;
  /** line / colorer / shapes / alertcondition */
  type?: string;
  /** colorer 专属：被染色的目标 plot/fill id */
  target?: string;
  /** colorer 专属：调色板 key */
  palette?: string;
  [k: string]: unknown;
}

export interface RawPineMetaInfo {
  id?: string;
  description?: string;
  shortDescription?: string;
  is_price_study?: boolean;
  inputs?: RawPineInput[];
  plots?: RawPinePlot[];
  styles?: Record<string, { title?: string; isHidden?: boolean; [k: string]: unknown }>;
  palettes?: Record<
    string,
    {
      colors?: Record<string, { name?: string }>;
      valToIndex?: Record<string, number>;
    }
  >;
  isTVScript?: boolean;
  historyCalculationMayChange?: boolean;
  [k: string]: unknown;
}

/** `pine-facade/translate/{id}/{ver}` 的响应信封 */
export interface RawTranslateResponse {
  success?: boolean;
  result?: {
    /** 与 ilTemplate 前若干字节相同但整体不同，用途未探明，本包不使用 */
    IL?: string;
    /** ★ 编译产物：原样喂给 WS create_study 的 inputs.text */
    ilTemplate?: string;
    metaInfo?: RawPineMetaInfo;
  } | null;
  reason?: string;
  [k: string]: unknown;
}

/**
 * `du` 消息里单个 study 的载荷。
 *
 * ⚠️ 数据键是 **`st`**，不是 K 线序列的 `s`（`RawSeriesUpdate.s`）——
 * 同一条 `du` 消息可能同时携带父 series（键 `s`）与 study（键 `st`）的更新，
 * 两者形状相似但键名不同，混用会取到 undefined 而静默丢数据。
 */
export interface RawStudyUpdate {
  /** 指标取值数组；`i` 是服务端相对序号，`v` 是 [time, plot_0值, plot_1值, …] */
  st?: Array<{ i?: number; v?: number[] }>;
  /** 上游计算节点标识，仅诊断用 */
  node?: string;
  /** 该 study 在 study 树中的位置标签（如 s1_st1） */
  t?: string;
  [k: string]: unknown;
}


// ============================================================================
// ② 领域对象（camelCase 语义字段）
// ============================================================================

/** 免费/付费判定 —— 由 scriptAccess 归一而来 */
export type TvStudyAccess = "free" | "restricted" | "unknown";

/** 指标目录条目 */
export interface TvStudyCatalogItem {
  /** 指标唯一标识（下游 tv-indicator.pineId 的取值来源） */
  pineId: string;
  /** 指标显示名 */
  name: string;
  /** 图表上的简称 */
  shortName: string | null;
  version: string;
  access: TvStudyAccess;
  /** 上游 scriptAccess 原值（access 的判定依据，原样保留便于排查） */
  accessRaw: string | null;
  /** study（指标）/ strategy（策略） */
  kind: string | null;
  /** true=叠加在主图价格轴；false=独立副图 */
  isPriceStudy: boolean | null;
  /** 输出通道数量（上游 extra.stats 的汇总，null=上游未给） */
  plotCount: number | null;
  /** 该指标属于哪个目录分组（对应请求的 filter） */
  category: string;
  /** 基本面类专属：财务科目分类（如 Income statements） */
  fundamentalCategory: string | null;
  /** 基本面类专属：报告期口径（FQ/FY/TTM/FH） */
  financialPeriod: string | null;
  tags: string[];
}

export interface TvStudyCatalogResult {
  query: {
    categories: string[];
    keyword: string | null;
    accessFilter: string | null;
    kind: string | null;
    limit: number;
  };
  items: TvStudyCatalogItem[];
  /** 各分组的原始条目数（过滤前），用于说明「从多少条里筛出来的」 */
  categoryCounts: Record<string, number>;
  /** 关键词/权限过滤前的总条目数 */
  totalBeforeFilter: number;
  /** 因 limit 截断而未返回的条目数 */
  truncatedCount: number;
  crawledAt: Date;
}

// ── 指标数值序列 ────────────────────────────────────────────────

/** 单个输出通道的规格（解码 v 数组的键） */
export interface TvStudyPlotSpec {
  /** 上游 plot id（plot_0 / plot_1 …） */
  id: string;
  /**
   * 通道类型：
   *   `line`           普通数值线
   *   `colorer`        为其它通道染色，值是调色板索引而非业务数值
   *   `shapes`         图形标记（背离箭头等）
   *   `alertcondition` 仅用于提醒规则，不参与绘图
   */
  type: string;
  /** 人读标题（来自 metaInfo.styles[id].title），无则为 null */
  title: string | null;
  /** colorer 专属：被染色的目标通道 */
  target: string | null;
}

/** 指标的一个可调参数（回显给 Agent，便于二次调参） */
export interface TvStudyInputSpec {
  /** in_0 / in_1 … */
  id: string;
  name: string;
  type: string;
  /** 本次实际生效的值（用户未覆盖时即上游默认值） */
  value: unknown;
  /** 上游默认值 */
  defaultValue: unknown;
}

/** 指标在单根 K 线上的取值 */
export interface TvStudyPoint {
  /** Unix 秒（UTC） */
  time: number;
  /**
   * 各输出通道的值，**与 plots 数组按下标对应**。
   * `null` = 该通道在这根 K 线上无值（上游哨兵 `1e+100` 已归一为 null）。
   */
  values: Array<number | null>;
}

/** 单标的 × 单指标的计算结果 */
export interface TvStudySeries {
  ticker: string;
  pineId: string;
  pineVersion: string;
  resolution: string;
  status: TvItemStatus;
  /** 指标元信息（来自编译响应） */
  studyMeta: {
    name: string | null;
    shortName: string | null;
    isPriceStudy: boolean | null;
    /** true=历史值可能随数据增补而被上游重算（repaint 类指标） */
    historyMayRepaint: boolean | null;
  } | null;
  /** 标的元信息（来自 symbol_resolved） */
  symbolMeta: TvSymbolMeta | null;
  /** ★ 解码键：values 数组按此顺序对应 */
  plots: TvStudyPlotSpec[];
  /** 本次生效的参数 */
  inputs: TvStudyInputSpec[];
  points: TvStudyPoint[];
  errorReason: string | null;
}

export interface TvStudyResult {
  query: {
    symbols: string[];
    pineId: string;
    pineVersion: string | null;
    resolution: string;
    bars: number;
    timezone: string;
    includePoints: boolean;
    /** 用户覆盖的参数（in_N → 值） */
    inputOverrides: Record<string, unknown>;
  };
  series: TvStudySeries[];
  diagnostics: TvWsDiagnostics;
  crawledAt: Date;
}
