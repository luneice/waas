/**
 * 现金流量表 Goal —— stock.xueqiu.com/v5/stock/finance/cn/cash_flow.json
 *
 * 逻辑全部复用 `createFinanceGoal`（见 thrall/shared.ts），本文件只提供坐标。
 */
import type { BaseGoal } from "@spider/core";
import { FINANCE_ENDPOINTS } from "@src/constants";
import { createFinanceGoal, type FinanceGoalParams } from "@src/thrall/shared";
import type { FinanceGoalResult } from "@src/types/common.types";
import type { RawCashFlowPeriod } from "@src/types/cashflow.types";

export const CASHFLOW_SCOPE = "xueqiu-cashflow";

export type CashFlowGoalResult = FinanceGoalResult<RawCashFlowPeriod>;

export function createCashFlowGoal(
  params: FinanceGoalParams,
): BaseGoal<CashFlowGoalResult> {
  return createFinanceGoal<RawCashFlowPeriod>(
    {
      scope: CASHFLOW_SCOPE,
      name: "雪球现金流量表",
      path: FINANCE_ENDPOINTS.cashFlow,
    },
    params,
  );
}
