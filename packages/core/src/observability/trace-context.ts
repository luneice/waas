// ============================================================================
// TraceContext — 基于 AsyncLocalStorage 的隐式上下文传播
// ============================================================================
//
// AI → CLI → SkillRegistry → Skill.execute → Stage → Hook → Endpoint
// 整条链路都需要共享 traceId / parentSpanId / 调用方元信息，
// 但又不希望污染业务 API。AsyncLocalStorage 让上下文跨 await 边界自动延续。
// ============================================================================

import { AsyncLocalStorage } from "async_hooks";
import { newSpanId, newTraceId } from "./events";

export interface TraceFrame {
  /** 一次 CLI 调用唯一 */
  traceId: string;
  /** 当前 span（嵌套时即父 span 候选） */
  spanId?: string;
  /** 调用方（agent 名 / 用户标识） */
  caller?: string;
  /** AI 调用动机 */
  rationale?: string;
  /** 当前 skill 名（若已进入 skill span） */
  skillId?: string;
  /** 当前 goal id */
  goalId?: string;
}

const als = new AsyncLocalStorage<TraceFrame>();

// ── 公共 API ───────────────────────────────────────────────────────────────

export function currentTraceFrame(): TraceFrame | undefined {
  return als.getStore();
}

/** 是否处于一次 trace 之中（外部调用如 cli/run 之外都 false） */
export function inTrace(): boolean {
  return als.getStore() !== undefined;
}

/**
 * 启动根 trace — 只该被 CLI 入口调用一次。
 * 嵌套调用合法但会启用新 traceId（如本进程同时跑多 skill 的批处理）。
 */
export function runRootTrace<T>(
  init: Omit<TraceFrame, "traceId" | "spanId"> & { traceId?: string },
  fn: () => Promise<T>,
): Promise<T> {
  const frame: TraceFrame = {
    traceId: init.traceId ?? newTraceId(),
    caller: init.caller,
    rationale: init.rationale,
  };
  return als.run(frame, fn);
}

/**
 * 进入子 span — 内部 fn 中 currentTraceFrame().spanId 自动指向新 span。
 * 调用方拿到 spanId 用于事件挂载。
 */
export function runSpan<T>(
  patch: Partial<TraceFrame> & { spanId?: string },
  fn: (spanId: string, parentSpanId: string | undefined) => Promise<T>,
): Promise<T> {
  const parent = als.getStore();
  if (!parent) {
    // 不在 trace 内 — 启动一个匿名 root（不会写入 sink，但保证上下文存在）
    const root: TraceFrame = { traceId: newTraceId() };
    return als.run(root, () => runSpan(patch, fn));
  }
  const spanId = patch.spanId ?? newSpanId();
  const frame: TraceFrame = { ...parent, ...patch, spanId };
  return als.run(frame, () => fn(spanId, parent.spanId));
}

/** 临时为后续 await 链注入字段（如进入 skill span 时记录 skillId） */
export function withFrame<T>(
  patch: Partial<TraceFrame>,
  fn: () => Promise<T>,
): Promise<T> {
  const parent = als.getStore();
  if (!parent) return fn();
  const frame: TraceFrame = { ...parent, ...patch };
  return als.run(frame, fn);
}
