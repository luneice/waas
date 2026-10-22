/**
 * 流式端点执行 —— `@Streamed` 的运行时
 *
 * ══════════════ 为什么不复用 browserFetch ══════════════
 *
 * `browserFetch` 是**一次性读完响应体**（`response.text()` / `arrayBuffer()`），
 * 而流式端点要 `response.body.getReader()` 循环读。
 *
 * 更重要的是：`browserFetch` 内含一段用血换来的判别逻辑 —— HTTP 200 却解析不出
 * JSON 时，要区分「空响应=瞬时故障可重试」与「有内容但非 JSON=风控页需人工介入」，
 * 两者处置相反。全仓 7 个包、180 个端点都依赖它，其中三个包**没有测试**。
 *
 * 因此这里**另起一个独立函数**，一个字节都不碰 browserFetch：
 * 用少量重复（fetch 初始化那几行）换取存量路径的零回归风险。
 *
 * ══════════════ 页内缓冲 + Node 侧轮询 ══════════════
 *
 * `page.evaluate` 是一次性往返，`ReadableStream` 没法跨边界传出来。
 * 所以在页面里开流并把 chunk 推进缓冲，Node 侧轮询取走 —— 与 WebSocket 的
 * 「页内泵」是同一个机制（tradingview-spider 已验证）。
 *
 * `drain` 的最长等待必须 <= `idleTimeout`：`runStream` 的超时判定基于事件到达
 * 时刻而非定时器，需要传输层保证「静默也能表现为一次迭代」。
 */

import type { Page } from "puppeteer-core";
import { EndpointHttpError, EndpointTimeoutError } from "../errors";
import { createSseDecoder } from "../stream/sse-decoder";
import { runStream, type StreamRunResult } from "../stream/reducer";
import type { StreamDecode, StreamedOptions } from "./streamed";

/** 页面内流状态的 window 键前缀（每次执行独立，避免并发串扰） */
const STREAM_KEY_PREFIX = "__spider_stream_";

export interface StreamFetchOptions {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  credentials?: RequestCredentials;
}

interface StreamOpenRet {
  ok: boolean;
  status: number;
  error: string | null;
}

interface StreamDrainRet {
  chunks: string[];
  done: boolean;
  error: string | null;
}

/**
 * 在页面里打开流式响应。
 *
 * ⚠️ 本函数体跨 `page.evaluate` 序列化边界 —— 禁止引用任何模块作用域标识符，
 * 且需自备 `__name` 兜底（esbuild 会给函数体内的具名声明注入该 helper，
 * 而 helper 定义在模块作用域，不随 fn.toString() 过边界）。
 */
const pageStreamOpen = async (arg: {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  credentials: string;
  key: string;
  maxBufferedChunks: number;
}): Promise<StreamOpenRet> => {
  const g = globalThis as unknown as Record<string, unknown>;
  if (typeof g.__name !== "function") g.__name = (fn: unknown) => fn;

  const w = window as unknown as Record<string, unknown>;
  try {
    const init: RequestInit = {
      method: arg.method,
      headers: arg.headers,
      credentials: arg.credentials as RequestCredentials,
    };
    if (arg.body !== null) init.body = arg.body;

    const resp = await fetch(arg.url, init);
    if (!resp.ok) {
      return { ok: false, status: resp.status, error: "HTTP " + resp.status };
    }
    if (!resp.body) {
      return { ok: false, status: resp.status, error: "response body is not readable" };
    }

    const state = {
      reader: resp.body.getReader(),
      decoder: new TextDecoder(),
      buf: [] as string[],
      done: false,
      err: null as string | null,
      dropped: 0,
    };
    w[arg.key] = state;

    // 后台持续读取，chunk 进缓冲；Node 侧轮询取走
    const pump = async (): Promise<void> => {
      try {
        for (;;) {
          const r = await state.reader.read();
          if (r.done) {
            state.done = true;
            return;
          }
          if (state.buf.length >= arg.maxBufferedChunks) {
            state.buf.shift();
            state.dropped += 1;
          }
          state.buf.push(state.decoder.decode(r.value, { stream: true }));
        }
      } catch (e) {
        state.err = e instanceof Error ? e.message : String(e);
        state.done = true;
      }
    };
    void pump();

    return { ok: true, status: resp.status, error: null };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
};

/** 取走缓冲区里的 chunk；为空则最多等 maxWaitMs（保证静默也能推进循环） */
const pageStreamDrain = async (arg: {
  key: string;
  maxWaitMs: number;
}): Promise<StreamDrainRet> => {
  const g = globalThis as unknown as Record<string, unknown>;
  if (typeof g.__name !== "function") g.__name = (fn: unknown) => fn;

  const w = window as unknown as Record<string, unknown>;
  const state = w[arg.key] as
    | { buf: string[]; done: boolean; err: string | null }
    | undefined;
  if (!state) {
    return { chunks: [], done: true, error: "stream state not found" };
  }

  if (state.buf.length === 0 && !state.done) {
    await new Promise<void>((resolve) => setTimeout(resolve, arg.maxWaitMs));
  }

  const chunks = state.buf.splice(0, state.buf.length);
  return { chunks, done: state.done, error: state.err };
};

/** 关闭流并清理页面状态（幂等） */
const pageStreamClose = async (arg: { key: string }): Promise<void> => {
  const g = globalThis as unknown as Record<string, unknown>;
  if (typeof g.__name !== "function") g.__name = (fn: unknown) => fn;

  const w = window as unknown as Record<string, unknown>;
  const state = w[arg.key] as { reader?: { cancel(): Promise<void> } } | undefined;
  if (state?.reader) {
    try {
      await state.reader.cancel();
    } catch {
      /* 已关闭，忽略 */
    }
  }
  delete w[arg.key];
};

/** 内置解码器：按行分隔的 JSON */
function createNdjsonDecoder(): {
  push(chunk: string): unknown[];
  flush(): unknown[];
} {
  let buffer = "";
  const parse = (line: string): unknown[] => {
    const t = line.trim();
    if (!t) return [];
    try {
      return [JSON.parse(t)];
    } catch {
      return [];
    }
  };
  return {
    push(chunk: string): unknown[] {
      buffer += chunk;
      const out: unknown[] = [];
      let idx: number;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        out.push(...parse(buffer.slice(0, idx)));
        buffer = buffer.slice(idx + 1);
      }
      return out;
    },
    flush(): unknown[] {
      const rest = buffer;
      buffer = "";
      return parse(rest);
    },
  };
}

