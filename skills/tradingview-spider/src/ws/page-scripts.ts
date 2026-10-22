/**
 * ★★★ 页面上下文脚本 —— 全包唯一跨 `page.evaluate` 序列化边界的文件 ★★★
 *
 * ══════════════════════ 本文件的硬性纪律（改动前必读）══════════════════════
 *
 * `page.evaluate(fn)` 会把 fn **字符串化**后丢进浏览器执行 —— 回调内看不到任何
 * 模块作用域。再叠加 CLAUDE.md §7 红线 1（业务 bundle 的混淆器会把字面量提出
 * 回调），任何对外部标识符的引用都会在真机上炸成 `xxx is not defined`，而且只在
 * **正式态构建后**才暴露，是本包最难排查的一类故障。
 *
 * 因此本文件的每个导出必须满足：
 *   1. 形如 `const fn = async (arg: XArg): Promise<XRet> => {...}`，**恰好一个参数**，
 *      入参与返回值都是 JSON 可序列化的纯数据；
 *   2. **禁止引用任何模块作用域标识符** —— 不 import、不用常量、不调用外部函数。
 *      URL、超时、window 键名、鉴权字面量一律从 `arg` 传入。这同时让回调内几乎
 *      没有字面量可供混淆器提取，从根上消解红线 1；
 *   3. 需要的 helper（编帧/拆帧约 15 行）在箭头函数体内**就地重声明**。
 *
 * 第 3 条是刻意的重复 —— 它与 `ws/frame.ts` 的实现重复了。备选方案（拼接
 * `fn.toString()` 源码注入）在 esbuild + 混淆下脆弱得多。`test/unit/page-scripts.test.ts`
 * 把这里的重复实现钉死在 `ws/frame.ts` 的行为上，两者漂移会立刻测试失败。
 *
 * ═════════════════════════ 页面侧的职责边界 ═════════════════════════
 *
 * 页面里只放「笨泵」：socket、帧缓冲、**心跳即时回声**。心跳必须在页面内回，
 * 不能等 Node 轮询回来再回（会被上游判定为掉线）。
 * 会话生命周期、增量合并、翻页决策、超时、错误分类全在 Node 侧（`ws/client.ts`）。
 */

// ============================================================================
// 入参 / 返回值契约
// ============================================================================

export interface PageFetchArg {
  url: string;
  method: string;
  /** 请求头；Origin/Referer 由浏览器按页面来源自动带上，无需也不应手工设置 */
  headers: Record<string, string>;
  body: string | null;
  timeoutMs: number;
}

export interface PageFetchRet {
  ok: boolean;
  status: number;
  /** 原始响应文本；由 Node 侧解析，避免解析异常在页面内静默吞掉 */
  text: string;
  /** 传输层失败分类（HTTP 非 2xx 不算这里，由 Node 侧按 status 判） */
  errorKind: "timeout" | "network" | null;
  error: string | null;
}

export interface PageWsOpenArg {
  url: string;
  /**
   * 已在 Node 侧编好帧的初始化消息（set_data_quality / set_auth_token / set_locale）。
   *
   * ⚠️ 其中 `set_auth_token` 里是**占位串**；`authTokenPlaceholder` 非空时，
   * 页面侧会就地把它替换成页面自身的登录 token（详见该字段注释）。
   */
  frames: string[];
  /** window 上的状态存储键 */
  key: string;
  openTimeoutMs: number;
  /** 帧缓冲上限，超出丢弃最旧帧并计数 */
  maxBufferedFrames: number;
  /**
   * 需要被替换成真实登录 token 的占位串；为空串则不做替换。
   *
   * ══════════════ 为什么必须在页面侧替换 ══════════════
   *
   * 技术指标（create_study）要求**真实的登录 token**，传固定字面量会被上游拒绝
   * （`Study not allowed in this connection`）。而 CLAUDE.md §4.6 明令
   * 「不得把 Cookie/Token 提取到 Node 层」—— 所以 token 只能在页面内取、
   * 页面内用，Node 侧从头到尾看不到它，只知道有没有取到（布尔）。
   *
   * 行情与 K 线不需要它（游客态即可），故仅指标链路启用。
   */
  authTokenPlaceholder: string;
}

