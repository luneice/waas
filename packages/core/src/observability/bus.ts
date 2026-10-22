// ============================================================================
// ObservabilityBus — 事件总线（singleton）
// ============================================================================
//
// 单一进入点：observabilityBus.emit(event)
// 内部异步派发到所有 sink；任何 sink 失败都不会冒泡，保证不阻断业务。
//
// 设计要点：
//   - sink.write 同步签名（返回 void / Promise）— bus.emit 同步触发
//   - flush()：CLI 退出前必调用，等待异步 sink 落盘
// ============================================================================

import type { ObsEvent } from "./events";

const MAX_PENDING_WRITES = 1000;

export interface ObsSink {
  readonly name: string;
  write(event: ObsEvent): void | Promise<void>;
  flush?(): Promise<void>;
  close?(): Promise<void>;
}

export class ObservabilityBus {
  private sinks: ObsSink[] = [];
  private pending: Promise<unknown>[] = [];
  private disabled = false;

  register(sink: ObsSink): void {
    if (this.sinks.some((existing) => existing.name === sink.name)) return;
    this.sinks.push(sink);
  }

  unregisterAll(): void {
    this.sinks = [];
  }

  disable(): void {
    this.disabled = true;
  }

  emit(event: ObsEvent): void {
    if (this.disabled || this.sinks.length === 0) return;
    for (const sink of this.sinks) {
      try {
        const r = sink.write(event);
        if (r && typeof (r as Promise<unknown>).catch === "function") {
          const p = (r as Promise<unknown>).catch(() => undefined);
          if (this.pending.length >= MAX_PENDING_WRITES) {
            continue;
          }
          this.pending.push(p);
          p.finally(() => {
            const i = this.pending.indexOf(p);
            if (i >= 0) this.pending.splice(i, 1);
          });
        }
      } catch {
        // Sink failures must not recurse into logging or break the caller.
      }
    }
  }

  async flush(): Promise<void> {
    // 先等当前 pending，再调用 sink.flush
    if (this.pending.length > 0) {
      await Promise.allSettled([...this.pending]);
    }
    for (const sink of this.sinks) {
      if (sink.flush) {
        try {
          await sink.flush();
        } catch {
          // Keep shutdown best-effort; callers should not observe sink failures.
        }
      }
    }
  }

  async close(): Promise<void> {
    await this.flush();
    for (const sink of this.sinks) {
      if (sink.close) {
        try {
          await sink.close();
        } catch {
          // Keep shutdown best-effort; callers should not observe sink failures.
        }
      }
    }
    this.sinks = [];
  }
}

// ── 全局单例 ───────────────────────────────────────────────────────────────

let bus: ObservabilityBus | undefined;

export function getObservabilityBus(): ObservabilityBus {
  if (!bus) bus = new ObservabilityBus();
  return bus;
}

/** 测试用：替换全局实例 */
export function setObservabilityBus(next: ObservabilityBus): void {
  bus = next;
}
