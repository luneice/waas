/**
 * B 组日期索引类端点的 Goal —— 十大股东 / 基金持股
 *
 * ## 与 page/size 类的根本差异
 *
 * 这两个端点**不是翻页**，而是「先取可用期次清单、再按期展开」：
 *
 * ```
 * ① 首次请求（不带日期参数） → data.times[] 列出全部可用报告期
 * ② 按 times[].value 逐个请求 → 每期一份完整快照
 * ```
 *
 * 所以用 `@Expanded`（source 为 times[]）而非 `@Paginated` ——
 * 这是「入参驱动、要几期发几次」的形态（CLAUDE.md §2.5）。
 *
 * ⚠️ 两端点的日期参数名**不同**：`top_holders` 用 `locate`+`start`，
 * `org_holding` 用 `timestamp`。语义相同但不可互换。
 */
import {
  Goal,
  Endpoint,
  Expanded,
  Aggregate,
  BaseGoal,
  GoalContext,
} from "@spider/core";
import { STOCK_API_BASE, F10_ENDPOINTS } from "@src/constants";
import { SHARED_GOAL_DEFAULTS, unwrapFinanceEnvelope } from "@src/thrall/shared";
import { extractItems, type RawTimeIndex } from "@src/thrall/f10-shared";
import type { RawFinanceEnvelope, RawPeriodBase } from "@src/types/common.types";
import type {
  RawHolderItem,
  RawQuitHolderItem,
  RawHolderTotal,
  RawFundHoldingItem,
} from "@src/types/f10.types";

/** 日期索引类端点的入参 */
export interface F10TimeGoalParams {
  symbol: string;
  /** 最多取多少期（从最新期倒序） */
  maxPeriods: number;
  [key: string]: unknown;
}

/** 从响应中安全提取 times[] */
function extractTimes(response: unknown, scope: string): RawTimeIndex[] {
  unwrapFinanceEnvelope(response as RawFinanceEnvelope<RawPeriodBase>, scope);
  const data = (response as { data?: Record<string, unknown> })?.data;
  const times = data?.times;
  if (!Array.isArray(times)) return [];
  return times.filter(
    (t): t is RawTimeIndex =>
      !!t && typeof (t as RawTimeIndex).value === "number",
  );
}

// ============================================================================
// 十大股东 / 十大流通股东
// ============================================================================

export const TOP_HOLDERS_SCOPE = "xueqiu-top-holders";

/** 单期十大股东快照 */
export interface TopHoldersPeriod {
  /** 期次显示名（`2026中报` 或 `2026-08-05`） */
  periodName: string;
  /** 期次时间戳（毫秒） */
  periodValue: number;
  items: RawHolderItem[];
  quit: RawQuitHolderItem[];
  total: RawHolderTotal | null;
}

export interface TopHoldersGoalResult {
  symbol: string;
  /** 口径：0=全体股东、1=流通股东 */
  circula: number;
  /** 全部可用期次（未截断），供消费方知晓还有多少历史 */
  availablePeriods: RawTimeIndex[];
  periods: TopHoldersPeriod[];
  crawledAt: string;
}

