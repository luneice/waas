/**
 * 批量截面扫描 Goal
 *
 * POST /<market>/scan —— 一次请求取多标的的指定字段快照。
 *
 * ══════════════ market 为什么用 @Expanded 承载 ══════════════
 *
 * `market` 是**路径段**而非查询参数，而 `@Endpoint` 的 url 是类级静态字符串。
 * 框架对**非分页端点**调 `resolveUrl(url, {}, baseURL)`（空参数对象，不做
 * `:market` 替换），但 `@Expanded` 会传 `params` 进 `resolveUrl` 并把用于
 * 路径的 key 从 query 中剔除 —— 因此单元素 `@Expanded` 正是承载动态路径段的手段。
 *
 * 曾经的写法是「抽象基类 + 每个域一个子类 + 工厂分派」。那在域是**闭合小集合**
 * 时成立（如 xhs 的 4 个固定 Tab），但本站是**全球全资产**平台，实测至少 20 个
 * 扫描域（global / america / japan / crypto / futures / forex / …）且随时可能
 * 新增国别域——为每个域写一个类既不可扩展，也会诱使人用白名单拦截入参。
 *
 * 响应 `d` 是**位置数组**（与请求 columns 严格按下标对应），不是键值对象。
 * 请求侧的 columns 顺序是唯一解码键；形状校验交给 `@Endpoint({schema})`
 * 由框架统一抛 UpstreamShapeChangedError，不手写 if 判断。
 */
import { BaseGoal, Goal, Endpoint, Expanded, Aggregate } from "@spider/core";
import type { GoalContext, ResponseValidator } from "@spider/core";
import { TV_SCANNER_HOST } from "@src/constants";
import { TV_GOAL_DEFAULTS } from "@src/thrall/shared";
import type {
  RawScanResponse,
  RawScanRow,
  TvScanFilter,
  TvScanResult,
  TvScanRow,
} from "@src/types/scan.types";

/**
 * 响应形状守卫 —— 实现 core 的 `ResponseValidator` 接口（`safeParse`）。
 *
 * 刻意不引入 zod：它在 node_modules 里只是**传递依赖**，本仓无任何包声明它，
 * 引入会进 bundle 与每个消费方的部署面（CLAUDE.md §3.1）。而 core 的 schema
 * 契约本就与 zod 解耦——「任何实现 ResponseValidator 接口的对象都可以」。
 */
const scanResponseSchema: ResponseValidator<RawScanResponse> = {
  safeParse(input: unknown) {
    if (input === null || typeof input !== "object") {
      return {
        success: false as const,
        error: { message: "响应不是对象（可能是拦截页或站点改版）" },
      };
    }
    const obj = input as RawScanResponse;
    if (obj.data !== undefined && !Array.isArray(obj.data)) {
      return {
        success: false as const,
        error: { message: "data 字段不是数组" },
      };
    }
    return { success: true as const, data: obj };
  },
};

export interface ScanGoalParams extends Record<string, unknown> {
  /** 扫描域（URL 路径段）—— 开放集合，不做枚举拦截 */
  market: string;
  columns: string[];
  tickers: string[] | null;
  filter: TvScanFilter[] | null;
  preset: string | null;
  sortBy: string | null;
  sortOrder: string;
  range: [number, number];
  lang: string;
  /** 因不在扫描索引内被丢弃的 ticker（由 Skill 层预先分流） */
  droppedTickers: string[];
}

/**
 * 请求体构造。
 *
 * ⚠️ **必须返回字符串而非对象**，且配 `Content-Type: text/plain`：
 * 上游的 `access-control-allow-headers` 只允许 `Referer,Accept`，
 * 用 `application/json` 会触发 CORS 预检并被拒（实测 `Failed to fetch`）；
 * `text/plain` 属简单请求，不触发预检。这也是 HAR 里的真实 Content-Type。
 *
 * core 的约定：body 为 string 时保留调用方给的 Content-Type，不代为改写。
 */
function buildScanBody(ctx: GoalContext<ScanGoalParams>): string {
  const p = ctx.params;
  return JSON.stringify({
    columns: p.columns,
    ...(p.tickers ? { symbols: { tickers: p.tickers } } : {}),
    ...(p.filter ? { filter: p.filter } : {}),
    ...(p.preset ? { preset: p.preset } : {}),
    ...(p.sortBy ? { sort: { sortBy: p.sortBy, sortOrder: p.sortOrder } } : {}),
    range: p.range,
    options: { lang: p.lang },
  });
}

/** 按请求 columns 顺序把位置数组还原成键值对 */
function toRow(raw: RawScanRow, columns: readonly string[]): TvScanRow {
  const values: Record<string, unknown> = {};
  const d = Array.isArray(raw.d) ? raw.d : [];
  columns.forEach((col, i) => {
    values[col] = i < d.length ? d[i] : null;
  });
  return { ticker: raw.s ?? "", values };
}

@Goal({
  id: "tv-scan",
  name: "批量截面扫描",
  baseURL: TV_SCANNER_HOST,
  // 截面扫描接口返回 access-control-allow-credentials: true，可沿用默认 include
  defaults: TV_GOAL_DEFAULTS,
})
export class ScannerScanGoal extends BaseGoal<TvScanResult, ScanGoalParams> {
  /**
   * 单元素 `@Expanded` —— 只为让 `:market` 路径段参与 `resolveUrl` 替换。
   * source 恒为单元素数组，因此实际只发一次请求。
   */
  @Endpoint("/:market/scan", {
    method: "POST",
    schema: { schema: scanResponseSchema },
  })
  @Expanded<string, RawScanResponse>({
    source: (ctx) => [(ctx.params as ScanGoalParams).market],
    params: (market) => ({ market }),
    body: (_market, _index, ctx) =>
      buildScanBody(ctx as GoalContext<ScanGoalParams>),
    concurrency: 1,
  })
  fetchScan(response: RawScanResponse): RawScanResponse {
    return response;
  }

  @Aggregate()
  aggregate(ctx: GoalContext<ScanGoalParams>): TvScanResult {
    const p = ctx.params;
    // @Expanded 的结果是数组，单元素取第一个
    const responses = ctx.get<RawScanResponse[]>("fetchScan") ?? [];
    const resp = responses[0];
    const rawRows = Array.isArray(resp?.data) ? resp.data : [];

    return {
      query: {
        market: p.market,
        columns: p.columns,
        tickers: p.tickers,
        filter: p.filter,
        preset: p.preset,
        sortBy: p.sortBy,
        sortOrder: p.sortOrder,
        range: p.range,
        lang: p.lang,
      },
      rows: rawRows.map((r) => toRow(r, p.columns)),
      totalCount: Number.isFinite(resp?.totalCount)
        ? Number(resp!.totalCount)
        : rawRows.length,
      droppedTickers: p.droppedTickers,
      crawledAt: new Date(),
    };
  }
}
