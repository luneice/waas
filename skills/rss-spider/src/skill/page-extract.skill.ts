/**
 * 单页详情提取 Skill
 *
 * AI Agent 入口：Puppeteer 打开指定 URL，提取正文、标题、作者、发布时间。
 * 使用多级 IPageExtractor 策略链（Readability → CustomSelector → …）。
 *
 * 继承核心 PuppeteerSkill，复用 Template Method 的浏览器生命周期管理。
 */
import type { Page, PuppeteerLifeCycleEvent } from "puppeteer-core";
import {
  PuppeteerSkill,
  MissingContextError,
  ArtifactsSlot,
  DocumentArtifactSink,
  sanitizeSlug,
  type PuppeteerSkillDeps,
  type SkillParamSchema,
  type ProjectionPipeline,
  type Artifact,
  type DocumentProvenance,
} from "@spider/core";
import type { IPageExtractor } from "@src/enrichment/interfaces";
import { extractPageWithFrames } from "@src/enrichment/page-extractor-chain";
import type { Configuration } from "@src/config";
import type { RssItem, DetailSelectors } from "@src/types";
import { isGoogleNewsUrl } from "@src/utils/google-news-decoder";

/** PageExtractSkill 依赖 */
export interface PageExtractSkillDeps extends PuppeteerSkillDeps {
  extractors: IPageExtractor[];
  config: Configuration;
}

interface PageExtractParams {
  /** 详情页 URL */
  url: string;
  /** 自定义 CSS 选择器 */
  selectors?: DetailSelectors;
  /** 输出格式 */
  format?: "markdown" | "html";
}

export class PageExtractSkill extends PuppeteerSkill<
  PageExtractParams,
  RssItem
