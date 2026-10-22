import { Page } from "puppeteer-core";
import type { EndpointSchemaOptions } from "./schema";
import type { StreamedOptions } from "./streamed";

// ============================================================================
// 基础类型
// ============================================================================

export interface RetryOptions {
  count: number;
  delay?: number;
  exponential?: boolean;
}

export interface GoalDefaults {
  retry?: RetryOptions;
  interval?: number;
  concurrency?: number;
  timeout?: number;
  /**
   * 浏览器内 fetch 的凭证模式（透传给 page.evaluate 的 fetch credentials）。
   * 默认 "include"（携带 Cookie，适配需登录态 + CORS 反射具体 origin 的站点）。
   * 公开接口若返回 `Access-Control-Allow-Origin: *`，带凭证会被浏览器拒绝
   * （CORS 规范：ACAO=* 与 credentials 互斥），此时应显式设为 "omit"。
   */
  credentials?: RequestCredentials;
}

// ============================================================================
// Goal 配置
// ============================================================================

export interface GoalOptions {
  id: string;
  name: string;
  baseURL?: string;
  defaults?: GoalDefaults;
}

// ============================================================================
// Endpoint 配置
// ============================================================================

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export interface EndpointOptions<TBody = unknown> {
  method: HttpMethod;
  dependencies?: string[];
  body?: TBody | ((ctx: GoalContext) => TBody);
  headers?:
    | Record<string, string>
    | ((ctx: GoalContext) => Record<string, string>);
  query?:
    | Record<string, unknown>
    | ((ctx: GoalContext) => Record<string, unknown>);
  retry?: RetryOptions;
  timeout?: number;
  responseType?: "json" | "text" | "blob";
  /** 凭证模式覆盖（优先级高于 Goal defaults.credentials）。 */
  credentials?: RequestCredentials;
  /**
   * 响应 schema 校验（推荐 zod schema）。
   * 只校验你声明的字段，未声明字段允许漂移（zod 用 .passthrough()）。
   * 校验失败时抛 UpstreamShapeChangedError；可通过 schema.onMismatch="warn" 改为软告警。
   */
  schema?: EndpointSchemaOptions;
}

// ============================================================================
// Paginated / Expanded 配置（保持原结构）
// ============================================================================

export interface PaginatedOptions<TResponse, TItem> {
  dependencies?: string[];
  pageSize: number;
  maxPages?: number;
  interval?: number;
  params: (
    ctx: GoalContext,
    page: number,
    cursor?: string,
  ) => Record<string, unknown>;
  stopWhen?: (
    response: TResponse,
    page: number,
    accumulated: TItem[],
  ) => boolean;
  body?: (ctx: GoalContext, page: number) => unknown;
  cursor?: {
    getNext: (response: TResponse) => string | null | undefined;
    param?: string;
  };
  [key: string]: unknown;
}

export interface ExpandedOptions<TSource, TResult> {
  dependencies?: string[];
  source: (ctx: GoalContext) => TSource[];
  params: (
    item: TSource,
    index: number,
    ctx: GoalContext,
  ) => Record<string, unknown>;
  body?: (item: TSource, index: number, ctx: GoalContext) => unknown;
  concurrency?: number;
  interval?: number;
  retry?: RetryOptions;
  filter?: (item: TSource, index: number, ctx: GoalContext) => boolean;
}

// ============================================================================
// GoalContext — 类型化参数
// ============================================================================

/**
 * Goal 执行上下文。
 *
 * `TParams` 默认 `Record<string, unknown>` 以兼容旧用法；
 * Skill 端可在 `createGoal` 时通过 `new MyGoal<MyParams>()` 收窄。
 */
export interface GoalContext<TParams extends object = Record<string, unknown>> {
  get<T>(methodName: string): T;
  has(methodName: string): boolean;
  readonly page: Page;
  readonly params: TParams;
  readonly goalId: string;
}

// ============================================================================
// 元数据类型
// ============================================================================

export interface EndpointMetadata {
  url: string;
  options: EndpointOptions;
  methodName: string;
  paginated?: PaginatedOptions<unknown, unknown>;
  expanded?: ExpandedOptions<unknown, unknown>;
  /** 流式端点配置（@Streamed）。可选字段 —— 存量端点恒为 undefined，走不进流式分支 */
  streamed?: StreamedOptions<unknown, unknown>;
}

export interface GoalMetadataStore {
  options: GoalOptions;
  endpoints: Map<string, EndpointMetadata>;
  aggregateMethod?: string;
}
