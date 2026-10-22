/**
 * 内嵌 RSSHub Runtime
 *
 * 封装 rsshub 包的生命周期管理，实现 IRsshubRuntime 接口。
 * 管理单例初始化、路由请求、健康检查。
 */
import {
  BrowserUnavailableError,
  EndpointHttpError,
  NoResultsError,
  SpiderError,
  type SkillFailureKind,
} from "@spider/core";
import type { IBrowserSessionProvider } from "@spider/core";
import type { Data as RsshubData } from "rsshub";
import { UrlFeedProvider } from "@src/provider/url.provider";

// rsshub 是 ESM-only 包，通过 dynamic import() 加载（esbuild ESM 输出原生支持）
let _rsshub: {
  init: (typeof import("rsshub"))["init"];
  request: (typeof import("rsshub"))["request"];
} | null = null;
let _rsshubPuppeteerPatched = false;

async function patchRsshubExternalBrowserClose(): Promise<void> {
  if (_rsshubPuppeteerPatched) {
    return;
  }

  const puppeteerModule = (await import("rebrowser-puppeteer")) as {
    default?: {
      connect?: (options: Record<string, unknown>) => Promise<{
        close: () => Promise<void>;
        disconnect: () => void;
      }>;
    };
  };
  const puppeteer = puppeteerModule.default;

  if (!puppeteer?.connect) {
    _rsshubPuppeteerPatched = true;
    return;
  }

  const originalConnect = puppeteer.connect.bind(puppeteer);
  puppeteer.connect = (async (options: Record<string, unknown>) => {
    const browser = await originalConnect(options);
    if (typeof options.browserWSEndpoint === "string") {
      // Track every new target (tab) opened via this browser connection.
      // browser.on('targetcreated') fires reliably for every newPage() call.
      const rsshubTargets: any[] = [];
      (browser as any).on("targetcreated", (target: any) => {
        rsshubTargets.push(target);
      });

      let closed = false;
      browser.close = async () => {
        if (closed) return;
        closed = true;
        // Close only the tabs RSSHub opened — never touch the browser itself.
        await Promise.allSettled(
          rsshubTargets.map(async (target) => {
            try {
              const page = await target.page();
              if (page) await page.close();
            } catch {}
          }),
        );
      };
    }
    return browser;
  }) as typeof puppeteer.connect;

  _rsshubPuppeteerPatched = true;
}

async function loadRsshub() {
  if (!_rsshub) {
    await patchRsshubExternalBrowserClose();
    const mod = await import("rsshub");
    _rsshub = { init: mod.init, request: mod.request };
  }
  return _rsshub;
}
import { Configuration } from "@src/config";
import type {
  RssFeed,
  BrowserCapabilityConfig,
  RouteResolution,
  FailureClassification,
} from "@src/types";
import type { IRsshubRuntime } from "./interfaces";
import {
  normalizeRoute,
  buildRouteUrl,
  resolveRouteConfig,
  EMBEDDED_BASE_URL,
} from "./route-resolver";
import {
  classifyRouteFailure,
  formatFailureMessage,
} from "./failure-classifier";

interface InitializedContext {
  browserCapability: BrowserCapabilityConfig;
  initializedAt: string;
}

/** 错误 scope 标识 */
const SCOPE = "embedded-rsshub-runtime";

// ── 工具函数 ──

/**
 * 比三值映射（browser-unavailable / endpoint-http / no-results）更精确、
 * 值得原样保留的 kind —— 命中即透传原错误，不做降级包装。
 *
 * 未列入的 kind 说明：
 * - browser-unavailable / endpoint-http / no-results 与映射结果同级，无信息增益；
 *   其中 endpoint-http 还需交由 classifyRouteFailure 按「Feed 请求失败: 4xx/5xx」
 *   再分类为 route_unavailable（RSSHub 路由取不到 feed），不能提前透传。
 * - hook-abort / pipeline-error 过于笼统，包装后附带 route 上下文更有用。
 */
const PRECISE_FAILURE_KINDS: ReadonlySet<SkillFailureKind> =
  new Set<SkillFailureKind>([
    "browser-acquire-timeout",
    "navigation-failed",
    "not-logged-in",
    "access-denied",
    "risk-control",
    "missing-context",
    "invalid-params",
    "upstream-shape-changed",
    "endpoint-timeout",
    "retry-exhausted",
    "unsupported",
  ]);

