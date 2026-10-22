import { connect, type Browser } from "puppeteer-core";
import type {
  BrowserEndpoint,
  BrowserLease,
  EndpointHealth,
  EndpointStatus,
  IBrowserPool,
  IBrowserRouter,
  PageSession,
  RouteConstraints,
} from "./interfaces";
import {
  BrowserAcquireTimeoutError,
  BrowserUnavailableError,
  InvalidParamsError,
} from "../errors";
import { currentRuntime } from "../runtime";

// ============================================================================
// 内部: 单个 endpoint 的连接管理
// ============================================================================

interface PooledConnection {
  browser: Browser;
  activePages: number;
  status: EndpointStatus;
  lastCheckedAt: Date | null;
  lastError?: string;
  healthTimer?: ReturnType<typeof setInterval>;
}

/** 并发槽位等待者 —— 超时或 dispose 时需要 reject，不能只丢弃 resolve */
interface SlotWaiter {
  resolve(): void;
  reject(err: unknown): void;
}

// ============================================================================
// BrowserPool
// ============================================================================

export interface BrowserPoolOptions {
  /** 连接超时 ms（默认 10_000） */
  connectTimeoutMs?: number;
  /** 健康检查间隔 ms（默认 30_000，0 = 不检查） */
  defaultHealthCheckIntervalMs?: number;
  /** 等待并发槽位的超时 ms（默认 60_000，0 = 不限时） */
  acquireTimeoutMs?: number;
}

/**
 * 浏览器连接池 — 管理多个远程 Chrome 实例
 *
 * 每个 BrowserEndpoint 维护一个长连接 (Browser)，多次调用复用连接并创建新 Page。
 * 支持并发控制、健康检查、自动重连。
 */
export class BrowserPool implements IBrowserPool {
  private readonly endpoints: BrowserEndpoint[];
  private readonly router: IBrowserRouter;
  private readonly connections = new Map<string, PooledConnection>();
  private readonly waitQueues = new Map<string, SlotWaiter[]>();
  private readonly health = new Map<string, EndpointHealth>();
  private readonly connectTimeoutMs: number;
  private readonly defaultHealthCheckIntervalMs: number;
  private readonly acquireTimeoutMs: number;
  private readonly healthTimer?: ReturnType<typeof setInterval>;
  private disposed = false;

  constructor(
    endpoints: BrowserEndpoint[],
    router: IBrowserRouter,
    options?: BrowserPoolOptions,
  ) {
    if (endpoints.length === 0) {
      throw new InvalidParamsError("BrowserPool 至少需要一个 endpoint", {
        scope: "browser.pool",
      });
    }
    this.endpoints = endpoints;
    this.router = router;
    this.connectTimeoutMs = options?.connectTimeoutMs ?? 10_000;
    this.defaultHealthCheckIntervalMs =
      options?.defaultHealthCheckIntervalMs ?? 30_000;
    this.acquireTimeoutMs = options?.acquireTimeoutMs ?? 60_000;
    if (this.defaultHealthCheckIntervalMs > 0) {
      this.healthTimer = setInterval(() => {
        void this.healthCheck().catch((err) => {
          this.emitError("health-check", err);
        });
      }, this.defaultHealthCheckIntervalMs);
      this.healthTimer.unref?.();
    }
  }

  // ── Public API ──

  async acquirePage(endpointId: string): Promise<PageSession> {
    const endpoint = this.endpoints.find((e) => e.id === endpointId);
    if (!endpoint) {
      throw new BrowserUnavailableError(`未知 endpoint: ${endpointId}`, {
        phase: "acquirePage",
        scope: "browser.pool",
        details: { endpointId },
      });
    }
    return this.acquireFromEndpoint(endpoint);
  }

  async acquirePageFor(constraints?: RouteConstraints): Promise<PageSession> {
    const healthMap = this.getHealthMap();
    const endpoint = this.router.route(
      constraints ?? {},
      this.endpoints,
      healthMap,
    );
    if (!endpoint) {
      throw new BrowserUnavailableError(
        "没有健康的 endpoint 满足路由约束",
        {
          phase: "acquirePageFor",
          scope: "browser.pool",
          details: { constraints },
        },
      );
    }
    return this.acquireFromEndpoint(endpoint);
  }

