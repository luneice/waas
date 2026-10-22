// ============================================================================
// RuntimeContext — 框架的运行时能力集合
// ============================================================================
//
// 取代旧的全局 `emitEvent` / `withSpan` / `getBodyStore` / `getObsConfig` 等。
// 任何框架内部代码（base skill、pipeline、browser、storage、goal、hook）
// 都应通过 `currentRuntime()` 或注入的 `runtime: RuntimeContext` 访问横切能力。
//
// 设计要点：
//   1. NoopRuntime（默认实现）让所有方法变成零成本空操作，使观测彻底可选
//   2. LiveRuntime（CLI 入口装配）桥接 ObservabilityBus + BodyStore + AsyncLocalStorage
//   3. 框架内不存在第二种访问观测的方式 — 没有顶层 emitEvent 函数可调用
// ============================================================================

import type { ObsEvent, BodyRef } from "../observability/events";
import type { ObsConfig } from "../observability/config";

// ── Tracer ─────────────────────────────────────────────────────────────────

/**
 * Span — 一段被观测的执行区间。属性可在 fn 体内追加（如 url、durationMs）。
 * NoopRuntime 下 traceId/spanId 仍是有效字符串（便于日志关联），仅不落 sink。
 */
export interface Span {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  setAttr(key: string, value: unknown): void;
}

/**
 * Tracer — 在新 span 内执行 fn。
 * - kind: span 类别（"skill" / "stage" / "navigate" / "goal" / "endpoint" 等）
 * - framePatch: 注入 trace frame 的字段（如 skillId、goalId）
 * - fn: 业务体，可读 span.spanId 写到事件里
 *
 * 错误从 fn 抛出会原样冒泡；LiveRuntime 会在抛错时把异常摘要附在 span 属性上。
 */
export interface Tracer {
  span<T>(
    kind: string,
    framePatch: Record<string, unknown>,
    fn: (span: Span) => Promise<T>,
  ): Promise<T>;
}

// ── EventEmitter ───────────────────────────────────────────────────────────

/**
 * 事件输入：与 ObsEvent 一致但 ts/traceId/spanId/parentSpanId 由 Runtime 自动补齐。
 * 业务方只需补 kind 与业务字段。
 */
type DistributiveOmit<T, K extends keyof T> = T extends unknown
  ? Omit<T, K>
  : never;
export type ObsEventInput = DistributiveOmit<
  ObsEvent,
  "ts" | "traceId" | "spanId" | "parentSpanId"
> & {
  spanId?: string;
  parentSpanId?: string;
};

export interface ErrorEventInput {
  errorKind: string;
  category?: string;
  phase?: string;
  scope?: string;
  skillId?: string;
  retryable?: boolean;
  message?: string;
  error?: unknown;
  details?: Record<string, unknown>;
}

export interface EventEmitter {
  emit(event: ObsEventInput): void;
  emitError(event: ErrorEventInput): void;
}

// ── BlobStore ──────────────────────────────────────────────────────────────

/**
 * BlobStore — 大对象内容寻址存储（请求体、响应体、入参、返回值）。
 * NoopRuntime 返回一个零字节空引用。
 */
export interface BlobStore {
  put(data: unknown, contentTypeHint?: string): BodyRef;
}

// ── Redactor ───────────────────────────────────────────────────────────────

/** 脱敏函数 — 把 password/token 等字段值替换为 "[REDACTED]"。 */
export type Redactor = <T>(value: T) => T;

// ── RuntimeContext ─────────────────────────────────────────────────────────

export interface RuntimeContext {
  readonly tracer: Tracer;
  readonly events: EventEmitter;
  readonly blobs: BlobStore;
  readonly redact: Redactor;
  readonly clock: () => Date;
  /** 当前观测配置（用于 cli/obs 子命令、redactKeys 等） */
  readonly config: Readonly<ObsConfig>;
}
