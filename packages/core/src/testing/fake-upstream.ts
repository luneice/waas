// ============================================================================
// FakeUpstream — 「URL 模式 → fixture 响应」路由表
// ============================================================================
//
// 测试替身链路里唯一的"上游"。FakePage.evaluate 内注入的 fetch 由它应答，
// 所以 Goal 层 executeOnce / executeWithRetry / 分页 / 展开的全部行为都能
// 在无网络、无浏览器的前提下被驱动。
//
// 三条设计约束：
//   1. **未命中默认 throw**（不静默兜底）—— fixture 缺口是测试缺陷，
//      让它当场炸掉，而不是回一个 200 空对象把 bug 掩盖成"通过"。
//   2. **多 reply 按调用次序轮换** —— 翻页/重试场景无需写有状态的 handler：
//      route(/list/, page1, page2, page3) 即可表达三页；末位 reply 在用尽后
//      持续复用（表达"稳定态"），需要"第四次就该失败"时显式再给一个 reply。
//   3. **calls 全量记录** —— 请求次序 / 次数 / URL / init 都可断言，
//      这是验证"重试了几次""并发分块间隔"这类行为的唯一手段。
// ============================================================================

/** 一条 fixture 应答 */
export interface FixtureReply {
  /** HTTP 状态码，默认 200 */
  status?: number;
  /** 响应体：对象 → JSON 序列化；字符串 → 原样（可表达 HTML 风控页） */
  body: unknown;
  /** Content-Type，默认按 body 类型推断 */
  contentType?: string;
  /** 延迟 ms —— 用于制造并发交错、触发超时路径 */
  delayMs?: number;
  /**
   * 网络层失败：设置后不返回响应，而是让 fetch 直接 reject（模拟断网/DNS 失败）。
   * 与 status 互斥，优先级更高。
   */
  networkError?: string;
}

/** 一次被记录的请求 */
export interface RecordedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  /** 请求体原文（string），未发送 body 时为 undefined */
  body?: string;
}

interface RouteEntry {
  match: string | RegExp;
  replies: FixtureReply[];
  /** 该路由已被命中的次数 —— 决定取第几个 reply */
  hits: number;
}

/** FakePage 内部使用的应答形态（已解析好，不含匹配逻辑） */
export interface ResolvedReply {
  status: number;
  contentType: string;
  /** 响应体文本 */
  text: string;
  delayMs: number;
  networkError?: string;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

function inferContentType(body: unknown): string {
  if (typeof body === "string") {
    return body.trimStart().startsWith("<")
      ? "text/html; charset=utf-8"
      : "text/plain; charset=utf-8";
  }
  return "application/json; charset=utf-8";
}

function serializeBody(body: unknown): string {
  if (typeof body === "string") return body;
  if (body === undefined) return "";
  return JSON.stringify(body);
}

/**
 * 上游替身。用法：
 *
 * ```typescript
 * const upstream = new FakeUpstream()
 *   .route(/\/api\/list/, { body: PAGE_1 }, { body: PAGE_2 })
 *   .route("/api/detail", { body: DETAIL });
 * ```
 */
export class FakeUpstream {
  private readonly routes: RouteEntry[] = [];
  private unmatched: "throw" | FixtureReply = "throw";
  private readonly recorded: RecordedCall[] = [];

  /**
   * 注册路由。
   *
   * @param match 字符串（子串包含匹配）或正则
   * @param replies 一个或多个应答，按该路由被命中的次序依次返回；
   *                用尽后持续复用最后一个
   */
  route(match: string | RegExp, ...replies: FixtureReply[]): this {
    if (replies.length === 0) {
      throw new Error(`FakeUpstream.route("${String(match)}") 至少需要一个 reply`);
    }
    this.routes.push({ match, replies, hits: 0 });
    return this;
  }

  /** 未命中策略：默认 "throw"（fixture 缺口即测试失败） */
  onUnmatched(policy: "throw" | FixtureReply): this {
    this.unmatched = policy;
    return this;
  }

  /** 按调用次序记录的全部请求 */
  get calls(): readonly RecordedCall[] {
    return this.recorded;
  }

  /** 命中指定路由模式的调用（断言重试次数 / 翻页页数用） */
  callsMatching(match: string | RegExp): RecordedCall[] {
    return this.recorded.filter((c) => matches(c.url, match));
  }

  /** 清空调用记录与路由命中计数（同一实例跨用例复用时调用） */
  reset(): void {
    this.recorded.length = 0;
    for (const r of this.routes) r.hits = 0;
  }

  /**
   * 解析一次请求 —— 由 FakePage 注入的 fetch 调用。
   * 记录调用、按次序取 reply、施加 delayMs。
   */
  async resolve(url: string, init?: RequestInit): Promise<ResolvedReply> {
    const method = (init?.method ?? "GET").toUpperCase();
    const headers = normalizeHeaders(init?.headers);
    const body =
      typeof init?.body === "string" ? init.body : undefined;
    this.recorded.push({ url, method, headers, body });

    const entry = this.routes.find((r) => matches(url, r.match));
    let reply: FixtureReply;
    if (entry) {
      const idx = Math.min(entry.hits, entry.replies.length - 1);
      entry.hits++;
      reply = entry.replies[idx];
    } else if (this.unmatched === "throw") {
      throw new Error(
        `FakeUpstream: 无 fixture 匹配 ${method} ${url}。` +
          `已注册路由 [${this.routes.map((r) => String(r.match)).join(", ")}]。` +
          `补 route(...) 或显式 onUnmatched({...}) 兜底。`,
      );
    } else {
      reply = this.unmatched;
    }

    const delayMs = reply.delayMs ?? 0;
    if (delayMs > 0) await sleep(delayMs);

    return {
      status: reply.status ?? 200,
      contentType: reply.contentType ?? inferContentType(reply.body),
      text: serializeBody(reply.body),
      delayMs,
      networkError: reply.networkError,
    };
  }
}

function matches(url: string, match: string | RegExp): boolean {
  return typeof match === "string" ? url.includes(match) : match.test(url);
}

function normalizeHeaders(
  headers: RequestInit["headers"],
): Record<string, string> {
  if (!headers) return {};
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers as Array<[string, string]>);
  }
  // Headers 实例有 forEach，普通对象没有
  if (typeof (headers as { forEach?: unknown }).forEach === "function") {
    const out: Record<string, string> = {};
    (headers as Headers).forEach((v, k) => {
      out[k] = v;
    });
    return out;
  }
  return { ...(headers as Record<string, string>) };
}
