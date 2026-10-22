import { resolve } from "node:path";
import type { Page } from "puppeteer-core";
import {
  ArtifactsSlot,
  ContentStore,
  InvalidParamsError,
  ProjectionPipeline,
  type Artifact,
  type BrowserSkillOptions,
  type ContentAsset,
  type ContentRecord,
  type GoalSkillDeps,
  type PageContext,
  type SkillParamSchema,
} from "@spider/core";
import { BILIBILI_WWW } from "@src/constants";
import { ArticleSkillBase } from "@src/skills/article/_base";
import { resolveArticleInput } from "@src/thrall/article/input";
import {
  extractOpusFromDom,
  waitForOpusRender,
} from "@src/thrall/article/dom-extract";
import { renderArticleMarkdown } from "@src/thrall/article/render";
import { BiliImageDownloader } from "@src/services/image-downloader";
import { articleViewDir, imageAssetName } from "@src/services/files";
import { projectBiliArticleExtractAiReady } from "@src/projections/article-extract.ai-ready";
import type {
  BiliArticleContent,
  BiliArticleExtractResult,
  BiliArticleParams,
  BiliArticleProjected,
} from "@src/types/article.types";

interface BiliArticleExtractSkillOptions {
  outputDir?: string;
  contentStore?: ContentStore;
  downloader?: BiliImageDownloader;
}

const DEFAULT_IMAGE_TIMEOUT = 30_000;
const NAV_TIMEOUT = 30_000;

/** 从最终页面 URL（cv 会 302 到 /opus/{id}）解析 opusId。 */
function extractOpusId(url: string): string | null {
  const m = /\/opus\/(\d+)/.exec(url || "");
  return m ? m[1] : null;
}

/**
 * Bilibili 专栏（opus 图文）提取 Skill —— SSR 页内解析。
 *
 * 正文来自详情页主文档内联的 `window.__INITIAL_STATE__.detail`（SSR），不走独立
 * 接口，故无需 WBI/playurl，不用声明式 Goal：fetchData 在导航后取 `page.content()`
 * → parseOpusInitialState → 下载配图 → 渲染 Markdown/meta 落盘。详见
 * docs/article-extract-analysis.md。从关键词检索请先用 bili-search。
 */
export class BiliArticleSkill extends ArticleSkillBase<
  BiliArticleParams,
  BiliArticleExtractResult,
  BiliArticleProjected
