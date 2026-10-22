/**
 * 现金流量表 AI-Ready 投影
 *
 * 🔴 本文件的独有职责：**字段级** S 系列抑制（与 balance 的全表抑制不同）。
 *
 * 现金流量表是流量表，`S` 系列（单季差分）对 36 个流量字段**语义正确**
 * （已验算：S0「2025四季度」ncf_from_oa 62.64 亿 = 年报 289.14 − 三季报 226.49），
 * S4 更能拿到上市公司不单独披露的 Q4 单季数据，价值很高。
 *
 * 但混着的 2 个**时点余额**字段会失真：
 *   - `initial_balance_of_cce` → 第 2~4 季恒变成 0.0
 *   - `final_balance_of_cce`   → 退化成等于当季净增额
 *
 * 所以**不能按端点粗粒度开关** —— 全禁会丢掉 36 个高价值字段，
 * 全放会让 Agent 把「当季净增 216.79 亿」当成期末余额（真实值 483.63 亿）。
 */
import { toValuePair } from "@src/thrall/shared";
import { money, trend, val, yoy, buildSemantics } from "@src/projections/envelope";
import { S_SERIES_UNSAFE_FIELDS } from "@src/constants";
import type {
  FinanceAiReady,
  FinanceMeta,
  ValuePair,
} from "@src/types/common.types";
import type {
  RawCashFlowPeriod,
  ProjectedCashFlowPeriod,
} from "@src/types/cashflow.types";
import type { CashFlowGoalResult } from "@src/thrall/cashflow";

