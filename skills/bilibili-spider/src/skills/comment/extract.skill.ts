import { resolve } from "node:path";
import type { Page } from "puppeteer-core";
import {
  ArtifactsSlot,
  ContentStore,
  InvalidParamsError,
  ProjectionPipeline,
  type Artifact,
  type BaseGoal,
  type BrowserSkillOptions,
  type ContentAsset,
  type ContentRecord,
  type GoalSkillDeps,
  type PageContext,
  type SkillParamSchema,
} from "@spider/core";
import { BILIBILI_WWW } from "@src/constants";
import {
  BILI_COMMENTS_DEFAULT_IMAGE_TIMEOUT,
  BILI_COMMENTS_DEFAULT_MAX_PAGES,
  BILI_COMMENTS_DEFAULT_REPLIES_LIMIT,
  BILI_COMMENTS_MAX_PAGES_CAP,
  BILI_COMMENTS_REPLIES_PAGE_SIZE,
} from "@src/constants";
import { CommentSkillBase } from "@src/skills/comment/_base";
import { resolveCommentInput } from "@src/thrall/comment/input";
import {
  CommentSubjectResolver,
  type ICommentSubjectStrategy,
} from "@src/thrall/comment/subject";
import {
  BiliCommentsPageGoal,
  type BiliCommentsPageGoalParams,
} from "@src/thrall/comment/comments";
import {
  BiliCommentRepliesGoal,
  type BiliCommentRepliesGoalParams,
} from "@src/thrall/comment/replies";
import { collectCommentImages } from "@src/thrall/comment/parse";
import { renderCommentsMarkdown } from "@src/thrall/comment/render";
import { BiliImageDownloader } from "@src/services/image-downloader";
import { commentsViewDir, imageAssetName } from "@src/services/files";
import { projectBiliCommentsAiReady } from "@src/projections/comment.ai-ready";
import type {
  BiliCommentImage,
  BiliCommentItem,
  BiliCommentMode,
  BiliCommentParams,
  BiliCommentsPage,
  BiliCommentsProjected,
  BiliCommentsResult,
  BiliCommentSubject,
} from "@src/types/comment.types";

interface BiliCommentsSkillOptions {
  outputDir?: string;
  contentStore?: ContentStore;
  downloader?: BiliImageDownloader;
  /** 注入自定义定位策略集（默认 Direct/Article/Video/Opus 四策略） */
  subjectStrategies?: ICommentSubjectStrategy[];
}

const NAV_TIMEOUT = 30_000;

/**
 * Bilibili 评论提取 Skill —— `/x/v2/reply/wbi/main`（WBI 签名）。
 *
 * 评论区按 (oid,type) 定位，与内容形态解耦：传入视频 bvid/av、专栏 cv、opus 图文或
 * 直接 oid+type 均可，由 {@link CommentSubjectResolver}（策略模式 + 依赖注入）解析。
 * 主楼单页抓取交给声明式 {@link BiliCommentsPageGoal}；多页连抓由本 Skill 按 offset
 * 游标编排循环（honor 动态 maxPages + 硬上限，暴露 nextOffset）。文字 + 配图均提取，
 * 配图下载本地化，输出 comments.md + meta.json + images/。详见
 * docs/comment-extract-analysis.md。从关键词检索请先用 bili-search。
 */
export class BiliCommentsSkill extends CommentSkillBase<
  BiliCommentParams,
  BiliCommentsResult,
  BiliCommentsProjected
