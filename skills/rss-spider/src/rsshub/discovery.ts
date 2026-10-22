/**
 * RSSHub 路由发现 — URL 到 RSSHub 路由的自动检测
 *
 * 实现 IRsshubDiscovery 接口。
 * 基于 rsshub 包的路由注册表构建域名→路由映射，
 * 实现从任意 URL 自动检测匹配的 RSSHub 路由。
 *
 * 路由元数据来源：
 * 1. rsshub 内置的 RoutePath 类型（编译期可用的所有路由路径）
 * 2. 内建的域名→命名空间映射表（覆盖常见站点）
 */
import type { IRsshubDiscovery } from "./interfaces";
import type { RouteInfo, DetectionResult } from "@src/types";

// ── 域名 → 命名空间映射（覆盖命名空间名称与域名不一致的情况） ──

const DOMAIN_TO_NAMESPACE: Record<string, string[]> = {
  "bilibili.com": ["bilibili"],
  "weibo.com": ["weibo"],
  "weibo.cn": ["weibo"],
  "zhihu.com": ["zhihu"],
  "douban.com": ["douban"],
  "github.com": ["github"],
  "twitter.com": ["twitter"],
  "x.com": ["twitter"],
  "youtube.com": ["youtube"],
  "reddit.com": ["reddit"],
  "instagram.com": ["instagram"],
  "telegram.org": ["telegram"],
  "t.me": ["telegram"],
  "pixiv.net": ["pixiv"],
  "juejin.cn": ["juejin"],
  "sspai.com": ["sspai"],
  "v2ex.com": ["v2ex"],
  "36kr.com": ["36kr"],
  "mp.weixin.qq.com": ["wechat"],
  "news.ycombinator.com": ["hackernews"],
  "medium.com": ["medium"],
  "nytimes.com": ["nytimes"],
  "bbc.com": ["bbc"],
  "bbc.co.uk": ["bbc"],
  "reuters.com": ["reuters"],
  "techcrunch.com": ["techcrunch"],
  "theverge.com": ["theverge"],
  "arstechnica.com": ["arstechnica"],
  "producthunt.com": ["producthunt"],
  "npmjs.com": ["npm"],
  "hub.docker.com": ["dockerhub"],
  "xhslink.com": ["xiaohongshu"],
  "jike.city": ["jike"],
  "okjike.com": ["jike"],
  "zcool.com.cn": ["zcool"],
  "dribbble.com": ["dribbble"],
  "behance.net": ["behance"],
  "figma.com": ["figma"],
  "notion.site": ["notion"],
  "substack.com": ["substack"],
  "threadreaderapp.com": ["twitter"],
  "epicgames.com": ["epicgames"],
  "steam.com": ["steam"],
  "steampowered.com": ["steam"],
  "store.steampowered.com": ["steam"],
  "itch.io": ["itch"],
  "kaggle.com": ["kaggle"],
  "huggingface.co": ["huggingface"],
  "space.bilibili.com": ["bilibili"],
  "t.bilibili.com": ["bilibili"],
};

// ── 路由路径参数解析 ──

function parseRouteParams(path: string): {
  params: string[];
  optionalParams: string[];
} {
  const params: string[] = [];
  const optionalParams: string[] = [];
  const paramRegex = /:(\w+)(?:\{[^}]*\})?(\?)?/g;
  let match: RegExpExecArray | null;
  while ((match = paramRegex.exec(path)) !== null) {
    if (match[2]) {
      optionalParams.push(match[1]);
    } else {
      params.push(match[1]);
    }
  }
  return { params, optionalParams };
}

function extractNamespace(path: string): string {
  const match = path.match(/^\/([^/]+)/);
  return match?.[1] ?? "";
}

/** 将路由路径模板转为正则 */
function routePathToRegex(path: string): RegExp {
  const pattern = path
    .replace(/:(\w+)\{[^}]*\}\?/g, "(?<$1>[^/]+)?")
    .replace(/:(\w+)\{[^}]*\}/g, "(?<$1>[^/]+)")
    .replace(/:(\w+)\?/g, "(?<$1>[^/]+)?")
    .replace(/:(\w+)/g, "(?<$1>[^/]+)")
    .replace(/\*/g, ".*");
  return new RegExp(`^${pattern}/?$`);
}

/** 从 URL 中提取域名信息 */
function extractDomainParts(url: string): {
  hostname: string;
  baseDomain: string;
} {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    const parts = hostname.split(".");
    const twoPartTLD = ["co.uk", "com.cn", "com.au", "co.jp", "or.jp"];
    let baseDomain: string;
    if (parts.length >= 3) {
      const lastTwo = parts.slice(-2).join(".");
      baseDomain = twoPartTLD.includes(lastTwo)
        ? parts.slice(-3).join(".")
        : lastTwo;
    } else {
      baseDomain = hostname;
    }
    return { hostname, baseDomain };
  } catch {
    return { hostname: "", baseDomain: "" };
  }
}

// ── RsshubDiscovery 实现 ──

