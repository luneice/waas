/**
 * RSSHub 路由发现 Skill
 *
 * AI Agent 入口：发现指定 URL / 关键词 / 命名空间对应的 RSSHub 路由。
 * 利用 IRsshubDiscovery 自动检测 URL 匹配 + 路由搜索。
 */
import {
  BaseSkill,
  MissingContextError,
  type SkillParamSchema,
  type SkillResult,
  type SkillExecuteOptions,
} from "@spider/core";
import type { IRsshubDiscovery } from "@src/rsshub/interfaces";
import type { RouteInfo, DetectionResult } from "@src/types";

/** RouteDiscoverSkill 依赖 */
export interface RouteDiscoverSkillDeps {
  discovery: IRsshubDiscovery;
}

interface RouteDiscoverParams {
  /** 网页 URL — 自动检测对应的 RSSHub 路由 */
  url?: string;
  /** 关键词搜索 */
  query?: string;
  /** 指定命名空间，列出其下所有路由 */
  namespace?: string;
  /** 列出所有命名空间 */
  listNamespaces?: boolean;
}

interface RouteDiscoverResult {
  matchMode: "radar" | "search" | "namespace" | "list-namespaces";
  radarDetections?: DetectionResult[];
  routes?: RouteInfo[];
  namespaces?: string[];
  count: number;
}

export class RouteDiscoverSkill extends BaseSkill<
  RouteDiscoverParams,
  RouteDiscoverResult,
  RouteDiscoverResult,
  SkillExecuteOptions
> {
  readonly id = "route-discover";
  readonly name = "RSSHub 路由发现";
  readonly description =
    "发现指定 URL 对应的 RSSHub 路由（自动检测）、按关键词搜索路由、列出命名空间下所有路由";
  readonly paramSchema: SkillParamSchema[] = [
    {
      name: "url",
      type: "string",
      required: false,
      description:
        "网页 URL — 自动检测该 URL 对应的 RSSHub 路由（如 https://www.bilibili.com/video/BV1xx → /bilibili/...）",
    },
    {
      name: "query",
      type: "string",
      required: false,
      description: "关键词搜索（按命名空间名称和路由路径模糊匹配）",
    },
    {
      name: "namespace",
      type: "string",
      required: false,
      description: "指定命名空间，列出其下所有路由",
    },
    {
      name: "listNamespaces",
      type: "boolean",
      required: false,
      default: false,
      description: "设为 true 时列出所有可用命名空间",
    },
  ];

  private readonly discovery: IRsshubDiscovery;

  constructor(deps: RouteDiscoverSkillDeps) {
    super();
    this.discovery = deps.discovery;
  }

  async execute(
    params: RouteDiscoverParams,
  ): Promise<SkillResult<RouteDiscoverResult>> {
    const startedAt = new Date();
    const normalized = this.normalizeParams(params);

    try {
      await this.discovery.initialize();
      const result = this.dispatch(normalized);
      return this.buildSuccess(result, normalized, startedAt);
    } catch (err) {
      // 直接透传原始错误：SpiderError 的 kind 由 buildFailure 保留
      return this.buildFailure(err, normalized, startedAt);
    }
  }

  private dispatch(params: RouteDiscoverParams): RouteDiscoverResult {
    if (params.listNamespaces) {
      const namespaces = this.discovery.listNamespaces();
      return {
        matchMode: "list-namespaces",
        namespaces,
        count: namespaces.length,
      };
    }

    if (params.url && typeof params.url === "string") {
      const detections = this.discovery.detect(params.url);
      return {
        matchMode: "radar",
        radarDetections: detections,
        count: detections.length,
      };
    }

    if (params.namespace && typeof params.namespace === "string") {
      const routes = this.discovery.getNamespaceRoutes(params.namespace);
      return {
        matchMode: "namespace",
        routes,
        count: routes.length,
      };
    }

    if (params.query && typeof params.query === "string") {
      const routes = this.discovery.search(params.query);
      return {
        matchMode: "search",
        routes,
        count: routes.length,
      };
    }

    throw new MissingContextError(
      "需提供 url / query / namespace / listNamespaces 之一",
      { scope: this.id },
    );
  }
}
