import { Page } from "puppeteer-core";
import { EndpointMetadata, GoalOptions, RetryOptions } from "./interfaces";
import { getGoalMetadata, finalizeGoalMetadata } from "./decorators";
import { GoalContextImpl } from "./context";
import type { BaseGoal } from "./base";
import { validateResponse } from "./schema";
import { runStreamedEndpoint } from "./stream-executor";
import { currentRuntime } from "../runtime";
import {
  EndpointHttpError,
  EndpointTimeoutError,
  RetryExhaustedError,
  RiskControlError,
  toSpiderError,
  isRetryable,
  SpiderError,
} from "../errors";

// ============================================================================
// 工具函数
// ============================================================================

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveUrl(
  url: string,
  params: Record<string, unknown>,
  baseURL?: string,
): string {
  let resolved = url;
  for (const [key, value] of Object.entries(params)) {
    resolved = resolved.replace(`:${key}`, String(value));
  }
  if (baseURL && !resolved.startsWith("http")) {
    resolved = baseURL.replace(/\/$/, "") + "/" + resolved.replace(/^\//, "");
  }
  return resolved;
}

function buildQueryString(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null,
  );
  if (entries.length === 0) return "";
  return (
    "?" +
    entries
      .map(
        ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
      )
      .join("&")
  );
}

function mergeRetryOptions(
  defaults?: RetryOptions,
  override?: RetryOptions,
): RetryOptions {
  return {
    count: override?.count ?? defaults?.count ?? 3,
    delay: override?.delay ?? defaults?.delay ?? 1000,
    exponential: override?.exponential ?? defaults?.exponential ?? false,
  };
}

// ============================================================================
// HTTP 请求执行
// ============================================================================

interface ExecuteRequestOptions {
  url: string;
  method: string;
  body?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
  responseType?: "json" | "text" | "blob";
  /** fetch 凭证模式；缺省 "include"（向后兼容）。 */
  credentials?: RequestCredentials;
}

interface BrowserFetchResult {
  ok: boolean;
  status?: number;
  statusText?: string;
  /** Response payload — present when ok=true */
  payload?: unknown;
  /** Failure category — present when ok=false */
  errorKind?: "timeout" | "http" | "network" | "non-json";
  /** Failure detail */
  errorMessage?: string;
  /** 响应体开头片段 — 仅 errorKind="non-json" 时提供，用于诊断拦截页类型 */
  bodyHead?: string;
}

type BrowserFetchEvaluateOptions = ExecuteRequestOptions;

/**
 * 浏览器内 fetch — 不再 throw，统一返回 {ok, errorKind} 由调用方决定如何映射为 SpiderError。
 * 这样可以避免在 page.evaluate 边界丢失类型信息（错误跨边界后只剩 message）。
 */
