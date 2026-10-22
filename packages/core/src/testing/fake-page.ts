// ============================================================================
// FakePage — 覆盖 Skill 链路实际用到的最小 Page 面
// ============================================================================
//
// ★ 本文件的核心价值在 evaluate()：它**不是**直接调用回调，而是
//   `fn.toString()` 取源码 + node:vm 在干净 context 里重建执行。
//
//   为什么必须这样：puppeteer 的 page.evaluate(fn) 会把 fn 序列化成字符串
//   丢进浏览器执行 —— 回调**看不见** Node 侧的闭包变量。若替身直接
//   `fn(...args)`，闭包引用能跑通，测试全绿，真机上却是 `xxx is not defined`。
//   这类 bug 恰恰是本仓最容易犯的（见 CLAUDE.md §7 构建红线：混淆器把字面量
//   提出 evaluate 回调导致同款故障）。用 vm 复现同样的边界，让替身与真机
//   同步失败，才有意义。
//
//   代价：回调里的 TypeScript 类型标注在运行时已被 tsx/tsc 抹掉，
//   但**枚举以外的语法糖照常工作**（vm 执行的是编译后的 JS 源码）。
//
// context 注入项（对齐真实浏览器全局面）：
//   fetch → FakeUpstream · AbortController/AbortSignal · setTimeout/clearTimeout
//   · btoa/atob · TextDecoder/TextEncoder · console · Response 形状
//   · opts.html 存在时另注入 linkedom 构造的 document/window（可选依赖，
//     未安装则该字段不注入，DOM 型回调会像真机缺元素一样报错）
// ============================================================================

import { createContext, runInContext } from "node:vm";
import { types as nodeTypes } from "node:util";
import type { FakeUpstream } from "./fake-upstream";

export interface FakePageOptions {
  /** 上游替身 —— evaluate 内 fetch 的应答来源 */
  upstream?: FakeUpstream;
  /** 页面 HTML —— 提供后尝试用 linkedom 注入 document/window */
  html?: string;
  /** page.goto 抛错（模拟导航失败），值为错误消息 */
  gotoError?: string;
  /** page.waitForSelector 抛错（模拟选择器超时），值为错误消息 */
  waitForSelectorError?: string;
}

/** evaluate 在 vm 里跑不出结果时的诊断包装 */
export class FakeEvaluateError extends Error {
  constructor(message: string, readonly source: string) {
    super(message);
    this.name = "FakeEvaluateError";
  }
}

export class FakePage {
  private currentUrl = "about:blank";
  private readonly listeners = new Map<
    string,
    Array<(arg: unknown) => unknown>
  >();
  private cookieJar: Array<{ name: string; value: string; domain?: string }> =
    [];
  /** 记录 goto 过的全部 URL（断言导航次序/重试次数） */
  readonly navigations: string[] = [];
  /** 记录 evaluate 调用次数 */
  evaluateCount = 0;
  private closed = false;

  constructor(private readonly opts: FakePageOptions = {}) {}

  url = (): string => this.currentUrl;

  isClosed(): boolean {
    return this.closed;
  }

  /** 由 FakeSessionProvider.release() 调用 */
  async close(): Promise<void> {
    this.closed = true;
  }

  async goto(url: string): Promise<unknown> {
    this.navigations.push(url);
    if (this.opts.gotoError) throw new Error(this.opts.gotoError);
    this.currentUrl = url;
    return null;
  }

  /**
   * ★ 序列化边界模拟 —— 见文件头。
   *
   * 参数经 JSON round-trip（与真机 CDP 传参一致：Date/Map/函数等不可序列化
   * 的值会被抹平），回调源码在干净 context 里 eval 后调用。
   */
  async evaluate<T = unknown>(
    fn: ((...args: never[]) => T | Promise<T>) | string,
    ...args: unknown[]
  ): Promise<T> {
    this.evaluateCount++;
    const source = typeof fn === "string" ? fn : fn.toString();

    // 与真机一致：参数必须可 JSON 序列化才能跨边界
    let transferred: unknown[];
    try {
      transferred = args.map((a) =>
        a === undefined ? undefined : JSON.parse(JSON.stringify(a)),
      );
    } catch (err) {
      throw new FakeEvaluateError(
        `evaluate 参数无法序列化（真机同样会失败）：${(err as Error).message}`,
        source,
      );
    }

    const sandbox = this.buildSandbox();
    const context = createContext(sandbox);

    let callable: unknown;
    try {
      // 包一层括号，兼容 "function(){}" / "(a)=>{}" / "async fn(){}"（对象方法简写）
      callable = runInContext(`(${source})`, context, {
        filename: "evaluate.js",
      });
    } catch (err) {
      // 对象方法简写形式（`async fetchList(x) {}`）不是合法表达式，补 function 关键字重试
      try {
        callable = runInContext(`(function ${source})`, context, {
          filename: "evaluate.js",
        });
      } catch {
        throw new FakeEvaluateError(
          `evaluate 回调源码无法在隔离 context 中重建：${(err as Error).message}`,
          source,
        );
      }
    }

    if (typeof callable !== "function") {
      throw new FakeEvaluateError("evaluate 回调不是函数", source);
    }

    // 真机上闭包变量缺失表现为 ReferenceError —— 这里原样透出，不做美化。
    // 但要跨回宿主 realm：见 rethrowInHostRealm。
    try {
      return (await (callable as (...a: unknown[]) => T | Promise<T>)(
        ...transferred,
      )) as T;
    } catch (err) {
      throw rethrowInHostRealm(err);
    }
  }

