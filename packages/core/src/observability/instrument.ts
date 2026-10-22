// ============================================================================
// Instrument — 高层 API：withSpan / recordEvent
// ============================================================================
//
// 业务代码（其实是框架内部代码，业务 Skill 透明）通过这两个函数接入观测：
//
//   await withSpan({ kind: "skill", name: skillId }, async (span) => {
//     emitEvent({ kind: "skill.start", ... })
//     ...
//     return result
//   })
//
// span 自动产生 spanId、把 spanId 注入 AsyncLocalStorage 供子 span 继承。
// ============================================================================

import { getObservabilityBus } from "./bus";
import {
  newSpanId,
  type ObsEvent,
} from "./events";
import {
  currentTraceFrame,
  runSpan,
} from "./trace-context";
import { BodyStore } from "./body-store";
import { getObsConfig } from "./config";

// ── BodyStore 单例 ─────────────────────────────────────────────────────────

let _bodyStore: BodyStore | undefined;
export function getBodyStore(): BodyStore {
  if (!_bodyStore) _bodyStore = new BodyStore();
  return _bodyStore;
}
/** 测试用 */
export function setBodyStore(store: BodyStore): void {
  _bodyStore = store;
}

// ── 事件发射 ───────────────────────────────────────────────────────────────

/**
 * Distribute Omit across each union member so that discriminated union
 * narrowing by `kind` still works at call sites.
 */
type DistributiveOmit<T, K extends keyof T> = T extends unknown
  ? Omit<T, K>
  : never;

export type ObsEventInput = DistributiveOmit<
  ObsEvent,
  "ts" | "traceId" | "spanId" | "parentSpanId"
> & {
  ts?: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
};

/**
 * 发射事件 — 自动从 ALS 读取 traceId/spanId/parentSpanId，调用方只需补 kind 字段。
 * 若不在 trace 内（如未经 CLI 直接 import 调用），事件被静默丢弃。
 */
export function emitEvent(event: ObsEventInput): void {
  const cfg = getObsConfig();
  if (!cfg.enabled) return;
  const frame = currentTraceFrame();
  if (!frame && !event.traceId) return;
  const out = {
    ts: event.ts ?? new Date().toISOString(),
    traceId: event.traceId ?? frame!.traceId,
    spanId: event.spanId ?? frame?.spanId ?? newSpanId(),
    parentSpanId: event.parentSpanId ?? frame?.spanId,
    ...event,
  } as ObsEvent;
  getObservabilityBus().emit(out);
}

// ── 高层 Span 包装 ────────────────────────────────────────────────────────

export interface SpanOptions {
  /** Span kind — 用于 sink 路由 */
  kind: string;
  /** 注入到 trace frame 的字段 */
  framePatch?: Parameters<typeof runSpan>[0];
}

/**
 * withSpan — 在新 span 内执行 fn。fn 抛出会被原样冒泡（业务异常不吞）。
 * 返回 spanId 给调用方写入 start/end 事件。
 */
export async function withSpan<T>(
  opts: SpanOptions,
  fn: (spanId: string, parentSpanId: string | undefined) => Promise<T>,
): Promise<T> {
  return runSpan(opts.framePatch ?? {}, async (spanId, parentSpanId) => {
    return fn(spanId, parentSpanId);
  });
}
