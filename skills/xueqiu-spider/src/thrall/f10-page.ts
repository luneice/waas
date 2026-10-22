/**
 * B 组 page/size 类端点的 Goal
 *
 * 四个端点（bonus / holders / shareschg / skholderchg）共用
 * `createF10PageGoal` 泛型工厂，本文件只提供各自的坐标与业务主键。
 *
 * 🔴 业务主键的作用：`holders` 端点每页多返一条作下页预览（末条 == 下页首条），
 * 跨页 concat 会在边界重复；其余端点虽无此行为，统一按主键去重更安全。
 */
import type { BaseGoal } from "@spider/core";
import { F10_ENDPOINTS } from "@src/constants";
import {
  createF10PageGoal,
  type F10PageParams,
  type F10PageGoalResult,
} from "@src/thrall/f10-shared";
import type {
  RawBonusItem,
  BonusExtra,
  RawAdditionItem,
  RawHoldersNumItem,
  RawRestrictItem,
  RawSkHolderChgItem,
} from "@src/types/f10.types";

// ============================================================================
// 分红 / 增发 / 配股
// ============================================================================

export const BONUS_SCOPE = "xueqiu-bonus";
export type BonusGoalResult = F10PageGoalResult<RawBonusItem, BonusExtra>;

export function createBonusGoal(
  params: F10PageParams,
): BaseGoal<BonusGoalResult> {
  return createF10PageGoal<RawBonusItem, BonusExtra>(
    {
      scope: BONUS_SCOPE,
      name: "雪球分红增发",
      path: F10_ENDPOINTS.bonus,
      itemsKey: "items",
      // 同一分红可能同期多次（极少见），用所属期 + 除权日组合做主键
      keyOf: (i) => `${i.dividend_year}|${i.ex_dividend_date ?? ""}`,
      // ⚠️ addtions / allots 每页原样重复返回，只能取首页的，不能跨页累积
      extractExtra: (envelope) => {
        const data = (envelope as { data?: Record<string, unknown> })?.data;
        return {
          addtions: Array.isArray(data?.addtions)
            ? (data.addtions as RawAdditionItem[])
            : [],
          allots: Array.isArray(data?.allots) ? (data.allots as unknown[]) : [],
        };
      },
    },
    params,
  );
}

// ============================================================================
// 股东人数
// ============================================================================

export const HOLDERS_NUM_SCOPE = "xueqiu-holders-num";
export type HoldersNumGoalResult = F10PageGoalResult<RawHoldersNumItem>;

export function createHoldersNumGoal(
  params: F10PageParams,
): BaseGoal<HoldersNumGoalResult> {
  return createF10PageGoal<RawHoldersNumItem>(
    {
      scope: HOLDERS_NUM_SCOPE,
      name: "雪球股东人数",
      path: F10_ENDPOINTS.holders,
      itemsKey: "items",
      // 每期一条，timestamp 即天然主键（实测跨页重复的正是它）
      keyOf: (i) => String(i.timestamp),
      // 🔴 本端点是四个中唯一多返一条预览的（size=10 → 返回 11 条）
      overFetch: true,
    },
    params,
  );
}

// ============================================================================
// 限售解禁
// ============================================================================

export const RESTRICT_SCOPE = "xueqiu-restricted-release";
export type RestrictGoalResult = F10PageGoalResult<RawRestrictItem>;

export function createRestrictGoal(
  params: F10PageParams,
): BaseGoal<RestrictGoalResult> {
  return createF10PageGoal<RawRestrictItem>(
    {
      scope: RESTRICT_SCOPE,
      name: "雪球限售解禁",
      path: F10_ENDPOINTS.sharesChg,
      itemsKey: "items",
      // ⚠️ 同一解禁日有多条（按股东拆分），主键须含股东名与数量
      keyOf: (i) =>
        `${i.floatable_time ?? ""}|${i.holder_name}|${i.floatable_shares_num ?? ""}`,
      extraQuery: { type: "restricts" },
    },
    params,
  );
}

// ============================================================================
// 高管增减持
// ============================================================================

export const SK_HOLDER_CHG_SCOPE = "xueqiu-insider-trades";
export type SkHolderChgGoalResult = F10PageGoalResult<RawSkHolderChgItem>;

export function createSkHolderChgGoal(
  params: F10PageParams,
): BaseGoal<SkHolderChgGoalResult> {
  return createF10PageGoal<RawSkHolderChgItem>(
    {
      scope: SK_HOLDER_CHG_SCOPE,
      name: "雪球高管增减持",
      path: F10_ENDPOINTS.skHolderChg,
      itemsKey: "items",
      // 同日同人可能多笔，主键须含变动股数
      keyOf: (i) =>
        `${i.chg_date ?? ""}|${i.share_changer_name}|${i.chg_shares_num ?? ""}`,
    },
    params,
  );
}
