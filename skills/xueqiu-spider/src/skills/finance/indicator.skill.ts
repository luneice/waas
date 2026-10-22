/**
 * 主要财务指标 Skill —— xueqiu-indicator
 */
import type { BaseGoal, SkillParamSchema, ProjectionPipeline } from "@spider/core";
import {
  FinanceSkillBase,
  type FinanceSkillParams,
  type NormalizedFinanceParams,
} from "@src/skills/finance/_base";
import {
  createIndicatorGoal,
  type IndicatorGoalResult,
} from "@src/thrall/indicator";
import {
  projectIndicatorAiReady,
  type IndicatorAiReady,
} from "@src/projections/indicator.ai-ready";
import { KNOWN_REPORT_TYPES, DEFAULT_PAGE_SIZE, DEFAULT_MAX_PAGES } from "@src/constants";

export class FinancialIndicatorSkill extends FinanceSkillBase<
  FinanceSkillParams,
  IndicatorGoalResult,
  IndicatorAiReady
> {
  readonly id = "xueqiu-indicator";
  readonly name = "雪球主要财务指标";
  readonly description =
    "拉取 A 股个股主要财务指标（ROE 双口径/毛利率/净利率/周转率/周转天数/" +
    "营业周期/现金循环/每股指标/成长率，35 项），按报告期倒序、自动翻页。" +
    "省去自行计算（尤其是需要期初期末数据的平均口径 ROE 与周转率）。" +
    "⚠️ 本表单位不统一（百分数/小数/倍/天/元混合），数值为上游原值未归一化，" +
    "换算前须查 meta.fieldUnits；且与 xueqiu-balance 有 2 个同名字段口径冲突。" +
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
        "⚠️ 本端点抓包中未出现 S0-S4（对比率做差分无意义），但仍不做白名单拦截，" +
        "取值合法性由上游判定",
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
      description:
        `最大翻页数，默认 ${DEFAULT_MAX_PAGES}（约 ${DEFAULT_MAX_PAGES * DEFAULT_PAGE_SIZE} 期 ≈ 10 年）。` +
        "本端点历史最深（实测可翻到 2011 年），但早期期次可能有跳跃缺失",
    },
  ];

  protected normalizeParams(params: FinanceSkillParams): FinanceSkillParams {
    return this.normalizeFinanceParams(params);
  }

  protected createGoal(
    params: FinanceSkillParams,
  ): BaseGoal<IndicatorGoalResult> {
    const p = params as NormalizedFinanceParams;
    return createIndicatorGoal({
      symbol: p.symbol,
      type: p.type,
      count: p.count,
      maxPages: p.maxPages,
    });
  }

  protected get pipeline(): ProjectionPipeline<
    FinanceSkillParams,
    IndicatorGoalResult,
    IndicatorGoalResult,
    IndicatorAiReady
  > {
    return {
      envelope: (data) => projectIndicatorAiReady(data, this.id),
    };
  }
}
