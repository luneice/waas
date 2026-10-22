// ============================================================================
// NoopRuntime — 零副作用的运行时实现，框架内 currentRuntime() 的兜底返回值。
// ============================================================================
//
// 行为契约：
//   - tracer.span(...fn) 直接 await fn(noopSpan)，不进 AsyncLocalStorage
//   - events.emit / emitError 完全静默
//   - blobs.put 返回固定的空引用，bytes=0
//
// 任何使用 NoopRuntime 执行的 Skill 结果应与 LiveRuntime + 关闭 obs 完全等价。
// ============================================================================

import type {
  BlobStore,
  EventEmitter,
  Redactor,
  RuntimeContext,
  Span,
  Tracer,
} from "./interfaces";
import type { ObsConfig } from "../observability/config";
import type { BodyRef } from "../observability/events";

const NOOP_SPAN: Span = Object.freeze({
  traceId: "noop",
  spanId: "noop",
  parentSpanId: undefined,
  setAttr() {},
}) as Span;

const noopTracer: Tracer = {
  async span<T>(
    _kind: string,
    _patch: Record<string, unknown>,
    fn: (span: Span) => Promise<T>,
  ): Promise<T> {
    return fn(NOOP_SPAN);
  },
};

const noopEvents: EventEmitter = {
  emit() {},
  emitError() {},
};

const EMPTY_BODY_REF: BodyRef = Object.freeze({
  hash: "0".repeat(64),
  bytes: 0,
  mime: "application/octet-stream",
  path: "",
}) as BodyRef;

const noopBlobs: BlobStore = {
  put() {
    return EMPTY_BODY_REF;
  },
};

const noopRedact: Redactor = (v) => v;

const NOOP_CONFIG: ObsConfig = Object.freeze({
  enabled: false,
  dir: "",
  sinks: [],
  bodyMaxBytes: 0,
  previewBytes: 0,
  redactKeys: [],
  loggerExplicit: false,
}) as ObsConfig;

export const NOOP_RUNTIME: RuntimeContext = Object.freeze({
  tracer: noopTracer,
  events: noopEvents,
  blobs: noopBlobs,
  redact: noopRedact,
  clock: () => new Date(),
  config: NOOP_CONFIG,
}) as RuntimeContext;