export function createTopHoldersGoal(
  params: F10TimeGoalParams & { circula: number },
): BaseGoal<TopHoldersGoalResult> {
  const { circula, maxPeriods } = params;

  /** 首次请求拿到的全部期次 —— 由端点方法体填充 */
  let allTimes: RawTimeIndex[] = [];

  @Goal({
    id: TOP_HOLDERS_SCOPE,
    name: "雪球十大股东",
    baseURL: STOCK_API_BASE,
    defaults: SHARED_GOAL_DEFAULTS,
  })
  class TopHoldersGoal extends BaseGoal<TopHoldersGoalResult> {
    /**
     * ① 首次请求 —— 不带 locate，返回最新期数据 + 全部可用期次。
     *
     * ⚠️ `count` 参数**不控制返回条数**（实测传 200 仍只返回 10 条），
     * 此处传它只为与页面行为一致。
     */
    @Endpoint(F10_ENDPOINTS.topHolders, {
      method: "GET",
      // ⚠️ circula 必须取自**闭包**，不能读 ctx.params ——
      //    ctx.params 是 Skill 归一化后的入参（含 circulating 布尔），
      //    而 circula 是 createGoal 时换算出来的，不在 ctx.params 里。
      //    曾因读 ctx.params.circula 得到 undefined，上游按默认值返回了
      //    流通股口径，而 meta 仍标称「全体股东」—— 静默的口径错配。
      query: (ctx) => {
        const p = ctx.params as F10TimeGoalParams;
        return { symbol: p.symbol, circula, count: 200 };
      },
    })
    fetchLatest(response: RawFinanceEnvelope<RawPeriodBase>): TopHoldersPeriod {
      const times = extractTimes(response, TOP_HOLDERS_SCOPE);
      allTimes = times;
      return toPeriod(response, times[0]);
    }

    /**
     * ② 按期展开 —— source 取自首次请求的 times[]（跳过首期，它已由 ① 取到）。
     *
     * ⚠️ `dependencies` 必须声明，否则 source 里 `ctx.get("fetchLatest")` 会抛错。
     */
    @Expanded<RawTimeIndex, TopHoldersPeriod>({
      dependencies: ["fetchLatest"],
      source: (ctx) => {
        void ctx.get("fetchLatest"); // 确保 ① 已执行
        return allTimes.slice(1, Math.max(1, maxPeriods));
      },
      params: (item, _i, ctx) => {
        const p = ctx.params as F10TimeGoalParams;
        // ⚠️ circula 同样取自闭包，理由见 fetchLatest
        // ⚠️ locate 与 start 抓包中恒同值
        return {
          symbol: p.symbol,
          circula,
          locate: item.value,
          start: item.value,
        };
      },
    })
    @Endpoint(F10_ENDPOINTS.topHolders, { method: "GET" })
    fetchHistory(
      response: RawFinanceEnvelope<RawPeriodBase>,
      item: RawTimeIndex,
    ): TopHoldersPeriod {
      return toPeriod(response, item);
    }

    @Aggregate()
    aggregate(ctx: GoalContext): TopHoldersGoalResult {
      const p = ctx.params as F10TimeGoalParams;
      const latest = ctx.get<TopHoldersPeriod>("fetchLatest");
      const history = ctx.has("fetchHistory")
        ? ctx.get<TopHoldersPeriod[]>("fetchHistory") ?? []
        : [];

      return {
        symbol: p.symbol,
        circula,
        availablePeriods: allTimes,
        periods: [latest, ...history].filter(Boolean),
        crawledAt: new Date().toISOString(),
      };
    }
  }

  /** 把一次响应转成单期快照 */
  function toPeriod(
    response: RawFinanceEnvelope<RawPeriodBase>,
    time: RawTimeIndex | undefined,
  ): TopHoldersPeriod {
    const items = extractItems<RawHolderItem>(
      response,
      "items",
      TOP_HOLDERS_SCOPE,
    );
    const data = (response as { data?: Record<string, unknown> })?.data;
    const quit = Array.isArray(data?.quit)
      ? (data.quit as RawQuitHolderItem[])
      : [];
    const total = (data?.total as RawHolderTotal) ?? null;

    return {
      periodName: time?.name ?? "",
      periodValue: time?.value ?? 0,
      items,
      quit,
      total,
    };
  }

  return new TopHoldersGoal();
}

// ============================================================================
// 基金持股
// ============================================================================

export const FUND_HOLDING_SCOPE = "xueqiu-fund-holding";

/** 单期基金持股快照 */
export interface FundHoldingPeriod {
  periodName: string;
  periodValue: number;
  /**
   * 基金明细（**已剥离汇总行**）。
   * 🔴 上游 `fund_items[0]` 是「全部合计」，不是一只基金。
   */
  funds: RawFundHoldingItem[];
  /** 汇总行（从 fund_items[0] 剥离出来） */
  summary: RawFundHoldingItem | null;
}