  // ── 事件 ──

  on(event: string, handler: (arg: unknown) => unknown): this {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(handler);
    return this;
  }

  off(event: string, handler: (arg: unknown) => unknown): this {
    const arr = this.listeners.get(event);
    if (arr) {
      this.listeners.set(
        event,
        arr.filter((h) => h !== handler),
      );
    }
    return this;
  }

  /** 当前挂在某事件上的监听器数量（断言 teardown 是否摘干净） */
  listenerCount(event: string): number {
    return this.listeners.get(event)?.length ?? 0;
  }

  /** 触发监听器（回放 response / request 事件，喂给拦截器 Hook） */
  async dispatch(event: string, arg: unknown): Promise<void> {
    const arr = [...(this.listeners.get(event) ?? [])];
    for (const h of arr) await h(arg);
  }

  // ── Cookie ──

  async cookies(): Promise<Array<{ name: string; value: string; domain?: string }>> {
    return this.cookieJar.slice();
  }
  async setCookie(
    ...cookies: Array<{ name: string; value: string; domain?: string }>
  ): Promise<void> {
    this.cookieJar.push(...cookies);
  }
  async deleteCookie(
    ...cookies: Array<{ name: string; value: string; domain?: string }>
  ): Promise<void> {
    const keys = new Set(cookies.map((c) => `${c.name}|${c.domain ?? ""}`));
    this.cookieJar = this.cookieJar.filter(
      (c) => !keys.has(`${c.name}|${c.domain ?? ""}`),
    );
  }

  // ── 其余 Page 面（空实现即可满足现有调用点）──

  async waitForSelector(): Promise<null> {
    if (this.opts.waitForSelectorError) {
      throw new Error(this.opts.waitForSelectorError);
    }
    return null;
  }
  async screenshot(): Promise<Buffer> {
    return Buffer.from("png-placeholder");
  }
  async setExtraHTTPHeaders(): Promise<void> {}
  async setUserAgent(): Promise<void> {}
  async setViewport(): Promise<void> {}
  async setRequestInterception(): Promise<void> {}
  async setDefaultTimeout(): Promise<void> {}
  async setDefaultNavigationTimeout(): Promise<void> {}
  async content(): Promise<string> {
    return this.opts.html ?? "<html></html>";
  }
  async title(): Promise<string> {
    return "fake-page";
  }

  // ── 内部：构造 vm sandbox ──

  private buildSandbox(): Record<string, unknown> {
    const upstream = this.opts.upstream;

    const fetchImpl = async (
      input: unknown,
      init?: RequestInit,
    ): Promise<unknown> => {
      if (!upstream) {
        throw new Error(
          "FakePage.evaluate: 回调调用了 fetch，但未注入 upstream。" +
            "构造 FakePage 时传 { upstream } 或改用不发请求的回调。",
        );
      }
      const url = typeof input === "string" ? input : String(input);

      // AbortSignal 必须真正生效：Goal 层的超时路径靠 fetch 抛 AbortError 触发，
      // 忽略 signal 会让 endpoint-timeout 分支永远测不到。
      const signal = init?.signal as AbortSignal | undefined;
      const pending = upstream.resolve(url, init);
      const reply = signal
        ? await Promise.race([pending, abortRejection(signal)])
        : await pending;

      if (reply.networkError) {
        throw new TypeError(reply.networkError);
      }
      return makeResponse(url, reply.status, reply.contentType, reply.text);
    };

    const sandbox: Record<string, unknown> = {
      fetch: fetchImpl,
      AbortController,
      AbortSignal,
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      queueMicrotask,
      TextDecoder,
      TextEncoder,
      URL,
      URLSearchParams,
      JSON,
      Math,
      Date,
      Promise,
      Error,
      TypeError,
      console,
      btoa: (s: string) => Buffer.from(s, "binary").toString("base64"),
      atob: (s: string) => Buffer.from(s, "base64").toString("binary"),
      // location 仅提供最小面，够 skill 里读 href/origin
      location: {
        href: this.currentUrl,
        origin: safeOrigin(this.currentUrl),
      },
    };

    const dom = this.buildDom();
    if (dom) {
      sandbox.document = dom.document;
      sandbox.window = dom.window;
      sandbox.Node = dom.Node;
      sandbox.NodeList = dom.NodeList;
    }

    return sandbox;
  }

