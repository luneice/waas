/**
 * 利润表（income.json）类型定义
 *
 * **口径为期间累计**：每期是「年初至该报告期末」的累计发生额，非单季数。
 * 已验证（赛力斯 2025 total_revenue）：
 * 一季报 191.47 亿 → 中报 624.02 亿 → 三季报 1105.34 亿 → 年报 1650.54 亿。
 *
 * 字段中文名依据**勾稽关系验算**推定（上游未提供表头映射表）。
 * 标「勾稽验证」的已用赛力斯 2026Q1 实数验算通过，见 docs/api/README.md §3.5.4。
 */
import type {
  RawValuePair,
  RawPeriodBase,
  ValuePair,
  ProjectedPeriodBase,
} from "@src/types/common.types";

// ============================================================================
// ① Raw
// ============================================================================

/** 利润表单期原始数据（40 个二元组 + 3 个标量） */
export interface RawIncomePeriod extends RawPeriodBase {
  // ── 营业总收入 / 成本 ──
  /** 营业总收入（勾稽验证） */
  total_revenue: RawValuePair;
  /** 营业收入。工商企业与 total_revenue 相等，金融企业会分离，**不可假设恒等** */
  revenue: RawValuePair;
  /** 营业**总**成本（勾稽验证）。⚠️ 与 operating_cost 只差一个 s */
  operating_costs: RawValuePair;
  /** 营业成本（勾稽验证）。⚠️ 与 operating_costs 只差一个 s */
  operating_cost: RawValuePair;
  /** 税金及附加 */
  operating_taxes_and_surcharge: RawValuePair;
  /** 销售费用 */
  sales_fee: RawValuePair;
  /** 管理费用 */
  manage_fee: RawValuePair;
  /** 研发费用（rad = R&D） */
  rad_cost: RawValuePair;
  /** 财务费用 */
  financing_expenses: RawValuePair;
  /** 财务费用—利息费用 */
  finance_cost_interest_fee: RawValuePair;
  /** 财务费用—利息收入 */
  finance_cost_interest_income: RawValuePair;

  // ── 营业利润构成 ──
  /** 其他收益 */
  other_income: RawValuePair;
  /** 投资收益 */
  invest_income: RawValuePair;
  /** 对联营/合营企业的投资收益 */
  invest_incomes_from_rr: RawValuePair;
  /** 公允价值变动收益（fv = fair value） */
  income_from_chg_in_fv: RawValuePair;
  /**
   * 信用减值损失。
   * ⚠️ 本字段为**负值**，而 asset_impairment_loss 为正值 —— 上游符号约定相反。
   * 计算营业利润时前者直接相加、后者须减去。**不要"顺手统一符号"**。
   */
  credit_impairment_loss: RawValuePair;
  /** 资产减值损失。⚠️ 为**正值**，勾稽时须减去（与 credit_impairment_loss 相反） */
  asset_impairment_loss: RawValuePair;
  /** 资产处置收益 */
  asset_disposal_income: RawValuePair;
  /** 汇兑收益 */
  exchg_gain: RawValuePair;
  /** **营业利润**（勾稽验证，op = operating profit） */
  op: RawValuePair;

  // ── 利润总额 / 净利润 ──
  /** 营业外收入 */
  non_operating_income: RawValuePair;
  /** 营业外支出 */
  non_operating_payout: RawValuePair;
  /** 非流动资产处置利得 */
  noncurrent_assets_dispose_gain: RawValuePair;
  /** 非流动资产处置损失 */
  noncurrent_asset_disposal_loss: RawValuePair;
  /** **利润总额**（勾稽验证：op + 营业外收入 − 营业外支出，完全吻合） */
  profit_total_amt: RawValuePair;
  /** 所得税费用 */
  income_tax_expenses: RawValuePair;
  /**
   * **净利润**（勾稽验证：利润总额 − 所得税，完全吻合），**含少数股东损益**。
   * ⚠️ 与 net_profit_atsopc（归母净利润）是不同概念，回写时不可混用。
   */
  net_profit: RawValuePair;
  /** 持续经营净利润 */
  continous_operating_np: RawValuePair;
  /** 终止经营净利润 */
  net_profit_bi: RawValuePair;
  /**
   * **归属于母公司股东的净利润**（勾稽验证，完全吻合）。
   * atsopc = attributable to shareholders of parent company。
   *
   * ⚠️ 少数股东损益为负时，**归母净利润会高于合并净利润**
   * （实测赛力斯 2026Q1：归母 7.54 亿 > 合并 6.11 亿）。回写务必区分二者。
   */
  net_profit_atsopc: RawValuePair;
  /** 少数股东损益（gal = gain and loss）。**可为负** */
  minority_gal: RawValuePair;
  /** 归母**扣非**净利润（nrgal = non-recurring gain and loss） */
  net_profit_after_nrgal_atsolc: RawValuePair;