function toIso(ms: number | null | undefined): string | null {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

const SUPPRESSED: ValuePair = { value: null, yoy: null };

/** S 口径下失真的时点字段（上游原字段名） */
const UNSAFE = S_SERIES_UNSAFE_FIELDS.cashFlow;
const UNSAFE_FIELDS: readonly string[] = Array.isArray(UNSAFE) ? UNSAFE : [];

/**
 * 投影单个报告期。
 *
 * @param suppress 为 true（S 系列单季口径）时，仅 `UNSAFE_FIELDS` 中的
 *                 时点字段置空，其余流量字段正常透传。
 */
function projectPeriod(
  raw: RawCashFlowPeriod,
  suppress: boolean,
): ProjectedCashFlowPeriod {
  const v = toValuePair;
  /** 时点字段专用取值器：S 口径下置空 */
  const t = (
    pair: RawCashFlowPeriod[keyof RawCashFlowPeriod],
    fieldName: string,
  ): ValuePair =>
    suppress && UNSAFE_FIELDS.includes(fieldName)
      ? SUPPRESSED
      : toValuePair(pair as never);

  return {
    reportDate: toIso(raw.report_date) ?? "",
    reportName: raw.report_name,
    dataUpdatedAt: toIso(raw.ctime),

    // 三大活动汇总
    operatingCashInflowSubtotal: v(raw.sub_total_of_ci_from_oa),
    operatingCashOutflowSubtotal: v(raw.sub_total_of_cos_from_oa),
    netCashFromOperating: v(raw.ncf_from_oa),
    investingCashInflowSubtotal: v(raw.sub_total_of_ci_from_ia),
    investingCashOutflowSubtotal: v(raw.sub_total_of_cos_from_ia),
    netCashFromInvesting: v(raw.ncf_from_ia),
    financingCashInflowSubtotal: v(raw.sub_total_of_ci_from_fa),
    financingCashOutflowSubtotal: v(raw.sub_total_of_cos_from_fa),
    netCashFromFinancing: v(raw.ncf_from_fa),

    // 经营活动明细
    cashFromSalesAndServices: v(raw.cash_received_of_sales_service),
    taxRefundReceived: v(raw.refund_of_tax_and_levies),
    otherOperatingCashReceived: v(raw.cash_received_of_othr_oa),
    cashPaidForGoodsAndServices: v(raw.goods_buy_and_service_cash_pay),
    cashPaidToEmployees: v(raw.cash_paid_to_employee_etc),
    taxesPaid: v(raw.payments_of_all_taxes),
    otherOperatingCashPaid: v(raw.othrcash_paid_relating_to_oa),

    // 投资活动明细
    cashFromInvestmentRecovery: v(raw.cash_received_of_dspsl_invest),
    cashFromInvestmentIncome: v(raw.invest_income_cash_received),
    netCashFromAssetDisposal: v(raw.net_cash_of_disposal_assets),
    netCashFromSubsidiaryDisposal: v(raw.net_cash_of_disposal_branch),
    otherInvestingCashReceived: v(raw.cash_received_of_othr_ia),
    cashPaidForFixedAssets: v(raw.cash_paid_for_assets),
    cashPaidForInvestment: v(raw.invest_paid_cash),
    netCashPaidForSubsidiary: v(raw.net_cash_amt_from_branch),
    otherInvestingCashPaid: v(raw.othrcash_paid_relating_to_ia),

    // 筹资活动明细
    cashFromInvestorContribution: v(raw.cash_received_of_absorb_invest),
    cashFromMinorityContribution: v(raw.cash_received_from_investor),
    cashFromBorrowing: v(raw.cash_received_of_borrowing),
    cashFromBondIssue: v(raw.cash_received_from_bond_issue),
    otherFinancingCashReceived: v(raw.cash_received_of_othr_fa),
    cashPaidForDebtRepayment: v(raw.cash_pay_for_debt),
    cashPaidForDividendAndInterest: v(raw.cash_paid_of_distribution),
    cashPaidToMinorityHolders: v(raw.branch_paid_to_minority_holder),
    otherFinancingCashPaid: v(raw.othrcash_paid_relating_to_fa),

    // 现金余额 —— 后两项是时点字段，S 口径下置空
    effectOfExchangeRateChange: v(raw.effect_of_exchange_chg_on_cce),
    netIncreaseInCash: v(raw.net_increase_in_cce),
    beginningCashBalance: t(raw.initial_balance_of_cce, "initial_balance_of_cce"),
    endingCashBalance: t(raw.final_balance_of_cce, "final_balance_of_cce"),
  };
}

function buildCashFlowInsights(
  items: ProjectedCashFlowPeriod[],
  result: CashFlowGoalResult,
): string[] {
  if (items.length === 0) return ["该筛选下无公开数据"];

  const out: string[] = [];
  const latest = items[0];
  const name = result.quoteName ?? result.symbol;

  out.push(
    `${name}（${result.symbol}）共取到 ${items.length} 个报告期，最新为 ${latest.reportName}`,
  );

  const oa = val(latest.netCashFromOperating);
  const ia = val(latest.netCashFromInvesting);
  const fa = val(latest.netCashFromFinancing);

  out.push(
    `${latest.reportName} 三大活动净额：经营 ${money(oa)}（${trend(yoy(latest.netCashFromOperating))}）、` +
      `投资 ${money(ia)}、筹资 ${money(fa)}`,
  );

  // 现金流量结构定性 —— 这是基本面分析最常用的速判
  if (oa !== null && ia !== null && fa !== null) {
    const pattern = describeCashPattern(oa, ia, fa);
    if (pattern) out.push(pattern);
  }

  if (result.singleQuarter) {
    out.push(
      "✅ 单季口径对现金流量表的流量字段语义正确（当季发生额），" +
        "S4 可拿到上市公司不单独披露的第四季度单季数据",
    );
    out.push(
      "🔴 但期初/期末现金余额是**时点字段**，单季差分后失真" +
        "（期初恒为 0、期末退化成等于当季净增额），已置为 null。" +
        "如需真实余额请改用 type=all / Q1-Q4",
    );
  } else {
    const ending = val(latest.endingCashBalance);
    if (ending !== null) {
      out.push(
        `期末现金及现金等价物余额 ${money(ending)}` +
          "（⚠️ 与资产负债表「货币资金」口径不同，后者含受限资金，不可混用）",
      );
    }
  }

  if (result.orgType !== null && result.orgType !== 1) {
    out.push(
      `⚠️ 该标的 org_type=${result.orgType}（非一般工商企业），` +
        "现金流量表科目结构不同（如金融企业有「客户存款净增加额」），请核对",
    );
  }

  return out;
}

/** 三大活动净额的正负组合 → 经营阶段定性 */
function describeCashPattern(oa: number, ia: number, fa: number): string | null {
  if (oa > 0 && ia < 0 && fa < 0) {
    return "现金流结构：经营净流入、投资净流出、筹资净流出 —— 典型的成熟期自我造血形态";
  }
  if (oa > 0 && ia < 0 && fa > 0) {
    return "现金流结构：经营净流入、投资净流出、筹资净流入 —— 扩张期，靠经营与外部融资共同支撑投入";
  }
  if (oa < 0 && ia < 0 && fa > 0) {
    return "⚠️ 现金流结构：经营净流出、投资净流出、筹资净流入 —— 完全依赖外部输血，需关注可持续性";
  }
  if (oa < 0) {
    return "⚠️ 经营活动现金流为净流出，需结合季节性与业务周期判断（一季度备货/回款周期常见）";
  }
  return null;
}

export type CashFlowAiReady = FinanceAiReady<ProjectedCashFlowPeriod, FinanceMeta>;

export function projectCashFlowAiReady(
  result: CashFlowGoalResult,
  skillId: string,
): CashFlowAiReady {
  const suppress = result.singleQuarter;
  const items = (result.periods ?? []).map((p) => projectPeriod(p, suppress));

  const base = buildSemantics(
    "现金流量表",
    result.type,
    suppress,
    result.currencyName,
    "flow",
  );
  const semantics = suppress
    ? `${base} —— ⚠️ 期初/期末现金余额为时点字段，单季差分后失真，已置空`
    : base;

  return {
    meta: {
      skill: skillId,
      semantics,
      symbol: result.symbol,
      quoteName: result.quoteName,
      reportType: result.type,
      currency: result.currency,
      orgType: result.orgType,
      lastReportName: result.lastReportName,
      periodCount: items.length,
      pagesFetched: result.pagesFetched,
      ...(suppress
        ? { suppressedFields: ["beginningCashBalance", "endingCashBalance"] }
        : {}),
      crawledAt: result.crawledAt,
    },
    units: {
      amount: "元",
      yoy: "小数比率（0.3446 表示 +34.46%）",
    },
    insights: buildCashFlowInsights(items, result),
    items,
  };
}
