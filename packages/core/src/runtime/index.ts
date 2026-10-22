// ============================================================================
// @spider/core/runtime — 框架运行时上下文统一入口
// ============================================================================

export type {
  RuntimeContext,
  Tracer,
  Span,
  EventEmitter,
  BlobStore,
  Redactor,
  ObsEventInput,
  ErrorEventInput,
} from "./interfaces";

export { NOOP_RUNTIME } from "./noop";
export { currentRuntime, runWithRuntime } from "./als";
export { createLiveRuntime, shutdownLiveRuntime } from "./live";
export type { LiveRuntimeOptions } from "./live";