async function browserFetch(
  page: Page,
  options: ExecuteRequestOptions,
): Promise<BrowserFetchResult> {
  const result = await page.evaluate(
    async (rawOpts: Record<string, unknown>): Promise<BrowserFetchResult> => {
      const opts = rawOpts as unknown as BrowserFetchEvaluateOptions;
      const controller = new AbortController();
      const timeoutId = opts.timeout
        ? setTimeout(() => controller.abort(), opts.timeout)
        : null;

      try {
        const headers: Record<string, string> = {
          Accept: "application/json, text/plain, */*",
          ...opts.headers,
        };

        const hasBody =
          opts.body != null && ["POST", "PUT", "PATCH"].includes(opts.method);

        // body 为 string → 视作已序列化（form-urlencoded / 自定义文本），
        //   保留调用方提供的 Content-Type；否则缺省为 form-urlencoded
        // body 为 object → JSON 序列化 + application/json
        let serializedBody: string | undefined;
        if (hasBody) {
          const hasCT = Object.keys(headers).some(
            (k) => k.toLowerCase() === "content-type",
          );
          if (typeof opts.body === "string") {
            serializedBody = opts.body;
            if (!hasCT) {
              headers["Content-Type"] =
                "application/x-www-form-urlencoded;charset=UTF-8";
            }
          } else {
            serializedBody = JSON.stringify(opts.body);
            if (!hasCT) {
              headers["Content-Type"] = "application/json;charset=UTF-8";
            }
          }
        }

        const fetchOptions: RequestInit = {
          method: opts.method,
          headers,
          credentials: opts.credentials ?? "include",
          signal: controller.signal,
        };
        if (serializedBody !== undefined) fetchOptions.body = serializedBody;

        const response = await fetch(opts.url, fetchOptions);

        if (!response.ok) {
          return {
            ok: false,
            status: response.status,
            statusText: response.statusText,
            errorKind: "http" as const,
            errorMessage: `HTTP ${response.status}: ${response.statusText}`,
          };
        }

        const rt = opts.responseType ?? "json";
        let payload: unknown;
        if (rt === "text") payload = await response.text();
        else if (rt === "blob") {
          const buf = await response.arrayBuffer();
          const bytes = new Uint8Array(buf);
          let binary = "";
          for (let i = 0; i < bytes.length; i++)
            binary += String.fromCharCode(bytes[i]);
          payload = btoa(binary);
        } else {
          // HTTP 200 却解析不出 JSON —— 最常见的成因是风控/验证页顶替了接口响应。
          // 先取文本再手动 parse（而非 response.json()），失败时才有 body 可供判别：
          // 空响应属瞬时故障可重试，有内容但不是 JSON 则需人工介入，两者处置相反。
          const text = await response.text();
          try {
            payload = JSON.parse(text);
          } catch {
            return {
              ok: false,
              status: response.status,
              errorKind: "non-json" as const,
              errorMessage: `expected JSON but got ${text.length} bytes of non-JSON`,
              bodyHead: text.slice(0, 200).replace(/\s+/g, " ").trim(),
            };
          }
        }

        return { ok: true, status: response.status, payload };
      } catch (err) {
        const e = err as Error;
        const isAbort = e.name === "AbortError";
        return {
          ok: false,
          errorKind: isAbort ? ("timeout" as const) : ("network" as const),
          errorMessage: e.message || String(err),
        };
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    },
    options as unknown as Record<string, unknown>,
  );
  return result as BrowserFetchResult;
}

interface ExecuteContext {
  goalId: string;
  methodName: string;
  /** 当前调用是第几次尝试（含重试）— 由 executeWithRetry 注入 */
  attempt?: number;
}

/**
 * 单次执行 — 把 BrowserFetchResult 映射为类型化错误或返回 payload。
 * 同时发射 endpoint.request / endpoint.response 事件（含完整 body 内容寻址）。
 */
async function executeOnce(
  page: Page,
  options: ExecuteRequestOptions,
  ctx: ExecuteContext,
): Promise<unknown> {
  const startedAt = Date.now();
  const attempt = ctx.attempt ?? 1;
  const requestRef = currentRuntime().blobs.put(
    {
      url: options.url,
      method: options.method,
      headers: options.headers ?? {},
      query: undefined,
      body: options.body ?? null,
    },
    "application/json",
  );
  currentRuntime().events.emit({
    kind: "endpoint.request",
    goalId: ctx.goalId,
    methodName: ctx.methodName,
    method: options.method,
    url: options.url,
    attempt,
    requestRef,
    headers: options.headers,
  });

  const result = await browserFetch(page, options);

  if (result.ok) {
    const responseRef = currentRuntime().blobs.put(
      result.payload,
      options.responseType === "blob"
        ? "application/octet-stream"
        : options.responseType === "text"
          ? "text/plain"
          : "application/json",
    );
    currentRuntime().events.emit({
      kind: "endpoint.response",
      goalId: ctx.goalId,
      methodName: ctx.methodName,
      method: options.method,
      url: options.url,
      attempt,
      status: "success",
      httpStatus: result.status,
      durationMs: Date.now() - startedAt,
      responseRef,
    });
    return result.payload;
  }

  const baseDetails = {
    goalId: ctx.goalId,
    methodName: ctx.methodName,
    url: options.url,
    method: options.method,
  };

  // 失败 — 也记录响应事件
  currentRuntime().events.emit({
    kind: "endpoint.response",
    goalId: ctx.goalId,
    methodName: ctx.methodName,
    method: options.method,
    url: options.url,
    attempt,
    status: "failure",
    httpStatus: result.status,
    durationMs: Date.now() - startedAt,
    errorKind: result.errorKind,
    errorMessage: result.errorMessage,
  });

  if (result.errorKind === "timeout") {
    throw new EndpointTimeoutError(
      `Endpoint "${ctx.methodName}" timed out after ${options.timeout}ms`,
      {
        scope: ctx.methodName,
        details: { ...baseDetails, timeoutMs: options.timeout },
      },
    );
  }
  if (result.errorKind === "http") {
    throw new EndpointHttpError(
      `Endpoint "${ctx.methodName}" failed: ${result.errorMessage}`,
      {
        scope: ctx.methodName,
        details: {
          ...baseDetails,
          status: result.status,
          statusText: result.statusText,
        },
      },
    );
  }
  if (result.errorKind === "non-json") {
    // HTTP 200 但响应体不是 JSON。按 body 是否为空分流 —— 处置完全相反：
    //   空壳（0 字节）：上游对超大响应的偶发故障 → 退避重试
    //   有内容：验证码页 / 滑块 / 登录跳转顶替了接口 → 熔断并等人工，
    //           自动重试只会朝着正在拦截你的服务器继续打，加剧封禁
    // 与 kind-meta 的 risk-control trigger「下载到 HTML 拦截页」同源。
    const head = result.bodyHead ?? "";
    if (head.length === 0) {
      throw new EndpointHttpError(
        `Endpoint "${ctx.methodName}" 响应体为空（HTTP ${result.status}），可重试`,
        { scope: ctx.methodName, details: { ...baseDetails, status: result.status } },
      );
    }
    throw new RiskControlError(
      `Endpoint "${ctx.methodName}" 期望 JSON 却收到非 JSON 响应` +
        `（HTTP ${result.status}，开头 "${head}"）——疑似风控拦截页/验证页，` +
        `请检查浏览器会话是否需要人工过验证；禁止自动重试`,
      {
        scope: ctx.methodName,
        details: { ...baseDetails, status: result.status, bodyHead: head },
      },
    );
  }
  // network / unknown
  throw new SpiderError({
    kind: "endpoint-http",
    message: `Endpoint "${ctx.methodName}" network error: ${result.errorMessage}`,
    scope: ctx.methodName,
    details: baseDetails,
  });
}

/**
 * 带重试包装 — 重试时保留首个错误链；只对 isRetryable=true 的错误重试。
 * 重试耗尽时抛 RetryExhaustedError，cause 指向最后一次失败的 SpiderError。
 */
async function executeWithRetry(
  page: Page,
  options: ExecuteRequestOptions,
  retry: RetryOptions,
  ctx: ExecuteContext,
): Promise<unknown> {
  let lastError: SpiderError | undefined;

  for (let attempt = 0; attempt <= retry.count; attempt++) {
    try {
      return await executeOnce(page, options, { ...ctx, attempt: attempt + 1 });
    } catch (err) {
      const spider =
        err instanceof SpiderError
          ? err
          : toSpiderError(err, "endpoint-http", { scope: ctx.methodName });
      lastError = spider;

      const exhausted = attempt >= retry.count;
      const retryable = isRetryable(spider.kind);

      if (exhausted || !retryable) {
        if (exhausted && retryable) {
          throw new RetryExhaustedError(
            `Endpoint "${ctx.methodName}" failed after ${retry.count + 1} attempts: ${spider.message}`,
            {
              scope: ctx.methodName,
              cause: spider,
              details: {
                attempts: retry.count + 1,
                lastKind: spider.kind,
                url: options.url,
              },
            },
          );
        }
        throw spider;
      }

      const delayMs = retry.exponential
        ? retry.delay! * Math.pow(2, attempt)
        : retry.delay!;
      currentRuntime().events.emitError({
        errorKind: "endpoint-retry",
        category: "retry",
        phase: "endpoint",
        scope: `${ctx.goalId}.${ctx.methodName}`,
        message: "Endpoint retry scheduled",
        error: spider,
        retryable: true,
        details: {
          goalId: ctx.goalId,
          methodName: ctx.methodName,
          attempt: attempt + 1,
          of: retry.count,
          kind: spider.kind,
          nextDelayMs: delayMs,
        },
      });
      await delay(delayMs);
    }
  }

  // 理论不可达
  throw lastError ?? new Error("executeWithRetry: unexpected exit");
}

// ============================================================================
// Goal 执行器
// ============================================================================

type GoalInstance = Record<string, (...args: unknown[]) => unknown>;

/**
 * 执行业务侧投影函数（goalFn[methodName]）并发射 endpoint.projection 事件。
 *
 * 与 endpoint.response 配合使用：
 *   - response 记录原始 payload
 *   - projection 记录投影后产物（每页 / 每 item / 每 single 一条）
 *
 * 即使 endpoint 未声明对应方法，也会用一个 noop 投影发射事件，
 * 这样可观测链路始终是完整的。
 */
function runProjection(
  goalFn: GoalInstance,
  ctx: {
    goalId: string;
    methodName: string;
    url: string;
    mode: "single" | "paginated" | "expanded";
    page?: number;
    itemIndex?: number;
  },
  validated: unknown,
  fallback: () => unknown,
  invokeWithMethod: (fn: (...args: unknown[]) => unknown) => unknown,
): unknown {
  const startedAt = Date.now();
  const fn = goalFn[ctx.methodName];
  const hasProjection = typeof fn === "function";
  try {
    const projected = hasProjection ? invokeWithMethod(fn) : fallback();
    const projectionRef = currentRuntime().blobs.put(projected, "application/json");
    currentRuntime().events.emit({
      kind: "endpoint.projection",
      goalId: ctx.goalId,
      methodName: ctx.methodName,
      url: ctx.url,
      mode: ctx.mode,
      page: ctx.page,
      itemIndex: ctx.itemIndex,
      status: "success",
      durationMs: Date.now() - startedAt,
      hasProjection,
      projectionRef,
    });
    return projected;
  } catch (err) {
    const e = err as Error;
    currentRuntime().events.emit({
      kind: "endpoint.projection",
      goalId: ctx.goalId,
      methodName: ctx.methodName,
      url: ctx.url,
      mode: ctx.mode,
      page: ctx.page,
      itemIndex: ctx.itemIndex,
      status: "failure",
      durationMs: Date.now() - startedAt,
      hasProjection,
      errorKind: (e as { name?: string }).name,
      errorMessage: e.message || String(err),
    });
    throw err;
  }
}

export interface GoalExecutorOptions {
  /** 兼容旧调用；当前执行链默认不打印日志。 */
  silent?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function defaultPaginatedProjection(validated: unknown): unknown[] {
  if (isRecord(validated)) {
    if (Array.isArray(validated.list)) return validated.list;
    if (Array.isArray(validated.data)) return validated.data;
  }
  return [validated];
}

export class GoalExecutor {
  async execute<T>(
    goal: BaseGoal<T>,
    page: Page,
    params?: Record<string, unknown>,
    execOptions?: GoalExecutorOptions,
  ): Promise<T> {
    void execOptions;

    finalizeGoalMetadata(goal);

    const metadata = getGoalMetadata(goal.constructor);
    if (!metadata) {
      throw new SpiderError({
        kind: "pipeline-error",
        message:
          "Goal metadata not found. Make sure the class is decorated with @Goal.",
        scope: "GoalExecutor",
      });
    }

    const { options, endpoints, aggregateMethod } = metadata;

    if (!aggregateMethod) {
      throw new SpiderError({
        kind: "pipeline-error",
        message: `Goal "${options.id}" is missing an @Aggregate method.`,
        scope: options.id,
      });
    }

    const goalInstance = goal as unknown as GoalInstance;
    if (typeof goalInstance[aggregateMethod] !== "function") {
      throw new SpiderError({
        kind: "pipeline-error",
        message: `Goal "${options.id}" declares aggregate method "${aggregateMethod}" but it does not exist on the Goal instance.`,
        scope: options.id,
      });
    }
    for (const [methodName] of endpoints) {
      if (typeof goalInstance[methodName] !== "function") {
        throw new SpiderError({
          kind: "pipeline-error",
          message: `Goal "${options.id}" declares endpoint "${methodName}" but it does not exist on the Goal instance.`,
          scope: options.id,
        });
      }
    }

    return currentRuntime().tracer.span(
      "goal",
      { goalId: options.id },
      async ({ spanId, parentSpanId }) => {
        const startedAt = Date.now();
        currentRuntime().events.emit({
          kind: "goal.start",
          spanId,
          parentSpanId,
          goalId: options.id,
          goalName: options.name,
        });
        try {
          const context = new GoalContextImpl(page, options.id, params || {});
          context.registerKnownEndpoints(endpoints.keys());

          const order = this.resolveExecutionOrder(endpoints);

          for (const methodName of order) {
            const endpoint = endpoints.get(methodName)!;
            await this.executeEndpoint(goal, endpoint, context, options);
          }

          const result = await goalInstance[aggregateMethod](context);

          currentRuntime().events.emit({
            kind: "goal.end",
            spanId,
            parentSpanId,
            goalId: options.id,
            goalName: options.name,
            durationMs: Date.now() - startedAt,
            status: "success",
            endpointCount: order.length,
          });
          return result as T;
        } catch (err) {
          currentRuntime().events.emit({
            kind: "goal.end",
            spanId,
            parentSpanId,
            goalId: options.id,
            goalName: options.name,
            durationMs: Date.now() - startedAt,
            status: "failure",
            errorMessage: err instanceof Error ? err.message : String(err),
          });
          throw err;
        }
      },
    );
  }

  private resolveExecutionOrder(
    endpoints: Map<string, EndpointMetadata>,
  ): string[] {
    const order: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const dependencies = new Map<string, Set<string>>();

    for (const [methodName, endpoint] of endpoints) {
      const deps = new Set<string>();
      if (endpoint.paginated?.dependencies) {
        for (const dep of endpoint.paginated.dependencies) deps.add(dep);
      } else if (endpoint.expanded?.dependencies) {
        for (const dep of endpoint.expanded.dependencies) deps.add(dep);
      } else if (endpoint.streamed?.dependencies) {
        for (const dep of endpoint.streamed.dependencies) deps.add(dep);
      } else if (endpoint.options.dependencies) {
        for (const dep of endpoint.options.dependencies) deps.add(dep);
      }
      dependencies.set(methodName, deps);
    }

    const visit = (methodName: string): void => {
      if (visited.has(methodName)) return;
      if (visiting.has(methodName)) {
        throw new SpiderError({
          kind: "pipeline-error",
          message: `Circular dependency detected involving "${methodName}"`,
          scope: "GoalExecutor",
        });
      }
      visiting.add(methodName);
      const deps = dependencies.get(methodName) ?? new Set<string>();
      for (const dep of deps) {
        if (!endpoints.has(dep)) {
          throw new SpiderError({
            kind: "pipeline-error",
            message: `Endpoint "${methodName}" depends on "${dep}", but "${dep}" does not exist.`,
            scope: "GoalExecutor",
          });
        }
        visit(dep);
      }
      visiting.delete(methodName);
      visited.add(methodName);
      order.push(methodName);
    };

    for (const [methodName] of endpoints) visit(methodName);
    return order;
  }

  private async executeEndpoint(
    goal: BaseGoal,
    endpoint: EndpointMetadata,
    context: GoalContextImpl,
    goalOptions: GoalOptions,
  ): Promise<void> {
    const { methodName, paginated, expanded, streamed } = endpoint;

    let result: unknown;
    if (paginated) {
      result = await this.executePaginated(
        goal,
        endpoint,
        context,
        goalOptions,
      );
    } else if (expanded) {
      result = await this.executeExpanded(goal, endpoint, context, goalOptions);
    } else if (streamed) {
      result = await this.executeStreamed(goal, endpoint, context, goalOptions);
    } else {
      result = await this.executeSingle(goal, endpoint, context, goalOptions);
    }
    context.setResult(methodName, result);
  }

  private async executeSingle(
    goal: BaseGoal,
    endpoint: EndpointMetadata,
    context: GoalContextImpl,
    goalOptions: GoalOptions,
  ): Promise<unknown> {
    const { methodName, url, options } = endpoint;
    const defaults = goalOptions.defaults || {};

    const body =
      typeof options.body === "function" ? options.body(context) : options.body;
    const headers =
      typeof options.headers === "function"
        ? options.headers(context)
        : options.headers;
    const query =
      typeof options.query === "function"
        ? options.query(context)
        : options.query;

    let fullUrl = resolveUrl(url, {}, goalOptions.baseURL);
    if (query) fullUrl += buildQueryString(query);

    const retry = mergeRetryOptions(defaults.retry, options.retry);
    const timeout = options.timeout ?? defaults.timeout ?? 30000;

    const response = await executeWithRetry(
      context.page,
      {
        url: fullUrl,
        method: options.method,
        body,
        headers,
        timeout,
        responseType: options.responseType,
        credentials: options.credentials ?? defaults.credentials,
      },
      retry,
      { goalId: goalOptions.id, methodName },
    );

    // ── Schema 校验 ──
    const validated = options.schema
      ? validateResponse(response, options.schema, {
          goalId: goalOptions.id,
          methodName,
          url: fullUrl,
        })
      : response;

    const goalFn = goal as unknown as GoalInstance;
    return runProjection(
      goalFn,
      {
        goalId: goalOptions.id,
        methodName,
        url: fullUrl,
        mode: "single",
      },
      validated,
      () => validated,
      (fn) => fn(validated),
    );
  }

  // ──────────────────────────────────────────────────────────────────────
  // 分页
  // ──────────────────────────────────────────────────────────────────────

  private async executePaginated(
    goal: BaseGoal,
    endpoint: EndpointMetadata,
    context: GoalContextImpl,
    goalOptions: GoalOptions,
  ): Promise<unknown[]> {
    const { methodName, url, options, paginated } = endpoint;
    const defaults = goalOptions.defaults || {};
    const paginatedOpts = paginated!;

    let accumulated: unknown[] = [];
    let currentPage = 1;
    let cursor: string | undefined;

    while (true) {
      if (paginatedOpts.maxPages && currentPage > paginatedOpts.maxPages) {
        break;
      }

      const params = paginatedOpts.params(context, currentPage, cursor);
      let fullUrl = resolveUrl(url, params, goalOptions.baseURL);

      const queryParams = { ...params };
      for (const key of Object.keys(params)) {
        if (url.includes(`:${key}`)) delete queryParams[key];
      }

      if (options.method === "GET" || paginatedOpts.body) {
        const qs = buildQueryString(queryParams);
        if (qs) fullUrl += qs;
      }

      const bodyData = paginatedOpts.body
        ? paginatedOpts.body(context, currentPage)
        : options.method !== "GET"
          ? params
          : undefined;

      const retry = mergeRetryOptions(defaults.retry, options.retry);
      const timeout = options.timeout ?? defaults.timeout ?? 30000;
      const interval = paginatedOpts.interval ?? defaults.interval ?? 1000;

      const response = await executeWithRetry(
        context.page,
        {
          url: fullUrl,
          method: options.method,
          body: bodyData,
          headers:
            typeof options.headers === "function"
              ? options.headers(context)
              : options.headers,
          timeout,
          responseType: options.responseType,
          credentials: options.credentials ?? defaults.credentials,
        },
        retry,
        { goalId: goalOptions.id, methodName },
      );

      const validated = options.schema
        ? validateResponse(response, options.schema, {
            goalId: goalOptions.id,
            methodName,
            url: fullUrl,
          })
        : response;

      const goalFn = goal as unknown as GoalInstance;
      const pageResult = runProjection(
        goalFn,
        {
          goalId: goalOptions.id,
          methodName,
          url: fullUrl,
          mode: "paginated",
          page: currentPage,
        },
        validated,
        () => defaultPaginatedProjection(validated),
        (fn) => fn(validated, currentPage),
      ) as unknown[];

      accumulated = [...accumulated, ...pageResult];

      if (paginatedOpts.stopWhen?.(validated, currentPage, accumulated)) {
        break;
      }
      if (paginatedOpts.cursor) {
        cursor = paginatedOpts.cursor.getNext(validated) ?? undefined;
        if (!cursor) break;
      }

      currentPage++;
      if (interval > 0) await delay(interval);
    }

    return accumulated;
  }

  // ──────────────────────────────────────────────────────────────────────
  // 展开
  // ──────────────────────────────────────────────────────────────────────

  /**
   * 流式端点执行 —— 承载「响应体读不完」的推送类协议。
   *
   * 与 executeSingle 的差异只在「怎么拿数据」：单次请求是 await 完整响应，
   * 流式是 reduce 累积到 until 满足。拿到累加器之后的处理（schema 校验、
   * 方法体投影、事件发射）完全一致，因此复用同一套 runProjection。
   *
   * ⚠️ `EndpointOptions.timeout` 对流式端点**不生效** —— 那是「整个请求的上限」，
   * 会把一条正常的长连接掐断。时间控制走 @Streamed 的 idleTimeout / maxDuration。
   */
  private async executeStreamed(
    goal: BaseGoal,
    endpoint: EndpointMetadata,
    context: GoalContextImpl,
    goalOptions: GoalOptions,
  ): Promise<unknown> {
    const { methodName, url, options, streamed } = endpoint;
    const defaults = goalOptions.defaults || {};
    const streamedOpts = streamed!;

    const body =
      typeof options.body === "function" ? options.body(context) : options.body;
    const headers =
      typeof options.headers === "function"
        ? options.headers(context)
        : options.headers;
    const query =
      typeof options.query === "function"
        ? options.query(context)
        : options.query;

    let fullUrl = resolveUrl(url, {}, goalOptions.baseURL);
    if (query) fullUrl += buildQueryString(query);

    const startedAt = Date.now();
    currentRuntime().events.emit({
      kind: "endpoint.request",
      goalId: goalOptions.id,
      methodName,
      method: options.method,
      url: fullUrl,
      attempt: 1,
      headers,
    });

    const outcome = await runStreamedEndpoint(
      context.page,
      {
        url: fullUrl,
        method: options.method,
        headers,
        body: typeof body === "string" ? body : body ? JSON.stringify(body) : undefined,
        credentials: options.credentials ?? defaults.credentials,
      },
      streamedOpts,
      context,
      `${goalOptions.id}.${methodName}`,
    );

    currentRuntime().events.emit({
      kind: "endpoint.response",
      goalId: goalOptions.id,
      methodName,
      method: options.method,
      url: fullUrl,
      attempt: 1,
      status: "success",
      durationMs: Date.now() - startedAt,
      responseRef: currentRuntime().blobs.put(
        {
          eventCount: outcome.eventCount,
          stopReason: outcome.stopReason,
          truncated: outcome.truncated,
        },
        "application/json",
      ),
    });

    const validated = options.schema
      ? validateResponse(outcome.acc, options.schema, {
          goalId: goalOptions.id,
          methodName,
          url: fullUrl,
        })
      : outcome.acc;

    const goalFn = goal as unknown as GoalInstance;
    return runProjection(
      goalFn,
      {
        goalId: goalOptions.id,
        methodName,
        url: fullUrl,
        mode: "single",
      },
      validated,
      () => validated,
      (fn) => fn(validated),
    );
  }

  private async executeExpanded(
    goal: BaseGoal,
    endpoint: EndpointMetadata,
    context: GoalContextImpl,
    goalOptions: GoalOptions,
  ): Promise<unknown[]> {
    const { methodName, url, options, expanded } = endpoint;
    const defaults = goalOptions.defaults || {};
    const expandedOpts = expanded!;

    const sourceData = expandedOpts.source(context);
    const filtered = expandedOpts.filter
      ? sourceData.filter((item, index) =>
          expandedOpts.filter!(item, index, context),
        )
      : sourceData;

    const results: unknown[] = [];
    const concurrency = expandedOpts.concurrency ?? defaults.concurrency ?? 3;
    const interval = expandedOpts.interval ?? defaults.interval ?? 1000;
    const retry = mergeRetryOptions(defaults.retry, expandedOpts.retry);
    const timeout = options.timeout ?? defaults.timeout ?? 30000;

    const indexed = filtered.map((item, index) => ({ item, index }));
    const chunks = this.chunkArray(indexed, concurrency);

    for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
      const chunk = chunks[chunkIdx];
      const chunkResults = await Promise.all(
        chunk.map(async ({ item, index: globalIndex }) => {
          const params = expandedOpts.params(item, globalIndex, context);
          let fullUrl = resolveUrl(url, params, goalOptions.baseURL);
          const queryParams = { ...params };
          for (const key of Object.keys(params)) {
            if (url.includes(`:${key}`)) delete queryParams[key];
          }
          if (options.method === "GET" || expandedOpts.body) {
            const qs = buildQueryString(queryParams);
            if (qs) fullUrl += qs;
          }
          const bodyData = expandedOpts.body
            ? expandedOpts.body(item, globalIndex, context)
            : options.method !== "GET"
              ? params
              : undefined;

          const response = await executeWithRetry(
            context.page,
            {
              url: fullUrl,
              method: options.method,
              body: bodyData,
              headers:
                typeof options.headers === "function"
                  ? options.headers(context)
                  : options.headers,
              timeout,
              responseType: options.responseType,
              credentials: options.credentials ?? defaults.credentials,
            },
            retry,
            { goalId: goalOptions.id, methodName },
          );

          const validated = options.schema
            ? validateResponse(response, options.schema, {
                goalId: goalOptions.id,
                methodName,
                url: fullUrl,
              })
            : response;

          const goalFn = goal as unknown as GoalInstance;
          return runProjection(
            goalFn,
            {
              goalId: goalOptions.id,
              methodName,
              url: fullUrl,
              mode: "expanded",
              itemIndex: globalIndex,
            },
            validated,
            () => validated,
            (fn) => fn(validated, item),
          );
        }),
      );
      results.push(...chunkResults);
      if (interval > 0 && chunkIdx < chunks.length - 1) await delay(interval);
    }

    return results;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

export function createGoalExecutor(_logger?: unknown): GoalExecutor {
  void _logger;
  return new GoalExecutor();
}
