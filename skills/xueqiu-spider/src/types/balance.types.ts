/**
 * 资产负债表（balance.json）类型定义
 *
 * 🔴 **口径为时点存量**（该报告期末当日的余额），**不可跨期相加**。
 * 这与利润表/现金流量表（期间流量）有根本区别。
 *
 * ⚠️ 本表数值看起来也逐期递增，容易误判为累计口径。区分依据是**表的性质**
 * 而非数值趋势 —— 2023 年就出现过中报总资产（370 亿）低于一季报（444 亿）
 * 的情况，累计口径不可能下降。
 *
 * 🔴 **不要对本表使用 `type=S*`**：上游对全族套用同一差分逻辑，未区分
 * 流量/存量。对存量做差分得到的是「期间变动额」而非「余额」，产出负的总资产
 * （实测 S2「2023二季度」total_assets = −73.58 亿）与负的资产负债率。
 *
 * 字段中文名依据勾稽验算推定，见 docs/api/README.md §4.5。
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

/** 资产负债表单期原始数据（87 个二元组 + 3 个标量） */
export interface RawBalancePeriod extends RawPeriodBase {
  // ── 核心汇总项（五组勾稽全部精确吻合）──
  /** 资产总计（勾稽验证） */
  total_assets: RawValuePair;
  /** 负债合计（勾稽验证） */
  total_liab: RawValuePair;
  /** 所有者权益合计，**含少数股东权益**（勾稽验证） */
  total_holders_equity: RawValuePair;
  /** 负债和所有者权益总计（恒等于 total_assets） */
  total_liab_and_holders_equity: RawValuePair;
  /** 流动资产合计 */
  total_current_assets: RawValuePair;
  /** 非流动资产合计 */
  total_noncurrent_assets: RawValuePair;
  /** 流动负债合计 */
  total_current_liab: RawValuePair;
  /** 非流动负债合计 */
  total_noncurrent_liab: RawValuePair;
  /**
   * 归属于母公司股东权益合计（勾稽验证）。
   * ⚠️ 上游拼写 `quity` 缺 e，**原样保留**，改对了会取不到值。
   */
  total_quity_atsopc: RawValuePair;
  /** 少数股东权益 */
  minority_equity: RawValuePair;
  /**
   * 资产负债率。
   * ⚠️ **单位是小数**（0.659 = 65.9%）。indicator.json 的同名字段是
   * **百分数**（65.9226）—— 跨表 join 会静默差 100 倍。
   */
  asset_liab_ratio: RawValuePair;

  // ── 流动资产 ──
  /** 货币资金。⚠️ 与现金流量表的「期末现金及现金等价物」口径不同（含受限资金） */
  currency_funds: RawValuePair;
  /** 交易性金融资产 */
  tradable_fnncl_assets: RawValuePair;
  /** 应收票据 */
  bills_receivable: RawValuePair;
  /** 应收账款 */
  account_receivable: RawValuePair;
  /** 应收票据及应收账款（合计项） */
  ar_and_br: RawValuePair;
  /** 预付款项 */
  pre_payment: RawValuePair;
  /** 应收利息 */
  interest_receivable: RawValuePair;
  /** 应收股利 */
  dividend_receivable: RawValuePair;
  /** 其他应收款 */
  othr_receivables: RawValuePair;
  /** 存货 */
  inventory: RawValuePair;
  /** 合同资产 */
  contractual_assets: RawValuePair;
  /** 持有待售资产 */
  to_sale_asset: RawValuePair;
  /** 一年内到期的非流动资产 */
  nca_due_within_one_year: RawValuePair;
  /** 其他流动资产 */
  othr_current_assets: RawValuePair;
  /** 流动资产特殊项目（si = special items） */
  current_assets_si: RawValuePair;

  // ── 非流动资产 ──
  /** 可供出售金融资产 */
  salable_financial_assets: RawValuePair;
  /**
   * 可供出售金融资产 —— **上游拼写错误的变体**（`finacial` 缺 n），
   * 与 salable_financial_assets 并存于同一响应。
   * ⚠️ **必须原样保留**，"顺手改对"会导致取不到值。
   */
  saleable_finacial_assets: RawValuePair;
  /** 持有至到期投资 */
  held_to_maturity_invest: RawValuePair;
  /** 长期应收款 */
  lt_receivable: RawValuePair;
  /** 长期股权投资 */
  lt_equity_invest: RawValuePair;
  /** 其他权益工具投资 */
  other_eq_ins_invest: RawValuePair;
  /** 投资性房地产 */
  invest_property: RawValuePair;
  /** 固定资产（裸名）。⚠️ 本样本恒为 null，有值的是 fixed_asset_sum */
  fixed_asset: RawValuePair;
  /** 固定资产合计 */
  fixed_asset_sum: RawValuePair;
  /** 在建工程（裸名）。⚠️ 本样本恒为 null，有值的是 _sum */
  construction_in_process: RawValuePair;
  /** 在建工程合计 */
  construction_in_process_sum: RawValuePair;
  /** 工程物资 */
  project_goods_and_material: RawValuePair;
  /** 固定资产清理 */
  fixed_assets_disposal: RawValuePair;
  /** 生产性生物资产 */
  productive_biological_assets: RawValuePair;
  /** 油气资产 */
  oil_and_gas_asset: RawValuePair;
  /** 无形资产 */
  intangible_assets: RawValuePair;
  /** 开发支出 */
  dev_expenditure: RawValuePair;
  /** 商誉 */
  goodwill: RawValuePair;
  /** 长期待摊费用 */
  lt_deferred_expense: RawValuePair;
  /** 递延所得税资产（dt = deferred tax） */
  dt_assets: RawValuePair;
  /** 其他非流动金融资产 */
  other_illiquid_fnncl_assets: RawValuePair;
  /** 其他非流动资产 */
  othr_noncurrent_assets: RawValuePair;
  /** 非流动资产特殊项目 */
  noncurrent_assets_si: RawValuePair;

