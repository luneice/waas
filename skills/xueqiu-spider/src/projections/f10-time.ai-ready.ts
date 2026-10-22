/**
 * 日期索引类 AI-Ready 投影 —— 十大股东 / 基金持股
 */
import { money } from "@src/projections/envelope";
import type {
  TopHoldersGoalResult,
  TopHoldersPeriod,
  FundHoldingGoalResult,
  FundHoldingPeriod,
} from "@src/thrall/f10-time";

function toIso(ms: number | null | undefined): string | null {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms === 0) return null;
  return new Date(ms).toISOString();
}

function num(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

// ============================================================================
// 十大股东
// ============================================================================

export interface ProjectedHolder {
  holderName: string;
  /** 持股数量（股） */
  heldShares: number | null;
  /** 持股占比（**百分数**） */
  heldRatio: number | null;
  /**
   * 持股**数量**的环比变动（百分数）。
   * ⚠️ 不是占比变动率；`0` 表示持股未变，不是「无数据」。
   */
  changePct: number | null;
}

export interface ProjectedQuitHolder {
  holderName: string;
  heldShares: number | null;
  heldRatio: number | null;
  /** 退出前的排名 —— 在榜股东没有这个字段 */
  rankBefore: number | null;
}

export interface ProjectedTopHoldersPeriod {
  periodName: string;
  periodDate: string | null;
  /** 前十大合计持股（股） */
  totalHeldShares: number | null;
  /** 前十大合计持股比例（百分数）—— 即**股权集中度** */
  totalHeldRatio: number | null;
  totalChangePct: number | null;
  holders: ProjectedHolder[];
  /** 本期退出前十的股东 */
  quitHolders: ProjectedQuitHolder[];
}

export interface TopHoldersAiReady {
  meta: {
    skill: string;
    semantics: string;
    symbol: string;
    /** 口径：全体股东 / 流通股东 */
    scope: "all" | "circulating";
    periodCount: number;
    /** 上游可用的总期数（未截断） */
    availablePeriodCount: number;
    crawledAt: string;
  };
  units: Record<string, string>;
  insights: string[];
  items: ProjectedTopHoldersPeriod[];
}

function projectTopHoldersPeriod(p: TopHoldersPeriod): ProjectedTopHoldersPeriod {
  return {
    periodName: p.periodName,
    periodDate: toIso(p.periodValue),
    totalHeldShares: num(p.total?.held_num),
    totalHeldRatio: num(p.total?.held_ratio),
    totalChangePct: num(p.total?.chg),
    holders: (p.items ?? []).map((h) => ({
      holderName: h.holder_name,
      heldShares: num(h.held_num),
      heldRatio: num(h.held_ratio),
      changePct: num(h.chg),
    })),
    quitHolders: (p.quit ?? []).map((q) => ({
      holderName: q.holder_name,
      heldShares: num(q.held_num),
      heldRatio: num(q.held_ratio),
      rankBefore: num(q.holder_rank),
    })),
  };
}

export function projectTopHoldersAiReady(
  result: TopHoldersGoalResult,
  skillId: string,
): TopHoldersAiReady {
  const items = (result.periods ?? []).map(projectTopHoldersPeriod);
  const circulating = result.circula === 1;
  const label = circulating ? "十大流通股东" : "十大股东";
  const insights: string[] = [];

  if (items.length === 0) {
    insights.push("该筛选下无公开数据");
  } else {
    const latest = items[0];
    insights.push(
      `${result.symbol} ${label}：共取到 ${items.length} 期` +
        `（上游可用 ${result.availablePeriods.length} 期）`,
    );
    insights.push(
      `最新期 ${latest.periodName}：合计持股 ${latest.totalHeldRatio?.toFixed(2) ?? "—"}%` +
        `（${((latest.totalHeldShares ?? 0) / 1e8).toFixed(2)} 亿股）—— 即股权集中度`,
    );

    const top3 = latest.holders.slice(0, 3);
    if (top3.length > 0) {
      insights.push(
        "前三大：" +
          top3
            .map((h) => `${h.holderName} ${h.heldRatio?.toFixed(2) ?? "—"}%`)
            .join("、"),
      );
    }

    // 增减持动向
    const moved = latest.holders.filter(
      (h) => h.changePct !== null && h.changePct !== 0,
    );
    if (moved.length > 0) {
      const inc = moved.filter((h) => (h.changePct ?? 0) > 0);
      const dec = moved.filter((h) => (h.changePct ?? 0) < 0);
      insights.push(
        `本期变动：${inc.length} 家增持、${dec.length} 家减持` +
          (dec.length > 0
            ? `（减持最多：${dec[0].holderName} ${dec[0].changePct?.toFixed(2)}%）`
            : ""),
      );
    }

    if (latest.quitHolders.length > 0) {
      insights.push(
        `⚠️ 本期 ${latest.quitHolders.length} 家退出前十：` +
          latest.quitHolders
            .map((q) => `${q.holderName}（原第 ${q.rankBefore} 位）`)
            .join("、"),
      );
    }

    insights.push(
      "ℹ️ changePct 是持股**数量**的环比变动，不是占比变动；" +
        "增发后股东未减持时也可能出现 changePct=0 而占比下降",
    );
  }

  return {
    meta: {
      skill: skillId,
      semantics: `${label}持股明细，按报告期倒序。` +
        `held_ratio 为占${circulating ? "流通股" : "总股本"}比例（百分数）`,
      symbol: result.symbol,
      scope: circulating ? "circulating" : "all",
      periodCount: items.length,
      availablePeriodCount: result.availablePeriods.length,
      crawledAt: result.crawledAt,
    },
    units: {
      heldShares: "股",
      heldRatio: "百分数（22.04 表示 22.04%）",
      changePct: "百分数（持股数量的环比变动）",
    },
    insights,
    items,
  };
}

// ============================================================================
// 基金持股
// ============================================================================

export interface ProjectedFund {
  fundName: string;
  heldShares: number | null;
  /** 占**流通股**比例（百分数）。⚠️ 分母是流通股，不是总股本 */
  toFloatRatio: number | null;
}

export interface ProjectedFundHoldingPeriod {
  periodName: string;
  periodDate: string | null;
  /** 持仓基金数量（**已剔除汇总行**） */
  fundCount: number;
  /** 全部基金合计持股（来自上游汇总行） */
  totalHeldShares: number | null;
  /** 全部基金合计占流通股比例（百分数） */
  totalToFloatRatio: number | null;
  /** 明细（默认只保留前 N 只，见 meta.truncated） */
  funds: ProjectedFund[];
}

export interface FundHoldingAiReady {
  meta: {
    skill: string;
    semantics: string;
    symbol: string;
    periodCount: number;
    availablePeriodCount: number;
    /** 每期明细的截断上限（0 = 不截断） */
    topN: number;
    crawledAt: string;
  };
  units: Record<string, string>;
  insights: string[];
  items: ProjectedFundHoldingPeriod[];
}

function projectFundPeriod(
  p: FundHoldingPeriod,
  topN: number,
): ProjectedFundHoldingPeriod {
  const funds = (p.funds ?? []).map((f) => ({
    fundName: f.org_name_or_fund_name,
    heldShares: num(f.held_num),
    toFloatRatio: num(f.to_float_shares_ratio),
  }));

  return {
    periodName: p.periodName,
    periodDate: toIso(p.periodValue),
    // ⚠️ 用剥离汇总行后的真实条数，不是上游数组长度
    fundCount: funds.length,
    totalHeldShares: num(p.summary?.held_num),
    totalToFloatRatio: num(p.summary?.to_float_shares_ratio),
    funds: topN > 0 ? funds.slice(0, topN) : funds,
  };
}

export function projectFundHoldingAiReady(
  result: FundHoldingGoalResult,
  skillId: string,
  topN: number,
): FundHoldingAiReady {
  const items = (result.periods ?? []).map((p) => projectFundPeriod(p, topN));
  const insights: string[] = [];

  if (items.length === 0) {
    insights.push("该筛选下无公开数据");
  } else {
    const latest = items[0];
    insights.push(
      `${result.symbol} 基金持股：共取到 ${items.length} 期` +
        `（上游可用 ${result.availablePeriods.length} 期）`,
    );
    insights.push(
      `最新期 ${latest.periodName}：${latest.fundCount.toLocaleString()} 只基金持仓，` +
        `合计 ${((latest.totalHeldShares ?? 0) / 1e8).toFixed(2)} 亿股、` +
        `占流通股 ${latest.totalToFloatRatio?.toFixed(2) ?? "—"}%`,
    );

    const top3 = latest.funds.slice(0, 3);
    if (top3.length > 0) {
      insights.push(
        "持仓最多：" +
          top3
            .map((f) => `${f.fundName}（${f.toFloatRatio?.toFixed(4) ?? "—"}%）`)
            .join("、"),
      );
    }

    if (topN > 0 && latest.fundCount > topN) {
      insights.push(
        `⚠️ 每期明细已截断为前 ${topN} 只（该期实际 ${latest.fundCount} 只），` +
          `合计数来自上游汇总行、不受截断影响。需要全量请调大 topN`,
      );
    }

    insights.push(
      "ℹ️ toFloatRatio 的分母是**流通股**，不是总股本，也不是基金净值",
    );
  }

  return {
    meta: {
      skill: skillId,
      semantics:
        "各报告期的基金持股明细，按报告期倒序。合计数来自上游汇总行（已与明细之和核对一致）",
      symbol: result.symbol,
      periodCount: items.length,
      availablePeriodCount: result.availablePeriods.length,
      topN,
      crawledAt: result.crawledAt,
    },
    units: {
      heldShares: "股",
      toFloatRatio: "百分数（占流通股，0.3795 表示 0.3795%）",
    },
    insights,
    items,
  };
}
