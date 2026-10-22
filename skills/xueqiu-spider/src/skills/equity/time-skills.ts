/**
 * B 组日期索引类 Skill —— 十大股东 / 基金持股
 *
 * 与 page/size 类的差异：不翻页，而是先取 `times[]` 再按期展开（@Expanded）。
 * 故入参是 `maxPeriods`（取多少期）而非 `maxPages`。
 */
import { InvalidParamsError, MissingContextError } from "@spider/core";
import type { BaseGoal, SkillParamSchema, ProjectionPipeline } from "@spider/core";
import { XueqiuSkillBase } from "@src/skills/xueqiu-skill-base";
import {
  STOCK_DETAIL_PATH,
  SYMBOL_SHAPE,
  F10_DEFAULT_MAX_PERIODS,
} from "@src/constants";
import {
  createTopHoldersGoal,
  createFundHoldingGoal,
  type TopHoldersGoalResult,
  type FundHoldingGoalResult,
} from "@src/thrall/f10-time";
import {
  projectTopHoldersAiReady,
  projectFundHoldingAiReady,
  type TopHoldersAiReady,
  type FundHoldingAiReady,
} from "@src/projections/f10-time.ai-ready";

/** 日期索引类 Skill 的入参 */
export interface F10TimeSkillParams {
  symbol: string;
  /** 最多取多少期（从最新期倒序），默认 8 */
  maxPeriods?: number;
  [key: string]: unknown;
}

interface NormalizedTimeParams extends F10TimeSkillParams {
  symbol: string;
  maxPeriods: number;
}

abstract class F10TimeSkillBase<
  TData extends object,
  TProjected,
> extends XueqiuSkillBase<F10TimeSkillParams, TData, TProjected> {
  protected getPath(params: F10TimeSkillParams): string {
    return STOCK_DETAIL_PATH.replace("{symbol}", params.symbol);
  }

  protected normalizeTimeParams(p: F10TimeSkillParams): NormalizedTimeParams {
    const raw = typeof p.symbol === "string" ? p.symbol.trim().toUpperCase() : "";
    if (!raw) {
      throw new MissingContextError(
        "缺少 symbol。标的代码形如 SZ300750，需来自上游检索结果，不要编造",
        { scope: this.id },
      );
    }
    if (!SYMBOL_SHAPE.test(raw)) {
      throw new InvalidParamsError(
        `symbol="${raw}" 形状非法。期望 {两位交易所前缀}{6位数字}，如 SZ300750`,
        { scope: this.id, details: { symbol: raw } },
      );
    }
    const n = Number(p.maxPeriods);
    const maxPeriods = Number.isFinite(n)
      ? Math.min(60, Math.max(1, Math.trunc(n)))
      : F10_DEFAULT_MAX_PERIODS;

    return { ...p, symbol: raw, maxPeriods };
  }
}

const PERIOD_SCHEMA: SkillParamSchema = {
  name: "maxPeriods",
  type: "number",
  required: false,
  default: F10_DEFAULT_MAX_PERIODS,
  description:
    `最多取多少期（从最新期倒序），默认 ${F10_DEFAULT_MAX_PERIODS}。` +
    "本端点不是翻页而是按可用期次展开：每期一次请求，期数越多请求越多",
};

const SYMBOL_SCHEMA: SkillParamSchema = {
  name: "symbol",
  type: "string",
  required: true,
  description: "标的代码，格式 {两位交易所前缀}{6位数字}，如 SZ300750。仅支持 A 股",
};

// ============================================================================
// 十大股东 / 十大流通股东
// ============================================================================

export class TopHoldersSkill extends F10TimeSkillBase<
  TopHoldersGoalResult,
  TopHoldersAiReady
