// ============================================================================
// Runtime ALS — 让框架内部任意位置都能 currentRuntime() 拿到当前 Runtime。
// ============================================================================
//
// 唯一入口：runWithRuntime(rt, fn) — 仅在 cli/run.ts 与 testing/runtime
// （createTestRuntime 配套）中调用。其它任何调用都视为反模式。
// ============================================================================

import { AsyncLocalStorage } from "async_hooks";
import { NOOP_RUNTIME } from "./noop";
import type { RuntimeContext } from "./interfaces";

const slot = new AsyncLocalStorage<RuntimeContext>();

/**
 * 返回当前 Runtime。无 ALS 上下文时返回 `NOOP_RUNTIME`（完全静默），
 * 业务永远不会因为"忘了启动 trace"而崩溃。
 */
export function currentRuntime(): RuntimeContext {
  return slot.getStore() ?? NOOP_RUNTIME;
}

/**
 * 把后续 await 链绑定到 rt。**只允许在框架入口调用**。
 */
export function runWithRuntime<T>(
  rt: RuntimeContext,
  fn: () => Promise<T>,
): Promise<T> {
  return slot.run(rt, fn);
}
