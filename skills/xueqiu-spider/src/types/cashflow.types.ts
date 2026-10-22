/**
 * 现金流量表（cash_flow.json）类型定义
 *
 * **口径为期间累计**（年初至该报告期末的累计发生额），与利润表同类。
 * ⚠️ 但本表累计值**可以下降甚至为负**（经营现金流本身可正可负），
 * 不能像利润表那样用「单调递增」判定累计口径。
 *
 * ## 🔴 本表不是纯流量表
 *
 * 混着 2 个**时点余额**字段（`initial_balance_of_cce` / `final_balance_of_cce`），
 * 在 `type=S*` 下同样失真：期初恒变成 0.0、期末退化成等于当季净增额。
 *
 * **这比资产负债表的坑更隐蔽** —— balance 的 S 系列会产出负的总资产，一眼可识破；
 * 而这里失真后仍是**正的、量级合理的数字**（2025四季度真实期末余额 483.63 亿，
 * S0 返回 216.79 亿），从结果完全看不出错误。
 *
 * ## 命名规律
 *
 * | 缩写 | 含义 |
 * |------|------|
 * | oa / ia / fa | operating / investing / financing activities |
 * | ci / cos     | cash inflow / cash outflow |
 * | ncf          | net cash flow |
 * | cce          | cash and cash equivalents |
 *
 * 于是 `sub_total_of_ci_from_oa` = 经营活动现金流入小计。
 *
 * 九组勾稽已用赛力斯 2026Q1 实数验算通过，见 docs/api/README.md §5.5。
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

/** 现金流量表单期原始数据（38 个二元组 + 3 个标量） */
export interface RawCashFlowPeriod extends RawPeriodBase {
  // ── 三大活动汇总（全部勾稽验证）──
  /** 经营活动现金流入小计 */
  sub_total_of_ci_from_oa: RawValuePair;
  /** 经营活动现金流出小计 */
  sub_total_of_cos_from_oa: RawValuePair;
  /** **经营活动产生的现金流量净额**（流入小计 − 流出小计） */
  ncf_from_oa: RawValuePair;
  /** 投资活动现金流入小计 */
  sub_total_of_ci_from_ia: RawValuePair;
  /** 投资活动现金流出小计 */
  sub_total_of_cos_from_ia: RawValuePair;
  /** **投资活动产生的现金流量净额** */
  ncf_from_ia: RawValuePair;
  /** 筹资活动现金流入小计 */
  sub_total_of_ci_from_fa: RawValuePair;
  /** 筹资活动现金流出小计 */
  sub_total_of_cos_from_fa: RawValuePair;
  /** **筹资活动产生的现金流量净额** */
  ncf_from_fa: RawValuePair;

  // ── 经营活动明细 ──
  /** 销售商品、提供劳务收到的现金 */
  cash_received_of_sales_service: RawValuePair;
  /** 收到的税费返还 */
  refund_of_tax_and_levies: RawValuePair;
  /** 收到其他与经营活动有关的现金 */
  cash_received_of_othr_oa: RawValuePair;
  /** 购买商品、接受劳务支付的现金 */
  goods_buy_and_service_cash_pay: RawValuePair;
  /** 支付给职工以及为职工支付的现金 */
  cash_paid_to_employee_etc: RawValuePair;
  /** 支付的各项税费 */
  payments_of_all_taxes: RawValuePair;
  /** 支付其他与经营活动有关的现金 */
  othrcash_paid_relating_to_oa: RawValuePair;

  // ── 投资活动明细 ──
  /** 收回投资收到的现金（dspsl = disposal） */
  cash_received_of_dspsl_invest: RawValuePair;
  /** 取得投资收益收到的现金 */
  invest_income_cash_received: RawValuePair;
  /** 处置固定/无形/其他长期资产收回的现金净额 */
  net_cash_of_disposal_assets: RawValuePair;
  /** 处置子公司及其他营业单位收到的现金净额 */
  net_cash_of_disposal_branch: RawValuePair;
  /** 收到其他与投资活动有关的现金 */
  cash_received_of_othr_ia: RawValuePair;
  /** 购建固定/无形/其他长期资产支付的现金 */
  cash_paid_for_assets: RawValuePair;
  /** 投资支付的现金 */
  invest_paid_cash: RawValuePair;
  /** 取得子公司及其他营业单位支付的现金净额 */
  net_cash_amt_from_branch: RawValuePair;
  /** 支付其他与投资活动有关的现金 */
  othrcash_paid_relating_to_ia: RawValuePair;

