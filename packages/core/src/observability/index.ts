// ============================================================================
// @spider/core/observability — 仅暴露类型与 Sink 实现
// ============================================================================
//
// 历史上这里导出了 emitEvent / withSpan / getBodyStore / getObsConfig 等
// 顶层函数。重构后框架内统一通过 RuntimeContext（见 ../runtime）注入，
// 这些函数不再公开。仍内部使用的模块从具体子文件直接 import。
// ============================================================================

// 旧版 logger（仅保留 setRootLogger / noopLogger 等）
export * from "./logger";

// 事件模型（公开类型）
export * from "./events";
export type { ObsConfig } from "./config";

// 事件总线 / Sink 抽象（公开类型 + 实现，便于自定义部署）
export type { ObsSink } from "./bus";
export { ObservabilityBus } from "./bus";
export { JsonlSink, type JsonlSinkOptions } from "./sinks/jsonl-sink";
export { LoggerSink, type LoggerSinkOptions } from "./sinks/logger-sink";
