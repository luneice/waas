/**
 * 资产负债表 Skill —— xueqiu-balance
 */
import type { BaseGoal, SkillParamSchema, ProjectionPipeline } from "@spider/core";
import {
  FinanceSkillBase,
  type FinanceSkillParams,
  type NormalizedFinanceParams,
} from "@src/skills/finance/_base";
import { createBalanceGoal, type BalanceGoalResult } from "@src/thrall/balance";
import {
  projectBalanceAiReady,
  type BalanceAiReady,
} from "@src/projections/balance.ai-ready";
import { KNOWN_REPORT_TYPES, DEFAULT_PAGE_SIZE, DEFAULT_MAX_PAGES } from "@src/constants";

export class BalanceSheetSkill extends FinanceSkillBase<
  FinanceSkillParams,
  BalanceGoalResult,
  BalanceAiReady
> {
  readonly id = "xueqiu-balance";
  readonly name = "雪球资产负债表";
  readonly description =
    "拉取 A 股个股资产负债表（资产/负债/所有者权益全部科目，87 项），" +
    "按报告期倒序、自动翻页。口径为**时点余额**（该报告期末当日），不可跨期相加。" +
    "⚠️ type=S*（单季）对本表无会计意义，会返回置空字段并给出说明。" +
    "需要已登录雪球的浏览器会话。symbol 需来自上游检索结果，不要编造。";

  readonly paramSchema: SkillParamSchema[] = [
    {
      name: "symbol",
      type: "string",
      required: true,
      description:
        "标的代码，格式 {两位交易所前缀}{6位数字}，如 SH601127。仅支持 A 股",
    },
    {
      name: "type",
      type: "string",
      required: false,
      default: "all",
      description:
        `报告期筛选。已验证取值：${KNOWN_REPORT_TYPES.join(" / ")}。` +
        "Q2=中报、Q4=年报（非第二/第四季度单季）。" +
        "⚠️ S0-S4 为单季差分，对本表（时点存量）无意义，业务字段会被置空。" +
        "该枚举由上游定义，此处不做白名单拦截",
    },
    {
      name: "count",
      type: "number",
      required: false,
      default: DEFAULT_PAGE_SIZE,
      description: `单次请求返回的报告期数，默认 ${DEFAULT_PAGE_SIZE}`,
    },
    {
      name: "maxPages",
      type: "number",
      required: false,
      default: DEFAULT_MAX_PAGES,
      description: `最大翻页数，默认 ${DEFAULT_MAX_PAGES}（约 ${DEFAULT_MAX_PAGES * DEFAULT_PAGE_SIZE} 期 ≈ 10 年）`,
    },
  ];

  protected normalizeParams(params: FinanceSkillParams): FinanceSkillParams {
    return this.normalizeFinanceParams(params);
  }

  protected createGoal(params: FinanceSkillParams): BaseGoal<BalanceGoalResult> {
    const p = params as NormalizedFinanceParams;
    return createBalanceGoal({
      symbol: p.symbol,
      type: p.type,
      count: p.count,
      maxPages: p.maxPages,
    });
  }

  protected get pipeline(): ProjectionPipeline<
    FinanceSkillParams,
    BalanceGoalResult,
    BalanceGoalResult,
    BalanceAiReady
  > {
    return {
      envelope: (data) => projectBalanceAiReady(data, this.id),
    };
  }
}