export interface PageWsOpenRet {
  ok: boolean;
  /** 握手 hello 帧的原始文本 */
  hello: string | null;
  errorKind: "timeout" | "socket" | null;
  error: string | null;
  /**
   * 是否成功取到并注入了页面的登录 token。
   *
   * 只回布尔，**绝不回 token 本体**（那会让凭据越过页面边界）。
   * false 且请求方需要登录态时，由 Node 侧据此给出"请先登录"的引导。
   */
  authInjected: boolean;
}


export interface PageWsSendArg {
  key: string;
  frames: string[];
}

export interface PageWsSendRet {
  ok: boolean;
  error: string | null;
}

export interface PageWsDrainArg {
  key: string;
  maxWaitMs: number;
}

export interface PageWsDrainRet {
  ok: boolean;
  /** 原始 payload 文本（不含心跳帧，心跳已在页面内回声并吞掉） */
  payloads: string[];
  closed: boolean;
  closeCode: number | null;
  closeReason: string | null;
  /** 累计因缓冲上限被丢弃的帧数 */
  dropped: number;
  error: string | null;
}

export interface PageWsCloseArg {
  key: string;
}

export interface PageWsCloseRet {
  ok: boolean;
}

// ============================================================================
// 页面脚本（以下函数体内禁止出现任何模块作用域标识符）
// ============================================================================

/**
 * 页面内 fetch —— 继承页面的 Origin / Referer / Cookie，满足 CLAUDE.md §4.6。
 *
 * 不抛异常，一律返回 `{ok, errorKind}` 由 Node 侧映射成 SpiderError：
 * 异常跨 evaluate 边界后只剩 message，类型信息会丢失。
 */