function resolveDecoder<TEvent>(
  decode: StreamDecode<TEvent>,
): { push(chunk: string): TEvent[]; flush(): TEvent[] } {
  if (decode === "sse") {
    return createSseDecoder() as unknown as {
      push(chunk: string): TEvent[];
      flush(): TEvent[];
    };
  }
  if (decode === "ndjson") {
    return createNdjsonDecoder() as unknown as {
      push(chunk: string): TEvent[];
      flush(): TEvent[];
    };
  }
  return decode();
}

/** 单次 drain 的最长等待；必须 <= idleTimeout 才能让静默被判超时 */
const DEFAULT_DRAIN_WAIT_MS = 500;
/** 页内 chunk 缓冲上限 */
const MAX_BUFFERED_CHUNKS = 2000;

/**
 * 在页面里打开流式响应，并驱动 reduce/until 直到收口。
 *
 * @returns 累加器与终止元信息（`truncated` 为 true 表示数据可能不完整）
 */
export async function runStreamedEndpoint<TEvent, TAcc>(
  page: Page,
  fetchOptions: StreamFetchOptions,
  streamed: StreamedOptions<TEvent, TAcc>,
  ctx: unknown,
  scope: string,
): Promise<StreamRunResult<TAcc>> {
  const key = `${STREAM_KEY_PREFIX}${Math.random().toString(36).slice(2, 10)}`;
  const decoder = resolveDecoder(streamed.decode);

  const opened = await page.evaluate(pageStreamOpen, {
    url: fetchOptions.url,
    method: fetchOptions.method,
    headers: fetchOptions.headers ?? {},
    body: fetchOptions.body ?? null,
    credentials: (fetchOptions.credentials ?? "include") as string,
    key,
    maxBufferedChunks: MAX_BUFFERED_CHUNKS,
  });

  if (!opened.ok) {
    throw new EndpointHttpError(
      `流式端点打开失败：${opened.error ?? "unknown"}`,
      {
        scope,
        phase: "stream-open",
        details: { url: fetchOptions.url, status: opened.status },
      },
    );
  }

  const drainWait = Math.min(
    DEFAULT_DRAIN_WAIT_MS,
    streamed.idleTimeout ?? DEFAULT_DRAIN_WAIT_MS,
  );

  /** 把页内缓冲包成事件流：解码后逐条产出，上游结束即终止迭代 */
  async function* source(): AsyncIterable<TEvent> {
    for (;;) {
      const batch = await page.evaluate(pageStreamDrain, {
        key,
        maxWaitMs: drainWait,
      });

      if (batch.error) {
        throw new EndpointHttpError(`流式读取失败：${batch.error}`, {
          scope,
          phase: "stream-drain",
          details: { url: fetchOptions.url },
        });
      }

      for (const chunk of batch.chunks) {
        for (const ev of decoder.push(chunk)) yield ev;
      }

      if (batch.done) {
        // 流结束时 flush 出最后一个未以边界结尾的事件
        for (const ev of decoder.flush()) yield ev;
        return;
      }
    }
  }

  try {
    const result = await runStream<TEvent, TAcc, unknown>(
      source(),
      {
        seed: streamed.seed as unknown as (c: unknown) => TAcc,
        reduce: streamed.reduce as unknown as (
          a: TAcc,
          e: TEvent,
          c: unknown,
        ) => TAcc,
        until: streamed.until as unknown as
          | ((a: TAcc, e: TEvent, c: unknown) => boolean)
          | undefined,
        idleTimeout: streamed.idleTimeout,
        maxDuration: streamed.maxDuration,
        maxEvents: streamed.maxEvents,
      },
      ctx,
    );

    if (result.stopReason === "idle-timeout") {
      throw new EndpointTimeoutError(
        `流式端点静默超过 ${streamed.idleTimeout}ms（疑似断流）`,
        {
          scope,
          phase: "stream",
          details: { url: fetchOptions.url, eventCount: result.eventCount },
        },
      );
    }

    return result;
  } finally {
    // 清理必然发生：页面已崩溃时也不该把异常抛给调用方
    try {
      await page.evaluate(pageStreamClose, { key });
    } catch {
      /* 页面已不可用，无需处理 */
    }
  }
}
