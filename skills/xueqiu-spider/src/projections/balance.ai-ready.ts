/**
 * 资产负债表 AI-Ready 投影
 *
 * 🔴 本文件承担一项独有职责：**S 系列（单季口径）字段抑制**。
 *
 * 上游对全族端点套用同一差分逻辑，未区分流量/存量。资产负债表是**时点存量表**，
 * 差分得到的是「期间变动额」而非「余额」，产出的数据在会计上荒谬：
 *   - S2「2023二季度」total_assets = **−73.58 亿**（负的总资产）
 *   - S0「2025四季度」asset_liab_ratio = **−0.0545**（负的资产负债率）
 *
 * 让 Agent 拿到「总资产 −73.58 亿」而不加解释会直接产出错误结论，
 * 故本表在 `type=S*` 时**全表业务字段置 null** 并在 meta/insights 中标注。
 */
import { toValuePair } from "@src/thrall/shared";
import { money, pct, trend, val, yoy, buildSemantics } from "@src/projections/envelope";
import type {
  FinanceAiReady,
  FinanceMeta,
  ValuePair,
} from "@src/types/common.types";
import type {
  RawBalancePeriod,
  ProjectedBalancePeriod,
} from "@src/types/balance.types";
import type { BalanceGoalResult } from "@src/thrall/balance";

