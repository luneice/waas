// ============================================================================
// LiveRuntime — 真实运行时实现：桥接 ObservabilityBus + BodyStore + Trace ALS
// ============================================================================
//
// 只在 CLI 入口（与显式测试夹具）装配。框架其它任何位置都通过
// currentRuntime() 取到这个实例。
// ============================================================================

import type {
  BlobStore,
  ErrorEventInput,
  EventEmitter,
  ObsEventInput,
  Redactor,
  RuntimeContext,
  Span,
  Tracer,
} from "./interfaces";
import { BodyStore } from "../observability/body-store";
import { ObservabilityBus } from "../observability/bus";
import { getObsConfig } from "../observability/config";
import {
  newSpanId,
  newTraceId,
  type ObsEvent,
} from "../observability/events";
import { redact as redactInternal } from "../observability/redact";
import {
  currentTraceFrame,
  runSpan,
} from "../observability/trace-context";
import { JsonlSink } from "../observability/sinks/jsonl-sink";
import { join } from "path";

// ── Tracer ─────────────────────────────────────────────────────────────────

class LiveSpan implements Span {
  readonly attrs: Record<string, unknown> = {};
  constructor(
    readonly traceId: string,
    readonly spanId: string,
    readonly parentSpanId: string | undefined,
  ) {}
  setAttr(key: string, value: unknown): void {
    this.attrs[key] = value;
  }
}

function createTracer(): Tracer {
  return {
    async span<T>(
      _kind: string,
      framePatch: Record<string, unknown>,
      fn: (span: Span) => Promise<T>,
    ): Promise<T> {
      return runSpan(framePatch, async (spanId, parentSpanId) => {
        const frame = currentTraceFrame();
        const span = new LiveSpan(
          frame?.traceId ?? newTraceId(),
          spanId,
          parentSpanId,
        );
        return fn(span);
      });
    },
  };
}

// ── EventEmitter ───────────────────────────────────────────────────────────

function createEmitter(bus: ObservabilityBus): EventEmitter {
  const buildBase = (input: ObsEventInput): ObsEvent => {
    const frame = currentTraceFrame();
    const out = {
      ts: new Date().toISOString(),
      traceId: frame?.traceId ?? newTraceId(),
      spanId: input.spanId ?? frame?.spanId ?? newSpanId(),
      parentSpanId: input.parentSpanId ?? frame?.spanId,
      ...input,
    } as ObsEvent;
    return out;
  };

  const toErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    try {
      return JSON.stringify(error) ?? String(error);
    } catch {
      return String(error);
    }
  };

  return {
    emit(input) {
      bus.emit(buildBase(input));
    },
    emitError(input) {
      const { error, message, details, ...rest } = input;
      const nextDetails =
        error === undefined
          ? details
          : {
              ...(details ?? {}),
              error: toErrorMessage(error),
              ...(error instanceof Error ? { errorName: error.name } : {}),
            };
      const out: ObsEventInput = {
        kind: "error",
        ...rest,
        message:
          message ??
          (error === undefined ? rest.errorKind : toErrorMessage(error)),
        ...(nextDetails ? { details: nextDetails } : {}),
      } as ObsEventInput;
      bus.emit(buildBase(out));
    },
  };
}

// ── BlobStore ──────────────────────────────────────────────────────────────

function createBlobs(): BlobStore {
  const store = new BodyStore();
  return {
    put: (data, mime) => store.put(data, mime),
  };
}

// ── Redactor ───────────────────────────────────────────────────────────────

function createRedactor(keys: ReadonlyArray<string>): Redactor {
  return (value) => redactInternal(value, keys) as typeof value;
}

// ── LiveRuntime 工厂 ──────────────────────────────────────────────────────

export interface LiveRuntimeOptions {
  /** 复用已有的 Bus（测试 / 嵌套 CLI 场景）。默认新建。 */
  bus?: ObservabilityBus;
  /** 是否自动装配 jsonl sink（默认按 obsConfig.sinks 决定） */
  autoBootstrap?: boolean;
}

let installedSinks: string[] = [];

/**
 * 创建并装配 LiveRuntime。
 *
 * - 若 obs 启用且 obsConfig 中包含 jsonl sink：装配 JsonlSink
 * - 否则：bus 不带任何 sink（事件被丢弃，但行为与 Noop 一致）
 * - 重复调用是幂等的：返回的 Runtime 共享同一全局 Bus
 */
export function createLiveRuntime(
  opts: LiveRuntimeOptions = {},
): { runtime: RuntimeContext; installedSinks: string[] } {
  const cfg = getObsConfig();
  const bus = opts.bus ?? new ObservabilityBus();

  if (opts.autoBootstrap !== false && cfg.enabled && installedSinks.length === 0) {
    if (cfg.sinks.includes("jsonl")) {
      bus.register(new JsonlSink({ dir: join(cfg.dir, "traces") }));
      installedSinks.push("jsonl");
    }
  }

  if (!cfg.enabled) bus.disable();

  const runtime: RuntimeContext = {
    tracer: createTracer(),
    events: createEmitter(bus),
    blobs: createBlobs(),
    redact: createRedactor(cfg.redactKeys),
    clock: () => new Date(),
    config: cfg,
  };

  // 把 bus 暴露给 CLI 入口用于 flush
  (runtime as { __bus?: ObservabilityBus }).__bus = bus;

  return { runtime, installedSinks: [...installedSinks] };
}

/** 关闭并 flush 上次 createLiveRuntime 装配的 sink — 仅 CLI 退出时调用。 */
export async function shutdownLiveRuntime(rt: RuntimeContext): Promise<void> {
  const bus = (rt as { __bus?: ObservabilityBus }).__bus;
  if (bus) {
    try {
      await bus.close();
    } catch {
      // best-effort
    }
  }
  installedSinks = [];
}