> {
  readonly id = "bili-comments";
  readonly name = "Bilibili 评论提取";
  readonly description =
    "提取 Bilibili 视频/专栏/图文的评论（文字 + 配图）。传入 bvid/av、cv、opusId、内容 URL " +
    "或 oid+type 定位评论区；按热度/时间排序，offset 游标多页连抓，配图下载本地化，" +
    "输出 comments.md + meta.json + images/。";
  readonly paramSchema: SkillParamSchema[] = [
    { name: "url", type: "string", required: false, description: "内容 URL：/video/、/opus/、/read/cv" },
    { name: "bvid", type: "string", required: false, description: "视频 BV 号" },
    { name: "aid", type: "string", required: false, description: "视频 av 号（数字）" },
    { name: "cvId", type: "string", required: false, description: "老版专栏 cv 号" },
    { name: "opusId", type: "string", required: false, description: "opus 图文/动态主键（数字串）" },
    { name: "oid", type: "string", required: false, description: "评论区 oid，与 type 配对直传" },
    { name: "type", type: "number", required: false, description: "评论区 type，与 oid 配对直传（1=视频/12=专栏cv）" },
    {
      name: "mode",
      type: "number",
      required: false,
      default: 3,
      description: "排序：3=热度（默认）/ 2=时间",
    },
    {
      name: "maxPages",
      type: "number",
      required: false,
      default: BILI_COMMENTS_DEFAULT_MAX_PAGES,
      description: `主楼连抓页数（默认 ${BILI_COMMENTS_DEFAULT_MAX_PAGES}，硬上限 ${BILI_COMMENTS_MAX_PAGES_CAP}）`,
    },
    {
      name: "offset",
      type: "string",
      required: false,
      description: "跨 maxPages 续取游标；首次留空，续取传上一次返回的 nextOffset",
    },
    {
      name: "includeReplies",
      type: "boolean",
      required: false,
      default: false,
      description: "true 时为每条主楼追加完整楼中楼（默认仅用主楼内嵌的少量热门子回复）",
    },
    {
      name: "repliesLimit",
      type: "number",
      required: false,
      default: BILI_COMMENTS_DEFAULT_REPLIES_LIMIT,
      description: "includeReplies=true 时每条主楼最多追加的子回复数",
    },
    {
      name: "downloadImages",
      type: "boolean",
      required: false,
      default: true,
      description: "false 时保留远程原图 URL，不下载评论配图",
    },
    { name: "outputDir", type: "string", required: false, description: "输出目录；不传使用 storageRoot/bilibili" },
    {
      name: "imageTimeoutMs",
      type: "number",
      required: false,
      default: BILI_COMMENTS_DEFAULT_IMAGE_TIMEOUT,
      description: "单图下载超时（毫秒）",
    },
  ];

  private readonly outputDir: string;
  private readonly content: ContentStore;
  private readonly downloader: BiliImageDownloader;
  private readonly subjectResolver: CommentSubjectResolver;

  constructor(deps: GoalSkillDeps, options: BiliCommentsSkillOptions = {}) {
    super(deps);
    this.outputDir = options.outputDir ?? process.cwd();
    this.content = options.contentStore ?? new ContentStore(this.outputDir);
    this.downloader = options.downloader ?? new BiliImageDownloader();
    this.subjectResolver = new CommentSubjectResolver(options.subjectStrategies);
  }

  /** PuppeteerGoalSkill 抽象成员：默认单页 Goal（多页编排在 fetchData）。 */
  protected createGoal(): BaseGoal<BiliCommentsResult> {
    return new BiliCommentsPageGoal() as unknown as BaseGoal<BiliCommentsResult>;
  }

  protected normalizeParams(params: BiliCommentParams): BiliCommentParams {
    const mode: BiliCommentMode = params.mode === 2 ? 2 : 3;
    const rawMaxPages = Math.floor(Number(params.maxPages ?? BILI_COMMENTS_DEFAULT_MAX_PAGES));
    const maxPages = Math.min(
      Math.max(1, Number.isFinite(rawMaxPages) ? rawMaxPages : BILI_COMMENTS_DEFAULT_MAX_PAGES),
      BILI_COMMENTS_MAX_PAGES_CAP,
    );
    const imageTimeoutMs = Math.floor(
      Number(params.imageTimeoutMs ?? BILI_COMMENTS_DEFAULT_IMAGE_TIMEOUT),
    );

    const normalized: BiliCommentParams = {
      ...params,
      mode,
      maxPages,
      offset: (params.offset ?? "").trim(),
      includeReplies: params.includeReplies ?? false,
      repliesLimit: Math.max(
        1,
        Math.floor(Number(params.repliesLimit ?? BILI_COMMENTS_DEFAULT_REPLIES_LIMIT)),
      ),
      downloadImages: params.downloadImages ?? true,
      imageTimeoutMs,
    };

    // 早校验入口（无法定位评论区时抛 InvalidParamsError）
    resolveCommentInput(normalized);

    if (imageTimeoutMs < 1000) {
      throw new InvalidParamsError("imageTimeoutMs 至少为 1000", { scope: this.id });
    }

    return normalized;
  }

  /** 导航 www 首页携带登录态 Cookie；接口请求由 Goal 发起。 */
  protected async navigate(page: Page, _params: BiliCommentParams): Promise<void> {
    await page.goto(BILIBILI_WWW, {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT,
    });
  }

  /** 解析评论区 → 多页连抓 → 可选楼中楼 → 下载配图 → 渲染落盘。 */
  protected async fetchData(
    page: Page,
    params: BiliCommentParams,
    options?: BrowserSkillOptions,
    ctx?: PageContext<BiliCommentParams>,
  ): Promise<BiliCommentsResult> {
    const mode: BiliCommentMode = params.mode === 2 ? 2 : 3;
    const subject = await this.resolveSubject(page, params);

    const page0 = await this.crawlPages(page, params, subject, mode, options);

    if (params.includeReplies) {
      await this.expandReplies(page, params, subject, page0.items, options);
    }

    const outputDir = resolve(params.outputDir ?? this.outputDir);
    const store =
      params.outputDir && resolve(params.outputDir) !== this.content.rootDir
        ? new ContentStore(outputDir)
        : this.content;
    const viewDir = commentsViewDir({ type: subject.type, oid: subject.oid });
    const artifacts: Artifact[] = [];
    const assets: ContentAsset[] = [];

    const imageFiles = await this.downloadImages(
      page,
      params,
      [...page0.topItems, ...page0.items],
      store,
      viewDir,
      artifacts,
      assets,
    );

    const result: BiliCommentsResult = {
      source: { ...subject, mode },
      meta: { total: page0.total },
      pagesFetched: page0.pagesFetched,
      returnedCount: page0.items.length,
      topItems: page0.topItems,
      items: page0.items,
      nextOffset: page0.nextOffset,
      hasMore: Boolean(page0.nextOffset) && !page0.isEnd,
      files: { markdown: null, meta: null, images: imageFiles },
      outputDir,
      crawledAt: new Date(),
    };

    const markdown = renderCommentsMarkdown(result);
    const mdPath = await store.writeView(`${viewDir}/comments.md`, markdown);
    artifacts.push({
      path: mdPath,
      role: "comments-markdown",
      contentType: "text/markdown",
      sizeBytes: Buffer.byteLength(markdown, "utf-8"),
    });
    result.files.markdown = mdPath;

    const record = this.buildRecord(result, viewDir, assets);
    const metaJson = JSON.stringify(
      { ...record, details: this.buildDetails(result) },
      null,
      2,
    );
    const metaPath = await store.writeView(`${viewDir}/meta.json`, metaJson);
    artifacts.push({
      path: metaPath,
      role: "comments-meta",
      contentType: "application/json",
      sizeBytes: Buffer.byteLength(metaJson, "utf-8"),
    });
    result.files.meta = metaPath;
    await store.appendManifest(record);

    if (ctx && artifacts.length > 0) {
      ctx.set(ArtifactsSlot, artifacts);
    }

    return result;
  }

  /** 组装内容清单记录（manifest 用；meta.json 在此基础上加 details）。 */
  private buildRecord(
    result: BiliCommentsResult,
    viewDir: string,
    assets: ContentAsset[],
  ): ContentRecord {
    return {
      kind: "comments",
      platform: "bilibili",
      id: `${result.source.type}-${result.source.oid}`,
      title: `评论区 ${result.source.type}-${result.source.oid}`,
      url: null,
      publishedAt: null,
      collectedAt: new Date().toISOString(),
      view: viewDir,
      assets,
    };
  }

  /** 用策略解析器把入参解析为评论区 (oid,type)。 */
  private async resolveSubject(
    page: Page,
    params: BiliCommentParams,
  ): Promise<BiliCommentSubject> {
    const input = resolveCommentInput(params);
    return this.subjectResolver.resolve(page, input);
  }

  /** 按 offset 游标连抓主楼，直到到底或达到 maxPages。 */
  private async crawlPages(
    page: Page,
    params: BiliCommentParams,
    subject: BiliCommentSubject,
    mode: BiliCommentMode,
    options?: BrowserSkillOptions,
  ): Promise<{
    items: BiliCommentItem[];
    topItems: BiliCommentItem[];
    total: number | null;
    nextOffset: string | null;
    isEnd: boolean;
    pagesFetched: number;
  }> {
    const maxPages = params.maxPages ?? BILI_COMMENTS_DEFAULT_MAX_PAGES;
    const seen = new Set<string>();
    const items: BiliCommentItem[] = [];
    let topItems: BiliCommentItem[] = [];
    let total: number | null = null;
    let offset = params.offset ?? "";
    let nextOffset: string | null = null;
    let isEnd = false;
    let pagesFetched = 0;

    for (let i = 0; i < maxPages; i++) {
      const goalParams: BiliCommentsPageGoalParams = {
        oid: subject.oid,
        type: subject.type,
        mode,
        offset,
      };
      const pageData = await this.deps.goalExecutor.execute<BiliCommentsPage>(
        new BiliCommentsPageGoal(),
        page,
        goalParams as unknown as Record<string, unknown>,
        { silent: options?.silent ?? false },
      );

      pagesFetched++;
      if (i === 0) {
        topItems = pageData.topItems;
        total = pageData.total;
      }
      for (const item of pageData.items) {
        if (item.rpid && seen.has(item.rpid)) continue;
        if (item.rpid) seen.add(item.rpid);
        items.push(item);
      }

      nextOffset = pageData.nextOffset;
      isEnd = pageData.isEnd;
      if (pageData.isEnd || !pageData.nextOffset) {
        nextOffset = null;
        break;
      }
      offset = pageData.nextOffset;
    }

    return { items, topItems, total, nextOffset, isEnd, pagesFetched };
  }

  /** includeReplies=true：逐条主楼抓取一页完整楼中楼覆盖内嵌子回复，失败降级告警。 */
  private async expandReplies(
    page: Page,
    params: BiliCommentParams,
    subject: BiliCommentSubject,
    items: BiliCommentItem[],
    options?: BrowserSkillOptions,
  ): Promise<void> {
    const limit = params.repliesLimit ?? BILI_COMMENTS_DEFAULT_REPLIES_LIMIT;
    for (const item of items) {
      if (item.replyCount <= 0) continue;
      try {
        const goalParams: BiliCommentRepliesGoalParams = {
          oid: subject.oid,
          type: subject.type,
          root: item.rpid,
          ps: BILI_COMMENTS_REPLIES_PAGE_SIZE,
          pn: 1,
        };
        const replies = await this.deps.goalExecutor.execute<BiliCommentItem[]>(
          new BiliCommentRepliesGoal(),
          page,
          goalParams as unknown as Record<string, unknown>,
          { silent: options?.silent ?? false },
        );
        if (replies.length > 0) item.replies = replies.slice(0, limit);
      } catch (err) {
        this.addWarning({
          code: "comment-replies-failed",
          message: `楼中楼抓取失败，保留内嵌热门子回复：rpid=${item.rpid}`,
          details: { error: err instanceof Error ? err.message : String(err) },
        });
      }
    }
  }

  /** 下载评论配图：取字节 → 内容寻址入湖 → 在 view/assets 建 symlink，回填 localPath。 */
  private async downloadImages(
    page: Page,
    params: BiliCommentParams,
    items: BiliCommentItem[],
    store: ContentStore,
    viewDir: string,
    artifacts: Artifact[],
    assets: ContentAsset[],
  ): Promise<string[]> {
    if (params.downloadImages === false) return [];

    const images: BiliCommentImage[] = collectCommentImages(items);
    if (images.length === 0) return [];

    const referer = page.url() || BILIBILI_WWW;
    const written: string[] = [];
    let index = 0;

    for (const image of images) {
      try {
        const bytes = await this.downloader.downloadBytes(page, {
          url: image.url,
          referer,
          timeoutMs: params.imageTimeoutMs ?? BILI_COMMENTS_DEFAULT_IMAGE_TIMEOUT,
        });
        const ref = await store.ingestBuffer(bytes.buffer, bytes.ext);
        index += 1;
        const assetName = imageAssetName(index, ref.ext);
        const linkPath = await store.link(`${viewDir}/assets/${assetName}`, ref);
        // Markdown 引用为相对 comments.md 的路径
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
          role: "comment-image",
          contentType: bytes.contentType,
          sourceUrl: bytes.sourceUrl,
          sizeBytes: ref.sizeBytes,
        });
        written.push(linkPath);
      } catch (err) {
        this.addWarning({
          code: "image-download-failed",
          message: `评论配图下载失败，保留远程 URL：${image.url}`,
          details: { error: err instanceof Error ? err.message : String(err) },
        });
      }
    }
    return written;
  }

  private buildDetails(result: BiliCommentsResult) {
    return {
      skill: this.id,
      source: result.source,
      total: result.meta.total,
      pagesFetched: result.pagesFetched,
      returnedCount: result.returnedCount,
      topCount: result.topItems.length,
      nextOffset: result.nextOffset,
      hasMore: result.hasMore,
      crawledAt: result.crawledAt,
      fieldSources: {
        subject: "resolver: direct/video(view)/article(cv)/opus(web-dynamic detail)",
        items: "api: /x/v2/reply/wbi/main data.replies[]",
        topItems: "api: /x/v2/reply/wbi/main data.top_replies[]",
        total: "api: data.cursor.all_count",
        nextOffset: "api: data.cursor.pagination_reply.next_offset",
        replies: "api: /x/v2/reply/reply data.replies[]（includeReplies=true）",
      },
    };
  }

  protected get pipeline(): ProjectionPipeline<
    BiliCommentParams,
    BiliCommentsResult,
    BiliCommentsResult,
    BiliCommentsProjected
  > {
    return {
      envelope: (data) =>
        projectBiliCommentsAiReady(data),
    };
  }
}