  /**
   * 可选 DOM：仅在提供 html 且 linkedom 可用时注入。
   * 未安装 linkedom 时不注入 —— DOM 型回调会以 ReferenceError 失败，
   * 与"真机上没有该元素"同样是可见故障，不静默假装成功。
   */
  private buildDom():
    | { document: unknown; window: unknown; Node: unknown; NodeList: unknown }
    | undefined {
    if (!this.opts.html) return undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { parseHTML } = require("linkedom") as {
        parseHTML: (html: string) => {
          document: unknown;
          window: unknown;
          Node: unknown;
          NodeList: unknown;
        };
      };
      const parsed = parseHTML(this.opts.html);
      return {
        document: parsed.document,
        window: parsed.window,
        Node: parsed.Node,
        NodeList: parsed.NodeList,
      };
    } catch {
      return undefined;
    }
  }
}

function safeOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "null";
  }
}

/** vm realm 里的内建错误名 → 宿主 realm 的构造函数 */
const HOST_ERROR_CTORS: Record<string, ErrorConstructor> = {
  Error,
  TypeError: TypeError as unknown as ErrorConstructor,
  RangeError: RangeError as unknown as ErrorConstructor,
  ReferenceError: ReferenceError as unknown as ErrorConstructor,
  SyntaxError: SyntaxError as unknown as ErrorConstructor,
  EvalError: EvalError as unknown as ErrorConstructor,
  URIError: URIError as unknown as ErrorConstructor,
};

/**
 * 把 vm context 里抛出的错误搬回宿主 realm。
 *
 * V8 引擎在 vm 内部生成的错误（`xxx is not defined`、`undefined.foo`）挂的是
 * **该 context 自己的** Error.prototype，于是 Node 侧 `err instanceof Error`
 * 恒为 false。真机 puppeteer 不会这样 —— 它把浏览器侧的异常在 Node 进程内
 * 重建成本地 Error。若不搬运，替身会让 `toSpiderError` 走 `String(err)` 分支、
 * 让 `assert.rejects` 的类型匹配失效，属于替身独有的假象。
 *
 * 只搬内建错误：sandbox 里注入的 Error/TypeError 构造器本就是宿主的，
 * 由回调 `throw new Error(...)` 抛出的实例天然是宿主 realm，原样返回。
 */
function rethrowInHostRealm(err: unknown): unknown {
  if (err instanceof Error) return err;
  if (!nodeTypes.isNativeError(err)) return err;

  const src = err as Error;
  const Ctor = HOST_ERROR_CTORS[src.name] ?? Error;
  const host = new Ctor(src.message);
  if (src.name !== host.name) host.name = src.name;
  if (src.stack) host.stack = src.stack;
  return host;
}

/**
 * 把 AbortSignal 转成一个只会 reject 的 Promise。
 * 抛出的错误 name 为 "AbortError" —— 与真实 fetch 一致，
 * Goal 层 browserFetch 正是靠这个 name 判定 errorKind: "timeout"。
 */
function abortRejection(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    const fail = () => {
      const err = new Error("The operation was aborted.");
      err.name = "AbortError";
      reject(err);
    };
    if (signal.aborted) return fail();
    signal.addEventListener("abort", fail, { once: true });
  });
}

/** 构造 vm 内可用的 Response-like 对象（覆盖 executor.ts browserFetch 用到的面） */
function makeResponse(
  url: string,
  status: number,
  contentType: string,
  text: string,
): Record<string, unknown> {
  const headers = new Map<string, string>([["content-type", contentType]]);
  return {
    url,
    status,
    statusText: statusTextOf(status),
    ok: status >= 200 && status < 300,
    headers: {
      get: (k: string) => headers.get(k.toLowerCase()) ?? null,
      has: (k: string) => headers.has(k.toLowerCase()),
      forEach: (cb: (v: string, k: string) => void) =>
        headers.forEach((v, k) => cb(v, k)),
    },
    text: async () => text,
    json: async () => JSON.parse(text),
    arrayBuffer: async () => {
      const buf = Buffer.from(text, "binary");
      // 返回真正的 ArrayBuffer 切片，供 new Uint8Array(buf) 消费
      return buf.buffer.slice(
        buf.byteOffset,
        buf.byteOffset + buf.byteLength,
      );
    },
  };
}

function statusTextOf(status: number): string {
  const map: Record<number, string> = {
    200: "OK",
    204: "No Content",
    301: "Moved Permanently",
    302: "Found",
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    412: "Precondition Failed",
    429: "Too Many Requests",
    500: "Internal Server Error",
    502: "Bad Gateway",
    503: "Service Unavailable",
    504: "Gateway Timeout",
  };
  return map[status] ?? "";
}