  /**
   * 按路由约束获取浏览器租约（Browser 级别，不创建 Page）
   *
   * 调用方通过 lease.release() 归还并发配额。
   * ChromeSessionProvider 用此方法获取 Browser 后自行创建 Page。
   */
  async acquireBrowserLease(
    constraints?: RouteConstraints,
  ): Promise<BrowserLease> {
    const healthMap = this.getHealthMap();
    const endpoint = this.router.route(
      constraints ?? {},
      this.endpoints,
      healthMap,
    );
    if (!endpoint) {
      throw new BrowserUnavailableError(
        "没有健康的 endpoint 满足路由约束",
        {
          phase: "acquireBrowserLease",
          scope: "browser.pool",
          details: { constraints },
        },
      );
    }
    return this.acquireLeaseFromEndpoint(endpoint);
  }

  async getWSEndpoint(endpointId?: string): Promise<string | null> {
    const endpoint = endpointId
      ? this.endpoints.find((e) => e.id === endpointId)
      : this.endpoints[0];
    if (!endpoint) return null;

    try {
      const versionUrl = new URL("/json/version", endpoint.url).toString();
      const response = await fetch(versionUrl, {
        signal: AbortSignal.timeout(this.connectTimeoutMs),
      });
      if (!response.ok) return null;
      const payload = (await response.json()) as {
        webSocketDebuggerUrl?: string;
      };
      return payload.webSocketDebuggerUrl ?? null;
    } catch (err) {
      this.emitError("getWSEndpoint", err, { endpointId: endpoint.id });
      return null;
    }
  }

  async healthCheck(): Promise<EndpointHealth[]> {
    const results: EndpointHealth[] = [];
    for (const endpoint of this.endpoints) {
      const health = await this.checkEndpoint(endpoint);
      this.health.set(endpoint.id, health);
      results.push(health);
    }
    return results;
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    if (this.healthTimer) clearInterval(this.healthTimer);
    for (const [id, conn] of this.connections) {
      if (conn.healthTimer) clearInterval(conn.healthTimer);
      try {
        conn.browser.disconnect();
      } catch (err) {
        this.emitError("dispose", err, { endpointId: id });
      }
      this.connections.delete(id);
    }
    // flush wait queues —— 必须 reject，仅清空数组会让等待者永久悬挂
    for (const [endpointId, queue] of this.waitQueues) {
      for (const waiter of queue) {
        waiter.reject(
          new BrowserUnavailableError("BrowserPool 已释放，等待中的请求被取消", {
            phase: "dispose",
            scope: "browser.pool",
            details: { endpointId },
          }),
        );
      }
      queue.length = 0;
    }
  }

  // ── Internal: endpoint connection lifecycle ──

  /**
   * 获取 endpoint 的浏览器租约（并发控制 + 连接管理，不创建 Page）
   */
  private async acquireLeaseFromEndpoint(
    endpoint: BrowserEndpoint,
  ): Promise<BrowserLease> {
    if (this.disposed) {
      throw new BrowserUnavailableError("BrowserPool 已释放", {
        phase: "acquireLease",
        scope: "browser.pool",
      });
    }

    const maxConcurrency = endpoint.maxConcurrency ?? 10;

    if (maxConcurrency > 0) {
      const conn = this.connections.get(endpoint.id);
      if (conn && conn.activePages >= maxConcurrency) {
        await this.waitForSlot(endpoint.id);
      }
    }

    const conn = await this.ensureConnection(endpoint);
    conn.activePages++;

    let released = false;
    return {
      browser: conn.browser,
      release: () => {
        if (released) return;
        released = true;
        conn.activePages = Math.max(0, conn.activePages - 1);
        this.notifySlot(endpoint.id);
      },
    };
  }