function toIso(ms: number | null | undefined): string | null {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

/** 空二元组 —— S 口径下被抑制的字段 */
const SUPPRESSED: ValuePair = { value: null, yoy: null };

/**
 * 投影单个报告期 —— 逐字段显式映射。
 *
 * @param suppress 为 true 时（S 系列单季口径）全部业务字段置空，
 *                 因为对时点存量做差分无会计意义（见文件头）。
 */
function projectPeriod(
  raw: RawBalancePeriod,
  suppress: boolean,
): ProjectedBalancePeriod {
  const v = suppress ? () => SUPPRESSED : toValuePair;
  return {
    reportDate: toIso(raw.report_date) ?? "",
    reportName: raw.report_name,
    dataUpdatedAt: toIso(raw.ctime),

    // 核心汇总
    totalAssets: v(raw.total_assets),
    totalLiabilities: v(raw.total_liab),
    totalEquity: v(raw.total_holders_equity),
    totalLiabilitiesAndEquity: v(raw.total_liab_and_holders_equity),
    totalCurrentAssets: v(raw.total_current_assets),
    totalNonCurrentAssets: v(raw.total_noncurrent_assets),
    totalCurrentLiabilities: v(raw.total_current_liab),
    totalNonCurrentLiabilities: v(raw.total_noncurrent_liab),
    equityAttrParent: v(raw.total_quity_atsopc),
    minorityEquity: v(raw.minority_equity),
    assetLiabRatio: v(raw.asset_liab_ratio),

    // 流动资产
    currencyFunds: v(raw.currency_funds),
    tradableFinancialAssets: v(raw.tradable_fnncl_assets),
    billsReceivable: v(raw.bills_receivable),
    accountsReceivable: v(raw.account_receivable),
    billsAndAccountsReceivable: v(raw.ar_and_br),
    prepayment: v(raw.pre_payment),
    interestReceivable: v(raw.interest_receivable),
    dividendReceivable: v(raw.dividend_receivable),
    otherReceivables: v(raw.othr_receivables),
    inventory: v(raw.inventory),
    contractAssets: v(raw.contractual_assets),
    heldForSaleAssets: v(raw.to_sale_asset),
    nonCurrentAssetsDueWithinOneYear: v(raw.nca_due_within_one_year),
    otherCurrentAssets: v(raw.othr_current_assets),
    currentAssetsSpecialItems: v(raw.current_assets_si),

    // 非流动资产
    availableForSaleFinancialAssets: v(raw.salable_financial_assets),
    availableForSaleFinancialAssetsAlt: v(raw.saleable_finacial_assets),
    heldToMaturityInvestment: v(raw.held_to_maturity_invest),
    longTermReceivables: v(raw.lt_receivable),
    longTermEquityInvestment: v(raw.lt_equity_invest),
    otherEquityInstrumentInvestment: v(raw.other_eq_ins_invest),
    investmentProperty: v(raw.invest_property),
    fixedAssets: v(raw.fixed_asset),
    fixedAssetsTotal: v(raw.fixed_asset_sum),
    constructionInProgress: v(raw.construction_in_process),
    constructionInProgressTotal: v(raw.construction_in_process_sum),
    projectMaterials: v(raw.project_goods_and_material),
    fixedAssetsDisposal: v(raw.fixed_assets_disposal),
    productiveBiologicalAssets: v(raw.productive_biological_assets),
    oilAndGasAssets: v(raw.oil_and_gas_asset),
    intangibleAssets: v(raw.intangible_assets),
    developmentExpenditure: v(raw.dev_expenditure),
    goodwill: v(raw.goodwill),
    longTermDeferredExpenses: v(raw.lt_deferred_expense),
    deferredTaxAssets: v(raw.dt_assets),
    otherNonCurrentFinancialAssets: v(raw.other_illiquid_fnncl_assets),
    otherNonCurrentAssets: v(raw.othr_noncurrent_assets),
    nonCurrentAssetsSpecialItems: v(raw.noncurrent_assets_si),

    // 流动负债
    shortTermLoans: v(raw.st_loan),
    tradableFinancialLiabilities: v(raw.tradable_fnncl_liab),
    derivativeFinancialLiabilities: v(raw.derivative_fnncl_liab),
    billsPayable: v(raw.bill_payable),
    accountsPayable: v(raw.accounts_payable),
    billsAndAccountsPayable: v(raw.bp_and_ap),
    advanceReceipts: v(raw.pre_receivable),
    contractLiabilities: v(raw.contract_liabilities),
    payrollPayable: v(raw.payroll_payable),
    taxPayable: v(raw.tax_payable),
    interestPayable: v(raw.interest_payable),
    dividendPayable: v(raw.dividend_payable),
    otherPayables: v(raw.othr_payables),
    heldForSaleLiabilities: v(raw.to_sale_debt),
    nonCurrentLiabilitiesDueWithinOneYear: v(raw.noncurrent_liab_due_in1y),
    otherCurrentLiabilities: v(raw.othr_current_liab),
    currentLiabilitiesSpecialItems: v(raw.current_liab_si),

    // 非流动负债
    longTermLoans: v(raw.lt_loan),
    bondsPayable: v(raw.bond_payable),
    perpetualBonds: v(raw.perpetual_bond),
    longTermPayables: v(raw.lt_payable),
    longTermPayablesTotal: v(raw.lt_payable_sum),
    specialPayables: v(raw.special_payable),
    estimatedLiabilities: v(raw.estimated_liab),
    deferredTaxLiabilities: v(raw.dt_liab),
    otherNonCurrentLiabilities: v(raw.othr_non_current_liab),
    nonCurrentLiabilitiesSpecialItems: v(raw.noncurrent_liab_si),
    nonCurrentDeferredIncome: v(raw.noncurrent_liab_di),

    // 所有者权益
    shareCapital: v(raw.shares),
    otherEquityInstruments: v(raw.othr_equity_instruments),
    capitalReserve: v(raw.capital_reserve),
    treasuryStock: v(raw.treasury_stock),
    otherComprehensiveIncome: v(raw.othr_compre_income),
    specialReserve: v(raw.special_reserve),
    surplusReserve: v(raw.earned_surplus),
    generalRiskProvision: v(raw.general_risk_provision),
    undistributedProfit: v(raw.undstrbtd_profit),
    foreignCurrencyTranslationDiff: v(raw.frgn_currency_convert_diff),
  };
}

function buildBalanceInsights(
  items: ProjectedBalancePeriod[],
  result: BalanceGoalResult,
): string[] {
  if (items.length === 0) return ["该筛选下无公开数据"];

  const out: string[] = [];
  const name = result.quoteName ?? result.symbol;

  // S 口径下全表抑制，此时不做任何业务解读
  if (result.singleQuarter) {
    out.push(
      `🔴 ${name}（${result.symbol}）请求了单季口径（type=${result.type}），` +
        "但资产负债表是**时点存量表**，对存量做差分得到的是「期间变动额」而非余额，" +
        "会产出负的总资产、负的资产负债率等无意义数据",
    );
    out.push(
      `已将全部 ${items.length} 期的业务字段置为 null。` +
        "如需时点余额请改用 type=all / Q1-Q4；如需期间变动额请自行对累计值做差分",
    );
    return out;
  }

  const latest = items[0];
  out.push(
    `${name}（${result.symbol}）共取到 ${items.length} 个报告期，最新为 ${latest.reportName}`,
  );

  out.push(
    `${latest.reportName}：资产总计 ${money(val(latest.totalAssets))}（${trend(yoy(latest.totalAssets))}）、` +
      `负债合计 ${money(val(latest.totalLiabilities))}、` +
      `所有者权益 ${money(val(latest.totalEquity))}`,
  );

  const ratio = val(latest.assetLiabRatio);
  if (ratio !== null) {
    out.push(`资产负债率 ${pct(ratio)}（该字段上游为小数，此处按原值透传）`);
  }

  // 短期偿债能力
  const ca = val(latest.totalCurrentAssets);
  const cl = val(latest.totalCurrentLiabilities);
  if (ca !== null && cl !== null && cl !== 0) {
    const cr = ca / cl;
    out.push(
      `流动比率约 ${cr.toFixed(2)}（流动资产 ${money(ca)} / 流动负债 ${money(cl)}）` +
        (cr < 1 ? " —— 低于 1，短期偿债压力需关注" : ""),
    );
  }

  // 归母 vs 少数股东
  const eqParent = val(latest.equityAttrParent);
  const eqMinority = val(latest.minorityEquity);
  if (eqParent !== null && eqMinority !== null) {
    out.push(
      `其中归属母公司股东权益 ${money(eqParent)}、少数股东权益 ${money(eqMinority)}`,
    );
  }

  // 商誉预警
  const goodwill = val(latest.goodwill);
  const totalAssets = val(latest.totalAssets);
  if (goodwill !== null && goodwill > 0 && totalAssets) {
    const share = (goodwill / totalAssets) * 100;
    if (share >= 5) {
      out.push(`⚠️ 商誉 ${money(goodwill)}，占总资产 ${share.toFixed(1)}%，需关注减值风险`);
    }
  }

  if (result.orgType !== null && result.orgType !== 1) {
    out.push(
      `⚠️ 该标的 org_type=${result.orgType}（非一般工商企业），` +
        "资产负债表科目结构与本字段字典差异较大（如银行有吸收存款/发放贷款），请核对",
    );
  }

  return out;
}

export type BalanceAiReady = FinanceAiReady<ProjectedBalancePeriod, FinanceMeta>;

export function projectBalanceAiReady(
  result: BalanceGoalResult,
  skillId: string,
): BalanceAiReady {
  const suppress = result.singleQuarter;
  const items = (result.periods ?? []).map((p) => projectPeriod(p, suppress));

  const semantics = suppress
    ? `资产负债表 · ⚠️ 单季口径对时点存量表无意义，业务字段已置空（type=${result.type}）`
    : buildSemantics(
        "资产负债表",
        result.type,
        false,
        result.currencyName,
        "stock",
      );

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
      ...(suppress ? { suppressedFields: ["*"] } : {}),
      crawledAt: result.crawledAt,
    },
    units: {
      amount: "元",
      assetLiabRatio: "小数（0.659 表示 65.9%）",
      yoy: "小数比率（0.3446 表示 +34.46%）",
    },
    insights: buildBalanceInsights(items, result),
    items,
  };
}
