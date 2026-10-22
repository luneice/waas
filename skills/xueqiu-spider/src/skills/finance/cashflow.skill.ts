/**
 * 现金流量表 Skill —— xueqiu-cashflow
 */
import type { BaseGoal, SkillParamSchema, ProjectionPipeline } from "@spider/core";
import {
  FinanceSkillBase,
  type FinanceSkillParams,
  type NormalizedFinanceParams,
} from "@src/skills/finance/_base";
import { createCashFlowGoal, type CashFlowGoalResult } from "@src/thrall/cashflow";
import {
  projectCashFlowAiReady,
  type CashFlowAiReady,
} from "@src/projections/cashflow.ai-ready";
import { KNOWN_REPORT_TYPES, DEFAULT_PAGE_SIZE, DEFAULT_MAX_PAGES } from "@src/constants";

export class CashFlowSkill extends FinanceSkillBase<
  FinanceSkillParams,
  CashFlowGoalResult,
  CashFlowAiReady
> {
  readonly id = "xueqiu-cashflow";
  readonly name = "雪球现金流量表";
  readonly description =
    "拉取 A 股个股现金流量表（经营/投资/筹资三大活动的流入流出明细与净额，38 项），" +
    "按报告期倒序、自动翻页。口径为年初至该期末的累计发生额。" +
    "配合利润表可做盈利质量分析（经营现金流 / 净利润）。" +
    "type=S* 单季口径对流量字段有效（可得 Q4 单季数据），但期初/期末现金余额会被置空。" +
    "需要已登录雪球的浏览器会话。";

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
        "S0-S4 为单季口径，对本表流量字段语义正确（S4 可得 Q4 单季数据），" +
        "但期初/期末现金余额为时点字段会失真并被置空。该枚举由上游定义，不做白名单拦截",
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

  protected createGoal(params: FinanceSkillParams): BaseGoal<CashFlowGoalResult> {
    const p = params as NormalizedFinanceParams;
    return createCashFlowGoal({
      symbol: p.symbol,
      type: p.type,
      count: p.count,
      maxPages: p.maxPages,
    });
  }

  protected get pipeline(): ProjectionPipeline<
    FinanceSkillParams,
    CashFlowGoalResult,
    CashFlowGoalResult,
    CashFlowAiReady
  > {
    return {
      envelope: (data) => projectCashFlowAiReady(data, this.id),
    };
  }
}