/** 沿 cause 链查找首个携带精确 kind 的 SpiderError（限深，避免环形 cause 死循环） */
function findPreciseSpiderError(error: unknown): SpiderError | null {
  let current: unknown = error;
  for (let depth = 0; current && depth < 8; depth += 1) {
    if (
      current instanceof SpiderError &&
      PRECISE_FAILURE_KINDS.has(current.kind)
    ) {
      return current;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

/**
 * 将 RSSHub 故障分类映射为框架标准错误（消息文案沿用 formatFailureMessage）。
 *
 * FailureKind → SkillFailureKind：
 * - browser_capability_unavailable → browser-unavailable（缺可用浏览器会话 / 内嵌 runtime 前置未就绪）
 * - service_unavailable            → endpoint-http（上游不可达）
 * - route_unavailable              → no-results（该路由当前拿不到 feed）
 *
 * ⚠️ 例外：底层已抛出带更精确 kind 的 SpiderError（如 endpoint-timeout /
 * not-logged-in / invalid-params）时**原样透传**——三值映射只有 3 个出口，
 * 重新包装会把这些信息降级成粗粒度 kind，导致 AI 消费方误判处置方式
 * （例如把「入参 URL 不是 feed」误读成「该路由暂时没数据」而去重试）。
 * 只有裸 Error、或 kind 不比映射结果更精确的 SpiderError 才按分类结果包装。
 */
function toRouteFailureError(
  failure: FailureClassification,
  route: string,
  baseUrl: string,
  cause: unknown,
): SpiderError {
  const precise = findPreciseSpiderError(cause);
  if (precise) {
    return precise;
  }

  const message = formatFailureMessage(failure);
  const init = {
    scope: SCOPE,
    phase: "fetch-route",
    details: { route, baseUrl, failureKind: failure.kind },
    cause,
  };
  switch (failure.kind) {
    case "browser_capability_unavailable":
      return new BrowserUnavailableError(message, init);
    case "service_unavailable":
      return new EndpointHttpError(message, init);
    default:
      return new NoResultsError(message, init);
  }
}

function mapRsshubDataToFeed(route: string, data: RsshubData): RssFeed {
  const items = data.item ?? [];
  return {
    title: data.title || route,
    link: data.link ?? "",
    description: data.description ?? "",
    items: items.map((item) => ({
      title: item.title,
      link: item.link ?? "",
      pubDate: item.pubDate
        ? item.pubDate instanceof Date
          ? item.pubDate.toISOString()
          : String(item.pubDate)
        : undefined,
      description: item.description ?? undefined,
      author:
        typeof item.author === "string"
          ? item.author
          : Array.isArray(item.author)
            ? item.author.map((a) => a.name).join(", ")
            : undefined,
      category: item.category,
    })),
  };
}

function stripUndefinedConfig(
  value: Record<string, string | undefined>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
}

// ── EmbeddedRsshubRuntime ──

export class EmbeddedRsshubRuntime implements IRsshubRuntime {
  readonly label = "默认内嵌 RSSHub runtime";

  private readonly sessionProvider: IBrowserSessionProvider;
  private readonly config: Configuration;
  private initPromise: Promise<InitializedContext> | null = null;

  constructor(
    sessionProvider: IBrowserSessionProvider,
    config?: Configuration,
  ) {
    this.sessionProvider = sessionProvider;
    this.config = config ?? new Configuration();
  }

  // ── IRsshubRuntime ──

  async fetchRoute(
    route: string,
    overrideBaseUrl?: string | null,
  ): Promise<RssFeed> {
    const resolution = this.resolveRoute(route, overrideBaseUrl);
    const sourceUrl = buildRouteUrl(
      resolution.resolvedBaseUrl,
      resolution.route,
    );

    try {
      if (resolution.mode === "embedded-package") {
        return await this.requestEmbeddedRoute(resolution.route);
      }
      return await new UrlFeedProvider(sourceUrl).fetch();
    } catch (error) {
      throw toRouteFailureError(
        classifyRouteFailure(
          error,
          resolution.route,
          resolution.resolvedBaseUrl,
        ),
        resolution.route,
        resolution.resolvedBaseUrl,
        error,
      );
    }
  }

  resolveRoute(
    route: string,
    overrideBaseUrl?: string | null,
  ): RouteResolution {
    return resolveRouteConfig(route, overrideBaseUrl);
  }

  // ── 内部方法 ──

  private ensureInitialized(
    browserWSEndpoint?: string | null,
  ): Promise<InitializedContext> {
    if (!this.initPromise) {
      this.initPromise = (async () => {
        if (!process.env.NODE_ENV) {
          process.env.NODE_ENV = "development";
        }
        const browserCapability =
          await this.resolveBrowserCapability(browserWSEndpoint);
        const config = this.buildRuntimeConfig(browserCapability);
        const rsshub = await loadRsshub();
        await rsshub.init(config);
        return {
          browserCapability,
          initializedAt: new Date().toISOString(),
        };
      })().catch((error) => {
        this.initPromise = null;
        throw error;
      });
    }
    return this.initPromise;
  }

  private async resolveBrowserCapability(
    explicitWSEndpoint?: string | null,
  ): Promise<BrowserCapabilityConfig> {
    if (explicitWSEndpoint) {
      return {
        browserUrl: this.config.browserUrl,
        browserWSEndpoint: explicitWSEndpoint,
        source: "explicit-ws-endpoint",
      };
    }
    if (this.config.rsshubPuppeteerWsEndpoint) {
      return {
        browserUrl: this.config.browserUrl,
        browserWSEndpoint: this.config.rsshubPuppeteerWsEndpoint,
        source: "explicit-ws-endpoint",
      };
    }
    const wsEndpoint = await this.sessionProvider.getWSEndpoint({
      browserURL: this.config.browserUrl,
      timeoutMs: this.config.serviceHealthTimeout,
    });
    if (wsEndpoint) {
      return {
        browserUrl: this.config.browserUrl,
        browserWSEndpoint: wsEndpoint,
        source: "derived-from-browser-url",
      };
    }
    return {
      browserUrl: this.config.browserUrl,
      browserWSEndpoint: null,
      source: "unavailable",
    };
  }

  private buildRuntimeConfig(
    browserCapability: BrowserCapabilityConfig,
  ): Record<string, string> {
    // 注意：rsshub 内部 puppeteer 模块会在 30s 后 browser.close() 关闭整个浏览器，
    // 无法区分自启浏览器和外部连接。调用方需确保在结果输出后立即 process.exit()，
    // 避免 30s 定时器触发关闭用户的 Chrome。
    return stripUndefinedConfig({
      CACHE_TYPE: this.config.rsshubCacheType,
      MEMORY_MAX:
        this.config.rsshubMemoryMax !== null
          ? String(this.config.rsshubMemoryMax)
          : undefined,
      REQUEST_TIMEOUT: String(this.config.rsshubRequestTimeout),
      PUPPETEER_WS_ENDPOINT: browserCapability.browserWSEndpoint || undefined,
      UA: this.config.rsshubUserAgent || undefined,
      NO_RANDOM_UA: this.config.rsshubNoRandomUa ? "1" : undefined,
      // 透传 route 级别的凭据环境变量
      WEIBO_COOKIES: process.env.WEIBO_COOKIES || undefined,
    });
  }

  private async requestEmbeddedRoute(route: string): Promise<RssFeed> {
    await this.ensureInitialized();
    const rsshub = await loadRsshub();
    const data = await rsshub.request(normalizeRoute(route));
    // RSSHub 在 IS_PACKAGE 模式下，路由出错时返回 { error: { message: "..." } }
    // 而非标准 Data（含 item 字段）。item 为 undefined 是错误响应的可靠标志。
    const anyData = data as any;
    if (anyData.item === undefined && anyData.error) {
      const msg: string =
        anyData.error?.message ?? JSON.stringify(anyData.error);
      throw new EndpointHttpError(`Feed 请求失败: 503 ${msg}`, {
        scope: SCOPE,
        phase: "embedded-request",
        details: { route, status: 503 },
      });
    }
    return mapRsshubDataToFeed(route, data);
  }
}
