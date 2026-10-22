/**
 * 主要财务指标 AI-Ready 投影
 *
 * 本文件的三项独有职责（都是为了防止静默产出错误结论）：
 *
 * 1. **逐字段单位声明** —— 本表单位不统一（见 units.ts），不做归一化，
 *    经 `meta.fieldUnits` 透出，把换算交给消费方。
 * 2. **字段正名** —— `np_per_share` → `netAssetsPerShare`（每股净资产，
 *    不是每股净利润）、`holder_equity` → `equityRatio`（权益比率，不是金额）、
 *    `capital_reserve` → `capitalReservePerShare`（每股，不是总额）。
 * 3. **丢弃 `*_yoy` 字段的 `[1]`** —— 那是「增速的同比」（二阶量），
 *    `operating_income_yoy: [34.4629, 2.2347]` 极易被误读成「营收增长 223%」。
 */
import { toValuePair } from "@src/thrall/shared";
import { val, buildSemantics } from "@src/projections/envelope";
import { buildIndicatorUnits, fieldUnitMap } from "@src/projections/units";
import type {
  FinanceAiReady,
  FinanceMeta,
  ValuePair,
} from "@src/types/common.types";
import type {
  RawIndicatorPeriod,
  ProjectedIndicatorPeriod,
} from "@src/types/indicator.types";
import type { IndicatorGoalResult } from "@src/thrall/indicator";