> {
  readonly id = "xueqiu-top-holders";
  readonly name = "雪球十大股东";
  readonly description =
    "拉取 A 股个股的十大股东或十大流通股东（circulating 参数切换），" +
    "含持股数量、占比、环比变动、合计持股比例（即股权集中度），" +
    "以及本期退出前十的股东。支持按报告期取多期历史。" +
    "⚠️ changePct 是持股**数量**的环比变动，不是占比变动。" +
    "需要已登录雪球的浏览器会话。";

  readonly paramSchema: SkillParamSchema[] = [
    SYMBOL_SCHEMA,
    {
      name: "circulating",
      type: "boolean",
      required: false,
      default: false,
      description:
        "口径开关。false（默认）= 十大股东（全体）；true = 十大**流通**股东。" +
        "⚠️ 两种口径的可用期数不同（实测 48 vs 36）",
    },
    PERIOD_SCHEMA,
  ];

  protected normalizeParams(p: F10TimeSkillParams): F10TimeSkillParams {
    return this.normalizeTimeParams(p);
  }

  protected createGoal(p: F10TimeSkillParams): BaseGoal<TopHoldersGoalResult> {
    const n = p as NormalizedTimeParams;
    return createTopHoldersGoal({
      symbol: n.symbol,
      maxPeriods: n.maxPeriods,
      circula: p.circulating === true ? 1 : 0,
    });
  }

  protected get pipeline(): ProjectionPipeline<
    F10TimeSkillParams,
    TopHoldersGoalResult,
    TopHoldersGoalResult,
    TopHoldersAiReady
  > {
    return { envelope: (d) => projectTopHoldersAiReady(d, this.id) };
  }
}

// ============================================================================
// 基金持股
// ============================================================================

/** 每期基金明细的默认截断上限 —— 单期可达 2000+ 只，全量输出会撑爆上下文 */
const DEFAULT_FUND_TOP_N = 50;

export class FundHoldingSkill extends F10TimeSkillBase<
  FundHoldingGoalResult,
  FundHoldingAiReady
> {
  readonly id = "xueqiu-fund-holding";
  readonly name = "雪球基金持股";
  readonly description =
    "拉取 A 股个股的基金持股明细：持仓基金名称、持股数量、占流通股比例，" +
    "以及全部基金的合计持仓。支持按报告期取多期历史。" +
    "⚠️ 单期可达 2000+ 只基金，默认每期只返回持仓最多的前 50 只" +
    "（合计数来自上游汇总行，不受截断影响），需要全量请调大 topN。" +
    "需要已登录雪球的浏览器会话。";

  readonly paramSchema: SkillParamSchema[] = [
    SYMBOL_SCHEMA,
    PERIOD_SCHEMA,
    {
      name: "topN",
      type: "number",
      required: false,
      default: DEFAULT_FUND_TOP_N,
      description:
        `每期返回持仓最多的前 N 只基金，默认 ${DEFAULT_FUND_TOP_N}。` +
        "传 0 表示不截断（⚠️ 单期可达 2000+ 只，慎用）。" +
        "合计持股数来自上游汇总行，任何截断都不影响它",
    },
  ];

  protected normalizeParams(p: F10TimeSkillParams): F10TimeSkillParams {
    const base = this.normalizeTimeParams(p);
    const n = Number(p.topN);
    const topN = Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : DEFAULT_FUND_TOP_N;
    return { ...base, topN };
  }

  protected createGoal(p: F10TimeSkillParams): BaseGoal<FundHoldingGoalResult> {
    const n = p as NormalizedTimeParams;
    return createFundHoldingGoal({ symbol: n.symbol, maxPeriods: n.maxPeriods });
  }

  protected get pipeline(): ProjectionPipeline<
    F10TimeSkillParams,
    FundHoldingGoalResult,
    FundHoldingGoalResult,
    FundHoldingAiReady
  > {
    return {
      envelope: (d, ctx) =>
        projectFundHoldingAiReady(
          d,
          this.id,
          Number((ctx.params as { topN?: number }).topN ?? DEFAULT_FUND_TOP_N),
        ),
    };
  }
}
