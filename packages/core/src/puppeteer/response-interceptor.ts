import type { Page, HTTPResponse } from "puppeteer-core";
import {
  PageInterceptor,
  type InterceptorOptions,
  type CapturedEntry,
} from "./interceptor";
import { currentRuntime } from "../runtime";

// ============================================================================
// Types
// ============================================================================

/** 匹配器 — URL 正则 | content-type 前缀列表 | 自定义谓词 */
export type ResponseMatcher =
  | RegExp
  | string[]
  | ((response: HTTPResponse) => boolean);

/** 响应体解析方式 */
export type ResponseParse = "json" | "text" | "buffer";

/** ResponseInterceptor 配置 */
export interface ResponseInterceptorOptions extends InterceptorOptions {
  /** 匹配条件 — RegExp 匹配 URL；string[] 匹配 content-type 前缀；函数自定义 */
  match: ResponseMatcher;
  /** 响应体解析方式（默认：first→json, all→buffer） */
  parse?: ResponseParse;
}

// ============================================================================
// Matcher 归一化
// ============================================================================

function normalizeMatcher(
  match: ResponseMatcher,
): (response: HTTPResponse) => boolean {
  if (match instanceof RegExp) {
    return (r) => match.test(r.url());
  }
  if (Array.isArray(match)) {
    return (r) => {
      const ct = r.headers()["content-type"] ?? "";
      return match.some((prefix) => ct.startsWith(prefix));
    };
  }
  return match;
}

// ============================================================================
// ResponseInterceptor
// ============================================================================

/**
 * ResponseInterceptor — HTTP 响应拦截器。
 *
 * 继承 PageInterceptor 的 first/all 模式调度 + slot-based 内部状态，
 * 只关注 HTTP Response 的事件订阅、匹配和解析。
 */
export class ResponseInterceptor extends PageInterceptor<HTTPResponse> {
  private readonly matchFn: (response: HTTPResponse) => boolean;
  private readonly parse: ResponseParse;

  constructor(options: ResponseInterceptorOptions) {
    super(options);
    this.matchFn = normalizeMatcher(options.match);
    this.parse = options.parse ?? (this.mode === "all" ? "buffer" : "json");
  }

  protected subscribe(page: Page, handler: (event: HTTPResponse) => void) {
    page.on("response", handler);
  }

  protected unsubscribe(page: Page, handler: (event: HTTPResponse) => void) {
    page.off("response", handler);
  }

  protected matches(event: HTTPResponse): boolean {
    return this.matchFn(event);
  }

  protected async parseEvent(event: HTTPResponse): Promise<CapturedEntry> {
    const url = event.url();
    const mime = (event.headers()["content-type"] ?? "").split(";")[0];
    const body = await this.parseBody(event);
    let bodyRef;
    let bytes: number | undefined;
    try {
      bodyRef = currentRuntime().blobs.put(body, mime || undefined);
      bytes = bodyRef.bytes;
    } catch {
      /* obs failure must not break parse */
    }
    currentRuntime().events.emit({
      kind: "intercept.match",
      slot: this.resultSlot.name,
      url,
      mime,
      bytes,
      bodyRef,
    });
    return { url, mimeType: mime, body };
  }

  private async parseBody(response: HTTPResponse): Promise<unknown> {
    switch (this.parse) {
      case "text":
        return response.text();
      case "buffer":
        return response.buffer();
      default:
        return response.json();
    }
  }
}