  // ── 流动负债 ──
  /** 短期借款（st = short term） */
  st_loan: RawValuePair;
  /** 交易性金融负债 */
  tradable_fnncl_liab: RawValuePair;
  /** 衍生金融负债 */
  derivative_fnncl_liab: RawValuePair;
  /** 应付票据 */
  bill_payable: RawValuePair;
  /** 应付账款 */
  accounts_payable: RawValuePair;
  /** 应付票据及应付账款（勾稽验证：bill_payable + accounts_payable == 本项） */
  bp_and_ap: RawValuePair;
  /** 预收款项 */
  pre_receivable: RawValuePair;
  /** 合同负债 */
  contract_liabilities: RawValuePair;
  /** 应付职工薪酬 */
  payroll_payable: RawValuePair;
  /** 应交税费 */
  tax_payable: RawValuePair;
  /** 应付利息 */
  interest_payable: RawValuePair;
  /** 应付股利。⚠️ 是时点欠付余额，**不是分红记录**，不能用来算股息率 */
  dividend_payable: RawValuePair;
  /** 其他应付款 */
  othr_payables: RawValuePair;
  /** 持有待售负债 */
  to_sale_debt: RawValuePair;
  /** 一年内到期的非流动负债 */
  noncurrent_liab_due_in1y: RawValuePair;
  /** 其他流动负债 */
  othr_current_liab: RawValuePair;
  /** 流动负债特殊项目 */
  current_liab_si: RawValuePair;

  // ── 非流动负债 ──
  /** 长期借款（lt = long term） */
  lt_loan: RawValuePair;
  /** 应付债券 */
  bond_payable: RawValuePair;
  /** 永续债 */
  perpetual_bond: RawValuePair;
  /** 长期应付款（裸名）。⚠️ 本样本为 null，有值的是 _sum */
  lt_payable: RawValuePair;
  /** 长期应付款合计。⚠️ 本样本为 `[0.0, null]` —— 值确实为零，不是"无数据" */
  lt_payable_sum: RawValuePair;
  /** 专项应付款 */
  special_payable: RawValuePair;
  /** 预计负债 */
  estimated_liab: RawValuePair;
  /** 递延所得税负债 */
  dt_liab: RawValuePair;
  /** 其他非流动负债 */
  othr_non_current_liab: RawValuePair;
  /** 非流动负债特殊项目 */
  noncurrent_liab_si: RawValuePair;
  /** 非流动负债递延收益（di 含义未确认，置信度低） */
  noncurrent_liab_di: RawValuePair;

  // ── 所有者权益 ──
  /**
   * **股本（金额，单位元）—— 不是股数！**
   *
   * 归母权益构成勾稽证明它是金额（作为加数参与求和，若是股数量纲不可能对上）。
   * 数值与股数相同是因为 A 股股本面值通常为 1 元/股。
   * ⚠️ **面值非 1 元的标的两者会不同**；且 EPS 用的是加权平均股数，
   * 与本字段（期末）实测偏差最高 8.44%。算每股指标类估值不要用它反算。
   */
  shares: RawValuePair;
  /** 其他权益工具 */
  othr_equity_instruments: RawValuePair;
  /** 资本公积。⚠️ indicator.json 的同名字段是**每股**资本公积，语义完全不同 */
  capital_reserve: RawValuePair;
  /** 库存股 */
  treasury_stock: RawValuePair;
  /**
   * 其他综合收益**累计余额**。
   * ⚠️ income.json 有同名字段但语义是「本期**发生额**」—— 跨表 join 会静默冲突。
   */
  othr_compre_income: RawValuePair;
  /** 专项储备 */
  special_reserve: RawValuePair;
  /** 盈余公积 */
  earned_surplus: RawValuePair;
  /** 一般风险准备 */
  general_risk_provision: RawValuePair;
  /** 未分配利润（undstrbtd = undistributed） */
  undstrbtd_profit: RawValuePair;
  /** 外币报表折算差额 */
  frgn_currency_convert_diff: RawValuePair;
}

