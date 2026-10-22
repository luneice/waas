/**
 * 主要财务指标（indicator.json）类型定义
 *
 * 🔴 **本端点与三张报表性质不同**：前三个是上游披露的**原始科目**，
 * 本端点是**由报表计算出的衍生指标**（比率、每股值、周转率）。
 *
 * 三个特有陷阱（都会静默产出错误结论）：
 *
 * ## 1. 单位在同一张表内不统一
 *
 * `asset_liab_ratio`=65.9226（百分数）与 `ncf_from_oa_to_total_liab`=-0.2568
 * （小数）在同一行里。逐字段单位见 `projections/units.ts`。
 *
 * ## 2. 与 balance.json 有 2 个同名字段口径冲突
 *
 * | 字段 | indicator | balance | 冲突 |
 * |------|-----------|---------|------|
 * | `asset_liab_ratio` | 65.9226 | 0.659226148333026 | 单位差 100 倍 |
 * | `capital_reserve`  | 21.2576 | 37030444558.6     | **语义完全不同** |
 *
 * `capital_reserve` 已精确验证：balance 的资本公积总额 37,030,444,558.6
 * ÷ 股本 1,741,985,086 = 21.2576，即 indicator 给的是**每股**资本公积。
 *
 * ## 3. 三个字段名与实际语义不符
 *
 * | 字段 | 望文生义 | **实际语义**（已验证） |
 * |------|---------|---------------------|
 * | `np_per_share`   | 每股净**利润** | **每股净资产**（np = net property） |
 * | `holder_equity`  | 股东权益**金额** | **权益比率**（权益/总资产×100） |
 * | `capital_reserve`| 资本公积总额 | **每股**资本公积 |
 *
 * 投影层已把它们改成名副其实的字段名，见 `ProjectedIndicatorPeriod`。
 *
 * 验证算式见 docs/api/README.md §6.6。
 */
import type {
  RawValuePair,
  RawPeriodBase,
  ValuePair,
  ProjectedPeriodBase,
} from "@src/types/common.types";

// ============================================================================
// ① Raw —— 保留上游原字段名（含误导性命名）
// ============================================================================

/** 主要财务指标单期原始数据（35 个二元组 + 3 个标量） */
export interface RawIndicatorPeriod extends RawPeriodBase {
  // ── 盈利能力（百分数）──
  /** 净资产收益率（**平均**口径）：归母净利 ÷ 平均归母权益 × 100 */
  avg_roe: RawValuePair;
  /** 净资产收益率（**摊薄**口径，dlt = diluted）：归母净利 ÷ **期末**归母权益 × 100 */
  ore_dlt: RawValuePair;
  /** 总资产净利率：净利润 ÷ **平均**总资产 × 100（注意分母是平均值，非期末） */
  net_interest_of_total_assets: RawValuePair;
  /** 毛利率：(营收 − 营业成本) ÷ 营收 × 100 */
  gross_selling_rate: RawValuePair;
  /** 净利率：**净利润**（含少数股东）÷ 营收 × 100。⚠️ 分子非归母净利 */
  net_selling_rate: RawValuePair;

  // ── 每股指标（元/股）──
  /** 基本每股收益。与 income.json 同名字段数值完全一致 */
  basic_eps: RawValuePair;
  /**
   * 🔴 **每股净资产**（不是每股净利润！）—— np = net **property**。
   * 归母权益 ÷ 股本 = 23.7144（精确验证）。
   * ⚠️ 赛力斯每股净资产 23.71 元 vs 每股收益 0.43 元，相差 55 倍，混淆会得出荒谬估值。
   */
  np_per_share: RawValuePair;
  /** 每股未分配利润 */
  undistri_profit_ps: RawValuePair;
  /** 每股经营现金流 */
  operate_cash_flow_ps: RawValuePair;
  /**
   * 🔴 **每股**资本公积（不是总额）。
   * ⚠️ balance.json 的同名字段是**资本公积总额**（元），语义完全不同。
   */
  capital_reserve: RawValuePair;

