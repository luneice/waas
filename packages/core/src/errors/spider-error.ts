import {
  categoryOf,
  isRetryable,
  type FailureCategory,
  type SkillFailureKind,
} from "./kinds";

// ============================================================================
// SpiderError — 所有爬虫异常的顶层抽象基类
// ============================================================================

export interface SpiderErrorInit {
  /** 标准化错误分类（必填） */
  kind: SkillFailureKind;
  /** 人类可读消息 */
  message: string;
  /** 发生阶段（lifecycle stage 名 / "navigate" / "fetch" / "endpoint" 等） */
  phase?: string;
  /** 相关的 Skill / Goal / endpoint 标识（可选） */
  scope?: string;
  /** 结构化补充信息 — 进入失败结果的 metadata.errorInfo.details */
  details?: Record<string, unknown>;
  /** 链式原因 */
  cause?: unknown;
}

/**
 * SpiderError — 框架内部统一抛出的错误基类。
 *
 * 所有更具体的错误（BrowserError / AuthError / ...）都继承自它，
 * 并锁定 `kind` 到对应的子集，但仍然共享同一种结构化负载。
 *
 * 与 plain Error 的区别：
 *   - kind 是判别字段，buildFailure() 会把它直接放进 metadata.errorInfo.kind
 *   - phase / scope / details 让 AI 消费方能判断"在哪个步骤、哪个端点出错"
 *   - cause 串起原始底层异常，logger 输出时一并展开
 */
export class SpiderError extends Error {
  readonly kind: SkillFailureKind;
  readonly category: FailureCategory;
  readonly phase?: string;
  readonly scope?: string;
  readonly details?: Record<string, unknown>;
  readonly cause?: unknown;

  constructor(init: SpiderErrorInit) {
    super(init.message);
    this.name = this.constructor.name;
    this.kind = init.kind;
    this.category = categoryOf(init.kind);
    this.phase = init.phase;
    this.scope = init.scope;
    this.details = init.details;
    this.cause = init.cause;
  }

  /** 是否值得重试（粗分类，可被 RetryPolicy 进一步收敛） */
  isRetryable(): boolean {
    return isRetryable(this.kind);
  }

  /** 序列化为 AI 可消费的紧凑 JSON 结构 */
  toErrorInfo(): SpiderErrorInfo {
    return {
      kind: this.kind,
      category: this.category,
      message: this.message,
      phase: this.phase,
      scope: this.scope,
      details: this.details,
      cause: this.cause ? formatCause(this.cause) : undefined,
    };
  }
}

/** AI 消费者看到的错误结构（出现在 SkillResultFailure.metadata.errorInfo） */
export interface SpiderErrorInfo {
  kind: SkillFailureKind;
  category: FailureCategory;
  message: string;
  phase?: string;
  scope?: string;
  details?: Record<string, unknown>;
  /** 原始底层错误的展开（避免循环引用，仅取 message + 简短 stack） */
  cause?: { name?: string; message: string };
}

function formatCause(cause: unknown): { name?: string; message: string } {
  if (cause instanceof Error) {
    return { name: cause.name, message: cause.message };
  }
  return { message: String(cause) };
}

// ============================================================================
// 中层分类基类（给类型收窄用） — 仍然是 SpiderError，只是限制 kind 子集
// ============================================================================

abstract class TypedSpiderError<
  K extends SkillFailureKind,
> extends SpiderError {
  declare readonly kind: K;
  constructor(
    kind: K,
    message: string,
    init: Omit<SpiderErrorInit, "kind" | "message">,
  ) {
    super({ ...init, kind, message });
  }
}

// ── 浏览器 ──

export class BrowserUnavailableError extends TypedSpiderError<"browser-unavailable"> {
  constructor(
    message: string,
    init: Omit<SpiderErrorInit, "kind" | "message"> = {},
  ) {
    super("browser-unavailable", message, init);
  }
}

export class BrowserAcquireTimeoutError extends TypedSpiderError<"browser-acquire-timeout"> {
  constructor(
    message: string,
    init: Omit<SpiderErrorInit, "kind" | "message"> = {},
  ) {
    super("browser-acquire-timeout", message, init);
  }
}

export class NavigationFailedError extends TypedSpiderError<"navigation-failed"> {
  constructor(
    message: string,
    init: Omit<SpiderErrorInit, "kind" | "message"> = {},
  ) {
    super("navigation-failed", message, init);
  }
}

// ── 鉴权 ──

export class NotLoggedInError extends TypedSpiderError<"not-logged-in"> {
  constructor(
    message: string,
    init: Omit<SpiderErrorInit, "kind" | "message"> = {},
  ) {
    super("not-logged-in", message, init);
  }
}