export class RsshubDiscovery implements IRsshubDiscovery {
  private routes: RouteInfo[] = [];
  private namespaceMap = new Map<string, RouteInfo[]>();
  private domainIndex = new Map<string, string[]>();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.loadRoutePathsFromTypeDeclaration();
    this.buildDomainIndex();
    this.initialized = true;
  }

  detect(url: string): DetectionResult[] {
    this.ensureInitialized();

    const { hostname, baseDomain } = extractDomainParts(url);
    const namespaces = this.findNamespacesForDomain(hostname, baseDomain);
    if (namespaces.length === 0) return [];

    let urlPath: string;
    try {
      urlPath = new URL(url).pathname;
    } catch {
      return [];
    }

    const results: DetectionResult[] = [];
    for (const ns of namespaces) {
      const nsRoutes = this.namespaceMap.get(ns) || [];
      for (const route of nsRoutes) {
        const match = this.matchUrlToRoute(urlPath, route);
        if (match) results.push(match);
      }
    }

    // 无精确匹配时返回低置信度的命名空间级路由
    if (results.length === 0) {
      for (const ns of namespaces) {
        for (const route of this.namespaceMap.get(ns) || []) {
          results.push({
            route,
            confidence: 0.3,
            extractedParams: {},
            resolvedPath: route.path,
          });
        }
      }
    }

    return results.sort((a, b) => b.confidence - a.confidence);
  }

  search(query: string): RouteInfo[] {
    this.ensureInitialized();
    const lowerQuery = query.toLowerCase();
    return this.routes.filter(
      (r) =>
        r.namespace.toLowerCase().includes(lowerQuery) ||
        r.path.toLowerCase().includes(lowerQuery),
    );
  }

  getNamespaceRoutes(namespace: string): RouteInfo[] {
    this.ensureInitialized();
    return this.namespaceMap.get(namespace.toLowerCase()) || [];
  }

  listNamespaces(): string[] {
    this.ensureInitialized();
    return [...this.namespaceMap.keys()].sort();
  }

  listRoutes(): RouteInfo[] {
    this.ensureInitialized();
    return [...this.routes];
  }

  hasDomain(url: string): boolean {
    this.ensureInitialized();
    const { hostname, baseDomain } = extractDomainParts(url);
    return this.findNamespacesForDomain(hostname, baseDomain).length > 0;
  }

  // ── 内部方法 ──

  private ensureInitialized(): void {
    if (!this.initialized) {
      this.loadRoutePathsFromTypeDeclaration();
      this.buildDomainIndex();
      this.initialized = true;
    }
  }

  /**
   * 从 rsshub 包的类型声明文件中解析所有路由路径
   *
   * rsshub 的 RoutePath 类型是包含所有路由路径的联合类型字面量，
   * 解析 .d.mts 文件可以在无需 init() 的情况下获取完整路由列表。
   */
  private loadRoutePathsFromTypeDeclaration(): void {
    try {
      const fs = require("fs");
      const path = require("path");

      const rsshubPkgDir = this.findRsshubPackageDir();
      if (!rsshubPkgDir) return;

      const dtsPath = path.join(rsshubPkgDir, "dist-lib", "pkg.d.mts");
      if (!fs.existsSync(dtsPath)) return;

      const source = fs.readFileSync(dtsPath, "utf-8");
      const routePathMatch = source.match(/type RoutePath\s*=\s*([\s\S]*?);/);
      if (!routePathMatch) return;

      const pathRegex = /`([^`]+)`/g;
      let match: RegExpExecArray | null;
      while ((match = pathRegex.exec(routePathMatch[1])) !== null) {
        const routePath = match[1];
        const namespace = extractNamespace(routePath);
        if (!namespace || namespace === "test" || namespace === "robots.txt")
          continue;

        const { params, optionalParams } = parseRouteParams(routePath);
        const route: RouteInfo = {
          path: routePath,
          namespace,
          params,
          optionalParams,
        };
        this.routes.push(route);

        if (!this.namespaceMap.has(namespace)) {
          this.namespaceMap.set(namespace, []);
        }
        this.namespaceMap.get(namespace)!.push(route);
      }
    } catch {
      // 类型文件不可用时静默失败，使用静态域名映射
    }
  }

  private findRsshubPackageDir(): string | null {
    const path = require("path");
    const fs = require("fs");
    let dir = __dirname;
    const maxDepth = 10;
    let depth = 0;
    while (dir !== path.dirname(dir) && depth < maxDepth) {
      const candidate = path.join(dir, "node_modules", "rsshub");
      if (fs.existsSync(path.join(candidate, "package.json"))) {
        return candidate;
      }
      dir = path.dirname(dir);
      depth++;
    }
    return null;
  }

  private buildDomainIndex(): void {
    for (const [domain, namespaces] of Object.entries(DOMAIN_TO_NAMESPACE)) {
      this.domainIndex.set(domain, namespaces);
    }
    for (const ns of this.namespaceMap.keys()) {
      for (const domain of [`${ns}.com`, `${ns}.cn`, `${ns}.org`, `${ns}.io`]) {
        if (!this.domainIndex.has(domain)) {
          this.domainIndex.set(domain, [ns]);
        }
      }
    }
  }

  private findNamespacesForDomain(
    hostname: string,
    baseDomain: string,
  ): string[] {
    const exact = this.domainIndex.get(hostname);
    if (exact) return exact;
    const base = this.domainIndex.get(baseDomain);
    if (base) return base;
    const domainName = baseDomain.split(".")[0];
    if (this.namespaceMap.has(domainName)) return [domainName];
    return [];
  }

  private matchUrlToRoute(
    urlPath: string,
    route: RouteInfo,
  ): DetectionResult | null {
    const routePathWithoutNs = route.path.replace(
      new RegExp(`^/${route.namespace}`),
      "",
    );
    const regex = routePathToRegex(routePathWithoutNs);
    const match = urlPath.match(regex);

    if (!match?.groups) return null;

    const extractedParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(match.groups)) {
      if (value !== undefined) extractedParams[key] = value;
    }

    let resolvedPath = route.path;
    for (const [key, value] of Object.entries(extractedParams)) {
      resolvedPath = resolvedPath.replace(`:${key}`, value);
    }
    resolvedPath = resolvedPath.replace(/\/:?\w+\?/g, "");

    return {
      route,
      confidence: 0.9,
      extractedParams,
      resolvedPath,
    };
  }
}