  // ── 偿债能力与资本结构（⚠️ 单位混合）──
  /** 资产负债率。⚠️ 本表是**百分数**（65.9226）；balance.json 同名字段是小数 */
  asset_liab_ratio: RawValuePair;
  /**
   * 🔴 **权益比率**（不是权益金额！）：全部所有者权益 ÷ 总资产 × 100。
   * 互补验证：holder_equity 34.0774 + asset_liab_ratio 65.9226 = 100.0000
   */
  holder_equity: RawValuePair;
  /** 流动比率（倍） */
  current_ratio: RawValuePair;
  /** 速动比率（倍）。⚠️ 精确口径未确证，标准公式算得 1.0421 与字段值 0.91 不符 */
  quick_ratio: RawValuePair;
  /** 产权比率（倍）：负债 ÷ **归母**权益。⚠️ 分母与 equity_multiplier 不同 */
  equity_ratio: RawValuePair;
  /** 权益乘数（倍）：总资产 ÷ **全部**所有者权益。⚠️ 分母与 equity_ratio 不同 */
  equity_multiplier: RawValuePair;
  /** 经营现金流 / 总负债。🔴 **本表唯一的小数比率**（-0.2568 = -25.68%） */
  ncf_from_oa_to_total_liab: RawValuePair;

  // ── 营运效率（次 / 天）──
  /** 存货周转率（次） */
  inventory_turnover: RawValuePair;
  /** 存货周转天数。⚠️ 基数是报告期实际天数（一季报 90 天），非 360 天 */
  inventory_turnover_days: RawValuePair;
  /** 应收账款周转率（次） */
  account_receivable_turnover: RawValuePair;
  /** 应收账款周转天数 */
  receivable_turnover_days: RawValuePair;
  /** 应付账款周转率（次） */
  accounts_payable_turnover: RawValuePair;
  /** 应付账款周转天数 */
  accounts_payable_turnover_days: RawValuePair;
  /** 总资产周转率（次） */
  total_capital_turnover: RawValuePair;
  /** 流动资产周转率（次） */
  current_asset_turnover_rate: RawValuePair;
  /** 固定资产周转率（次） */
  fixed_asset_turnover_ratio: RawValuePair;
  /** 营业周期（天）：存货周转天数 + 应收周转天数 */
  operating_cycle: RawValuePair;
  /**
   * 现金循环周期（天）：营业周期 − 应付周转天数。
   * ⚠️ **为负是正常的**（占用上游资金，强势产业链地位），不是数据错误。
   */
  cash_cycle: RawValuePair;

  // ── 成长能力（百分数）──
  /**
   * 营业收入同比增长率。
   * 🔴 `[0]` 是**百分数**（34.4629），而同一行 `total_revenue[1]` 是
   * **小数**（0.3446）—— 同一个同比，单位差 100 倍。
   * 🔴 本字段自己的 `[1]` 是「**增速的同比**」（二阶量），极易误读。
   */
  operating_income_yoy: RawValuePair;
  /** 归母净利润同比增长率（百分数）。`[1]` 同样是二阶量 */
  net_profit_atsopc_yoy: RawValuePair;
  /** 归母扣非净利润同比增长率（百分数）。`[1]` 同样是二阶量 */
  np_atsopc_nrgal_yoy: RawValuePair;

  // ── 原始金额搬运（元，与 income.json 数值一致，join 安全）──
  /** 营业总收入 */
  total_revenue: RawValuePair;
  /** 归属于母公司股东的净利润 */
  net_profit_atsopc: RawValuePair;
  /** 归母扣非净利润 */
  net_profit_after_nrgal_atsolc: RawValuePair;

