/**
 * 分红 / 增发 AI-Ready 投影
 *
 * 🔴 本文件的独有职责：把 `plan_explain` 中文串解析成结构化金额，
 * 同时**永远保留原文**并显式标注解析失败（见 projections/bonus-plan.ts）。
 */
import { money } from "@src/projections/envelope";
import {
  parseBonusPlan,
  sumImplementedDividend,
  type ParsedBonusPlan,
} from "@src/projections/bonus-plan";
import type { BonusGoalResult } from "@src/thrall/f10-page";
import type { RawBonusItem, RawAdditionItem } from "@src/types/f10.types";

function toIso(ms: number | null | undefined): string | null {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

function num(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** 投影后的分红记录 */
export interface ProjectedBonusItem {
  /** 分红所属期。⚠️ 两种格式并存：`2025年报` 或 `2024-12-11`（特别分红） */
  dividendPeriod: string;
  /** 是否为特别分红（`dividend_year` 为日期格式） */
  isSpecialDividend: boolean;
  /** 每股派息（元/股，税前）。null = 解析失败或该方案不含派息 */
  dividendPerShare: number | null;
  /** 每股转增股数 */
  transferPerShare: number | null;
  /** 每股送股数 */
  bonusSharesPerShare: number | null;
  /** 实施状态。非 implemented 不应计入已分红 */
  status: ParsedBonusPlan["status"];
  /** 是否成功解析出结构化信息。false 时须回退到 planExplain 原文 */
  parsed: boolean;
  /** 🔴 方案原文 —— 永远保留，供核对与发现未覆盖形态 */
  planExplain: string;
  /** 是否已被取消（cancle_dividend_date 非空） */
  cancelled: boolean;
  equityDate: string | null;
  exDividendDate: string | null;
  dividendDate: string | null;
}

/** 投影后的增发记录 */
export interface ProjectedAdditionItem {
  /** 实际发行数量（股） */
  issueVolume: number | null;
  /** 实际发行价（元/股） */
  issuePrice: number | null;
  /** 实际募集资金净额（元，已扣发行费用） */
  netRaisedAmount: number | null;
  /** 增发股份上市日 */
  listingDate: string | null;
}

export interface BonusAiReady {
  meta: {
    skill: string;
    semantics: string;
    symbol: string;
    dividendCount: number;
    additionCount: number;
    allotCount: number;
    pagesFetched: number;
    /** 解析失败的分红记录数 —— 非零时汇总不完整 */
    unparsedCount: number;
    crawledAt: string;
  };
  units: Record<string, string>;
  insights: string[];
  items: ProjectedBonusItem[];
  /** 增发记录（非分页数据，只取首页） */
  additions: ProjectedAdditionItem[];
  /** 配股记录。本样本为空，字段结构未验证，原样透传 */
  allotments: unknown[];
}

/** `dividend_year` 是日期格式（如 2024-12-11）→ 特别分红 */
function isDateFormat(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function projectBonusItem(raw: RawBonusItem): ProjectedBonusItem {
  const plan = parseBonusPlan(raw.plan_explain);
  const period = raw.dividend_year ?? "";
  return {
    dividendPeriod: period,
    isSpecialDividend: isDateFormat(period),
    dividendPerShare: plan.dividendPerShare,
    transferPerShare: plan.transferPerShare,
    bonusSharesPerShare: plan.bonusSharesPerShare,
    status: plan.status,
    parsed: plan.parsed,
    planExplain: plan.raw,
    cancelled: num(raw.cancle_dividend_date) !== null,
    equityDate: toIso(raw.equity_date),
    exDividendDate: toIso(raw.ex_dividend_date),
    dividendDate: toIso(raw.dividend_date),
  };
}

function projectAddition(raw: RawAdditionItem): ProjectedAdditionItem {
  return {
    issueVolume: num(raw.actual_issue_vol),
    issuePrice: num(raw.actual_issue_price),
    netRaisedAmount: num(raw.actual_rc_net_amt),
    listingDate: toIso(raw.listing_ad),
  };
}

function buildInsights(
  items: ProjectedBonusItem[],
  additions: ProjectedAdditionItem[],
  result: BonusGoalResult,
): string[] {
  if (items.length === 0 && additions.length === 0) {
    return ["该标的无公开的分红或增发记录"];
  }

  const out: string[] = [];
  const plans = items.map((i) => ({
    dividendPerShare: i.dividendPerShare,
    status: i.status,
    parsed: i.parsed,
  })) as ParsedBonusPlan[];
  const sum = sumImplementedDividend(plans);

  out.push(
    `${result.symbol} 共取到 ${items.length} 条分红记录、${additions.length} 条增发记录`,
  );

  if (sum.counted > 0) {
    out.push(
      `已实施分红累计每股 ${sum.total.toFixed(4)} 元（税前，含 ${sum.counted} 次派息）` +
        (sum.skipped > 0
          ? ` —— ⚠️ 另有 ${sum.skipped} 条因未实施或解析失败未计入，该合计不完整`
          : ""),
    );
  }

  const latest = items[0];
  if (latest) {
    out.push(
      `最近一次：${latest.dividendPeriod} ${latest.planExplain}` +
        (latest.isSpecialDividend ? "（特别分红，不与定期报告绑定）" : ""),
    );
  }

  const unparsed = items.filter((i) => !i.parsed);
  if (unparsed.length > 0) {
    out.push(
      `⚠️ ${unparsed.length} 条方案未能解析出金额（形态未覆盖），` +
        `已保留原文于 planExplain，**不要当作「未分红」**：` +
        unparsed.slice(0, 3).map((i) => `「${i.planExplain}」`).join("、"),
    );
  }

  const cancelled = items.filter((i) => i.cancelled);
  if (cancelled.length > 0) {
    out.push(`⚠️ 其中 ${cancelled.length} 条分红已被取消，计算总额时须排除`);
  }

  if (additions.length > 0) {
    const total = additions.reduce((s, a) => s + (a.netRaisedAmount ?? 0), 0);
    out.push(
      `增发累计募资净额 ${money(total)}（${additions.length} 次），` +
        `最近一次发行价 ${additions[0].issuePrice ?? "—"} 元/股`,
    );
  }

  out.push(
    "ℹ️ 算股息率还需股价（本接口族不提供），需另接行情数据源",
  );

  return out;
}

export function projectBonusAiReady(
  result: BonusGoalResult,
  skillId: string,
): BonusAiReady {
  const items = (result.items ?? []).map(projectBonusItem);
  const additions = (result.extra?.addtions ?? []).map(projectAddition);
  const allotments = result.extra?.allots ?? [];
  const unparsedCount = items.filter((i) => !i.parsed).length;

  return {
    meta: {
      skill: skillId,
      semantics:
        "分红/增发/配股记录 · 分红金额由 plan_explain 中文串解析而来，" +
        "已保留原文；仅「实施方案」状态的记录代表已实施",
      symbol: result.symbol,
      dividendCount: items.length,
      additionCount: additions.length,
      allotCount: allotments.length,
      pagesFetched: result.pagesFetched,
      unparsedCount,
      crawledAt: result.crawledAt,
    },
    units: {
      dividendPerShare: "元/股（税前）",
      transferPerShare: "股/股",
      issuePrice: "元/股",
      netRaisedAmount: "元",
    },
    insights: buildInsights(items, additions, result),
    items,
    additions,
    allotments,
  };
}