  private async acquireFromEndpoint(
    endpoint: BrowserEndpoint,
  ): Promise<PageSession> {
    const lease = await this.acquireLeaseFromEndpoint(endpoint);

    try {
      const page = await lease.browser.newPage();
      await page.setViewport(null);

      const released = { value: false };
      return {
        page,
        release: async () => {
          if (released.value) return;
          released.value = true;
          try {
            await page.close();
          } catch (err) {
            this.emitError("release-page", err, { endpointId: endpoint.id });
          } finally {
            lease.release();
          }
        },
      };
    } catch (err) {
      lease.release();

      // 连接可能已断开，标记不健康并清理
      const conn = this.connections.get(endpoint.id);
      if (conn) {
        conn.status = "unhealthy";
        conn.lastError = err instanceof Error ? err.message : String(err);
        this.connections.delete(endpoint.id);
        try {
          conn.browser.disconnect();
        } catch (disconnectErr) {
          this.emitError("disconnect-unhealthy", disconnectErr, {
            endpointId: endpoint.id,
          });
        }
      }

      throw new BrowserUnavailableError(
        `在 ${endpoint.id} 上创建 Page 失败：${err instanceof Error ? err.message : String(err)}`,
        {
          phase: "acquirePage",
          scope: "browser.pool",
          details: { endpointId: endpoint.id },
          cause: err,
        },
      );
    }
  }

  private async ensureConnection(
    endpoint: BrowserEndpoint,
  ): Promise<PooledConnection> {
    const existing = this.connections.get(endpoint.id);
    if (existing && existing.status !== "unhealthy") {
      return existing;
    }

    // 清理旧连接
    if (existing) {
      if (existing.healthTimer) clearInterval(existing.healthTimer);
      try {
        existing.browser.disconnect();
      } catch (err) {
        this.emitError("disconnect-stale", err, { endpointId: endpoint.id });
      }
      this.connections.delete(endpoint.id);
    }

    const browser = await this.connectWithTimeout(endpoint.url);

    const conn: PooledConnection = {
      browser,
      activePages: 0,
      status: "healthy",
      lastCheckedAt: new Date(),
    };
    this.health.set(endpoint.id, {
      endpoint,
      status: "healthy",
      activePages: 0,
      lastCheckedAt: conn.lastCheckedAt,
    });

    // 监听断连事件
    browser.on("disconnected", () => {
      conn.status = "unhealthy";
      conn.lastError = "Browser disconnected";
      this.connections.delete(endpoint.id);
      this.health.set(endpoint.id, {
        endpoint,
        status: "unhealthy",
        activePages: conn.activePages,
        lastCheckedAt: new Date(),
        lastError: conn.lastError,
      });
    });

    // 启动健康检查
    const interval =
      endpoint.healthCheckIntervalMs ?? this.defaultHealthCheckIntervalMs;
    if (interval > 0) {
      conn.healthTimer = setInterval(async () => {
        const health = await this.checkEndpoint(endpoint);
        const c = this.connections.get(endpoint.id);
        if (c) {
          c.status = health.status;
          c.lastCheckedAt = health.lastCheckedAt;
          c.lastError = health.lastError;
        }
        this.health.set(endpoint.id, health);
      }, interval);
      conn.healthTimer.unref?.();
    }

    this.connections.set(endpoint.id, conn);
    return conn;
  }

