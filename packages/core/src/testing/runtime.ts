// ============================================================================
// createTestRuntime — 测试夹具运行时
// ============================================================================
//
// 用法：
//   const { runtime, events } = createTestRuntime();
//   await runWithRuntime(runtime, () => skill.execute(params));
//   expect(events).toContainEqual(expect.objectContaining({ kind: "skill.end" }));
// ============================================================================

import type {
  BlobStore,
  EventEmitter,
  ObsEventInput,
  RuntimeContext,
  Span,
  Tracer,
} from "../runtime";
import type { ObsEvent } from "../observability";

export interface TestRuntimeHandle {
  runtime: RuntimeContext;
  /** 按 emit 顺序收集到的事件 */
  events: ObsEvent[];
  /** put 进去的 blob — 测试可读 */
  blobs: Map<string, unknown>;
}

let counter = 0;
const newId = (prefix: string): string => `${prefix}-${++counter}`;

export function createTestRuntime(): TestRuntimeHandle {
  const events: ObsEvent[] = [];
  const blobs = new Map<string, unknown>();

  const traceId = newId("trace");
  const stack: Span[] = [];

  const tracer: Tracer = {
    async span<T>(
      _kind: string,
      _patch: Record<string, unknown>,
      fn: (span: Span) => Promise<T>,
    ): Promise<T> {
      const parent = stack[stack.length - 1];
      const span: Span = {
        traceId,
        spanId: newId("span"),
        parentSpanId: parent?.spanId,
        setAttr() {
          /* recorder ignores attrs */
        },
      };
      stack.push(span);
      try {
        return await fn(span);
      } finally {
        stack.pop();
      }
    },
  };

  const captureEvent = (input: ObsEventInput): ObsEvent => {
    const cur = stack[stack.length - 1];
    return {
      ts: new Date(0).toISOString(),
      traceId,
      spanId: input.spanId ?? cur?.spanId ?? newId("span"),
      parentSpanId: input.parentSpanId ?? cur?.parentSpanId,
      ...input,
    } as ObsEvent;
  };

  const emitter: EventEmitter = {
    emit(input) {
      events.push(captureEvent(input));
    },
    emitError(input) {
      const { error, message, details, ...rest } = input;
      const msg =
        message ??
        (error instanceof Error
          ? error.message
          : error === undefined
            ? rest.errorKind
            : String(error));
      events.push(
        captureEvent({
          kind: "error",
          ...rest,
          message: msg,
          ...(details ? { details } : {}),
        } as ObsEventInput),
      );
    },
  };

  const blobsImpl: BlobStore = {
    put(data, mime) {
      const sha = `sha-${newId("blob")}`;
      blobs.set(sha, data);
      const json =
        typeof data === "string" ? data : JSON.stringify(data);
      const bytes =
        typeof data === "string"
          ? Buffer.byteLength(data)
          : Buffer.byteLength(json);
      return {
        hash: sha,
        path: `memory/${sha}`,
        mime: mime ?? "application/json",
        bytes,
      };
    },
  };

  const runtime: RuntimeContext = {
    tracer,
    events: emitter,
    blobs: blobsImpl,
    redact: (v) => v,
    clock: () => new Date(0),
    config: {
      enabled: true,
      dir: "/tmp/spider-test",
      sinks: [],
      bodyMaxBytes: Number.MAX_SAFE_INTEGER,
      previewBytes: 0,
      redactKeys: [],
      loggerExplicit: false,
    },
  };

  return { runtime, events, blobs };
}
