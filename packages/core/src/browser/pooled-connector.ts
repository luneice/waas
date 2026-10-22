import type {
  BrowserAcquireOptions,
  BrowserLease,
  IBrowserConnector,
} from "./interfaces";
import type { BrowserPool } from "./pool";

/**
 * 池化连接器 — 委托 BrowserPool 获取浏览器连接
 *
 * 支持多端点路由、并发控制、健康检查、自动重连。
 * 适用于多节点远程浏览器集群场景。
 */
export class PooledConnector implements IBrowserConnector {
  constructor(private readonly pool: BrowserPool) {}

  async acquire(options?: BrowserAcquireOptions): Promise<BrowserLease> {
    return this.pool.acquireBrowserLease({
      site: options?.site,
      requiredTags: options?.requiredTags,
    });
  }

  async getWSEndpoint(options?: {
    browserURL?: string;
    timeoutMs?: number;
  }): Promise<string | null> {
    return this.pool.getWSEndpoint();
  }

  async dispose(): Promise<void> {
    return this.pool.dispose();
  }
}