> {
  readonly id = "page-extract";
  readonly name = "单页详情提取";
  readonly description =
    "Puppeteer 打开详情页 URL，提取正文（Readability 提纯 + Turndown 转 markdown）、标题、作者、发布时间";
  readonly paramSchema: SkillParamSchema[] = [
    {
      name: "url",
      type: "string",
      required: true,
      description: "详情页地址",
    },
    {
      name: "selectors",
      type: "object",
      required: false,
      description: "自定义 CSS 选择器 { content, title, author, time }",
    },
    {
      name: "format",
      type: "string",
      required: false,
      default: "markdown",
      description:
        '输出正文格式："markdown"（默认，Readability + Turndown）或 "html"（Readability 提纯后的干净 HTML）',
    },
  ];

  private readonly extractors: IPageExtractor[];
  private readonly config: Configuration;

  constructor(deps: PageExtractSkillDeps) {
    super(deps);
    this.extractors = deps.extractors;
    this.config = deps.config;
  }

  // ── PuppeteerSkill 钩子 ──

  protected readonly siteURL = "";

  protected getPath(params: PageExtractParams): string {
    return params.url;
  }

  /** 覆写导航：直接使用参数中的完整 URL */
  protected async navigate(
    page: Page,
    params: PageExtractParams,
  ): Promise<void> {
    const url = params.url;
    if (!url) return;

    if (isGoogleNewsUrl(url)) {
      // Google News URL 会经历 JS 重定向，需等待跳转到真实站点
      await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: this.navigateTimeout,
      });
      // 如果仍停留在 news.google.com，等待导航到真实站点
      if (page.url().includes("news.google.com")) {
        await page
          .waitForNavigation({
            waitUntil: "domcontentloaded",
            timeout: this.navigateTimeout,
          })
          .catch(() => {});
      }
    } else {
      await page.goto(url, {
        waitUntil: this.navigateWaitUntil,
        timeout: this.navigateTimeout,
      });
    }
  }

  protected get navigateWaitUntil(): PuppeteerLifeCycleEvent {
    return "domcontentloaded";
  }

  protected get navigateTimeout(): number {
    return this.config.pageNavigationTimeout;
  }

  protected normalizeParams(params: PageExtractParams): PageExtractParams {
    if (!params.url || typeof params.url !== "string") {
      throw new MissingContextError("url 参数为必填项", { scope: this.id });
    }
    return params;
  }

  /** 核心提取逻辑 — 在 PuppeteerSkill 的 Template Method 中被调用 */
  protected async fetchData(
    page: Page,
    params: PageExtractParams,
  ): Promise<RssItem> {
    const selectors = params.selectors;
    const resolvedUrl = page.url();
    params.url = resolvedUrl;

    const result = await extractPageWithFrames({
      page,
      url: resolvedUrl,
      extractors: this.extractors,
      selectors,
      minFrameContentLength: this.config.minContentLength,
    });
    if (result) {
      return {
        title: result.title ?? "",
        link: resolvedUrl,
        description: result.content,
        author: result.author,
        pubDate: result.publishedAt,
      };
    }

    // 所有策略均失败 — 返回最小结果
    return {
      title: await page.title(),
      link: resolvedUrl,
      description: undefined,
    };
  }

  /**
   * emit 阶段：把单页正文落盘为文档载荷 + intel 边车。
   * 仅在成功提取到正文（description 非空）时落盘——空提取不产文件。
   */
  protected get pipeline(): ProjectionPipeline<
    PageExtractParams,
    RssItem,
    RssItem,
    RssItem
  > {
    return {
      emit: async (item, pctx) => {
        const sink = this.deps.artifactSink;
        const body = item.description;
        if (!sink || !body) return;

        const isMarkdown = pctx.params.format !== "html";
        const ext = isMarkdown ? ".md" : ".html";
        const contentType = isMarkdown ? "text/markdown" : "text/html";
        const slug = sanitizeSlug(item.title || item.link);
        const provenance = buildRssProvenance(item);

        let artifact: Artifact;
        if (sink instanceof DocumentArtifactSink) {
          artifact = await sink.writeDocument({
            slug: `${slug}${ext}`,
            role: "document-text",
            contentType,
            data: body,
            provenance,
            sourceUrl: item.link,
          });
        } else {
          artifact = await sink.write(`media/${slug}${ext}`, body, {
            role: "document-text",
            contentType,
          });
        }
        const existing = pctx.pageContext.get(ArtifactsSlot) ?? [];
        pctx.pageContext.set(ArtifactsSlot, [
          ...existing,
          artifact,
        ] as Artifact[]);
      },
    };
  }
}

/**
 * 从 RssItem 组装中立溯源事实。
 * pubDate 是上游未归一的自由字符串——能解析出带时间的即秒级，仅日期即 day，
 * 无法解析则不伪造 publishedAt（由 intel 侧按 BAD_SIDECAR 处置或投递胶水补齐）。
 */
function buildRssProvenance(item: RssItem): DocumentProvenance {
  const { iso, precision } = normalizePubDate(item.pubDate);
  return {
    publishedAt: iso,
    publishedAtPrecision: iso ? precision : undefined,
    documentUrl: item.link,
  };
}

function normalizePubDate(raw?: string): {
  iso: string | undefined;
  precision: "second" | "day";
} {
  const s = (raw || "").trim();
  if (!s) return { iso: undefined, precision: "day" };
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    // 非标准格式：尝试抽取 y-m-d 作为 day 精度
    const dm = /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(s);
    if (!dm) return { iso: undefined, precision: "day" };
    const [, y, mo, dd] = dm;
    const pad = (v: string): string => v.padStart(2, "0");
    return {
      iso: `${y}-${pad(mo)}-${pad(dd)}T00:00:00+08:00`,
      precision: "day",
    };
  }
  // 原字符串带时区/时间信息即视为秒级；Date.toISOString 归一为 UTC(Z)
  const hasTime = /\d{1,2}:\d{2}/.test(s);
  return {
    iso: d.toISOString(),
    precision: hasTime ? "second" : "day",
  };
}
