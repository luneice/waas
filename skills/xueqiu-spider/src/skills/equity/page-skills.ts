/**
 * B 组 page/size 类 Skill —— 分红增发 / 股东人数 / 限售解禁 / 高管增减持
 *
 * 四者结构高度相似（同一泛型 Goal 工厂 + 各自投影），故合并一个文件。
 */
import type { BaseGoal, SkillParamSchema, ProjectionPipeline } from "@spider/core";
import {
  F10SkillBase,
  type F10SkillParams,
  type NormalizedF10Params,
} from "@src/skills/equity/_base";
import {
  createBonusGoal,
  createHoldersNumGoal,
  createRestrictGoal,
  createSkHolderChgGoal,
  type BonusGoalResult,
  type HoldersNumGoalResult,
  type RestrictGoalResult,
  type SkHolderChgGoalResult,
} from "@src/thrall/f10-page";
import {
  projectBonusAiReady,
  type BonusAiReady,
} from "@src/projections/bonus.ai-ready";
import {
  projectHoldersNumAiReady,
  projectRestrictAiReady,
  projectInsiderTradeAiReady,
  type HoldersNumAiReady,
  type RestrictAiReady,
  type InsiderTradeAiReady,
} from "@src/projections/equity.ai-ready";
import { F10_DEFAULT_SIZE, F10_DEFAULT_MAX_PAGES } from "@src/constants";

/** 四个 Skill 共享的参数 schema */
function sharedSchema(): SkillParamSchema[] {
  return [
    {
      name: "symbol",
      type: "string",
      required: true,
      description:
        "标的代码，格式 {两位交易所前缀}{6位数字}，如 SZ300750。仅支持 A 股",
    },
    {
      name: "size",
      type: "number",
      required: false,
      default: F10_DEFAULT_SIZE,
      description:
        `每页条数，默认 ${F10_DEFAULT_SIZE}。` +
        "⚠️ 上游实际返回 size+1 条（末条是下页首条），本包已自动去重并修正终止判据",
    },
    {
      name: "maxPages",
      type: "number",
      required: false,
      default: F10_DEFAULT_MAX_PAGES,
      description: `最大翻页数，默认 ${F10_DEFAULT_MAX_PAGES}`,
    },
  ];
}

const toGoalParams = (p: F10SkillParams) => {
  const n = p as NormalizedF10Params;
  return { symbol: n.symbol, page: n.page, size: n.size, maxPages: n.maxPages };
};

// ============================================================================
// 分红 / 增发
// ============================================================================

export class BonusSkill extends F10SkillBase<
  F10SkillParams,
  BonusGoalResult,
  BonusAiReady
> {
  readonly id = "xueqiu-bonus";
  readonly name = "雪球分红增发";
  readonly description =
    "拉取 A 股个股的分红、增发、配股记录。分红含所属期、方案说明、股权登记日、" +
    "除权除息日；增发含发行数量、发行价、募资净额。" +
    "⚠️ 上游分红金额只在中文方案串里（如「10派69.57元」），本包已解析为每股派息额" +
    "并保留原文；解析失败时金额为 null（不是 0），须据 parsed 字段判别。" +
    "算股息率还需股价，本接口族不提供。需要已登录雪球的浏览器会话。";

  readonly paramSchema = sharedSchema();

  protected normalizeParams(p: F10SkillParams): F10SkillParams {
    return this.normalizeF10Params(p);
  }
  protected createGoal(p: F10SkillParams): BaseGoal<BonusGoalResult> {
    return createBonusGoal(toGoalParams(p));
  }
  protected get pipeline(): ProjectionPipeline<
    F10SkillParams,
    BonusGoalResult,
    BonusGoalResult,
    BonusAiReady
  > {
    return { envelope: (d) => projectBonusAiReady(d, this.id) };
  }
}

// ============================================================================
// 股东人数
// ============================================================================