  // ── 筹资活动明细 ──
  /** 吸收投资收到的现金 */
  cash_received_of_absorb_invest: RawValuePair;
  /** 其中：子公司吸收少数股东投资收到的现金 */
  cash_received_from_investor: RawValuePair;
  /** 取得借款收到的现金 */
  cash_received_of_borrowing: RawValuePair;
  /** 发行债券收到的现金 */
  cash_received_from_bond_issue: RawValuePair;
  /** 收到其他与筹资活动有关的现金 */
  cash_received_of_othr_fa: RawValuePair;
  /** 偿还债务支付的现金 */
  cash_pay_for_debt: RawValuePair;
  /**
   * 分配股利、利润**或偿付利息**支付的现金。
   * ⚠️ **混合了利息支出**，不能直接当分红额用来算股息率/分红率。
   */
  cash_paid_of_distribution: RawValuePair;
  /** 其中：子公司支付给少数股东的股利、利润 */
  branch_paid_to_minority_holder: RawValuePair;
  /** 支付其他与筹资活动有关的现金 */
  othrcash_paid_relating_to_fa: RawValuePair;

  // ── 现金余额（⚠️ 含 2 个时点字段）──
  /** 汇率变动对现金及现金等价物的影响。**流量字段**，S 口径下正确 */
  effect_of_exchange_chg_on_cce: RawValuePair;
  /** 现金及现金等价物净增加额。**流量字段**，S 口径下正确 */
  net_increase_in_cce: RawValuePair;
  /**
   * 期初现金及现金等价物余额。
   * 🔴 **时点字段，type=S* 时失真** —— 第 2~4 季恒变成 0.0。
   */
  initial_balance_of_cce: RawValuePair;
  /**
   * 期末现金及现金等价物余额。
   * 🔴 **时点字段，type=S* 时失真** —— 退化成等于当季净增额。
   *
   * ⚠️ 与 balance.json 的 `currency_funds`（货币资金）**口径不同**：
   * 2026Q1 分别为 221.49 亿 / 638.54 亿，差额为受限资金。不可混用。
   */
  final_balance_of_cce: RawValuePair;
}

// ============================================================================
// ③ 对外投影
// ============================================================================

/** 投影后的现金流量表单期。金额单位为**元** */
export interface ProjectedCashFlowPeriod extends ProjectedPeriodBase {
  // 三大活动汇总
  operatingCashInflowSubtotal: ValuePair;
  operatingCashOutflowSubtotal: ValuePair;
  /** 经营活动产生的现金流量净额 */
  netCashFromOperating: ValuePair;
  investingCashInflowSubtotal: ValuePair;
  investingCashOutflowSubtotal: ValuePair;
  /** 投资活动产生的现金流量净额 */
  netCashFromInvesting: ValuePair;
  financingCashInflowSubtotal: ValuePair;
  financingCashOutflowSubtotal: ValuePair;
  /** 筹资活动产生的现金流量净额 */
  netCashFromFinancing: ValuePair;

  // 经营活动明细
  cashFromSalesAndServices: ValuePair;
  taxRefundReceived: ValuePair;
  otherOperatingCashReceived: ValuePair;
  cashPaidForGoodsAndServices: ValuePair;
  cashPaidToEmployees: ValuePair;
  taxesPaid: ValuePair;
  otherOperatingCashPaid: ValuePair;

  // 投资活动明细
  cashFromInvestmentRecovery: ValuePair;
  cashFromInvestmentIncome: ValuePair;
  netCashFromAssetDisposal: ValuePair;
  netCashFromSubsidiaryDisposal: ValuePair;
  otherInvestingCashReceived: ValuePair;
  cashPaidForFixedAssets: ValuePair;
  cashPaidForInvestment: ValuePair;
  netCashPaidForSubsidiary: ValuePair;
  otherInvestingCashPaid: ValuePair;

  // 筹资活动明细
  cashFromInvestorContribution: ValuePair;
  cashFromMinorityContribution: ValuePair;
  cashFromBorrowing: ValuePair;
  cashFromBondIssue: ValuePair;
  otherFinancingCashReceived: ValuePair;
  cashPaidForDebtRepayment: ValuePair;
  /** 分配股利、利润或偿付利息支付的现金（⚠️ 含利息，非纯分红） */
  cashPaidForDividendAndInterest: ValuePair;
  cashPaidToMinorityHolders: ValuePair;
  otherFinancingCashPaid: ValuePair;

  // 现金余额
  effectOfExchangeRateChange: ValuePair;
  netIncreaseInCash: ValuePair;
  /** 期初现金及现金等价物余额（时点字段，S 口径下会被置空） */
  beginningCashBalance: ValuePair;
  /** 期末现金及现金等价物余额（时点字段，S 口径下会被置空） */
  endingCashBalance: ValuePair;
}
