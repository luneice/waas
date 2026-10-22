/**
 * 端点族共享类型 —— 四张报表的信封、二元组、翻页入参
 *
 * 类型三段式（CLAUDE.md §4.2）：
 *   ① Raw*      保留上游原字段名（snake_case），带 [k: string]: unknown 兜底
 *   ② 领域对象   camelCase 语义字段
 *   ③ *Projected 对外投影
 *
 * 上游改字段时映射函数编译报错，这是刻意的早期预警。
 */

// ============================================================================
// ① Raw —— 1:1 对应上游 JSON
// ============================================================================

/**
 * `[本期值, 同比增长率]` 二元组 —— 上游全族的基本数值形态。
 *
 * ⚠️ **有三种状态**，语义各不相同（不止两种）：
 *
 * | 形态              | 含义                                    |
 * |-------------------|-----------------------------------------|
 * | `[123.45, 0.34]`  | 有值、有同比                             |
 * | `[null, null]`    | 该科目本期不适用/未披露                   |
 * | `[123.45, null]`  | **有值但无同比**（去年同期为 0 或缺失）   |
 *
 * 实测第三种：`lt_payable_sum: [0.0, null]` —— 这是**值确实为零**，
 * 不是"无数据"。用 `value || null` 归一化会把真实的 0 误吞成 null。
 *
 * ⚠️ `[1]` 是**小数比率**（`0.3446` 表示 +34.46%），不是百分数。
 *    但 indicator.json 的比率字段是百分数 —— 单位口径见 units.ts。
 *
 * ⚠️ 值可能是**科学计数法**（原始 JSON 中即为 `3.0E8`）。
 *    标准 JSON.parse 安全；正则/字符串处理会挂。
 */
export type RawValuePair = [number | null, number | null];

/** 单个报告期的公共标量字段 */
export interface RawPeriodBase {
  /** 报告期末日期，**毫秒**时间戳，恒为该期最后一日 00:00:00 东八区 */
  report_date: number;
  /**
   * 报告期名称。
   *
   * ⚠️ 措辞区分口径：`type=all/Q*` → 「2026一季**报**」（定期报告）；
   * `type=S*` → 「2026一季**度**」（单季差分）。唯一差异是「报」vs「度」。
   */
  report_name: string;
  /**
   * 数据入库时间（毫秒）。
   *
   * ⚠️ 仅 income / indicator 有值；balance / cash_flow 恒为 null。
   *
   * 该字段能揭示**数据重述**：若某期 ctime 远晚于其后续期次，
   * 说明被事后重列过（上游做的是一致性重述，同比口径可比）。
   */
  ctime: number | null;
  [key: string]: unknown;
}

/** `data` 外层的公共元数据（四端点完全一致的 6 个字段） */
export interface RawFinanceDataBase {
  quote_name?: string | null;
  currency?: string | null;
  currency_name?: string | null;
  /**
   * 机构类型。样本仅见 1（一般工商企业）。
   *
   * ⚠️ 银行/保险/券商的科目结构**完全不同**（如银行有"吸收存款"而无"营业成本"），
   * 其他取值的字段集未验证，**不可假设字段集恒定**。
   */
  org_type?: number | null;
  last_report_name?: string | null;
  statuses?: unknown;
  [key: string]: unknown;
}

/** 端点族统一响应信封 */
export interface RawFinanceEnvelope<TPeriod extends RawPeriodBase> {
  data?: (RawFinanceDataBase & { list?: TPeriod[] }) | null;
  /**
   * ⚠️ **类型会漂移**：成功时为 number `0`，失败时为 string（如 `"400016"`）。
   * 判定必须归一化：`Number(error_code) === 0`。
   */
  error_code?: number | string;
  error_description?: string;
}

// ============================================================================
// ② 领域对象 —— Goal 聚合结果
// ============================================================================

/** 归一化后的二元组 */
export interface ValuePair {
  /** 本期值。null = 上游不提供；0 = 值确实为零（二者不可混用） */
  value: number | null;
  /** 同比。null = 无法计算（去年同期为 0 或缺失），**不代表增长为零** */
  yoy: number | null;
}

/** Goal 聚合的公共结果形态 */
export interface FinanceGoalResult<TPeriod extends RawPeriodBase> {
  /** 入参回显 —— 上游响应不含这些，由 aggregate() 从 ctx.params 补齐 */
  symbol: string;
  type: string;
  /** 是否为单季口径（`type` 以 S 开头） */
  singleQuarter: boolean;
  quoteName: string | null;
  currency: string | null;
  currencyName: string | null;
  orgType: number | null;
  lastReportName: string | null;
  /** 报告期数组，按 report_date 倒序 */
  periods: TPeriod[];
  /** 实际请求的页数 */
  pagesFetched: number;
  crawledAt: string;
}

// ============================================================================
// ③ 对外投影
// ============================================================================

/** AI-Ready 信封的公共 meta */
export interface FinanceMeta {
  skill: string;
  /** 一句中文说清这组数字的口径 —— Agent 回写时只允许用此口径，不得自造词 */
  semantics: string;
  symbol: string;
  quoteName: string | null;
  reportType: string;
  currency: string | null;
  orgType: number | null;
  lastReportName: string | null;
  periodCount: number;
  pagesFetched: number;
  /** 该口径下被置空的字段（S 系列语义失真时非空） */
  suppressedFields?: string[];
  crawledAt: string;
}

/** 端点族统一的 AI-Ready 信封 */
export interface FinanceAiReady<TItem, TMeta extends FinanceMeta = FinanceMeta> {
  meta: TMeta;
  /** 字段单位字典 —— indicator 必填（单位混合），报表类可选 */
  units?: Record<string, string>;
  insights: string[];
  items: TItem[];
}

/** 投影后的单期数据公共部分 */
export interface ProjectedPeriodBase {
  reportDate: string;
  reportName: string;
  /** 数据入库时间（ISO），null 表示上游未提供 */
  dataUpdatedAt: string | null;
}