  private async connectWithTimeout(browserURL: string): Promise<Browser> {
    let timedOut = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const connectPromise = connect({ browserURL, defaultViewport: null });
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        timedOut = true;
        reject(
          new BrowserUnavailableError(
            `puppeteer.connect 超时（${this.connectTimeoutMs}ms），browserURL=${browserURL}`,
            {
              phase: "connect",
              scope: "browser.pool",
              details: { browserURL, timeoutMs: this.connectTimeoutMs },
            },
          ),
        );
      }, this.connectTimeoutMs);
    });

    connectPromise
      .then((browser) => {
        if (!timedOut) return;
        try {
          browser.disconnect();
        } catch (err) {
          this.emitError("connect-timeout-cleanup", err, { browserURL });
        }
      })
      .catch((err) => {
        if (!timedOut) return;
        this.emitError("late-connect-failure", err, { browserURL });
      });

    try {
      return await Promise.race([connectPromise, timeoutPromise]);
    } catch (err) {
      if (err instanceof BrowserUnavailableError) throw err;
      // puppeteer.connect 自身失败（ECONNREFUSED / 端口无 CDP 服务等）
      throw new BrowserUnavailableError(
        `puppeteer.connect 失败，browserURL=${browserURL}：${
          err instanceof Error ? err.message : String(err)
        }`,
        {
          phase: "connect",
          scope: "browser.pool",
          details: { browserURL },
          cause: err,
        },
      );
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  // ── Internal: health check ──

  private async checkEndpoint(
    endpoint: BrowserEndpoint,
  ): Promise<EndpointHealth> {
    const conn = this.connections.get(endpoint.id);
    try {
      const versionUrl = new URL("/json/version", endpoint.url).toString();
      const response = await fetch(versionUrl, {
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      return {
        endpoint,
        status: "healthy",
        activePages: conn?.activePages ?? 0,
        lastCheckedAt: new Date(),
      };
    } catch (err) {
      const lastError = err instanceof Error ? err.message : String(err);
      if (conn) {
        conn.status = "unhealthy";
        conn.lastError = lastError;
      }
      const health = {
        endpoint,
        status: "unhealthy",
        activePages: conn?.activePages ?? 0,
        lastCheckedAt: new Date(),
        lastError,
      } satisfies EndpointHealth;
      this.health.set(endpoint.id, health);
      return health;
    }
  }

  // ── Internal: concurrency wait queue ──

  /**
   * 等待 endpoint 释放一个并发槽位。
   *
   * 必须带超时 —— 否则并发打满且无人释放时会永久挂起（进程不退出、
   * Agent 收不到任何 JSON）。超时抛 browser-acquire-timeout（可重试）。
   */
  private waitForSlot(endpointId: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let queue = this.waitQueues.get(endpointId);
      if (!queue) {
        queue = [];
        this.waitQueues.set(endpointId, queue);
      }

      let settled = false;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;

      const waiter: SlotWaiter = {
        resolve: () => {
          if (settled) return;
          settled = true;
          if (timeoutId) clearTimeout(timeoutId);
          resolve();
        },
        reject: (err) => {
          if (settled) return;
          settled = true;
          if (timeoutId) clearTimeout(timeoutId);
          reject(err);
        },
      };
      queue.push(waiter);

      if (this.acquireTimeoutMs > 0) {
        timeoutId = setTimeout(() => {
          const q = this.waitQueues.get(endpointId);
          if (q) {
            const idx = q.indexOf(waiter);
            if (idx >= 0) q.splice(idx, 1);
          }
          waiter.reject(
            new BrowserAcquireTimeoutError(
              `等待 ${endpointId} 的并发槽位超时（${this.acquireTimeoutMs}ms）`,
              {
                phase: "acquireLease",
                scope: "browser.pool",
                details: {
                  endpointId,
                  acquireTimeoutMs: this.acquireTimeoutMs,
                },
              },
            ),
          );
        }, this.acquireTimeoutMs);
        timeoutId.unref?.();
      }
    });
  }

  private notifySlot(endpointId: string): void {
    const queue = this.waitQueues.get(endpointId);
    if (queue && queue.length > 0) {
      const next = queue.shift()!;
      next.resolve();
    }
  }

  // ── Internal: health map for router ──

  private getHealthMap(): Map<string, EndpointHealth> {
    const map = new Map<string, EndpointHealth>();
    for (const endpoint of this.endpoints) {
      const conn = this.connections.get(endpoint.id);
      const lastHealth = this.health.get(endpoint.id);
      map.set(endpoint.id, {
        endpoint,
        status: conn?.status ?? lastHealth?.status ?? "unknown",
        activePages: conn?.activePages ?? 0,
        lastCheckedAt: conn?.lastCheckedAt ?? lastHealth?.lastCheckedAt ?? null,
        lastError: conn?.lastError ?? lastHealth?.lastError,
      });
    }
    return map;
  }

  private emitError(
    phase: string,
    error: unknown,
    details?: Record<string, unknown>,
  ): void {
    currentRuntime().events.emitError({
      errorKind: "browser-pool",
      category: "browser",
      phase,
      scope: "browser.pool",
      message: "Browser pool operation failed",
      error,
      details,
    });
  }
}
