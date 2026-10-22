/**
 * RSSHub 路由解析 — 纯函数
 *
 * 从 rsshub-service.ts 中提取，负责路由路径归一化与模式判定。
 */
import { MissingContextError } from "@spider/core";
import type { RouteResolution } from "@src/types";

/** 错误 scope 标识 */
const SCOPE = "route-resolver";

const EMBEDDED_BASE_URL = "rsshub://embedded";

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function isEmbeddedBaseUrl(baseUrl: string): boolean {
  return stripTrailingSlash(baseUrl) === stripTrailingSlash(EMBEDDED_BASE_URL);
}

/** 归一化路由路径（确保以 / 开头） */
export function normalizeRoute(route: string): string {
  const value = route?.trim();
  if (!value) {
    throw new MissingContextError("路由不能为空", { scope: SCOPE });
  }
  return value.startsWith("/") ? value : `/${value}`;
}

/** 构建完整路由 URL */
export function buildRouteUrl(baseUrl: string, route: string): string {
  return `${stripTrailingSlash(baseUrl)}${normalizeRoute(route)}`;
}

/** 解析路由配置（判定 embedded vs external，优先级：参数 > 环境变量 > 默认） */
export function resolveRouteConfig(
  route: string,
  overrideBaseUrl?: string | null,
): RouteResolution {
  const normalizedRoute = normalizeRoute(route);
  const explicitBaseUrl = overrideBaseUrl?.trim();
  const envBaseUrl = process.env.RSSHUB_BASE_URL?.trim();

  if (explicitBaseUrl) {
    if (isEmbeddedBaseUrl(explicitBaseUrl)) {
      return {
        route: normalizedRoute,
        resolvedBaseUrl: stripTrailingSlash(EMBEDDED_BASE_URL),
        source: "param-override",
        mode: "embedded-package",
      };
    }
    return {
      route: normalizedRoute,
      resolvedBaseUrl: stripTrailingSlash(explicitBaseUrl),
      source: "param-override",
      mode: "external-http",
    };
  }

  if (envBaseUrl) {
    if (isEmbeddedBaseUrl(envBaseUrl)) {
      return {
        route: normalizedRoute,
        resolvedBaseUrl: stripTrailingSlash(EMBEDDED_BASE_URL),
        source: "env-default",
        mode: "embedded-package",
      };
    }
    return {
      route: normalizedRoute,
      resolvedBaseUrl: stripTrailingSlash(envBaseUrl),
      source: "env-default",
      mode: "external-http",
    };
  }

  return {
    route: normalizedRoute,
    resolvedBaseUrl: stripTrailingSlash(EMBEDDED_BASE_URL),
    source: "embedded-default",
    mode: "embedded-package",
  };
}

export { EMBEDDED_BASE_URL };