  // ── 语义未确认 ──
  /**
   * 🔴 **语义未破解**，原样透传，**不要编中文名**。
   *
   * 本样本值 73.0061。已排除：营业成本率（73.7617）、营业成本/营业总成本
   * （73.4238）、营业总成本/营收（100.4602）、(营收−营业利润)/营收（96.8711）、
   * 每股营收（14.7795）。
   *
   * 跨期观察呈「期内累积后回落」形态（74.10→143.26→157.86→100.64→73.01），
   * 不像稳定比率。不要凭字段名猜测（疑似 return on ...，但 return 类口径已排除）。
   */
  rop: RawValuePair;
}

// ============================================================================
// ③ 对外投影 —— 字段名改为名副其实
// ============================================================================

/**
 * 投影后的主要财务指标单期。
 *
 * ⚠️ **单位不统一**，逐字段见 `projections/units.ts` 与信封的 `meta.fieldUnits`。
 * 投影层**不做单位归一化**，原样透传上游值。
 */
export interface ProjectedIndicatorPeriod extends ProjectedPeriodBase {
  // 盈利能力（%）
  /** 净资产收益率（平均口径） */
  avgRoe: ValuePair;
  /** 净资产收益率（摊薄口径，用期末权益） */
  dilutedRoe: ValuePair;
  /** 总资产净利率（分母为平均总资产） */
  returnOnTotalAssets: ValuePair;
  /** 毛利率 */
  grossMargin: ValuePair;
  /** 净利率（分子为含少数股东的净利润） */
  netMargin: ValuePair;

  // 每股指标（元/股）
  /** 基本每股收益 */
  basicEps: ValuePair;
  /** 每股净资产（上游字段名 np_per_share 有误导性，此处已正名） */
  netAssetsPerShare: ValuePair;
  /** 每股未分配利润 */
  undistributedProfitPerShare: ValuePair;
  /** 每股经营现金流 */
  operatingCashFlowPerShare: ValuePair;
  /** 每股资本公积（上游字段名 capital_reserve 与 balance 的总额同名，此处已正名） */
  capitalReservePerShare: ValuePair;

  // 偿债能力与资本结构（单位混合）
  /** 资产负债率（**百分数**，与 xueqiu-balance 的小数口径不同） */
  assetLiabRatio: ValuePair;
  /** 权益比率（上游字段名 holder_equity 有误导性，此处已正名）（%） */
  equityRatio: ValuePair;
  /** 流动比率（倍） */
  currentRatio: ValuePair;
  /** 速动比率（倍，精确口径未确证） */
  quickRatio: ValuePair;
  /** 产权比率（倍，负债/归母权益） */
  debtToEquityRatio: ValuePair;
  /** 权益乘数（倍，总资产/全部权益） */
  equityMultiplier: ValuePair;
  /** 经营现金流/总负债（**小数**，本表唯一） */
  operatingCashFlowToLiabilities: ValuePair;

  // 营运效率
  inventoryTurnover: ValuePair;
  inventoryTurnoverDays: ValuePair;
  receivableTurnover: ValuePair;
  receivableTurnoverDays: ValuePair;
  payableTurnover: ValuePair;
  payableTurnoverDays: ValuePair;
  totalAssetTurnover: ValuePair;
  currentAssetTurnover: ValuePair;
  fixedAssetTurnover: ValuePair;
  operatingCycle: ValuePair;
  /** 现金循环周期（天，为负正常） */
  cashCycle: ValuePair;

  // 成长能力（%）
  /**
   * 营业收入同比增长率（**百分数**）。
   * ⚠️ 上游该字段的 `[1]` 是「增速的同比」（二阶量），已在投影层丢弃，
   * 此处 yoy 恒为 null 以免误读。
   */
  revenueYoy: ValuePair;
  netProfitAttrParentYoy: ValuePair;
  netProfitDeductNonRecurringYoy: ValuePair;

  // 原始金额（元）
  totalRevenue: ValuePair;
  netProfitAttrParent: ValuePair;
  netProfitDeductNonRecurring: ValuePair;

  /** ⚠️ 语义未确认，原样透传 */
  rop: ValuePair;
}
