/**
 * f10 端点族（B 组 · 股权与公司运作）共享逻辑
 *
 * 与 A 组（财务报表）的关系：
 *   - **完全复用**：响应信封解包、`error_code` 判定、鉴权、导航目标
 *     → 直接用 `thrall/shared.ts` 的 `unwrapFinanceEnvelope` / `SHARED_GOAL_DEFAULTS`
 *   - **必须另写**：翻页范式（三种并存）、`data` 内部形态（各端点不同）
 *
 * 本文件只承载 B 组特有的部分。
 *
 * ⚠️ 同 A 组：这里全是**模块级纯函数**，端点方法体是无 this 调用的。
 */
import {
  Goal,
  Endpoint,
  Paginated,
  Aggregate,
  BaseGoal,
  GoalContext,
} from "@spider/core";
import { STOCK_API_BASE } from "@src/constants";
import { SHARED_GOAL_DEFAULTS, unwrapFinanceEnvelope } from "@src/thrall/shared";
import type { RawFinanceEnvelope, RawPeriodBase } from "@src/types/common.types";

/** page/size 类端点的通用入参 */
export interface F10PageParams {
  symbol: string;
  page: number;
  size: number;
  maxPages: number;
  [key: string]: unknown;
}

/** 日期索引类端点的通用入参 */
export interface F10TimeParams {
  symbol: string;
  /** 最多取多少期（从最新期倒序） */
  maxPeriods: number;
  [key: string]: unknown;
}

/**
 * 🔴 page/size 类端点的翻页终止判据。
 *
 * ## 为什么不能一刀切
 *
 * 实测四个端点的每页条数**并不一致**：
 *
 * | 端点 | size=10 时每页返回 | 说明 |
 * | --- | --- | --- |
 * | `holders` | **11 条** | 多返一条作「下页预览」，末条 == 下页首条 |
 * | `bonus` / `shareschg` / `skholderchg` | **10 条** | 标准行为 |
 *
 * 所以：
 * - 对 `holders`：满页是 `size + 1`，收到 `<= size` 即到底；
 * - 对其余端点：满页是 `size`，收到 `< size`（含 0）才到底。
 *
 * ⚠️ 若把 holders 的特例当成全族规则（用 `<= size`），
 * 会让标准端点在**第一页就误判到底**（10 <= 10），丢失后续所有数据 ——
 * 实测 bonus 因此只拿到 10 条而真实有 12 条。
 *
 * @param overFetch 该端点是否多返一条预览（仅 holders 为 true）
 */
export function isLastF10Page(
  itemCount: number,
  size: number,
  overFetch: boolean,
): boolean {
  return overFetch ? itemCount <= size : itemCount < size;
}

/**
 * 🔴 按业务主键去重。
 *
 * `holders` 端点每页多返一条作下页预览，跨页 concat 会在**每页边界重复一条**。
 * 其余端点无此行为，但统一去重可防御上游变化，且对正常数据无副作用。
 *
 * @param keyOf 提取业务主键的函数（各端点主键不同，见各自 Goal）
 */