function toIso(ms: number | null | undefined): string | null {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

/**
 * 取 `*_yoy` 字段的值，**丢弃其 `[1]`**。
 *
 * 上游 `operating_income_yoy = [34.4629, 2.2347]`：
 *   - `[0]` = 营收同比 +34.46%（百分数）
 *   - `[1]` = **该增速相对去年同期增速的变化**（二阶量）
 *
 * 保留 `[1]` 会让 Agent 误读成「营收增长 223%」，故置 null。
 */
function yoyValueOnly(raw: RawIndicatorPeriod[keyof RawIndicatorPeriod]): ValuePair {
  const pair = toValuePair(raw as never);
  return { value: pair.value, yoy: null };
}

/** 投影单个报告期 —— 逐字段显式映射并正名 */
function projectPeriod(raw: RawIndicatorPeriod): ProjectedIndicatorPeriod {
  const v = toValuePair;
  return {
    reportDate: toIso(raw.report_date) ?? "",
    reportName: raw.report_name,
    dataUpdatedAt: toIso(raw.ctime),

    // 盈利能力
    avgRoe: v(raw.avg_roe),
    dilutedRoe: v(raw.ore_dlt),
    returnOnTotalAssets: v(raw.net_interest_of_total_assets),
    grossMargin: v(raw.gross_selling_rate),
    netMargin: v(raw.net_selling_rate),

    // 每股指标（正名：np_per_share 实为每股净资产）
    basicEps: v(raw.basic_eps),
    netAssetsPerShare: v(raw.np_per_share),
    undistributedProfitPerShare: v(raw.undistri_profit_ps),
    operatingCashFlowPerShare: v(raw.operate_cash_flow_ps),
    capitalReservePerShare: v(raw.capital_reserve),

    // 偿债能力与资本结构（正名：holder_equity 实为权益比率）
    assetLiabRatio: v(raw.asset_liab_ratio),
    equityRatio: v(raw.holder_equity),
    currentRatio: v(raw.current_ratio),
    quickRatio: v(raw.quick_ratio),
    debtToEquityRatio: v(raw.equity_ratio),
    equityMultiplier: v(raw.equity_multiplier),
    operatingCashFlowToLiabilities: v(raw.ncf_from_oa_to_total_liab),

    // 营运效率
    inventoryTurnover: v(raw.inventory_turnover),
    inventoryTurnoverDays: v(raw.inventory_turnover_days),
    receivableTurnover: v(raw.account_receivable_turnover),
    receivableTurnoverDays: v(raw.receivable_turnover_days),
    payableTurnover: v(raw.accounts_payable_turnover),
    payableTurnoverDays: v(raw.accounts_payable_turnover_days),
    totalAssetTurnover: v(raw.total_capital_turnover),
    currentAssetTurnover: v(raw.current_asset_turnover_rate),
    fixedAssetTurnover: v(raw.fixed_asset_turnover_ratio),
    operatingCycle: v(raw.operating_cycle),
    cashCycle: v(raw.cash_cycle),

    // 成长能力 —— 丢弃二阶量
    revenueYoy: yoyValueOnly(raw.operating_income_yoy),
    netProfitAttrParentYoy: yoyValueOnly(raw.net_profit_atsopc_yoy),
    netProfitDeductNonRecurringYoy: yoyValueOnly(raw.np_atsopc_nrgal_yoy),

    // 原始金额
    totalRevenue: v(raw.total_revenue),
    netProfitAttrParent: v(raw.net_profit_atsopc),
    netProfitDeductNonRecurring: v(raw.net_profit_after_nrgal_atsolc),

    // 语义未确认
    rop: v(raw.rop),
  };
}

/**
 * 格式化百分数字段（上游已是百分数，直接加 %）。
 *
 * ⚠️ 保留上游精度而非固定 2 位：ROE 双口径实测为 1.83（平均）vs 1.8263（摊薄），
 * 固定两位会把差异抹平成同一个值，让「双口径」的提示失去意义。
 */
function fmtPct(v: number | null): string {
  if (v === null) return "—";
  // 去掉浮点噪声尾数，但不强制截断到 2 位
  const s = Number(v.toFixed(4)).toString();
  return `${s}%`;
}

function fmtNum(v: number | null, digits = 2): string {
  return v === null ? "—" : v.toFixed(digits);
}

function buildIndicatorInsights(
  items: ProjectedIndicatorPeriod[],
  result: IndicatorGoalResult,
): string[] {
  if (items.length === 0) return ["该筛选下无公开数据"];

  const out: string[] = [];
  const latest = items[0];
  const name = result.quoteName ?? result.symbol;

  out.push(
    `${name}（${result.symbol}）共取到 ${items.length} 个报告期，最新为 ${latest.reportName}`,
  );

  out.push(
    `${latest.reportName} 盈利能力：毛利率 ${fmtPct(val(latest.grossMargin))}、` +
      `净利率 ${fmtPct(val(latest.netMargin))}、` +
      `ROE ${fmtPct(val(latest.avgRoe))}（平均口径）/ ${fmtPct(val(latest.dilutedRoe))}（摊薄口径）`,
  );

  out.push(
    `偿债与结构：资产负债率 ${fmtPct(val(latest.assetLiabRatio))}、` +
      `流动比率 ${fmtNum(val(latest.currentRatio))} 倍、` +
      `权益乘数 ${fmtNum(val(latest.equityMultiplier))} 倍`,
  );

  const cc = val(latest.cashCycle);
  if (cc !== null) {
    out.push(
      `营运效率：营业周期 ${fmtNum(val(latest.operatingCycle), 1)} 天、` +
        `现金循环周期 ${fmtNum(cc, 1)} 天` +
        (cc < 0 ? "（为负表示占用上游资金，是强势产业链地位的体现，非数据错误）" : ""),
    );
  }

  out.push(
    `成长性：营收同比 ${fmtPct(val(latest.revenueYoy))}、` +
      `归母净利同比 ${fmtPct(val(latest.netProfitAttrParentYoy))}、` +
      `扣非归母净利同比 ${fmtPct(val(latest.netProfitDeductNonRecurringYoy))}`,
  );

  // 单位口径警告 —— 这是本表最容易出错的地方
  out.push(
    "⚠️ 本表单位不统一：比率类多为**百分数**（如资产负债率 65.92 即 65.92%），" +
      "但 operatingCashFlowToLiabilities 是**小数**。逐字段单位见 meta.fieldUnits，" +
      "数值均为上游原值，未做归一化",
  );

  out.push(
    "⚠️ 与 xueqiu-balance 跨表比对前须对齐口径：assetLiabRatio 在本表是百分数（65.92）、" +
      "在资产负债表是小数（0.6592）；capitalReservePerShare 是**每股**值，" +
      "资产负债表的 capitalReserve 是**总额**",
  );

  if (val(latest.rop) !== null) {
    out.push(
      `ℹ️ 字段 rop=${fmtNum(val(latest.rop))} 语义未确认（已排除营业成本率等 5 种口径），原样透传，请勿据此下结论`,
    );
  }

  if (result.orgType !== null && result.orgType !== 1) {
    out.push(
      `⚠️ 该标的 org_type=${result.orgType}（非一般工商企业），部分指标口径可能不适用`,
    );
  }

  return out;
}

/** 本表的 meta 额外带逐字段单位映射 */
export interface IndicatorMeta extends FinanceMeta {
  /** 字段名 → 单位类型。Agent 换算前必须查此表 */
  fieldUnits: Record<string, string>;
}

export type IndicatorAiReady = FinanceAiReady<
  ProjectedIndicatorPeriod,
  IndicatorMeta
>;

export function projectIndicatorAiReady(
  result: IndicatorGoalResult,
  skillId: string,
): IndicatorAiReady {
  const items = (result.periods ?? []).map(projectPeriod);

  return {
    meta: {
      skill: skillId,
      semantics:
        buildSemantics(
          "主要财务指标",
          result.type,
          result.singleQuarter,
          null,
          "derived",
        ) + " —— ⚠️ 单位不统一，逐字段见 fieldUnits，数值为上游原值未归一化",
      symbol: result.symbol,
      quoteName: result.quoteName,
      reportType: result.type,
      currency: result.currency,
      orgType: result.orgType,
      lastReportName: result.lastReportName,
      periodCount: items.length,
      pagesFetched: result.pagesFetched,
      fieldUnits: fieldUnitMap(),
      crawledAt: result.crawledAt,
    },
    units: buildIndicatorUnits(),
    insights: buildIndicatorInsights(items, result),
    items,
  };
}
