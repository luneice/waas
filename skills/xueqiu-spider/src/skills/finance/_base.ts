/**
 * 财务报表模块基类 —— 钉住导航路径与共享的入参归一化
 *
 * 导航到个股详情页的目的：
 *   1. 建立 `https://xueqiu.com` 同源上下文（上游 CORS 校验 Origin，缺失直接 403）；
 *   2. 让浏览器自动附带登录态 Cookie（Node 侧全程不接触 token）；
 *   3. 提供合理的 Referer。
 */
import { InvalidParamsError, MissingContextError } from "@spider/core";
import { XueqiuSkillBase } from "@src/skills/xueqiu-skill-base";
import {
  STOCK_DETAIL_PATH,
  SYMBOL_SHAPE,
  REPORT_TYPE_SHAPE,
  DEFAULT_PAGE_SIZE,
  DEFAULT_MAX_PAGES,
} from "@src/constants";

/** 四张报表共享的入参 */
export interface FinanceSkillParams {
  /** 标的代码，如 SH601127 */
  symbol: string;
  /** 报告期筛选，默认 all */
  type?: string;
  /** 单次返回期数，默认 5 */
  count?: number;
  /** 最大翻页数，默认 8（≈40 期，约 10 年） */
  maxPages?: number;
  [key: string]: unknown;
}

/** 归一化后的入参（默认值已填） */
export interface NormalizedFinanceParams extends FinanceSkillParams {
  symbol: string;
  type: string;
  count: number;
  maxPages: number;
}

export abstract class FinanceSkillBase<
  TParams extends FinanceSkillParams = FinanceSkillParams,
  TData extends object = object,
  TProjected = TData,
> extends XueqiuSkillBase<TParams, TData, TProjected> {
  protected getPath(params: TParams): string {
    return STOCK_DETAIL_PATH.replace("{symbol}", params.symbol);
  }

  /**
   * 共享的入参归一化：语义校验 → trim/clamp → `??` 填默认值。
   *
   * ⚠️ `paramSchema.default` 只是给 Agent 看的文档，**框架不会注入它** ——
   * 实际默认值必须在这里用 `??` 兜底。
   *
   * ⚠️ **`type` 只做形状校验，不做取值白名单**（CLAUDE.md §3.6）：
   * 它是**上游定义**的枚举。利润表 HAR 只出现 all/Q1–Q4，据此拦截会挡掉
   * 资产负债表 HAR 中实际存在的 S0–S4。取值合法性交给上游的 4xx 判定。
   */
  protected normalizeFinanceParams(params: TParams): NormalizedFinanceParams {
    const rawSymbol = typeof params.symbol === "string" ? params.symbol.trim().toUpperCase() : "";

    if (!rawSymbol) {
      throw new MissingContextError(
        "缺少 symbol。标的代码形如 SH601127 / SZ000001，需来自上游检索结果，不要编造",
        { scope: this.id },
      );
    }

    if (!SYMBOL_SHAPE.test(rawSymbol)) {
      throw new InvalidParamsError(
        `symbol="${rawSymbol}" 形状非法。期望 {两位交易所前缀}{6位数字}，如 SH601127`,
        { scope: this.id, details: { symbol: rawSymbol } },
      );
    }

    const rawType = typeof params.type === "string" ? params.type.trim() : "";
    const type = rawType || "all";

    // 仅防注入的形状校验；取值是否被上游接受由上游判定
    if (!REPORT_TYPE_SHAPE.test(type)) {
      throw new InvalidParamsError(
        `type="${type}" 形状非法（仅允许字母数字，长度 1-8）`,
        { scope: this.id, details: { type } },
      );
    }

    const count = clampInt(params.count, DEFAULT_PAGE_SIZE, 1, 100);
    const maxPages = clampInt(params.maxPages, DEFAULT_MAX_PAGES, 1, 200);

    return { ...params, symbol: rawSymbol, type, count, maxPages };
  }
}

function clampInt(
  raw: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}