export function dedupeByKey<T>(items: T[], keyOf: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = keyOf(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** 日期索引项 —— `times[]` 的元素，是 `@Expanded` 的 source */
export interface RawTimeIndex {
  /** 期次显示名（`2026中报` 或 `2026-08-05`） */
  name: string;
  /** 期次时间戳（毫秒）—— 作为 locate / timestamp 入参 */
  value: number;
}

/** 构造 page/size 类端点的查询参数 */
export function buildF10PageQuery(
  symbol: string,
  page: number,
  size: number,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return { symbol, page, size, extend: true, ...extra };
}

// ============================================================================
// 泛型 Goal 工厂 —— page/size 类（bonus / holders / shareschg / skholderchg）
// ============================================================================

/** 构造一个 page/size 类 f10 Goal 所需的坐标 */
export interface F10PageGoalSpec<TItem, TExtra = undefined> {
  /** 同时用作 @Goal.id 与错误 scope */
  scope: string;
  /** Goal 中文名 */
  name: string;
  /** 端点路径 */
  path: string;
  /** 业务数据在 data 下的键名（多数是 items） */
  itemsKey: string;
  /** 业务主键提取器 —— 跨页去重用 */
  keyOf: (item: TItem) => string;
  /** 附加查询参数（如 shareschg 的 type=restricts） */
  extraQuery?: Record<string, unknown>;
  /**
   * 该端点是否**多返一条**作下页预览（仅 `holders` 为 true）。
   *
   * 实测：`holders` 在 size=10 时每页返回 11 条，末条 == 下页首条；
   * 其余三个端点返回标准的 10 条。终止判据据此不同，见 `isLastF10Page`。
   */
  overFetch?: boolean;
  /**
   * 从首页响应中提取「非分页」的附加数据（如 bonus 的 addtions/allots）。
   * ⚠️ 这类数据每页原样重复返回，只能取一次，不能跨页累积。
   */
  extractExtra?: (envelope: unknown) => TExtra;
}

/** page/size 类 Goal 的聚合结果 */
export interface F10PageGoalResult<TItem, TExtra = undefined> {
  symbol: string;
  items: TItem[];
  /** 非分页附加数据（仅取首页），无则为 undefined */
  extra?: TExtra;
  pagesFetched: number;
  crawledAt: string;
}

/**
 * page/size 类 f10 Goal 泛型工厂。
 *
 * 与 A 组 `createFinanceGoal` 的差异：
 *   - 翻页是 **page 递增**而非 timestamp 游标；
 *   - 终止判据**逐端点而异**（holders 多返一条预览，见 `isLastF10Page`）；
 *   - 跨页按业务主键去重（holders 的边界会重复一条）。
 *
 * 用工厂而非静态类的理由同 A 组（见 `thrall/shared.ts` 的说明）：
 * maxPages/size 要进装饰器工厂参数，附加数据要靠闭包捕获。
 */
export function createF10PageGoal<TItem extends object, TExtra = undefined>(
  spec: F10PageGoalSpec<TItem, TExtra>,
  params: F10PageParams,
): BaseGoal<F10PageGoalResult<TItem, TExtra>> {
  const { scope, name, path, itemsKey, keyOf, extraQuery, extractExtra } = spec;
  const overFetch = spec.overFetch ?? false;
  const { size, maxPages } = params;

  /** 首页的非分页附加数据 —— 由端点方法体填充 */
  let extra: TExtra | undefined;
  let pagesFetched = 0;

  @Goal({
    id: scope,
    name,
    baseURL: STOCK_API_BASE,
    defaults: SHARED_GOAL_DEFAULTS,
  })
  class F10PageGoal extends BaseGoal<F10PageGoalResult<TItem, TExtra>> {
    @Paginated<RawFinanceEnvelope<RawPeriodBase>, TItem>({
      pageSize: size,
      maxPages,
      params: (ctx, page) => {
        const p = ctx.params as F10PageParams;
        return buildF10PageQuery(p.symbol, page, p.size, extraQuery);
      },
      // ⚠️ stopWhen 拿不到 ctx，但 size / overFetch 已由工厂闭包捕获，够用。
      stopWhen: (response) => {
        const list = extractItems<TItem>(response, itemsKey, scope);
        return isLastF10Page(list.length, size, overFetch);
      },
    })
    @Endpoint(path, { method: "GET" })
    fetchPage(response: RawFinanceEnvelope<RawPeriodBase>): TItem[] {
      // ⚠️ 必须返回数组 —— executor 用 spread 累积
      const list = extractItems<TItem>(response, itemsKey, scope);
      if (pagesFetched === 0 && extractExtra) extra = extractExtra(response);
      pagesFetched += 1;
      return list;
    }

    @Aggregate()
    aggregate(ctx: GoalContext): F10PageGoalResult<TItem, TExtra> {
      const accumulated = ctx.get<TItem[]>("fetchPage") ?? [];
      const p = ctx.params as F10PageParams;

      return {
        symbol: p.symbol,
        // 🔴 去重：holders 每页多返一条预览，边界会重复；其余端点无害
        items: dedupeByKey(accumulated, keyOf),
        extra,
        pagesFetched,
        crawledAt: new Date().toISOString(),
      };
    }
  }

  return new F10PageGoal();
}

/**
 * 从 f10 响应中提取业务数组。
 *
 * ⚠️ 各端点的键名不同（多数是 `items`，基金持股是 `fund_items`），
 * 故做成参数而非硬编码。
 */
export function extractItems<T>(
  response: unknown,
  itemsKey: string,
  scope: string,
): T[] {
  // 先走统一的信封解包（含 error_code 判定、未登录识别）
  unwrapFinanceEnvelope(
    response as RawFinanceEnvelope<RawPeriodBase>,
    scope,
  );

  const data = (response as { data?: Record<string, unknown> })?.data;
  const list = data?.[itemsKey];
  return Array.isArray(list) ? (list as T[]) : [];
}
