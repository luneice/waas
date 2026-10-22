/**
 * rss-spider 统一类型定义
 */
import type { Page } from "puppeteer-core";

// ============================================================================
// Feed 数据结构
// ============================================================================

/** 单条 RSS 条目 */
export interface RssItem {
  /** 标题 */
  title: string;
  /** 原文链接 */
  link: string;
  /** 发布时间（ISO 8601 或原始字符串） */
  pubDate?: string;
  /** 正文内容（markdown 或 html） */
  description?: string;
  /** 作者 */
  author?: string;
  /** 分类标签 */
  category?: string[];
}

/** RSS Feed 聚合结构 */
export interface RssFeed {
  /** Feed 标题 */
  title: string;
  /** Feed 主页链接 */
  link: string;
  /** Feed 描述 */
  description: string;
  /** 条目列表 */
  items: RssItem[];
}

// ============================================================================
// CSS 选择器
// ============================================================================

/** CSS 详情页选择器 */
export interface DetailSelectors {
  /** 正文容器 */
  content?: string;
  /** 标题 */
  title?: string;
  /** 作者 */
  author?: string;
  /** 发布时间 */
  time?: string;
}

/** CSS 列表页选择器 */
export interface ListSelectors {
  /** 列表项容器 */
  item?: string;
  /** 标题（相对于 item） */
  title?: string;
  /** 链接（相对于 item） */
  link?: string;
  /** 时间（相对于 item） */
  time?: string;
  /** 摘要（相对于 item） */
  summary?: string;
}

/** Google News 地区/语言配置 */
export interface GoogleNewsLocale {
  /** 界面语言，如 zh-CN, en-US */
  hl: string;
  /** 国家/地区代码，如 CN, US */
  gl: string;
  /** 版本标识，如 CN:zh-Hans, US:en */
  ceid: string;
}

// ============================================================================
// 补全 (Enrichment)
// ============================================================================

/** 补全器配置 */
export interface EnrichOptions {
  /** 最大补全条数 */
  maxItems?: number;
  /** 并发数 */
  concurrency?: number;
  /** 输出格式 */
  format?: "markdown" | "html";
  /** 自定义详情页选择器 */
  selectors?: DetailSelectors;
}

/** 单条补全失败记录 */
export interface EnrichError {
  /** 失败的 URL */
  url: string;
  /** 错误信息 */
  error: string;
}

/** 补全报告 */
export interface EnrichReport {
  /** 成功补全条数 */
  enriched: number;
  /** 补全失败条数 */
  failed: number;
  /** 跳过条数（超出 maxItems 或无 link） */
  skipped: number;
  /** 失败明细 */
  errors: EnrichError[];
}

/** 补全结果 */
export interface EnrichResult {
  items: RssItem[];
  report: EnrichReport;
}

// ============================================================================
// 完整性评估
// ============================================================================

/** 完整性分类结果 */
export interface CompletenessResult {
  /** 内容已完整的条目 */
  complete: RssItem[];
  /** 有 link 但内容不足的条目（可补全） */
  incomplete: RssItem[];
  /** 无 link 的条目（无法补全） */
  unenrichable: RssItem[];
}

// ============================================================================
// 页面提取
// ============================================================================

/** 页面内容提取结果 */
export interface ExtractResult {
  /** 标题 */
  title?: string;
  /** 正文内容（markdown 或 html） */
  content?: string;
  /** 作者 */
  author?: string;
  /** 发布时间 */
  publishedAt?: string;
}

// ============================================================================
// RSSHub 路由发现
// ============================================================================

/** 路由元信息 */
export interface RouteInfo {
  /** 路由路径模板（如 /bilibili/user/video/:uid） */
  path: string;
  /** 命名空间（如 bilibili） */
  namespace: string;
  /** 路径参数名列表 */
  params: string[];
  /** 可选参数名列表 */
  optionalParams: string[];
}

/** Radar 检测结果 */
export interface DetectionResult {
  /** 匹配的路由信息 */
  route: RouteInfo;
  /** 匹配置信度 (0-1) */
  confidence: number;
  /** 从 URL 中提取到的参数值 */
  extractedParams: Record<string, string>;
  /** 构建后的完整 RSSHub 路由路径 */
  resolvedPath: string;
}

/** 路由解析结果 */
export interface RouteResolution {
  route: string;
  resolvedBaseUrl: string;
  mode: "external-http" | "embedded-package";
  source: "param-override" | "env-default" | "embedded-default";
}

/** 浏览器能力配置（内部使用） */
export interface BrowserCapabilityConfig {
  browserUrl: string | null;
  browserWSEndpoint: string | null;
  source: "derived-from-browser-url" | "explicit-ws-endpoint" | "unavailable";
}

/** 故障分类 */
export type FailureKind =
  | "service_unavailable"
  | "route_unavailable"
  | "browser_capability_unavailable";

export interface FailureClassification {
  kind: FailureKind;
  message: string;
  recoverable: boolean;
}

// ============================================================================
// Skill 参数
// ============================================================================

/** 主 Skill 参数 */
export interface RssParams {
  url?: string;
  route?: string;
  rsshubBase?: string;
  googleQuery?: string;
  googleLocale?: GoogleNewsLocale;
  /** 限定来源域名，如 "techcrunch.com"（仅 googleQuery 模式） */
  googleSource?: string;
  /** 时间范围：1h / 1d / 7d / 30d / 1y（仅 googleQuery 模式） */
  googleWhen?: string;
  maxItems?: number;
  summary?: boolean;
  skipEnrichment?: boolean;
  minContentLength?: number;
  maxEnrichItems?: number;
  concurrency?: number;
  format?: "markdown" | "html";
  detailSelectors?: DetailSelectors;
}

/** 主 Skill 结果 */
export interface RssResult {
  success: boolean;
  feed: RssFeed;
  report: EnrichReport | null;
  error?: string;
}
