/**
 * RSSHub 故障分类器 — 纯函数
 *
 * 将 RSSHub 路由请求错误分类为标准化的故障类型。
 */
import type { FailureKind, FailureClassification } from "@src/types";
import { normalizeRoute } from "./route-resolver";

const CONNECTIVITY_ERROR_RE =
  /fetch failed|network|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ECONNRESET|socket hang up|aborted|timed out|超时/i;
const ROUTE_STATUS_RE = /Feed 请求失败:\s*(4\d\d|5\d\d)/i;
const BROWSER_RUNTIME_ERROR_RE =
  /browser|puppeteer|chrome|chromium|websocketdebuggerurl|PUPPETEER_WS_ENDPOINT|Failed to launch the browser process|Could not find Chrome|Target closed/i;
const EMBEDDED_RUNTIME_ERROR_RE =
  /ERR_MODULE_NOT_FOUND|Cannot find package|Cannot find module|RSSHub.*initialized|默认内嵌 RSSHub runtime|directory import/i;
const EMBEDDED_BASE_URL_RE = /^rsshub:\/\/embedded/;

function buildFailure(
  kind: FailureKind,
  detail: string,
): FailureClassification {
  return {
    kind,
    message: detail,
    recoverable: kind !== "route_unavailable",
  };
}

/** 格式化故障消息（添加前缀） */
export function formatFailureMessage(failure: FailureClassification): string {
  const prefixes: Record<FailureKind, string> = {
    service_unavailable: "服务不可用:",
    route_unavailable: "路由不可用:",
    browser_capability_unavailable: "浏览器能力不可用:",
  };
  return `${prefixes[failure.kind]} ${failure.message}`;
}

/** 将路由请求错误分类为标准故障类型 */
export function classifyRouteFailure(
  error: unknown,
  route: string,
  baseUrl: string,
): FailureClassification {
  const message = error instanceof Error ? error.message : String(error);

  if (message.startsWith("服务不可用:")) {
    return buildFailure(
      "service_unavailable",
      message.replace(/^服务不可用:\s*/, ""),
    );
  }
  if (message.startsWith("路由不可用:")) {
    return buildFailure(
      "route_unavailable",
      message.replace(/^路由不可用:\s*/, ""),
    );
  }
  if (message.startsWith("浏览器能力不可用:")) {
    return buildFailure(
      "browser_capability_unavailable",
      message.replace(/^浏览器能力不可用:\s*/, ""),
    );
  }
  if (BROWSER_RUNTIME_ERROR_RE.test(message)) {
    return buildFailure(
      "browser_capability_unavailable",
      `${normalizeRoute(route)} 需要浏览器能力，但当前执行未能建立可用浏览器会话（${message}）`,
    );
  }
  // 本地内嵌 runtime 缺失 / 初始化失败 —— 属于「运行时前置未满足」，
  // 与下方「上游连不通」的连接性失败分属两类，不可混同：
  // 前者要调用方补齐本地运行时 / 浏览器前置，重试无用；
  // 后者只是上游可达性问题，换实例或稍后重试即可恢复。
  if (
    EMBEDDED_BASE_URL_RE.test(baseUrl) &&
    EMBEDDED_RUNTIME_ERROR_RE.test(message)
  ) {
    return buildFailure(
      "browser_capability_unavailable",
      `内嵌 RSSHub runtime 不可用（${message}）—— 请先确认运行时 / 浏览器前置已就绪`,
    );
  }
  // 连接性失败 —— 上游（外部 RSSHub 实例 / route 目标站点）不可达
  if (CONNECTIVITY_ERROR_RE.test(message)) {
    return buildFailure("service_unavailable", `${baseUrl} 不可达`);
  }
  if (ROUTE_STATUS_RE.test(message)) {
    return buildFailure(
      "route_unavailable",
      `${normalizeRoute(route)} 当前无法返回 feed（${message}）`,
    );
  }

  return buildFailure(
    "route_unavailable",
    `${normalizeRoute(route)} 当前无法返回 feed（${message}）`,
  );
}