export const pageFetchJson = async (
  arg: PageFetchArg,
): Promise<PageFetchRet> => {
  // ⚠️ esbuild/tsx 会给函数体内的具名声明注入 `__name()` helper（用于保留函数名）。
  // 该 helper 定义在模块作用域，**不会随 fn.toString() 一起过 evaluate 边界**，
  // 于是真机报 `__name is not defined` —— 单测抓不到，只在跨边界时暴露。
  // 这里在页面侧自备一个同名兜底：已存在则不覆盖，不存在则补一个恒等实现。
  const g = globalThis as unknown as Record<string, unknown>;
  if (typeof g.__name !== "function") g.__name = (fn: unknown) => fn;
  const controller = new AbortController();
  const timer = arg.timeoutMs
    ? setTimeout(() => controller.abort(), arg.timeoutMs)
    : null;
  try {
    const init: RequestInit = {
      method: arg.method,
      headers: arg.headers,
      credentials: "include",
      signal: controller.signal,
    };
    if (arg.body !== null) init.body = arg.body;

    const resp = await fetch(arg.url, init);
    const text = await resp.text();
    return {
      ok: resp.ok,
      status: resp.status,
      text,
      errorKind: null,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      status: 0,
      text: "",
      errorKind: aborted ? "timeout" : "network",
      error: message,
    };
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
};

/**
 * 建立 WS 连接并把 socket 挂在 `window[key]`。
 *
 * onmessage 里做三件事：拆帧 → 心跳原样回声 → 业务 payload 入缓冲。
 * 解析成功与否不在这里判断（返回原始文本给 Node 侧解析）—— 页面内 throw 会静默
 * 打死 socket。
 */
export const pageWsOpen = async (
  arg: PageWsOpenArg,
): Promise<PageWsOpenRet> => {
  // ⚠️ esbuild/tsx 会给函数体内的具名声明注入 `__name()` helper（用于保留函数名）。
  // 该 helper 定义在模块作用域，**不会随 fn.toString() 一起过 evaluate 边界**，
  // 于是真机报 `__name is not defined` —— 单测抓不到，只在跨边界时暴露。
  // 这里在页面侧自备一个同名兜底：已存在则不覆盖，不存在则补一个恒等实现。
  const g = globalThis as unknown as Record<string, unknown>;
  if (typeof g.__name !== "function") g.__name = (fn: unknown) => fn;
  // ── 就地重声明的拆帧逻辑（与 ws/frame.ts 等价，见文件头第 3 条纪律）──
  const splitFrames = (raw: string): string[] => {
    const out: string[] = [];
    const re = /~m~(\d+)~m~/g;
    let match = re.exec(raw);
    while (match !== null) {
      const start = match.index + match[0].length;
      re.lastIndex = start;
      const next = re.exec(raw);
      // 按分隔符切分而非按声明的字节长度：payload 含中文时
      // 声明的「字节数」≠ JS 字符串「字符数」，按数字切会截断多字节字符
      out.push(raw.slice(start, next === null ? raw.length : next.index));
      match = next;
    }
    return out;
  };

  const w = window as unknown as Record<string, unknown>;

  // ── 页面侧就地注入登录 token（凭据不出页面，见 authTokenPlaceholder 注释）──
  let authInjected = false;
  let frames = arg.frames;
  if (arg.authTokenPlaceholder !== "") {
    // 站点在已登录时把 token 内联进 `var user = {...}` 的 auth_token 字段
    const u = w.user as { auth_token?: unknown } | undefined;
    const token = u === undefined ? undefined : u.auth_token;
    if (typeof token === "string" && token.length > 0) {
      // 帧的字节长度会因替换而变，必须重新编帧（不能只换 payload 里的串）
      frames = arg.frames.map((f) => {
        const at = f.indexOf(arg.authTokenPlaceholder);
        if (at === -1) return f;
        const sep = f.indexOf("~m~", 3);
        const payload = sep === -1 ? f : f.slice(sep + 3);
        const replaced = payload.split(arg.authTokenPlaceholder).join(token);
        return "~m~" + new TextEncoder().encode(replaced).length + "~m~" + replaced;
      });
      authInjected = true;
    }
  }

  return await new Promise<PageWsOpenRet>((resolve) => {
    let settled = false;
    const finish = (ret: PageWsOpenRet): void => {
      if (settled) return;
      settled = true;
      resolve(ret);
    };

    let sock: WebSocket;
    try {
      sock = new WebSocket(arg.url);
    } catch (err) {
      finish({
        ok: false,
        hello: null,
        errorKind: "socket",
        error: err instanceof Error ? err.message : String(err),
        authInjected,
      });
      return;
    }

    const state = {
      sock,
      buf: [] as string[],
      dropped: 0,
      closed: false,
      closeCode: null as number | null,
      closeReason: null as string | null,
      waiter: null as null | (() => void),
    };
    w[arg.key] = state;

    const timer = setTimeout(() => {
      finish({
        ok: false,
        hello: null,
        errorKind: "timeout",
        error: "WebSocket open timeout",
        authInjected,
      });
    }, arg.openTimeoutMs);

    sock.onopen = () => {
      for (const f of frames) sock.send(f);
    };

    sock.onmessage = (ev: MessageEvent) => {
      const raw = typeof ev.data === "string" ? ev.data : "";
      for (const chunk of splitFrames(raw)) {
        if (chunk.indexOf("~h~") === 0) {
          // 心跳必须立刻原样回声，不能等 Node 轮询
          try {
            sock.send("~m~" + chunk.length + "~m~" + chunk);
          } catch {
            /* socket 已关闭，忽略 */
          }
          continue;
        }
        if (state.buf.length >= arg.maxBufferedFrames) {
          state.buf.shift();
          state.dropped += 1;
        }
        state.buf.push(chunk);
        if (!settled) {
          clearTimeout(timer);
          finish({
            ok: true,
            hello: chunk,
            errorKind: null,
            error: null,
            authInjected,
          });
        }
      }
      if (state.waiter !== null) {
        const notify = state.waiter;
        state.waiter = null;
        notify();
      }
    };

    sock.onerror = () => {
      clearTimeout(timer);
      finish({
        ok: false,
        hello: null,
        errorKind: "socket",
        error: "WebSocket error event",
        authInjected,
      });
    };

    sock.onclose = (ev: CloseEvent) => {
      state.closed = true;
      state.closeCode = ev.code;
      state.closeReason = ev.reason;
      clearTimeout(timer);
      if (state.waiter !== null) {
        const notify = state.waiter;
        state.waiter = null;
        notify();
      }
      finish({
        ok: false,
        hello: null,
        errorKind: "socket",
        error: "WebSocket closed before handshake (code=" + ev.code + ")",
        authInjected,
      });
    };
  });
};

/** 发送已编好帧的消息 */
export const pageWsSend = async (
  arg: PageWsSendArg,
): Promise<PageWsSendRet> => {
  // ⚠️ esbuild/tsx 会给函数体内的具名声明注入 `__name()` helper（用于保留函数名）。
  // 该 helper 定义在模块作用域，**不会随 fn.toString() 一起过 evaluate 边界**，
  // 于是真机报 `__name is not defined` —— 单测抓不到，只在跨边界时暴露。
  // 这里在页面侧自备一个同名兜底：已存在则不覆盖，不存在则补一个恒等实现。
  const g = globalThis as unknown as Record<string, unknown>;
  if (typeof g.__name !== "function") g.__name = (fn: unknown) => fn;
  const w = window as unknown as Record<string, unknown>;
  const state = w[arg.key] as { sock: WebSocket; closed: boolean } | undefined;
  if (state === undefined) {
    return { ok: false, error: "WebSocket state not found" };
  }
  if (state.closed) {
    return { ok: false, error: "WebSocket already closed" };
  }
  try {
    for (const f of arg.frames) state.sock.send(f);
    return { ok: true, error: null };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
};

/**
 * 取走缓冲区里的业务帧。
 *
 * 缓冲非空立刻返回；为空则挂 waiter 等 `maxWaitMs`（保持远小于 puppeteer 协议
 * 超时），期间来帧会提前唤醒。
 */
export const pageWsDrain = async (
  arg: PageWsDrainArg,
): Promise<PageWsDrainRet> => {
  // ⚠️ esbuild/tsx 会给函数体内的具名声明注入 `__name()` helper（用于保留函数名）。
  // 该 helper 定义在模块作用域，**不会随 fn.toString() 一起过 evaluate 边界**，
  // 于是真机报 `__name is not defined` —— 单测抓不到，只在跨边界时暴露。
  // 这里在页面侧自备一个同名兜底：已存在则不覆盖，不存在则补一个恒等实现。
  const g = globalThis as unknown as Record<string, unknown>;
  if (typeof g.__name !== "function") g.__name = (fn: unknown) => fn;
  const w = window as unknown as Record<string, unknown>;
  const state = w[arg.key] as
    | {
        buf: string[];
        dropped: number;
        closed: boolean;
        closeCode: number | null;
        closeReason: string | null;
        waiter: null | (() => void);
      }
    | undefined;

  if (state === undefined) {
    return {
      ok: false,
      payloads: [],
      closed: true,
      closeCode: null,
      closeReason: null,
      dropped: 0,
      error: "WebSocket state not found",
    };
  }

  if (state.buf.length === 0 && !state.closed) {
    await new Promise<void>((resolve) => {
      let done = false;
      const finish = (): void => {
        if (done) return;
        done = true;
        state.waiter = null;
        resolve();
      };
      state.waiter = finish;
      setTimeout(finish, arg.maxWaitMs);
    });
  }

  const payloads = state.buf.splice(0, state.buf.length);
  return {
    ok: true,
    payloads,
    closed: state.closed,
    closeCode: state.closeCode,
    closeReason: state.closeReason,
    dropped: state.dropped,
    error: null,
  };
};

/** 关闭连接并清理页面状态（幂等） */
export const pageWsClose = async (
  arg: PageWsCloseArg,
): Promise<PageWsCloseRet> => {
  // ⚠️ esbuild/tsx 会给函数体内的具名声明注入 `__name()` helper（用于保留函数名）。
  // 该 helper 定义在模块作用域，**不会随 fn.toString() 一起过 evaluate 边界**，
  // 于是真机报 `__name is not defined` —— 单测抓不到，只在跨边界时暴露。
  // 这里在页面侧自备一个同名兜底：已存在则不覆盖，不存在则补一个恒等实现。
  const g = globalThis as unknown as Record<string, unknown>;
  if (typeof g.__name !== "function") g.__name = (fn: unknown) => fn;
  const w = window as unknown as Record<string, unknown>;
  const state = w[arg.key] as { sock: WebSocket } | undefined;
  if (state !== undefined) {
    try {
      state.sock.close();
    } catch {
      /* 已关闭，忽略 */
    }
    delete w[arg.key];
  }
  return { ok: true };
};