export interface FundHoldingGoalResult {
  symbol: string;
  availablePeriods: RawTimeIndex[];
  periods: FundHoldingPeriod[];
  crawledAt: string;
}

/** 汇总行的名称标识 —— 按名称匹配比按位置判断更稳妥 */
const SUMMARY_NAME_RE = /^(全部)?合计$|总计|小计/;

export function createFundHoldingGoal(
  params: F10TimeGoalParams,
): BaseGoal<FundHoldingGoalResult> {
  const { maxPeriods } = params;
  let allTimes: RawTimeIndex[] = [];

  @Goal({
    id: FUND_HOLDING_SCOPE,
    name: "雪球基金持股",
    baseURL: STOCK_API_BASE,
    defaults: SHARED_GOAL_DEFAULTS,
  })
  class FundHoldingGoal extends BaseGoal<FundHoldingGoalResult> {
    @Endpoint(F10_ENDPOINTS.orgHolding, {
      method: "GET",
      query: (ctx) => {
        const p = ctx.params as F10TimeGoalParams;
        return { symbol: p.symbol, extend: true };
      },
    })
    fetchLatest(response: RawFinanceEnvelope<RawPeriodBase>): FundHoldingPeriod {
      const times = extractTimes(response, FUND_HOLDING_SCOPE);
      allTimes = times;
      return toFundPeriod(response, times[0]);
    }

    @Expanded<RawTimeIndex, FundHoldingPeriod>({
      dependencies: ["fetchLatest"],
      source: (ctx) => {
        void ctx.get("fetchLatest");
        return allTimes.slice(1, Math.max(1, maxPeriods));
      },
      params: (item, _i, ctx) => {
        const p = ctx.params as F10TimeGoalParams;
        // ⚠️ 这里参数名是 timestamp，不是 top_holders 的 locate
        return { symbol: p.symbol, timestamp: item.value, extend: true };
      },
    })
    @Endpoint(F10_ENDPOINTS.orgHolding, { method: "GET" })
    fetchHistory(
      response: RawFinanceEnvelope<RawPeriodBase>,
      item: RawTimeIndex,
    ): FundHoldingPeriod {
      return toFundPeriod(response, item);
    }

    @Aggregate()
    aggregate(ctx: GoalContext): FundHoldingGoalResult {
      const p = ctx.params as F10TimeGoalParams;
      const latest = ctx.get<FundHoldingPeriod>("fetchLatest");
      const history = ctx.has("fetchHistory")
        ? ctx.get<FundHoldingPeriod[]>("fetchHistory") ?? []
        : [];

      return {
        symbol: p.symbol,
        availablePeriods: allTimes,
        periods: [latest, ...history].filter(Boolean),
        crawledAt: new Date().toISOString(),
      };
    }
  }

  /**
   * 转单期快照，并**剥离汇总行**。
   *
   * 🔴 `fund_items[0]` 是「全部合计」，不剥离会导致：
   *   - 「持仓基金数量」多算 1
   *   - 「最大持仓基金」永远是那条汇总行
   *
   * 已验证：合计行 held_num == 2159 条明细之和（差额 0）。
   */
  function toFundPeriod(
    response: RawFinanceEnvelope<RawPeriodBase>,
    time: RawTimeIndex | undefined,
  ): FundHoldingPeriod {
    const all = extractItems<RawFundHoldingItem>(
      response,
      "fund_items", // ⚠️ 不是 items —— 与本组其它端点不一致
      FUND_HOLDING_SCOPE,
    );

    let summary: RawFundHoldingItem | null = null;
    const funds: RawFundHoldingItem[] = [];
    for (const f of all) {
      if (summary === null && SUMMARY_NAME_RE.test(f.org_name_or_fund_name ?? "")) {
        summary = f;
        continue;
      }
      funds.push(f);
    }

    return {
      periodName: time?.name ?? "",
      periodValue: time?.value ?? 0,
      funds,
      summary,
    };
  }

  return new FundHoldingGoal();
}
