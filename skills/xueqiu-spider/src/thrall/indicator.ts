/**
 * 主要财务指标 Goal —— stock.xueqiu.com/v5/stock/finance/cn/indicator.json
 *
 * 逻辑全部复用 `createFinanceGoal`（见 thrall/shared.ts），本文件只提供坐标。
 */
import type { BaseGoal } from "@spider/core";
import { FINANCE_ENDPOINTS } from "@src/constants";
import { createFinanceGoal, type FinanceGoalParams } from "@src/thrall/shared";
import type { FinanceGoalResult } from "@src/types/common.types";
import type { RawIndicatorPeriod } from "@src/types/indicator.types";

export const INDICATOR_SCOPE = "xueqiu-indicator";

export type IndicatorGoalResult = FinanceGoalResult<RawIndicatorPeriod>;

export function createIndicatorGoal(
  params: FinanceGoalParams,
): BaseGoal<IndicatorGoalResult> {
  return createFinanceGoal<RawIndicatorPeriod>(
    {
      scope: INDICATOR_SCOPE,
      name: "雪球主要财务指标",
      path: FINANCE_ENDPOINTS.indicator,
    },
    params,
  );
}
