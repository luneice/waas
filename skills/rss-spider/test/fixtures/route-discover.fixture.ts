/**
 * route-discover fixture —— L2 专用。
 *
 * RouteDiscoverSkill 唯一依赖 IRsshubDiscovery（纯接口），本包完全不走
 * GoalExecutor/FakeUpstream，构造函数直接注入 fake discovery 即可把
 * 分派逻辑（listNamespaces/url/namespace/query 四选一优先级 + count 计算
 * + missing-context）测干净，不依赖 node_modules/rsshub 是否安装。
 */
import type { IRsshubDiscovery } from "@src/rsshub/interfaces";
import type { RouteInfo, DetectionResult } from "@src/types";

export const sampleRoutes: RouteInfo[] = [
  { path: "/bilibili/user/video/:uid", namespace: "bilibili", params: ["uid"], optionalParams: [] },
  { path: "/bilibili/user/dynamic/:uid", namespace: "bilibili", params: ["uid"], optionalParams: [] },
  { path: "/github/trending/:since/:language?", namespace: "github", params: ["since"], optionalParams: ["language"] },
];

export const sampleDetections: DetectionResult[] = [
  {
    route: sampleRoutes[0],
    confidence: 0.9,
    extractedParams: { uid: "546195" },
    resolvedPath: "/bilibili/user/video/546195",
  },
];

/** 未初始化前调用 detect/search 等即抛错，用于验证 skill 是否先 await initialize()。 */
export function createFakeDiscovery(overrides: Partial<IRsshubDiscovery> = {}): IRsshubDiscovery {
  let initialized = false;
  return {
    async initialize() {
      initialized = true;
    },
    detect(url: string) {
      if (!initialized) throw new Error("discovery 未初始化即调用 detect");
      if (url.includes("bilibili.com")) return sampleDetections;
      return [];
    },
    search(query: string) {
      if (!initialized) throw new Error("discovery 未初始化即调用 search");
      return sampleRoutes.filter((r) => r.path.includes(query) || r.namespace.includes(query));
    },
    getNamespaceRoutes(namespace: string) {
      if (!initialized) throw new Error("discovery 未初始化即调用 getNamespaceRoutes");
      return sampleRoutes.filter((r) => r.namespace === namespace);
    },
    listNamespaces() {
      if (!initialized) throw new Error("discovery 未初始化即调用 listNamespaces");
      return [...new Set(sampleRoutes.map((r) => r.namespace))];
    },
    listRoutes() {
      return sampleRoutes;
    },
    hasDomain(url: string) {
      return url.includes("bilibili.com") || url.includes("github.com");
    },
    ...overrides,
  };
}

/** initialize() 直接抛错的 fake（模拟路由表加载失败）。 */
export function createFailingDiscovery(message = "路由表加载失败"): IRsshubDiscovery {
  return {
    async initialize() {
      throw new Error(message);
    },
    detect: () => [],
    search: () => [],
    getNamespaceRoutes: () => [],
    listNamespaces: () => [],
    listRoutes: () => [],
    hasDomain: () => false,
  };
}
