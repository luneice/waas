import type { Browser, Page } from "puppeteer-core";

// ============================================================================
// 浏览器端点
// ============================================================================

/** 远程浏览器实例描述符 */
export interface BrowserEndpoint {
  /** 唯一标识（如 "cn-dedao", "us-general"） */
  id: string;
  /** CDP 远程调试地址（如 http://10.0.1.5:4444） */
  url: string;
  /** 路由标签 — 用于 site affinity 匹配 */
  tags?: string[];
  /** 最大并发 Page 数（0 = 无限制，默认 10） */
  maxConcurrency?: number;
  /** 健康检查间隔 ms（0 = 不检查，默认 30000） */
  healthCheckIntervalMs?: number;
}

/** 端点运行时状态 */
export type EndpointStatus = "healthy" | "unhealthy" | "unknown";

/** 端点健康信息 */
export interface EndpointHealth {
  endpoint: BrowserEndpoint;
  status: EndpointStatus;
  activePages: number;
  lastCheckedAt: Date | null;
  lastError?: string;
}

// ============================================================================
// 路由约束
// ============================================================================

/** 浏览器路由约束 — Skill 声明需要什么样的浏览器 */
export interface RouteConstraints {
  /** 目标站点域名（如 "dedao.cn"）— 自动从 siteURL 提取 */
  site?: string;
  /** 必须满足的标签 */
  requiredTags?: string[];
  /** 偏好标签（软匹配，优先但不强制） */
  preferredTags?: string[];
}

// ============================================================================
// 浏览器池
// ============================================================================

/** 浏览器连接池接口 */
export interface IBrowserPool {
  /** 从指定 endpoint 获取一个 Page */
  acquirePage(endpointId: string): Promise<PageSession>;
  /** 按路由约束获取 Page（自动选择最优 endpoint） */
  acquirePageFor(constraints?: RouteConstraints): Promise<PageSession>;
  /** 获取所有端点的健康状态 */
  healthCheck(): Promise<EndpointHealth[]>;
  /** 获取指定 endpoint 的 WS 端点 */
  getWSEndpoint(endpointId?: string): Promise<string | null>;
  /** 释放所有连接 */
  dispose(): Promise<void>;
}

// ============================================================================
// 浏览器路由
// ============================================================================

/** 浏览器路由策略接口 */
export interface IBrowserRouter {
  /** 根据约束选择最优 endpoint */
  route(
    constraints: RouteConstraints,
    endpoints: BrowserEndpoint[],
    health: Map<string, EndpointHealth>,
  ): BrowserEndpoint | null;
}

// ============================================================================
// 浏览器连接策略
// ============================================================================

/** 浏览器租约 — 由 IBrowserConnector.acquire() 返回，调用方负责 release() */
export interface BrowserLease {
  /** puppeteer Browser 实例 */
  readonly browser: Browser;
  /** 归还浏览器连接（disconnect / 归还池）— 幂等 */
  release(): void;
}

/**
 * 浏览器连接器 — 策略模式
 *
 * 可插拔的浏览器来源：本地 CDP、远程 WS、连接池、手机浏览器…
 * ChromeSessionProvider 持有一个 IBrowserConnector，通过它获取 Browser 实例。
 */
export interface IBrowserConnector {
  /** 获取浏览器连接 */
  acquire(options?: BrowserAcquireOptions): Promise<BrowserLease>;
  /** 获取 WS 调试端点（返回 null 表示不可用） */
  getWSEndpoint(options?: {
    browserURL?: string;
    timeoutMs?: number;
  }): Promise<string | null>;
  /** 释放所有资源（可选） */
  dispose?(): Promise<void>;
}

// ============================================================================
// 浏览器会话
// ============================================================================

/**
 * 浏览器 Page 会话 — RAII 风格
 * 由 IBrowserSessionProvider 创建，调用方负责 release()
 */
export interface PageSession {
  readonly page: Page;
  /** 归还资源 — close page + disconnect browser */
  release(): Promise<void>;
}

/** 浏览器会话提供者（依赖倒置核心接口） */
export interface IBrowserSessionProvider {
  acquire(options?: BrowserAcquireOptions): Promise<PageSession>;
  /**
   * 获取浏览器 WebSocket 调试端点（用于将本地 Chrome 传给第三方 SDK，如 RSSHub embedded）
   * 返回 null 表示浏览器不可达或未暴露端点。
   */
  getWSEndpoint(options?: {
    browserURL?: string;
    timeoutMs?: number;
  }): Promise<string | null>;
}

/** acquire() 的选项 */
export interface BrowserAcquireOptions {
  /** 直接指定 CDP URL（跳过路由，escape hatch） */
  browserURL?: string;
  /** 目标站点（用于路由选择最优浏览器） */
  site?: string;
  /** 必须满足的标签 */
  requiredTags?: string[];
}