export class HoldersNumSkill extends F10SkillBase<
  F10SkillParams,
  HoldersNumGoalResult,
  HoldersNumAiReady
> {
  readonly id = "xueqiu-holders-num";
  readonly name = "雪球股东人数";
  readonly description =
    "拉取 A 股个股各报告期的股东户数与筹码结构：总户数、A/H/B 股股东数、" +
    "户均持股、户均市值、前十大股东合计持股比例。" +
    "可用于判断筹码集中或分散（户数↑+户均持股↓=分散）。" +
    "⚠️ 返回的 price 仅为披露日股价快照，不能替代行情源做估值。" +
    "需要已登录雪球的浏览器会话。";

  readonly paramSchema = sharedSchema();

  protected normalizeParams(p: F10SkillParams): F10SkillParams {
    return this.normalizeF10Params(p);
  }
  protected createGoal(p: F10SkillParams): BaseGoal<HoldersNumGoalResult> {
    return createHoldersNumGoal(toGoalParams(p));
  }
  protected get pipeline(): ProjectionPipeline<
    F10SkillParams,
    HoldersNumGoalResult,
    HoldersNumGoalResult,
    HoldersNumAiReady
  > {
    return { envelope: (d) => projectHoldersNumAiReady(d, this.id) };
  }
}

// ============================================================================
// 限售解禁
// ============================================================================

export class RestrictedReleaseSkill extends F10SkillBase<
  F10SkillParams,
  RestrictGoalResult,
  RestrictAiReady
> {
  readonly id = "xueqiu-restricted-release";
  readonly name = "雪球限售解禁";
  readonly description =
    "拉取 A 股个股的限售股解禁明细：股东名称、解禁日、解禁数量、解禁股份类型。" +
    "⚠️ 同一解禁日按股东拆成多条，输出中的 byDate 已按日聚合求和，" +
    "算单日解禁总量请用它，不要取单条。需要已登录雪球的浏览器会话。";

  readonly paramSchema = sharedSchema();

  protected normalizeParams(p: F10SkillParams): F10SkillParams {
    return this.normalizeF10Params(p);
  }
  protected createGoal(p: F10SkillParams): BaseGoal<RestrictGoalResult> {
    return createRestrictGoal(toGoalParams(p));
  }
  protected get pipeline(): ProjectionPipeline<
    F10SkillParams,
    RestrictGoalResult,
    RestrictGoalResult,
    RestrictAiReady
  > {
    return { envelope: (d) => projectRestrictAiReady(d, this.id) };
  }
}

// ============================================================================
// 高管增减持
// ============================================================================

export class InsiderTradeSkill extends F10SkillBase<
  F10SkillParams,
  SkHolderChgGoalResult,
  InsiderTradeAiReady
> {
  readonly id = "xueqiu-insider-trades";
  readonly name = "雪球高管增减持";
  readonly description =
    "拉取 A 股个股高管及关联人的持股变动明细：变动人、职务、变动日、" +
    "变动股数（负数=减持）、成交均价、变动后余额，并估算变动金额。" +
    "可用于观察管理层信心。⚠️ 减持原因多样（个人资金需求、股权激励行权、" +
    "大宗减持计划等），本数据为事实记录，不构成投资判断。" +
    "需要已登录雪球的浏览器会话。";

  readonly paramSchema = sharedSchema();

  protected normalizeParams(p: F10SkillParams): F10SkillParams {
    return this.normalizeF10Params(p);
  }
  protected createGoal(p: F10SkillParams): BaseGoal<SkHolderChgGoalResult> {
    return createSkHolderChgGoal(toGoalParams(p));
  }
  protected get pipeline(): ProjectionPipeline<
    F10SkillParams,
    SkHolderChgGoalResult,
    SkHolderChgGoalResult,
    InsiderTradeAiReady
  > {
    return { envelope: (d) => projectInsiderTradeAiReady(d, this.id) };
  }
}
