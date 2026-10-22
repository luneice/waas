/**
 * 利润表 Skill —— xueqiu-income
 */
import type { BaseGoal, SkillParamSchema } from "@spider/core";
import type { ProjectionPipeline } from "@spider/core";
import {
  FinanceSkillBase,
  type FinanceSkillParams,
  type NormalizedFinanceParams,
} from "@src/skills/finance/_base";
import { createIncomeGoal, type IncomeGoalResult } from "@src/thrall/income";
import {
  projectIncomeAiReady,
  type IncomeAiReady,
} from "@src/projections/income.ai-ready";
import { KNOWN_REPORT_TYPES, DEFAULT_PAGE_SIZE, DEFAULT_MAX_PAGES } from "@src/constants";

export class IncomeStatementSkill extends FinanceSkillBase<
  FinanceSkillParams,
  IncomeGoalResult,
  IncomeAiReady
> {
  readonly id = "xueqiu-income";
  readonly name = "雪球利润表";
  readonly description =
    "拉取 A 股个股利润表（营收/成本/费用/各级利润/每股收益/综合收益，40 个科目），" +
    "按报告期倒序、自动翻页。口径为年初至该期末的累计发生额；" +
    "type=S* 时为单季发生额。需要已登录雪球的浏览器会话。" +
    "symbol 需来自上游检索结果，不要编造。";

  readonly paramSchema: SkillParamSchema[] = [
    {
      name: "symbol",
      type: "string",
      required: true,
      description:
        "标的代码，格式 {两位交易所前缀}{6位数字}，如 SH601127。仅支持 A 股（上游路径含 /cn/）",
    },
    {
      name: "type",
      type: "string",
      required: false,
      default: "all",
      description:
        `报告期筛选。已验证取值：${KNOWN_REPORT_TYPES.join(" / ")}。` +
        "注意 Q2=中报、Q4=年报（非第二/第四季度单季）；S0-S4 为单季口径。" +
        "该枚举由上游定义，此处不做白名单拦截，可能存在未列出的取值",
    },
    {
      name: "count",
      type: "number",
      required: false,
      default: DEFAULT_PAGE_SIZE,
      description: `单次请求返回的报告期数，默认 ${DEFAULT_PAGE_SIZE}（上游上限未验证）`,
    },
    {
      name: "maxPages",
      type: "number",
      required: false,
      default: DEFAULT_MAX_PAGES,
      description:
        `最大翻页数，默认 ${DEFAULT_MAX_PAGES}（约 ${DEFAULT_MAX_PAGES * DEFAULT_PAGE_SIZE} 期 ≈ 10 年）。` +
        "上游不返回 has_more，翻页在返回条数不足一页时自动终止",
    },
  ];

  protected normalizeParams(params: FinanceSkillParams): FinanceSkillParams {
    return this.normalizeFinanceParams(params);
  }

  protected createGoal(params: FinanceSkillParams): BaseGoal<IncomeGoalResult> {
    const p = params as NormalizedFinanceParams;
    return createIncomeGoal({
      symbol: p.symbol,
      type: p.type,
      count: p.count,
      maxPages: p.maxPages,
    });
  }

  /**
   * 投影走 pipeline getter —— **不要写 `protected project()` 方法**。
   * 基类不再调用任何 project()，写了也不会执行，TProjected 会形同虚设
   * 而 typecheck 不报错，是最难发现的一类 bug。
   *
   * 单层转换写在 envelope 阶段（TPayload 被基类锁为 TResult）。
   */
  protected get pipeline(): ProjectionPipeline<
    FinanceSkillParams,
    IncomeGoalResult,
    IncomeGoalResult,
    IncomeAiReady
  > {
    return {
      envelope: (data) => projectIncomeAiReady(data, this.id),
    };
  }
}
