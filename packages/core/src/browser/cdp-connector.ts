import { connect, type Browser } from "puppeteer-core";
import type {
  BrowserAcquireOptions,
  BrowserLease,
  IBrowserConnector,
} from "./interfaces";
import { BrowserUnavailableError, SpiderError } from "../errors";
import { currentRuntime } from "../runtime";

/**
 * CDP 连接器 — 通过 HTTP CDP 端点连接单个 Chrome 实例
 *
 * 每次 acquire() 建立新的 puppeteer 连接，调用方通过 lease.release() 断开。
 * 这是最基本的连接策略，适用于本地或单节点远程 Chrome。
 */
export class CDPConnector implements IBrowserConnector {
  constructor(
    private readonly browserURL: string = "http://127.0.0.1:4444",
    private readonly connectTimeoutMs: number = 10_000,
  ) {}

  async acquire(options?: BrowserAcquireOptions): Promise<BrowserLease> {
    const url = options?.browserURL ?? this.browserURL;
    const browser = await connectWithTimeout(url, this.connectTimeoutMs);

    let released = false;
    return {
      browser,
      release() {
        if (released) return;
        released = true;
        browser.disconnect();
      },
    };
  }

  async getWSEndpoint(options?: {
    browserURL?: string;
    timeoutMs?: number;
  }): Promise<string | null> {
    const url = options?.browserURL ?? this.browserURL;
    const timeoutMs = options?.timeoutMs ?? this.connectTimeoutMs;
    try {
      const versionUrl = new URL("/json/version", url).toString();
      const response = await fetch(versionUrl, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) return null;
      const payload = (await response.json()) as {
        webSocketDebuggerUrl?: string;
      };
      return payload.webSocketDebuggerUrl ?? null;
    } catch (err) {
      currentRuntime().events.emitError({
        errorKind: "browser-cdp.websocket-endpoint",
        category: "browser",
        phase: "getWSEndpoint",
        scope: "browser.cdp",
        message: "Failed to resolve websocket endpoint",
        error: err,
        details: { browserURL: url },
      });
      return null;
    }
  }
}

/**
 * 带超时的 puppeteer.connect — 超时后清理泄漏的连接。
 *
 * 无论是超时还是 connect 本身失败（Chrome 未启动 / 端口不通），一律抛
 * BrowserUnavailableError。**不能抛裸 Error**：BaseSkill.normalizeFailure
 * 只对 string 类型解析 `[kind]` 前缀，Error 实例会被兜底成 pipeline-error，
 * 导致本该重试的"浏览器不可用"被判为不可重试。
 */
async function connectWithTimeout(
  browserURL: string,
  timeoutMs: number,
): Promise<Browser> {
  let timedOut = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const connectPromise = connect({ browserURL, defaultViewport: null });
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      reject(
        new BrowserUnavailableError(
          `puppeteer.connect 超时（${timeoutMs}ms），browserURL=${browserURL}`,
          {
            phase: "connect",
            scope: "browser.cdp",
            details: { browserURL, timeoutMs },
          },
        ),
      );
    }, timeoutMs);
  });

  connectPromise
    .then((browser) => {
      if (!timedOut) return;
      try {
        browser.disconnect();
      } catch (err) {
        currentRuntime().events.emitError({
          errorKind: "browser-cdp.late-cleanup",
          category: "browser",
          phase: "connectWithTimeout",
          scope: "browser.cdp",
          message: "Failed to cleanup late browser connection",
          error: err,
          details: { browserURL },
        });
      }
    })
    .catch((err) => {
      if (!timedOut) return;
      currentRuntime().events.emitError({
        errorKind: "browser-cdp.late-connect-failure",
        category: "browser",
        phase: "connectWithTimeout",
        scope: "browser.cdp",
        message: "Late puppeteer.connect failed after timeout",
        error: err,
        details: { browserURL },
      });
    });

  try {
    return await Promise.race([connectPromise, timeoutPromise]);
  } catch (err) {
    if (err instanceof SpiderError) throw err;
    // puppeteer.connect 自身失败（ECONNREFUSED / 端口无 CDP 服务等）
    throw new BrowserUnavailableError(
      `puppeteer.connect 失败，browserURL=${browserURL}：${
        err instanceof Error ? err.message : String(err)
      }`,
      {
        phase: "connect",
        scope: "browser.cdp",
        details: { browserURL },
        cause: err,
      },
    );
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
