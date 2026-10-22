/**
 * 主要财务指标的**逐字段单位表**
 *
 * 🔴 存在的理由：`indicator.json` 是四个端点里唯一**单位不统一**的。
 * 三张报表可以「金额一律元、同比一律小数」一刀切，本表不行 ——
 * 同一个报告期对象里：
 *
 * ```
 * asset_liab_ratio          65.9226   ← 百分数
 * ncf_from_oa_to_total_liab -0.2568   ← 小数
 * current_ratio              1.0687   ← 倍
 * cash_cycle              -130.9449   ← 天
 * total_revenue      25745711786.75   ← 元
 * np_per_share              23.7144   ← 元/股
 * ```
 *
 * 任何统一处理都会让一半字段错 100 倍。
 *
 * ## 实现纪律
 *
 * 1. **不做单位归一化** —— 原样透传上游值，把换算交给消费方。
 *    采集侧擅自 ×100 / ÷100 会与报表端点的同名字段产生新的不一致。
 * 2. 单位经信封的 `units` 字段透出（CLAUDE.md §4.3「units 显式声明」）。
 * 3. 新增字段必须在此登记，否则会落进 `unknown` 分类。
 */

/** 单位类型 */
export type UnitKind =
  | "percent" // 百分数：65.9226 表示 65.92%
  | "ratio" // 小数比率：-0.2568 表示 -25.68%
  | "times" // 倍 / 次
  | "days" // 天
  | "yuan" // 元
  | "yuanPerShare" // 元/股
  | "unknown"; // 语义未确认

/** 单位类型 → 面向 Agent 的中文说明（写进信封 units） */
export const UNIT_LABEL: Record<UnitKind, string> = {
  percent: "百分数（65.9226 表示 65.92%）",
  ratio: "小数比率（-0.2568 表示 -25.68%）",
  times: "倍 / 次",
  days: "天",
  yuan: "元",
  yuanPerShare: "元/股",
  unknown: "语义未确认，原样透传",
};

/**
 * 投影后字段名 → 单位。
 *
 * ⚠️ 键是**投影后**的 camelCase 名（对外契约），不是上游 snake_case。
 */
export const INDICATOR_UNITS: Record<string, UnitKind> = {
  // ── 盈利能力（百分数）──
  avgRoe: "percent",
  dilutedRoe: "percent",
  returnOnTotalAssets: "percent",
  grossMargin: "percent",
  netMargin: "percent",

  // ── 每股指标（元/股）──
  basicEps: "yuanPerShare",
  netAssetsPerShare: "yuanPerShare",
  undistributedProfitPerShare: "yuanPerShare",
  operatingCashFlowPerShare: "yuanPerShare",
  capitalReservePerShare: "yuanPerShare",

  // ── 偿债能力与资本结构（⚠️ 混合）──
  assetLiabRatio: "percent", // ⚠️ balance.json 同名字段是小数，差 100 倍
  equityRatio: "percent", // 权益比率（权益/总资产）
  currentRatio: "times",
  quickRatio: "times",
  debtToEquityRatio: "times", // 产权比率（负债/归母权益）
  equityMultiplier: "times",
  operatingCashFlowToLiabilities: "ratio", // ⚠️ 本表唯一的小数比率

  // ── 营运效率（次 / 天）──
  inventoryTurnover: "times",
  inventoryTurnoverDays: "days",
  receivableTurnover: "times",
  receivableTurnoverDays: "days",
  payableTurnover: "times",
  payableTurnoverDays: "days",
  totalAssetTurnover: "times",
  currentAssetTurnover: "times",
  fixedAssetTurnover: "times",
  operatingCycle: "days",
  cashCycle: "days",

  // ── 成长能力（百分数）──
  revenueYoy: "percent",
  netProfitAttrParentYoy: "percent",
  netProfitDeductNonRecurringYoy: "percent",

  // ── 原始金额搬运（元）──
  totalRevenue: "yuan",
  netProfitAttrParent: "yuan",
  netProfitDeductNonRecurring: "yuan",

  // ── 语义未确认 ──
  rop: "unknown",
};

/**
 * 构造信封的 `units` 字典 —— 只列出实际出现的单位种类，避免噪声。
 */
export function buildIndicatorUnits(): Record<string, string> {
  const kinds = new Set(Object.values(INDICATOR_UNITS));
  const out: Record<string, string> = {};
  for (const kind of kinds) out[kind] = UNIT_LABEL[kind];

  out["⚠️ 注意"] =
    "本表单位不统一，逐字段见 fieldUnits。asset_liab_ratio 在本表是百分数（65.92），" +
    "而 xueqiu-balance 的同名字段是小数（0.6592），跨表比对前须先对齐口径";

  return out;
}

/** 供 meta 透出的逐字段单位映射（Agent 按字段名查） */
export function fieldUnitMap(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [field, kind] of Object.entries(INDICATOR_UNITS)) {
    out[field] = kind;
  }
  return out;
}