export class AccessDeniedError extends TypedSpiderError<"access-denied"> {
  constructor(
    message: string,
    init: Omit<SpiderErrorInit, "kind" | "message"> = {},
  ) {
    super("access-denied", message, init);
  }
}

/** 触发站点风控/反爬（验证码、滑块、拦截页）——处置见 kind-meta：熔断 + 人工，禁止自动重试 */
export class RiskControlError extends TypedSpiderError<"risk-control"> {
  constructor(
    message: string,
    init: Omit<SpiderErrorInit, "kind" | "message"> = {},
  ) {
    super("risk-control", message, init);
  }
}

// ── 入参 ──

export class MissingContextError extends TypedSpiderError<"missing-context"> {
  constructor(
    message: string,
    init: Omit<SpiderErrorInit, "kind" | "message"> = {},
  ) {
    super("missing-context", message, init);
  }
}

export class InvalidParamsError extends TypedSpiderError<"invalid-params"> {
  constructor(
    message: string,
    init: Omit<SpiderErrorInit, "kind" | "message"> = {},
  ) {
    super("invalid-params", message, init);
  }
}

// ── 上游 ──

export class UpstreamShapeChangedError extends TypedSpiderError<"upstream-shape-changed"> {
  constructor(
    message: string,
    init: Omit<SpiderErrorInit, "kind" | "message"> = {},
  ) {
    super("upstream-shape-changed", message, init);
  }
}

export class EndpointHttpError extends TypedSpiderError<"endpoint-http"> {
  constructor(
    message: string,
    init: Omit<SpiderErrorInit, "kind" | "message"> = {},
  ) {
    super("endpoint-http", message, init);
  }
}

export class EndpointTimeoutError extends TypedSpiderError<"endpoint-timeout"> {
  constructor(
    message: string,
    init: Omit<SpiderErrorInit, "kind" | "message"> = {},
  ) {
    super("endpoint-timeout", message, init);
  }
}

export class RetryExhaustedError extends TypedSpiderError<"retry-exhausted"> {
  constructor(
    message: string,
    init: Omit<SpiderErrorInit, "kind" | "message"> = {},
  ) {
    super("retry-exhausted", message, init);
  }
}

// ── 管道 ──

/**
 * Hook 主动 abortPipeline() 触发的错误。
 * 兼容旧的 puppeteer/hooks 中的 HookAbortError —— 该类已被本类替代。
 */
export class HookAbortError extends SpiderError {
  constructor(
    message: string,
    kind: SkillFailureKind = "hook-abort",
    init: Omit<SpiderErrorInit, "kind" | "message"> = {},
  ) {
    super({ ...init, kind, message });
  }
}

export class PipelineError extends TypedSpiderError<"pipeline-error"> {
  constructor(
    message: string,
    init: Omit<SpiderErrorInit, "kind" | "message"> = {},
  ) {
    super("pipeline-error", message, init);
  }
}

// ── 业务 ──

export class NoResultsError extends TypedSpiderError<"no-results"> {
  constructor(
    message: string,
    init: Omit<SpiderErrorInit, "kind" | "message"> = {},
  ) {
    super("no-results", message, init);
  }
}

export class UnsupportedError extends TypedSpiderError<"unsupported"> {
  constructor(
    message: string,
    init: Omit<SpiderErrorInit, "kind" | "message"> = {},
  ) {
    super("unsupported", message, init);
  }
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 将任意 unknown 错误归一化为 SpiderError。
 * 已是 SpiderError 时原样返回；否则包装成 PipelineError 以保留 cause。
 */
export function toSpiderError(
  err: unknown,
  fallbackKind: SkillFailureKind = "pipeline-error",
  init: Omit<SpiderErrorInit, "kind" | "message"> = {},
): SpiderError {
  if (err instanceof SpiderError) return err;
  const message = err instanceof Error ? err.message : String(err);
  return new SpiderError({ ...init, kind: fallbackKind, message, cause: err });
}

/**
 * 旧 API 兼容：`formatError(kind, msg)` 现在直接构造 SpiderError 抛出更安全。
 * 但仍保留字符串前缀以兼容旧调用点（如 `throw new Error(formatError(...))`）。
 */
export function formatError(kind: SkillFailureKind, message: string): string {
  return `[${kind}] ${message}`;
}

/**
 * 从字符串前缀格式 "[kind] msg" 中尝试解析出 kind。
 * 用于兼容老代码抛 `new Error(formatError(...))` 的场景。
 */
export function parseLegacyKind(message: string): SkillFailureKind | undefined {
  const match = message.match(/^\[([\w-]+)\]/);
  if (!match) return undefined;
  return match[1] as SkillFailureKind;
}
