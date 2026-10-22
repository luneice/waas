/**
 * 资产负债表 Goal —— stock.xueqiu.com/v5/stock/finance/cn/balance.json
 *
 * 逻辑全部复用 `createFinanceGoal`（见 thrall/shared.ts），本文件只提供坐标。
 */
import type { BaseGoal } from "@spider/core";
import { FINANCE_ENDPOINTS } from "@src/constants";
import { createFinanceGoal, type FinanceGoalParams } from "@src/thrall/shared";
import type { FinanceGoalResult } from "@src/types/common.types";
import type { RawBalancePeriod } from "@src/types/balance.types";

export const BALANCE_SCOPE = "xueqiu-balance";

export type BalanceGoalResult = FinanceGoalResult<RawBalancePeriod>;

export function createBalanceGoal(
  params: FinanceGoalParams,
): BaseGoal<BalanceGoalResult> {
  return createFinanceGoal<RawBalancePeriod>(
    {
      scope: BALANCE_SCOPE,
      name: "雪球资产负债表",
      path: FINANCE_ENDPOINTS.balance,
    },
    params,
  );
}
