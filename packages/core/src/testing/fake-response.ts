// ============================================================================
// createFakeResponse — ResponseInterceptor 的回放替身
// ============================================================================
//
// 与 FakePage/FakeUpstream 不是一回事：那两个模拟的是**页面内 fetch**，
// 这个模拟的是 puppeteer 抛给 `page.on("response")` 的 Response 对象 ——
// 即 @CaptureResponse / @CaptureMedia 拦截器消费的那一面（函数式取值：
// `url()` / `status()`，而非属性）。配 FakePage.dispatch("response", r) 使用。
// ============================================================================

export interface FakeResponseLike {
  url: () => string;
  status: () => number;
  ok: () => boolean;
  headers: () => Record<string, string>;
  text: () => Promise<string>;
  json: () => Promise<unknown>;
  buffer: () => Promise<Buffer>;
  request: () => { resourceType: () => string };
}

export function createFakeResponse(opts: {
  url: string;
  status?: number;
  headers?: Record<string, string>;
  body: Buffer | string | object;
  resourceType?: string;
}): FakeResponseLike {
  const isBuffer = Buffer.isBuffer(opts.body);
  const isObject =
    !isBuffer && typeof opts.body === "object" && opts.body !== null;
  const buf = isBuffer
    ? (opts.body as Buffer)
    : Buffer.from(isObject ? JSON.stringify(opts.body) : String(opts.body));

  const status = opts.status ?? 200;
  return {
    url: () => opts.url,
    status: () => status,
    ok: () => status >= 200 && status < 300,
    headers: () => opts.headers ?? {},
    text: async () => buf.toString("utf-8"),
    json: async () => (isObject ? opts.body : JSON.parse(buf.toString("utf-8"))),
    buffer: async () => buf,
    request: () => ({ resourceType: () => opts.resourceType ?? "fetch" }),
  };
}
