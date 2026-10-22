/**
 * 股权类 AI-Ready 投影 —— 股东人数 / 限售解禁 / 高管增减持
 *
 * 三者都是 page/size 类端点，数值为标量（非 A 组的二元组）。
 */
import { money } from "@src/projections/envelope";
import type {
  HoldersNumGoalResult,
  RestrictGoalResult,
  SkHolderChgGoalResult,
} from "@src/thrall/f10-page";
import type {
  RawHoldersNumItem,
  RawRestrictItem,
  RawSkHolderChgItem,
} from "@src/types/f10.types";

function toIso(ms: number | null | undefined): string | null {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

function num(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function pctStr(v: number | null): string {
  return v === null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}

// ============================================================================
// 股东人数
// ============================================================================

export interface ProjectedHoldersNumItem {
  reportDate: string | null;
  /** 股东总户数 */
  holderNum: number | null;
  aShareHolders: number | null;
  hShareHolders: number | null;
  bShareHolders: number | null;
  /** 户数环比变动（**百分数**） */
  holderNumChgPct: number | null;
  /** 户均持流通股（股） */
  sharesPerHolder: number | null;
  sharesPerHolderChgPct: number | null;
  /** 户均持股市值（元）= sharesPerHolder × price */
  amountPerHolder: number | null;
  /** ⚠️ 该报告期股价，**不能替代行情源做估值**（只在披露日有值） */
  price: number | null;
  /** 前十大股东合计持股比例（百分数） */
  topHolderRatio: number | null;
  topFloatHolderRatio: number | null;
}

export interface HoldersNumAiReady {
  meta: {
    skill: string;
    semantics: string;
    symbol: string;
    periodCount: number;
    pagesFetched: number;
    crawledAt: string;
  };
  units: Record<string, string>;
  insights: string[];
  items: ProjectedHoldersNumItem[];
}

function projectHoldersNum(raw: RawHoldersNumItem): ProjectedHoldersNumItem {
  return {
    reportDate: toIso(raw.timestamp),
    holderNum: num(raw.holder_num),
    aShareHolders: num(raw.ashare_holder),
    hShareHolders: num(raw.hshare_holder),
    bShareHolders: num(raw.bshare_holder),
    holderNumChgPct: num(raw.chg),
    sharesPerHolder: num(raw.per_float),
    sharesPerHolderChgPct: num(raw.per_float_chg),
    amountPerHolder: num(raw.per_amount),
    price: num(raw.price),
    topHolderRatio: num(raw.top_holder_ratio),
    topFloatHolderRatio: num(raw.top_float_holder_ratio),
  };
}

export function projectHoldersNumAiReady(
  result: HoldersNumGoalResult,
  skillId: string,
): HoldersNumAiReady {
  const items = (result.items ?? []).map(projectHoldersNum);
  const insights: string[] = [];

  if (items.length === 0) {
    insights.push("该筛选下无公开数据");
  } else {
    const latest = items[0];
    insights.push(
      `${result.symbol} 共取到 ${items.length} 期股东人数数据`,
    );
    insights.push(
      `最新期股东 ${latest.holderNum?.toLocaleString() ?? "—"} 户（${pctStr(latest.holderNumChgPct)}），` +
        `户均持股 ${latest.sharesPerHolder?.toFixed(0) ?? "—"} 股（${pctStr(latest.sharesPerHolderChgPct)}）、` +
        `户均市值 ${money(latest.amountPerHolder)}`,
    );

    // 筹码流向定性 —— 这是本端点的核心分析价值
    const hc = latest.holderNumChgPct;
    const pc = latest.sharesPerHolderChgPct;
    if (hc !== null && pc !== null) {
      if (hc > 0 && pc < 0) {
        insights.push("筹码结构：户数增加 + 户均持股下降 → **筹码分散**（散户增多）");
      } else if (hc < 0 && pc > 0) {
        insights.push("筹码结构：户数减少 + 户均持股上升 → **筹码集中**（通常视为积极信号）");
      }
    }

    if (latest.topHolderRatio !== null) {
      insights.push(
        `前十大股东合计持股 ${latest.topHolderRatio.toFixed(2)}%、` +
          `前十大流通股东 ${latest.topFloatHolderRatio?.toFixed(2) ?? "—"}%`,
      );
    }

    insights.push(
      "ℹ️ price 字段仅为该披露日股价快照（一年数期），**不能替代行情源做估值**",
    );
  }

  return {
    meta: {
      skill: skillId,
      semantics: "各报告期的股东户数与筹码结构，按报告期倒序",
      symbol: result.symbol,
      periodCount: items.length,
      pagesFetched: result.pagesFetched,
      crawledAt: result.crawledAt,
    },
    units: {
      holderNum: "户",
      sharesPerHolder: "股",
      amountPerHolder: "元",
      price: "元",
      "*ChgPct / *Ratio": "百分数（32.04 表示 32.04%）",
    },
    insights,
    items,
  };
}

// ============================================================================
// 限售解禁
// ============================================================================

export interface ProjectedRestrictItem {
  holderName: string;
  /** 可流通日（解禁日） */
  floatableDate: string | null;
  /** 解禁数量（股） */
  floatableShares: number | null;
  /** 解禁股份类型（开放字符串，不做枚举映射） */
  shareType: string;
}

export interface RestrictAiReady {
  meta: {
    skill: string;
    semantics: string;
    symbol: string;
    recordCount: number;
    pagesFetched: number;
    crawledAt: string;
  };
  units: Record<string, string>;
  insights: string[];
  items: ProjectedRestrictItem[];
  /** 按解禁日聚合的汇总 —— 同一日有多条记录，须分组求和 */
  byDate: Array<{ date: string | null; totalShares: number; holderCount: number }>;
}

function projectRestrict(raw: RawRestrictItem): ProjectedRestrictItem {
  return {
    holderName: raw.holder_name,
    floatableDate: toIso(raw.floatable_time),
    // 上游带浮点噪声（3419511.9999999995），取整到股
    floatableShares:
      num(raw.floatable_shares_num) === null
        ? null
        : Math.round(raw.floatable_shares_num as number),
    shareType: raw.float_shares_type,
  };
}

export function projectRestrictAiReady(
  result: RestrictGoalResult,
  skillId: string,
): RestrictAiReady {
  const items = (result.items ?? []).map(projectRestrict);

  // ⚠️ 同一解禁日有多条（按股东拆分），算日解禁总量必须分组求和
  const grouped = new Map<string, { totalShares: number; holderCount: number }>();
  for (const i of items) {
    const key = i.floatableDate ?? "unknown";
    const g = grouped.get(key) ?? { totalShares: 0, holderCount: 0 };
    g.totalShares += i.floatableShares ?? 0;
    g.holderCount += 1;
    grouped.set(key, g);
  }
  const byDate = [...grouped.entries()]
    .map(([date, g]) => ({ date: date === "unknown" ? null : date, ...g }))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  const insights: string[] = [];
  if (items.length === 0) {
    insights.push("该标的无公开的限售解禁记录");
  } else {
    insights.push(
      `${result.symbol} 共取到 ${items.length} 条解禁记录，涉及 ${byDate.length} 个解禁日`,
    );
    const top = byDate[0];
    if (top) {
      insights.push(
        `最近解禁日 ${top.date?.slice(0, 10) ?? "—"}：合计 ${(top.totalShares / 1e4).toFixed(2)} 万股，` +
          `涉及 ${top.holderCount} 个股东`,
      );
    }
    const types = [...new Set(items.map((i) => i.shareType))];
    insights.push(`解禁类型：${types.join("、")}`);
    insights.push(
      "⚠️ 同一解禁日按股东拆成多条，算单日解禁总量请用 byDate（已分组求和），不要取单条",
    );
  }

  return {
    meta: {
      skill: skillId,
      semantics: "限售股解禁明细，按解禁日倒序；byDate 为按日聚合的合计",
      symbol: result.symbol,
      recordCount: items.length,
      pagesFetched: result.pagesFetched,
      crawledAt: result.crawledAt,
    },
    units: { floatableShares: "股" },
    insights,
    items,
    byDate,
  };
}

// ============================================================================
// 高管增减持
// ============================================================================

export interface ProjectedInsiderTrade {
  /** 股份变动人 */
  changerName: string;
  /** 关联高管（变动人为亲属时，此处是高管本人） */
  managerName: string;
  /** 变动人与高管的关系 */
  relation: string;
  /** 职务 */
  duty: string;
  changeDate: string | null;
  /** 变动股数。🔴 负数=减持，正数=增持 */
  changeShares: number | null;
  /** 方向 —— 由 changeShares 符号派生，便于消费方直接过滤 */
  direction: "increase" | "decrease" | "unknown";
  /** 成交均价（元/股） */
  avgPrice: number | null;
  /** 变动后持股余额（股） */
  balanceAfter: number | null;
  /** 估算变动金额（元）= |changeShares| × avgPrice */
  estimatedAmount: number | null;
}

export interface InsiderTradeAiReady {
  meta: {
    skill: string;
    semantics: string;
    symbol: string;
    quoteName: string | null;
    recordCount: number;
    pagesFetched: number;
    crawledAt: string;
  };
  units: Record<string, string>;
  insights: string[];
  items: ProjectedInsiderTrade[];
}

function projectInsiderTrade(raw: RawSkHolderChgItem): ProjectedInsiderTrade {
  const shares = num(raw.chg_shares_num);
  const price = num(raw.trans_avg_price);
  return {
    changerName: raw.share_changer_name,
    managerName: raw.manage_name,
    relation: raw.rr_of_chgr_and_manage,
    duty: raw.duty,
    changeDate: toIso(raw.chg_date),
    changeShares: shares,
    direction: shares === null ? "unknown" : shares < 0 ? "decrease" : "increase",
    avgPrice: price,
    balanceAfter: num(raw.daily_shares_balance_otd),
    estimatedAmount:
      shares !== null && price !== null ? Math.abs(shares) * price : null,
  };
}

export function projectInsiderTradeAiReady(
  result: SkHolderChgGoalResult,
  skillId: string,
): InsiderTradeAiReady {
  const items = (result.items ?? []).map(projectInsiderTrade);
  const insights: string[] = [];

  if (items.length === 0) {
    insights.push("该标的无公开的高管增减持记录");
  } else {
    const decreases = items.filter((i) => i.direction === "decrease");
    const increases = items.filter((i) => i.direction === "increase");
    const decAmount = decreases.reduce((s, i) => s + (i.estimatedAmount ?? 0), 0);
    const incAmount = increases.reduce((s, i) => s + (i.estimatedAmount ?? 0), 0);

    insights.push(
      `${result.symbol} 共取到 ${items.length} 条高管增减持记录：` +
        `减持 ${decreases.length} 笔、增持 ${increases.length} 笔`,
    );

    if (decreases.length > 0) {
      insights.push(`减持估算金额合计 ${money(decAmount)}（按成交均价估算）`);
    }
    if (increases.length > 0) {
      insights.push(`增持估算金额合计 ${money(incAmount)}`);
    }

    const people = [...new Set(items.map((i) => i.changerName))];
    insights.push(`涉及 ${people.length} 人：${people.slice(0, 5).join("、")}`);

    insights.push(
      "⚠️ 减持可能出于个人资金需求、股权激励行权、大宗减持计划等多种原因，" +
        "本数据为事实记录，不构成投资判断",
    );
  }

  return {
    meta: {
      skill: skillId,
      semantics:
        "高管及关联人的持股变动明细，按变动日倒序。changeShares 负数为减持、正数为增持",
      symbol: result.symbol,
      quoteName: (result.items?.[0]?.name as string) ?? null,
      recordCount: items.length,
      pagesFetched: result.pagesFetched,
      crawledAt: result.crawledAt,
    },
    units: {
      changeShares: "股（负数=减持）",
      avgPrice: "元/股",
      balanceAfter: "股",
      estimatedAmount: "元（估算值 = |变动股数| × 成交均价）",
    },
    insights,
    items,
  };
}
