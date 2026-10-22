/**
 * 利润表 AI-Ready 投影
 *
 * 显式枚举全部字段（CLAUDE.md §3.5：禁止 `{...raw}` spread —— 会让上游
 * 新增字段静默泄露给消费者，破坏契约稳定性）。
 */
import { toValuePair } from "@src/thrall/shared";
import {
  money,
  trend,
  val,
  yoy,
  buildSemantics,
} from "@src/projections/envelope";
import type {
  FinanceAiReady,
  FinanceMeta,
  ValuePair,
} from "@src/types/common.types";
import type {
  RawIncomePeriod,
  ProjectedIncomePeriod,
} from "@src/types/income.types";
import type { IncomeGoalResult } from "@src/thrall/income";

/** 毫秒时间戳 → ISO 字符串（null 安全） */
function toIso(ms: number | null | undefined): string | null {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

/** 投影单个报告期 —— 逐字段显式映射 */
function projectPeriod(raw: RawIncomePeriod): ProjectedIncomePeriod {
  const v = toValuePair;
  return {
    reportDate: toIso(raw.report_date) ?? "",
    reportName: raw.report_name,
    dataUpdatedAt: toIso(raw.ctime),

    totalRevenue: v(raw.total_revenue),
    revenue: v(raw.revenue),
    totalOperatingCosts: v(raw.operating_costs),
    operatingCost: v(raw.operating_cost),
    taxesAndSurcharge: v(raw.operating_taxes_and_surcharge),
    sellingExpenses: v(raw.sales_fee),
    adminExpenses: v(raw.manage_fee),
    rdExpenses: v(raw.rad_cost),
    financeExpenses: v(raw.financing_expenses),
    interestExpense: v(raw.finance_cost_interest_fee),
    interestIncome: v(raw.finance_cost_interest_income),

    otherIncome: v(raw.other_income),
    investIncome: v(raw.invest_income),
    investIncomeFromAssociates: v(raw.invest_incomes_from_rr),
    fairValueChangeIncome: v(raw.income_from_chg_in_fv),
    creditImpairmentLoss: v(raw.credit_impairment_loss),
    assetImpairmentLoss: v(raw.asset_impairment_loss),
    assetDisposalIncome: v(raw.asset_disposal_income),
    exchangeGain: v(raw.exchg_gain),
    operatingProfit: v(raw.op),

    nonOperatingIncome: v(raw.non_operating_income),
    nonOperatingExpense: v(raw.non_operating_payout),
    nonCurrentAssetDisposalGain: v(raw.noncurrent_assets_dispose_gain),
    nonCurrentAssetDisposalLoss: v(raw.noncurrent_asset_disposal_loss),
    totalProfit: v(raw.profit_total_amt),
    incomeTaxExpense: v(raw.income_tax_expenses),
    netProfit: v(raw.net_profit),
    continuingOperationsNetProfit: v(raw.continous_operating_np),
    discontinuedOperationsNetProfit: v(raw.net_profit_bi),
    netProfitAttrParent: v(raw.net_profit_atsopc),
    minorityInterestIncome: v(raw.minority_gal),
    netProfitDeductNonRecurring: v(raw.net_profit_after_nrgal_atsolc),

    basicEps: v(raw.basic_eps),
    dilutedEps: v(raw.dlt_earnings_per_share),

    otherComprehensiveIncome: v(raw.othr_compre_income),
    otherComprehensiveIncomeAttrParent: v(raw.othr_compre_income_atoopc),
    otherComprehensiveIncomeAttrMinority: v(raw.othr_compre_income_atms),
    totalComprehensiveIncome: v(raw.total_compre_income),
    totalComprehensiveIncomeAttrParent: v(raw.total_compre_income_atsopc),
    totalComprehensiveIncomeAttrMinority: v(raw.total_compre_income_atms),
  };
}

/**
 * 构建中文要点。
 *
 * 内容由"Agent 拿到后最可能立刻算的东西"决定：规模与增速、盈利结构、
 * 归母与合并的差异、盈利质量线索 —— 而非复述字段。
 */
function buildIncomeInsights(
  items: ProjectedIncomePeriod[],
  result: IncomeGoalResult,
): string[] {
  if (items.length === 0) {
    return ["该筛选下无公开数据"];
  }

  const out: string[] = [];
  const latest = items[0];
  const name = result.quoteName ?? result.symbol;

  out.push(
    `${name}（${result.symbol}）共取到 ${items.length} 个报告期，` +
      `最新为 ${latest.reportName}${result.lastReportName && result.lastReportName !== latest.reportName ? `（上游最新期为 ${result.lastReportName}）` : ""}`,
  );

  out.push(
    `${latest.reportName}：营业总收入 ${money(val(latest.totalRevenue))}（${trend(yoy(latest.totalRevenue))}）、` +
      `归母净利润 ${money(val(latest.netProfitAttrParent))}（${trend(yoy(latest.netProfitAttrParent))}）`,
  );

  // 归母 vs 合并 —— 少数股东损益为负时归母会高于合并，回写极易张冠李戴
  const np = val(latest.netProfit);
  const npParent = val(latest.netProfitAttrParent);
  const minority = val(latest.minorityInterestIncome);
  if (np !== null && npParent !== null && minority !== null && minority < 0) {
    out.push(
      `⚠️ 少数股东损益为 ${money(minority)}（亏损），故归母净利润 ${money(npParent)} ` +
        `**高于**合并净利润 ${money(np)} —— 两者不可混用`,
    );
  }

  // 毛利率（仅在两项都有值时给）
  const rev = val(latest.totalRevenue);
  const cost = val(latest.operatingCost);
  if (rev !== null && cost !== null && rev !== 0) {
    out.push(`${latest.reportName} 毛利率约 ${(((rev - cost) / rev) * 100).toFixed(2)}%（营业总收入口径）`);
  }

  // 扣非与归母的差距 —— 非经常性损益占比
  const deduct = val(latest.netProfitDeductNonRecurring);
  if (npParent !== null && deduct !== null && npParent !== 0) {
    const ratio = (deduct / npParent) * 100;
    out.push(
      `扣非归母净利润 ${money(deduct)}，占归母净利润 ${ratio.toFixed(1)}%` +
        (ratio < 60 ? "（非经常性损益占比较高，需关注利润构成）" : ""),
    );
  }

  if (result.singleQuarter) {
    out.push(
      "⚠️ 本次为单季口径（上游按相邻期差分得出），各期为当季发生额而非年初至今累计",
    );
  }

  if (result.orgType !== null && result.orgType !== 1) {
    out.push(
      `⚠️ 该标的 org_type=${result.orgType}（非一般工商企业），科目结构可能与本字段字典不同，请核对`,
    );
  }

  return out;
}

export type IncomeAiReady = FinanceAiReady<ProjectedIncomePeriod, FinanceMeta>;

/** 利润表 AI-Ready 信封 */
export function projectIncomeAiReady(
  result: IncomeGoalResult,
  skillId: string,
): IncomeAiReady {
  const items = (result.periods ?? []).map(projectPeriod);

  return {
    meta: {
      skill: skillId,
      semantics: buildSemantics(
        "利润表",
        result.type,
        result.singleQuarter,
        result.currencyName,
      ),
      symbol: result.symbol,
      quoteName: result.quoteName,
      reportType: result.type,
      currency: result.currency,
      orgType: result.orgType,
      lastReportName: result.lastReportName,
      periodCount: items.length,
      pagesFetched: result.pagesFetched,
      crawledAt: result.crawledAt,
    },
    units: {
      amount: "元",
      eps: "元/股",
      yoy: "小数比率（0.3446 表示 +34.46%）",
    },
    insights: buildIncomeInsights(items, result),
    items,
  };
}
