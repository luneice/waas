/**
 * 利润表 Goal —— stock.xueqiu.com/v5/stock/finance/cn/income.json
 *
 * 端点族的翻页/信封/聚合逻辑全部复用 `createFinanceGoal`（见 thrall/shared.ts），
 * 本文件只提供三处坐标与 `TPeriod` 类型收窄。
 */
import type { BaseGoal } from "@spider/core";
import { FINANCE_ENDPOINTS } from "@src/constants";
import {
  createFinanceGoal,
  type FinanceGoalParams,
} from "@src/thrall/shared";
import type { FinanceGoalResult } from "@src/types/common.types";
import type { RawIncomePeriod } from "@src/types/income.types";

/** 同时用作 @Goal.id 与错误 scope */
export const INCOME_SCOPE = "xueqiu-income";

export type IncomeGoalResult = FinanceGoalResult<RawIncomePeriod>;
export type IncomeGoalParams = FinanceGoalParams;

export function createIncomeGoal(
  params: IncomeGoalParams,
): BaseGoal<IncomeGoalResult> {
  return createFinanceGoal<RawIncomePeriod>(
    {
      scope: INCOME_SCOPE,
      name: "雪球利润表",
      path: FINANCE_ENDPOINTS.income,
    },
    params,
  );
}
