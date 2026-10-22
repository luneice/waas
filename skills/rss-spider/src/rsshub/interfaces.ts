/**
 * RSSHub 模块接口
 *
 * 定义 RSSHub 的两个核心能力：
 * - IRsshubRuntime: 路由请求（执行）
 * - IRsshubDiscovery: 路由发现（检测）
 */
import type {
  RssFeed,
  RouteResolution,
  RouteInfo,
  DetectionResult,
} from "@src/types";

// ============================================================================
// Runtime — 路由请求
// ============================================================================

/**
 * RSSHub Runtime — 管理内嵌 RSSHub 包的懒初始化与路由请求
 *
 * 调用 fetchRoute 时自动初始化，无需显式启动。
 */
export interface IRsshubRuntime {
  /** 标签（用于日志/用户提示） */
  readonly label: string;

  /** 请求指定路由，返回 Feed 数据（首次调用自动初始化） */
  fetchRoute(route: string, overrideBaseUrl?: string | null): Promise<RssFeed>;

  /** 解析路由配置（判断 embedded vs external） */
  resolveRoute(route: string, overrideBaseUrl?: string | null): RouteResolution;
}

// ============================================================================
// Discovery — 路由发现
// ============================================================================

/**
 * RSSHub 路由发现 — 基于 rsshub 路由注册表
 *
 * 依赖 IRsshubRuntime 完成 init() 后路由注册表才可用。
 */
export interface IRsshubDiscovery {
  /** 初始化（加载路由元数据） */
  initialize(): Promise<void>;

  /** 从任意 URL 检测匹配的 RSSHub 路由 */
  detect(url: string): DetectionResult[];

  /** 按关键词搜索路由 */
  search(query: string): RouteInfo[];

  /** 获取指定命名空间下所有路由 */
  getNamespaceRoutes(namespace: string): RouteInfo[];

  /** 列出所有命名空间 */
  listNamespaces(): string[];

  /** 列出所有路由 */
  listRoutes(): RouteInfo[];

  /** 判断 URL 域名是否有已知 RSSHub 路由 */
  hasDomain(url: string): boolean;
}
