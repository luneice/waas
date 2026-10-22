import type {
  BrowserAcquireOptions,
  BrowserEndpoint,
  IBrowserConnector,
  IBrowserSessionProvider,
  PageSession,
} from "./interfaces";
import { CDPConnector } from "./cdp-connector";
import { PooledConnector } from "./pooled-connector";
import { BrowserPool } from "./pool";
import { CompositeRouter } from "./router";
import { loadBrowserEndpoints } from "./config";
import { currentRuntime } from "../runtime";

/** ChromeSessionProvider 构造选项 */
export interface ChromeSessionProviderOptions {
  /** 默认 CDP 浏览器地址（单节点模式） */
  browserURL?: string;
  /** 连接超时 ms（默认 10_000） */
  connectTimeoutMs?: number;
  /** 直接注入连接器（跳过自动解析） */
  connector?: IBrowserConnector;
  /** 显式传入端点列表（优先级最高） */
  endpoints?: BrowserEndpoint[];
}

/**
 * 浏览器会话提供者 — 下层 Skill 的唯一入口
 *
 * 下层不关心浏览器从哪里来（本地 CDP、远程 WS、连接池、手机浏览器……），
 * ChromeSessionProvider 通过注入的 IBrowserConnector 获取 Browser 实例，
 * 再统一创建 Page 并返回 PageSession。
 *
 * 使用方式:
 * - 最简: new ChromeSessionProvider({ browserURL })
 * - 自动多端点: new ChromeSessionProvider()  // 读取环境/配置
 * - 自定义连接器: new ChromeSessionProvider({ connector: myConnector })
 */
export class ChromeSessionProvider implements IBrowserSessionProvider {
  private readonly connector: IBrowserConnector;

  constructor(options?: ChromeSessionProviderOptions) {
    this.connector = options?.connector ?? resolveConnector(options);
  }

  async acquire(options?: BrowserAcquireOptions): Promise<PageSession> {
    const lease = await this.connector.acquire(options);

    try {
      const page = await lease.browser.newPage();
      await page.setViewport(null);

      const released = { value: false };
      return {
        page,
        async release() {
          if (released.value) return;
          released.value = true;
          try {
            await page.close();
          } catch (err) {
            currentRuntime().events.emitError({
              errorKind: "browser-provider.page-close",
              category: "browser",
              phase: "release",
              scope: "browser.provider",
              message: "Failed to close page",
              error: err,
            });
          } finally {
            lease.release();
          }
        },
      };
    } catch (err) {
      lease.release();
      throw err;
    }
  }

  async getWSEndpoint(options?: {
    browserURL?: string;
    timeoutMs?: number;
  }): Promise<string | null> {
    return this.connector.getWSEndpoint(options);
  }
}

/**
 * 根据配置自动选择连接器
 *
 * 决策: 单默认端点 → CDPConnector；多端点 → PooledConnector
 */
function resolveConnector(
  options?: Omit<ChromeSessionProviderOptions, "connector">,
): IBrowserConnector {
  const browserURL = options?.browserURL ?? "http://127.0.0.1:4444";
  const connectTimeoutMs = options?.connectTimeoutMs ?? 10_000;
  const endpoints = options?.endpoints ?? loadBrowserEndpoints({ browserURL });

  // 单个默认端点 → 不需要池化开销
  if (endpoints.length === 1 && endpoints[0].url === browserURL) {
    return new CDPConnector(browserURL, connectTimeoutMs);
  }

  // 多端点 → 池化 + 路由
  const pool = new BrowserPool(endpoints, new CompositeRouter(), {
    connectTimeoutMs,
  });
  return new PooledConnector(pool);
}
