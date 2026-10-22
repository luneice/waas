/**
 * f10 模块基类 —— 钉住导航路径与 page/size 类端点的共享入参归一化
 */
import { InvalidParamsError, MissingContextError } from "@spider/core";
import { XueqiuSkillBase } from "@src/skills/xueqiu-skill-base";
import {
  STOCK_DETAIL_PATH,
  SYMBOL_SHAPE,
  F10_DEFAULT_SIZE,
  F10_DEFAULT_MAX_PAGES,
} from "@src/constants";

/** page/size 类 f10 端点的共享入参 */
export interface F10SkillParams {
  symbol: string;
  /** 每页条数，默认 10 */
  size?: number;
  /** 最大翻页数，默认 10 */
  maxPages?: number;
  [key: string]: unknown;
}

export interface NormalizedF10Params extends F10SkillParams {
  symbol: string;
  page: number;
  size: number;
  maxPages: number;
}

export abstract class F10SkillBase<
  TParams extends F10SkillParams = F10SkillParams,
  TData extends object = object,
  TProjected = TData,
> extends XueqiuSkillBase<TParams, TData, TProjected> {
  protected getPath(params: TParams): string {
    return STOCK_DETAIL_PATH.replace("{symbol}", params.symbol);
  }

  /**
   * 共享入参归一化。
   *
   * ⚠️ `paramSchema.default` 框架不注入，实际默认值必须在这里用 `??` 兜底。
   */
  protected normalizeF10Params(params: TParams): NormalizedF10Params {
    const raw = typeof params.symbol === "string" ? params.symbol.trim().toUpperCase() : "";

    if (!raw) {
      throw new MissingContextError(
        "缺少 symbol。标的代码形如 SZ300750 / SH601127，需来自上游检索结果，不要编造",
        { scope: this.id },
      );
    }
    if (!SYMBOL_SHAPE.test(raw)) {
      throw new InvalidParamsError(
        `symbol="${raw}" 形状非法。期望 {两位交易所前缀}{6位数字}，如 SZ300750`,
        { scope: this.id, details: { symbol: raw } },
      );
    }

    return {
      ...params,
      symbol: raw,
      page: 1,
      size: clampInt(params.size, F10_DEFAULT_SIZE, 1, 100),
      maxPages: clampInt(params.maxPages, F10_DEFAULT_MAX_PAGES, 1, 200),
    };
  }
}

function clampInt(raw: unknown, fallback: number, min: number, max: number): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}