  // ── 每股收益 ──
  /** 基本每股收益。⚠️ **单位是元/股**，与其余金额字段（元）不同 */
  basic_eps: RawValuePair;
  /** 稀释每股收益。⚠️ **单位是元/股** */
  dlt_earnings_per_share: RawValuePair;

  // ── 综合收益 ──
  /**
   * 其他综合收益（本期**发生额**）。
   * ⚠️ balance.json 有同名字段但语义是「累计**余额**」—— 跨表 join 会静默冲突。
   */
  othr_compre_income: RawValuePair;
  /** 归属母公司的其他综合收益 */
  othr_compre_income_atoopc: RawValuePair;
  /** 归属少数股东的其他综合收益 */
  othr_compre_income_atms: RawValuePair;
  /** 综合收益总额 */
  total_compre_income: RawValuePair;
  /** 归属母公司的综合收益总额 */
  total_compre_income_atsopc: RawValuePair;
  /** 归属少数股东的综合收益总额 */
  total_compre_income_atms: RawValuePair;
}

// ============================================================================
// ③ 对外投影
// ============================================================================

/**
 * 投影后的利润表单期。
 *
 * 显式枚举字段（CLAUDE.md §3.5：禁止 spread，避免上游新增字段静默泄露）。
 * 金额单位统一为**元**，`eps` 两项为**元/股**。
 */
export interface ProjectedIncomePeriod extends ProjectedPeriodBase {
  /** 营业总收入 */
  totalRevenue: ValuePair;
  /** 营业收入 */
  revenue: ValuePair;
  /** 营业总成本 */
  totalOperatingCosts: ValuePair;
  /** 营业成本 */
  operatingCost: ValuePair;
  /** 税金及附加 */
  taxesAndSurcharge: ValuePair;
  /** 销售费用 */
  sellingExpenses: ValuePair;
  /** 管理费用 */
  adminExpenses: ValuePair;
  /** 研发费用 */
  rdExpenses: ValuePair;
  /** 财务费用 */
  financeExpenses: ValuePair;
  /** 财务费用—利息费用 */
  interestExpense: ValuePair;
  /** 财务费用—利息收入 */
  interestIncome: ValuePair;
  /** 其他收益 */
  otherIncome: ValuePair;
  /** 投资收益 */
  investIncome: ValuePair;
  /** 对联营/合营企业的投资收益 */
  investIncomeFromAssociates: ValuePair;
  /** 公允价值变动收益 */
  fairValueChangeIncome: ValuePair;
  /** 信用减值损失（上游为负值） */
  creditImpairmentLoss: ValuePair;
  /** 资产减值损失（上游为正值，符号约定与信用减值相反） */
  assetImpairmentLoss: ValuePair;
  /** 资产处置收益 */
  assetDisposalIncome: ValuePair;
  /** 汇兑收益 */
  exchangeGain: ValuePair;
  /** 营业利润 */
  operatingProfit: ValuePair;
  /** 营业外收入 */
  nonOperatingIncome: ValuePair;
  /** 营业外支出 */
  nonOperatingExpense: ValuePair;
  /** 非流动资产处置利得 */
  nonCurrentAssetDisposalGain: ValuePair;
  /** 非流动资产处置损失 */
  nonCurrentAssetDisposalLoss: ValuePair;
  /** 利润总额 */
  totalProfit: ValuePair;
  /** 所得税费用 */
  incomeTaxExpense: ValuePair;
  /** 净利润（含少数股东损益） */
  netProfit: ValuePair;
  /** 持续经营净利润 */
  continuingOperationsNetProfit: ValuePair;
  /** 终止经营净利润 */
  discontinuedOperationsNetProfit: ValuePair;
  /** 归属于母公司股东的净利润 */
  netProfitAttrParent: ValuePair;
  /** 少数股东损益 */
  minorityInterestIncome: ValuePair;
  /** 归母扣非净利润 */
  netProfitDeductNonRecurring: ValuePair;
  /** 基本每股收益（元/股） */
  basicEps: ValuePair;
  /** 稀释每股收益（元/股） */
  dilutedEps: ValuePair;
  /** 其他综合收益（本期发生额） */
  otherComprehensiveIncome: ValuePair;
  /** 归属母公司的其他综合收益 */
  otherComprehensiveIncomeAttrParent: ValuePair;
  /** 归属少数股东的其他综合收益 */
  otherComprehensiveIncomeAttrMinority: ValuePair;
  /** 综合收益总额 */
  totalComprehensiveIncome: ValuePair;
  /** 归属母公司的综合收益总额 */
  totalComprehensiveIncomeAttrParent: ValuePair;
  /** 归属少数股东的综合收益总额 */
  totalComprehensiveIncomeAttrMinority: ValuePair;
}