> {
  readonly id = "bili-article";
  readonly name = "Bilibili 专栏提取";
  readonly description =
    "使用当前浏览器登录态提取 Bilibili 专栏（opus 图文）。传入 opus/cv URL、opusId、cv 号直接定位；" +
    "正文来自详情页 SSR 内联状态，配图下载本地化，输出 article.md + meta.json + images/。";
  readonly paramSchema: SkillParamSchema[] = [
    {
      name: "url",
      type: "string",
      required: false,
      description: "专栏 URL：/opus/{opusId} 或 /read/cv{cvId}",
    },
    { name: "opusId", type: "string", required: false, description: "opus 主键（数字串）" },
    { name: "cvId", type: "string", required: false, description: "旧版 cv 号（纯数字或 cvXXXX）" },
    {
      name: "id",
      type: "string",
      required: false,
      description: "兼容简写：opus 数字串 / cvXXXX / 纯数字",
    },
    {
      name: "downloadImages",
      type: "boolean",
      required: false,
      default: true,
      description: "false 时正文保留远程原图 URL，不下载图片",
    },
    {
      name: "includeLinkCards",
      type: "boolean",
      required: false,
      default: false,
      description: "true 时在 Markdown 渲染链接卡/商品卡为引用行",
    },
    {
      name: "outputDir",
      type: "string",
      required: false,
      description: "输出目录；不传使用 storageRoot/bilibili",
    },
    {
      name: "imageTimeoutMs",
      type: "number",
      required: false,
      default: DEFAULT_IMAGE_TIMEOUT,
      description: "单图下载超时（毫秒）",
    },
  ];

  private readonly outputDir: string;
  private readonly content: ContentStore;
  private readonly downloader: BiliImageDownloader;

  constructor(deps: GoalSkillDeps, options: BiliArticleExtractSkillOptions = {}) {
    super(deps);
    this.outputDir = options.outputDir ?? process.cwd();
    this.content = options.contentStore ?? new ContentStore(this.outputDir);
    this.downloader = options.downloader ?? new BiliImageDownloader();
  }

  protected normalizeParams(params: BiliArticleParams): BiliArticleParams {
    const normalized: BiliArticleParams = {
      ...params,
      downloadImages: params.downloadImages ?? true,
      includeLinkCards: params.includeLinkCards ?? false,
      imageTimeoutMs: Math.floor(
        Number(params.imageTimeoutMs ?? DEFAULT_IMAGE_TIMEOUT),
      ),
    };

    // 早校验入口
    resolveArticleInput(normalized);

    if ((normalized.imageTimeoutMs ?? DEFAULT_IMAGE_TIMEOUT) < 1000) {
      throw new InvalidParamsError("imageTimeoutMs 至少为 1000", {
        scope: this.id,
      });
    }

    return normalized;
  }

  /** 导航专栏详情页（cv 会 302 到 opus），携带当前浏览器登录态 Cookie。 */
  protected async navigate(
    page: Page,
    params: BiliArticleParams,
  ): Promise<void> {
    const input = resolveArticleInput(params);
    await page.goto(this.directUrl(input), {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT,
    });
    // 登录态 opus 为 CSR，正文 hydration 后才写入 DOM —— 等待容器挂载
    await waitForOpusRender(page, NAV_TIMEOUT);
  }

  /** 导航详情页 → SSR 解析 → 下载配图 → 渲染落盘。 */
  protected async fetchData(
    page: Page,
    params: BiliArticleParams,
    options?: BrowserSkillOptions,
    ctx?: PageContext<BiliArticleParams>,
  ): Promise<BiliArticleExtractResult> {
    const input = resolveArticleInput(params);
    const source: BiliArticleExtractResult["source"] = {
      mode: "direct",
      input: input.input,
    };

    const opusId =
      input.opusId ?? extractOpusId(page.url()) ?? input.cvId ?? "";
    const article = await extractOpusFromDom(page, opusId);

    const outputDir = resolve(params.outputDir ?? this.outputDir);
    const store =
      params.outputDir && resolve(params.outputDir) !== this.content.rootDir
        ? new ContentStore(outputDir)
        : this.content;
    const viewDir = articleViewDir({
      mid: article.author.mid,
      opusId: article.opusId,
      cvId: article.cvId,
    });

    const artifacts: Artifact[] = [];
    const assets: ContentAsset[] = [];
    const imageFiles = await this.downloadImages(
      page,
      params,
      article,
      store,
      viewDir,
      artifacts,
      assets,
    );

    // 渲染 article.md（图片 localPath 已回填为 assets/img-00N）+ meta.json（人/AI 可读）
    const markdown = renderArticleMarkdown(article, {
      includeLinkCards: params.includeLinkCards ?? false,
    });
    const mdPath = await store.writeView(`${viewDir}/article.md`, markdown);
    artifacts.push({
      path: mdPath,
      role: "article-markdown",
      contentType: "text/markdown",
      sizeBytes: Buffer.byteLength(markdown, "utf-8"),
    });

    const record = this.buildRecord(source, article, viewDir, assets);
    const metaJson = JSON.stringify(
      { ...record, details: this.buildDetails(source, article) },
      null,
      2,
    );
    const metaPath = await store.writeView(`${viewDir}/meta.json`, metaJson);
    artifacts.push({
      path: metaPath,
      role: "article-meta",
      contentType: "application/json",
      sizeBytes: Buffer.byteLength(metaJson, "utf-8"),
    });
    await store.appendManifest(record);

    if (ctx && artifacts.length > 0) {
      ctx.set(ArtifactsSlot, artifacts);
    }

    for (const w of article.warnings) {
      this.addWarning({ code: "article-parse-warning", message: w });
    }

    return {
      source,
      content: article,
      files: {
        markdown: mdPath,
        meta: metaPath,
        images: imageFiles,
      },
      outputDir,
    };
  }

  /** 组装内容清单记录（manifest 用；meta.json 在此基础上加 details）。 */
  private buildRecord(
    source: BiliArticleExtractResult["source"],
    article: BiliArticleContent,
    viewDir: string,
    assets: ContentAsset[],
  ): ContentRecord {
    return {
      kind: "article",
      platform: "bilibili",
      id: article.opusId || article.cvId || "article",
      creator: {
        id: article.author.mid != null ? String(article.author.mid) : "_unknown",
        name: article.author.name,
      },
      title: article.title,
      url: article.opusId
        ? `${BILIBILI_WWW}/opus/${article.opusId}`
        : `${BILIBILI_WWW}/read/cv${article.cvId}`,
      publishedAt: article.author.pubTime,
      collectedAt: new Date().toISOString(),
      view: viewDir,
      assets,
    };
  }

  /** 下载配图：取字节 → 内容寻址入湖 → 在 view/assets 建 symlink，回填 localPath。 */
  private async downloadImages(
    page: Page,
    params: BiliArticleParams,
    article: BiliArticleContent,
    store: ContentStore,
    viewDir: string,
    artifacts: Artifact[],
    assets: ContentAsset[],
  ): Promise<string[]> {
    if (params.downloadImages === false) return [];

    const referer = page.url() || BILIBILI_WWW;
    const written: string[] = [];
    let index = 0;

    for (const para of article.paragraphs) {
      if (para.type !== "image" || !para.images) continue;
      for (const image of para.images) {
        try {
          const bytes = await this.downloader.downloadBytes(page, {
            url: image.url,
            referer,
            timeoutMs: params.imageTimeoutMs ?? DEFAULT_IMAGE_TIMEOUT,
          });
          const ref = await store.ingestBuffer(bytes.buffer, bytes.ext);
          index += 1;
          const assetName = imageAssetName(index, ref.ext);
          const linkPath = await store.link(`${viewDir}/assets/${assetName}`, ref);
          // Markdown 引用为相对 article.md 的路径
          image.localPath = `assets/${assetName}`;
          image.sizeBytes = ref.sizeBytes;
          assets.push({
            name: assetName,
            role: "image",
            sha256: ref.sha256,
            object: ref.objectPath,
            sizeBytes: ref.sizeBytes,
            contentType: bytes.contentType,
            sourceUrl: bytes.sourceUrl,
          });
          artifacts.push({
            path: linkPath,
            role: "article-image",
            contentType: bytes.contentType,
            sourceUrl: bytes.sourceUrl,
            sizeBytes: ref.sizeBytes,
          });
          written.push(linkPath);
        } catch (err) {
          this.addWarning({
            code: "image-download-failed",
            message: `配图下载失败，正文保留远程 URL：${image.url}`,
            details: { error: err instanceof Error ? err.message : String(err) },
          });
        }
      }
    }
    return written;
  }

  private directUrl(input: { opusId?: string; cvId?: string }): string {
    if (input.opusId) return `${BILIBILI_WWW}/opus/${input.opusId}`;
    return `${BILIBILI_WWW}/read/cv${input.cvId}`;
  }

  /** meta.json 的领域细节块（保留 v1 富信息：stat / fieldSources 等）。 */
  private buildDetails(
    source: BiliArticleExtractResult["source"],
    content: BiliArticleContent,
  ) {
    return {
      skill: this.id,
      source,
      opusId: content.opusId,
      cvId: content.cvId,
      articleType: content.articleType,
      author: content.author,
      stat: content.stat,
      paragraphCount: content.paragraphs.length,
      warnings: content.warnings,
      fieldSources: {
        title: "dom: .opus-module-title__text",
        opusId: "url: /opus/{opusId}",
        cvId: "api: web-dynamic detail item.basic.comment_id_str",
        author: "dom: .opus-module-author + api module_author",
        stat: "api: web-dynamic detail module_stat",
        content: "dom: .opus-module-content paragraphs",
      },
    };
  }

  protected get pipeline(): ProjectionPipeline<
    BiliArticleParams,
    BiliArticleExtractResult,
    BiliArticleExtractResult,
    BiliArticleProjected
  > {
    return {
      envelope: (data) =>
        projectBiliArticleExtractAiReady(data),
    };
  }
}