// ============================================================================
// ③ 对外投影
// ============================================================================

/** 投影后的资产负债表单期。金额单位为**元**，`assetLiabRatio` 为**小数** */
export interface ProjectedBalancePeriod extends ProjectedPeriodBase {
  // 核心汇总
  totalAssets: ValuePair;
  totalLiabilities: ValuePair;
  totalEquity: ValuePair;
  totalLiabilitiesAndEquity: ValuePair;
  totalCurrentAssets: ValuePair;
  totalNonCurrentAssets: ValuePair;
  totalCurrentLiabilities: ValuePair;
  totalNonCurrentLiabilities: ValuePair;
  equityAttrParent: ValuePair;
  minorityEquity: ValuePair;
  /** 资产负债率（**小数**，0.659 = 65.9%） */
  assetLiabRatio: ValuePair;

  // 流动资产
  currencyFunds: ValuePair;
  tradableFinancialAssets: ValuePair;
  billsReceivable: ValuePair;
  accountsReceivable: ValuePair;
  billsAndAccountsReceivable: ValuePair;
  prepayment: ValuePair;
  interestReceivable: ValuePair;
  dividendReceivable: ValuePair;
  otherReceivables: ValuePair;
  inventory: ValuePair;
  contractAssets: ValuePair;
  heldForSaleAssets: ValuePair;
  nonCurrentAssetsDueWithinOneYear: ValuePair;
  otherCurrentAssets: ValuePair;
  currentAssetsSpecialItems: ValuePair;

  // 非流动资产
  availableForSaleFinancialAssets: ValuePair;
  /** 上游拼写错误变体（finacial），与上一字段并存 */
  availableForSaleFinancialAssetsAlt: ValuePair;
  heldToMaturityInvestment: ValuePair;
  longTermReceivables: ValuePair;
  longTermEquityInvestment: ValuePair;
  otherEquityInstrumentInvestment: ValuePair;
  investmentProperty: ValuePair;
  fixedAssets: ValuePair;
  fixedAssetsTotal: ValuePair;
  constructionInProgress: ValuePair;
  constructionInProgressTotal: ValuePair;
  projectMaterials: ValuePair;
  fixedAssetsDisposal: ValuePair;
  productiveBiologicalAssets: ValuePair;
  oilAndGasAssets: ValuePair;
  intangibleAssets: ValuePair;
  developmentExpenditure: ValuePair;
  goodwill: ValuePair;
  longTermDeferredExpenses: ValuePair;
  deferredTaxAssets: ValuePair;
  otherNonCurrentFinancialAssets: ValuePair;
  otherNonCurrentAssets: ValuePair;
  nonCurrentAssetsSpecialItems: ValuePair;

  // 流动负债
  shortTermLoans: ValuePair;
  tradableFinancialLiabilities: ValuePair;
  derivativeFinancialLiabilities: ValuePair;
  billsPayable: ValuePair;
  accountsPayable: ValuePair;
  billsAndAccountsPayable: ValuePair;
  advanceReceipts: ValuePair;
  contractLiabilities: ValuePair;
  payrollPayable: ValuePair;
  taxPayable: ValuePair;
  interestPayable: ValuePair;
  /** 应付股利（时点欠付余额，非分红记录） */
  dividendPayable: ValuePair;
  otherPayables: ValuePair;
  heldForSaleLiabilities: ValuePair;
  nonCurrentLiabilitiesDueWithinOneYear: ValuePair;
  otherCurrentLiabilities: ValuePair;
  currentLiabilitiesSpecialItems: ValuePair;

  // 非流动负债
  longTermLoans: ValuePair;
  bondsPayable: ValuePair;
  perpetualBonds: ValuePair;
  longTermPayables: ValuePair;
  longTermPayablesTotal: ValuePair;
  specialPayables: ValuePair;
  estimatedLiabilities: ValuePair;
  deferredTaxLiabilities: ValuePair;
  otherNonCurrentLiabilities: ValuePair;
  nonCurrentLiabilitiesSpecialItems: ValuePair;
  nonCurrentDeferredIncome: ValuePair;

  // 所有者权益
  /** 股本金额（元，非股数） */
  shareCapital: ValuePair;
  otherEquityInstruments: ValuePair;
  /** 资本公积**总额**（元） */
  capitalReserve: ValuePair;
  treasuryStock: ValuePair;
  /** 其他综合收益**累计余额** */
  otherComprehensiveIncome: ValuePair;
  specialReserve: ValuePair;
  surplusReserve: ValuePair;
  generalRiskProvision: ValuePair;
  undistributedProfit: ValuePair;
  foreignCurrencyTranslationDiff: ValuePair;
}
