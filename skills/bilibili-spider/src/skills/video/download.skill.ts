import { unlink } from "node:fs/promises";
import { resolve } from "node:path";
import type { Page } from "puppeteer-core";
import {
  ArtifactsSlot,
  ContentStore,
  EndpointHttpError,
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
import { BILIBILI_API_BASE, BILIBILI_WWW } from "@src/constants";
import { VideoSkillBase } from "@src/skills/video/_base";
import { BiliVideoGoal } from "@src/thrall/video/resolve";
import { resolveVideoInput } from "@src/thrall/video/input";
import type { CodecPreference } from "@src/thrall/video/stream-selection";
import {
  parseSubtitleView,
  type BiliSubtitleViewItem,
} from "@src/thrall/video/subtitle-meta";
import { BiliMediaDownloader } from "@src/services/media-downloader";
import { BiliMuxer } from "@src/services/muxer";
import { videoViewDir, videoAssetName, subtitleAssetName } from "@src/services/files";
import { projectBiliVideoDownloadAiReady } from "@src/projections/video-download.ai-ready";
import type {
  BiliDownloadedFile,
  BiliDownloadedPage,
  BiliDownloadedSubtitle,
  BiliResolvedPage,
  BiliVideoDownloadParams,
  BiliVideoDownloadProjected,
  BiliVideoDownloadResult,
  BiliVideoResolveResult,
} from "@src/types/video.types";

interface BiliVideoDownloadSkillOptions {
  outputDir?: string;
  contentStore?: ContentStore;
  downloader?: BiliMediaDownloader;
  muxer?: BiliMuxer;
}

const DEFAULT_QN = 80;
const DEFAULT_FNVAL = 4048;
const DEFAULT_CHUNK_SIZE = 4 * 1024 * 1024;
const DEFAULT_CHUNK_TIMEOUT = 30_000;

/**
 * Bilibili 视频 Skill —— 混合模式（PuppeteerGoalSkill 官方支持）。
 *
 * `createGoal` 提供声明式 BiliVideoGoal（view + playurl + 选流）；覆写 `fetchData`
 * 在解析结果之上承载领域副作用（浏览器内分段下载、ffmpeg 合并），
 * 这些副作用是 xhs 纯 JSON 采集没有的，无法表达为纯 Goal。
 */
export class BiliVideoSkill extends VideoSkillBase<
  BiliVideoDownloadParams,
  BiliVideoDownloadResult,
  BiliVideoDownloadProjected
> {
  readonly id = "bili-video";
  readonly name = "Bilibili 视频";
  readonly description =
    "使用当前浏览器登录态下载/解析 Bilibili 视频。传入 BV/av/视频 URL 直接定位；视频信息与播放地址解析走 Goal 流程，媒体下载走浏览器页内 fetch。从关键词检索请先用 bili-search。";
  readonly paramSchema: SkillParamSchema[] = [
    {
      name: "url",
      type: "string",
      required: false,
      description: "Bilibili 视频 URL，支持 /video/BV... 或 /video/av...",
    },
    { name: "bvid", type: "string", required: false, description: "BV 号" },
    { name: "aid", type: "number", required: false, description: "AV 数字 ID" },
    {
      name: "id",
      type: "string",
      required: false,
      description: "兼容简写：BV... / av... / 数字 aid",
    },
    {
      name: "part",
      type: "number",
      required: false,
      default: 1,
      description: "多 P 页码，1-based",
    },
    {
      name: "partMode",
      type: "string",
      required: false,
      default: "selected",
      description: "selected=仅下载 part；all=下载全部分 P",
    },
    {
      name: "qn",
      type: "number",
      required: false,
      default: DEFAULT_QN,
      description: "期望清晰度，80=1080P",
    },
    {
      name: "preferCodec",
      type: "string",
      required: false,
      default: "avc",
      description: "视频编码偏好：avc / hevc / av1 / best",
    },
    {
      name: "download",
      type: "boolean",
      required: false,
      default: true,
      description: "是否下载媒体（视频/音频）。false 时只解析 playurl 和选择流，不下载媒体（仍可单独下字幕）",
    },
    {
      name: "subtitle",
      type: "boolean",
      required: false,
      default: true,
      description: "是否下载字幕。与 download 相互独立：可同时下、只下视频(subtitle=false)、只下字幕(download=false)",
    },
    {
      name: "merge",
      type: "boolean",
      required: false,
      default: true,
      description: "是否调用 ffmpeg 合并音视频",
    },
    {
      name: "outputDir",
      type: "string",
      required: false,
      description: "输出目录；不传使用 storageRoot/bilibili",
    },
  ];

  private readonly outputDir: string;
  private readonly content: ContentStore;
  private readonly downloader: BiliMediaDownloader;
  private readonly muxer: BiliMuxer;

  constructor(deps: GoalSkillDeps, options: BiliVideoDownloadSkillOptions = {}) {
    super(deps);
    this.outputDir = options.outputDir ?? process.cwd();
    this.content = options.contentStore ?? new ContentStore(this.outputDir);
    this.downloader = options.downloader ?? new BiliMediaDownloader();
    this.muxer = options.muxer ?? new BiliMuxer();
  }

  protected createGoal(): BaseGoal<BiliVideoDownloadResult> {
    // 混合模式：实际解析交给 BiliVideoGoal（中间态 BiliVideoResolveResult），
    // 最终 BiliVideoDownloadResult 由覆写的 fetchData 在解析结果之上组装，
    // 故此处对抽象契约做一次类型擦除。
    return new BiliVideoGoal() as unknown as BaseGoal<BiliVideoDownloadResult>;
  }

  protected normalizeParams(
    params: BiliVideoDownloadParams,
  ): BiliVideoDownloadParams {
    const normalized: BiliVideoDownloadParams = {
      ...params,
      part: Math.floor(Number(params.part ?? 1)),
      partMode: params.partMode ?? "selected",
      qn: Math.floor(Number(params.qn ?? DEFAULT_QN)),
      fnval: Math.floor(Number(params.fnval ?? DEFAULT_FNVAL)),
      preferCodec: params.preferCodec ?? "avc",
      download: params.download ?? true,
      subtitle: params.subtitle ?? true,
      merge: params.merge ?? true,
      keepParts: params.keepParts ?? true,
      chunkSizeBytes: Math.floor(
        Number(params.chunkSizeBytes ?? DEFAULT_CHUNK_SIZE),
      ),
      chunkTimeoutMs: Math.floor(
        Number(params.chunkTimeoutMs ?? DEFAULT_CHUNK_TIMEOUT),
      ),
      ffmpegPath: params.ffmpegPath ?? "ffmpeg",
    };

    resolveVideoInput(normalized);

    if ((normalized.part ?? 1) < 1) {
      throw new InvalidParamsError("part 必须 >= 1", { scope: this.id });
    }
    if (normalized.partMode !== "selected" && normalized.partMode !== "all") {
      throw new InvalidParamsError("partMode 仅支持 selected 或 all", {
        scope: this.id,
      });
    }
    if ((normalized.qn ?? DEFAULT_QN) < 1) {
      throw new InvalidParamsError("qn 必须 >= 1", { scope: this.id });
    }
    if (
      !["avc", "hevc", "av1", "best"].includes(String(normalized.preferCodec))
    ) {
      throw new InvalidParamsError("preferCodec 仅支持 avc/hevc/av1/best", {
        scope: this.id,
      });
    }
    if ((normalized.chunkSizeBytes ?? DEFAULT_CHUNK_SIZE) < 256 * 1024) {
      throw new InvalidParamsError("chunkSizeBytes 至少为 256KiB", {
        scope: this.id,
      });
    }

    return normalized;
  }

  /** 导航到视频页（携带登录态 Cookie，满足后续接口 referer）。 */
  protected async navigate(
    page: Page,
    params: BiliVideoDownloadParams,
  ): Promise<void> {
    const input = resolveVideoInput(params);
    const target = input.bvid
      ? `${BILIBILI_WWW}/video/${input.bvid}/`
      : `${BILIBILI_WWW}/video/av${input.aid}/`;
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 30_000 });
  }

  /** 直接解析 → BiliVideoGoal 选流 → 落盘合并。 */
  protected async fetchData(
    page: Page,
    params: BiliVideoDownloadParams,
    options?: BrowserSkillOptions,
    ctx?: PageContext<BiliVideoDownloadParams>,
  ): Promise<BiliVideoDownloadResult> {
    const input = resolveVideoInput(params);

    const resolved = await this.deps.goalExecutor.execute<BiliVideoResolveResult>(
      new BiliVideoGoal(),
      page,
      {
        bvid: input.bvid,
        aid: input.aid,
        part: params.part ?? 1,
        partMode: params.partMode ?? "selected",
        qn: params.qn ?? DEFAULT_QN,
        fnval: params.fnval ?? DEFAULT_FNVAL,
        preferCodec: (params.preferCodec ?? "avc") as CodecPreference,
      },
      { silent: options?.silent ?? false },
    );

    const info = resolved.video;
    await ensureVideoPage(page, info.url);

    const outputDir = resolve(params.outputDir ?? this.outputDir);
    const content =
      params.outputDir && resolve(params.outputDir) !== this.content.rootDir
        ? new ContentStore(outputDir)
        : this.content;
    const viewDir = videoViewDir({ mid: info.owner.mid, bvid: info.bvid });

    const downloadedPages: BiliDownloadedPage[] = [];
    const artifacts: Artifact[] = [];
    const assets: ContentAsset[] = [];

    for (const resolvedPage of resolved.pages) {
      const { result: pageResult, assets: pageAssets } = await this.processPage(
        page,
        params,
        info,
        resolvedPage,
        content,
        viewDir,
      );
      downloadedPages.push(pageResult);
      assets.push(...pageAssets);
      for (const file of pageResult.files) {
        artifacts.push({
          path: file.path,
          role: file.role,
          contentType: file.contentType,
          sourceUrl: file.sourceUrl,
          sizeBytes: file.sizeBytes,
        });
      }
      for (const sub of pageResult.subtitles) {
        artifacts.push({
          path: sub.path,
          role: "subtitle",
          contentType: sub.contentType,
          sourceUrl: sub.sourceUrl,
          sizeBytes: sub.sizeBytes,
        });
      }
    }

    // 写 meta.json（人/AI 可读）+ 追加 manifest（全局索引 + 血缘）
    if (assets.length > 0) {
      const record = this.buildRecord(info, viewDir, assets, params);
      const metaPath = await content.writeView(
        `${viewDir}/meta.json`,
        JSON.stringify(record, null, 2),
      );
      artifacts.push({
        path: metaPath,
        role: "video-meta",
        contentType: "application/json",
        sizeBytes: Buffer.byteLength(JSON.stringify(record)),
      });
      await content.appendManifest(record);
    }

    if (ctx && artifacts.length > 0) {
      ctx.set(ArtifactsSlot, artifacts);
    }

    return {
      source: { mode: "direct", input: input.input },
      video: info,
      requested: {
        qn: params.qn ?? DEFAULT_QN,
        preferCodec: String(params.preferCodec ?? "avc"),
        partMode: String(params.partMode ?? "selected"),
        download: params.download !== false,
        subtitle: params.subtitle !== false,
        merge: params.merge !== false,
      },
      pages: downloadedPages,
      outputDir,
    };
  }

  /** 组装内容清单记录（meta.json 与 manifest.jsonl 共用同一 schema）。 */
  private buildRecord(
    info: BiliVideoResolveResult["video"],
    viewDir: string,
    assets: ContentAsset[],
    params: BiliVideoDownloadParams,
  ): ContentRecord {
    return {
      kind: "video",
      platform: "bilibili",
      id: info.bvid,
      creator: {
        id: info.owner.mid != null ? String(info.owner.mid) : "_unknown",
        name: info.owner.name,
      },
      title: info.title,
      url: info.url,
      publishedAt: null,
      collectedAt: new Date().toISOString(),
      view: viewDir,
      assets,
    };
  }

  /** 下载 + 合并单个分 P；download=false 时仅返回选流元数据。 */
  private async processPage(
    page: Page,
    params: BiliVideoDownloadParams,
    info: BiliVideoResolveResult["video"],
    resolvedPage: BiliResolvedPage,
    content: ContentStore,
    viewDir: string,
  ): Promise<{ result: BiliDownloadedPage; assets: ContentAsset[] }> {
    const { page: videoPage, selected } = resolvedPage;
    const files: BiliDownloadedFile[] = [];
    const assets: ContentAsset[] = [];
    const subtitles: BiliDownloadedSubtitle[] = [];
    let merged: BiliDownloadedFile | null = null;
    const referer = info.url;

    if (params.download !== false && selected) {
      const height = selected.video.height;
      const codecs = selected.video.codecs;

      // ── 视频流：下载到暂存 → 内容寻址入湖 ──
      const videoStaging = await content.stagingPath(
        `${info.bvid}-P${videoPage.page}-video.m4s`,
      );
      const videoDl = await this.downloader.download(
        page,
        {
          role: "video",
          urls: [selected.video.url, ...selected.video.backupUrls],
          outputPath: videoStaging,
          referer,
          chunkSizeBytes: params.chunkSizeBytes ?? DEFAULT_CHUNK_SIZE,
          timeoutMs: params.chunkTimeoutMs ?? DEFAULT_CHUNK_TIMEOUT,
        },
        content.rootDir,
      );
      const videoRef = await content.ingestFile(videoDl.absolutePath, {
        ext: ".m4s",
        sha256: videoDl.sha256,
      });

      // ── 音频流 ──
      const audioStaging = await content.stagingPath(
        `${info.bvid}-P${videoPage.page}-audio.m4s`,
      );
      const audioDl = await this.downloader.download(
        page,
        {
          role: "audio",
          urls: [selected.audio.url, ...selected.audio.backupUrls],
          outputPath: audioStaging,
          referer,
          chunkSizeBytes: params.chunkSizeBytes ?? DEFAULT_CHUNK_SIZE,
          timeoutMs: params.chunkTimeoutMs ?? DEFAULT_CHUNK_TIMEOUT,
        },
        content.rootDir,
      );
      const audioRef = await content.ingestFile(audioDl.absolutePath, {
        ext: ".m4s",
        sha256: audioDl.sha256,
      });

      let mergeOk = false;
      if (params.merge !== false) {
        const mp4Staging = await content.stagingPath(
          `${info.bvid}-P${videoPage.page}.mp4`,
        );
        try {
          await this.muxer.merge({
            ffmpegPath: params.ffmpegPath ?? "ffmpeg",
            videoPath: videoRef.absPath,
            audioPath: audioRef.absPath,
            outputPath: mp4Staging,
            rootDir: content.rootDir,
          });
          const mergedRef = await content.ingestFile(mp4Staging, { ext: ".mp4" });
          const mergedName = videoAssetName({
            page: videoPage.page,
            part: videoPage.part,
            role: "merged",
            height,
            codecs,
          });
          const mergedPath = await content.link(`${viewDir}/${mergedName}`, mergedRef);
          merged = {
            role: "merged",
            path: mergedPath,
            absolutePath: content.viewAbs(`${viewDir}/${mergedName}`),
            sizeBytes: mergedRef.sizeBytes,
            contentType: "video/mp4",
            sha256: mergedRef.sha256,
          };
          files.push(merged);
          assets.push({
            name: mergedName,
            role: "merged",
            sha256: mergedRef.sha256,
            object: mergedRef.objectPath,
            sizeBytes: mergedRef.sizeBytes,
            contentType: "video/mp4",
            extra: { page: videoPage.page, part: videoPage.part, height, codec: codecs },
          });
          mergeOk = true;
        } catch (err) {
          await unlink(mp4Staging).catch(() => undefined);
          this.addWarning({
            code: "merge-failed",
            message:
              "音视频分片已入内容湖，但 ffmpeg 合并失败；可用 view 下的 video/audio m4s 手动合并。",
            details: {
              error: err instanceof Error ? err.message : String(err),
              viewDir,
            },
          });
        }
      }

      // 视图中是否保留分片：merge 失败必须保留；keepParts!==false 时也保留
      const keepParts = params.keepParts !== false || !mergeOk;
      if (keepParts) {
        const videoName = videoAssetName({
          page: videoPage.page,
          part: videoPage.part,
          role: "video",
          height,
          codecs,
        });
        const audioName = videoAssetName({
          page: videoPage.page,
          part: videoPage.part,
          role: "audio",
        });
        const videoPath = await content.link(`${viewDir}/${videoName}`, videoRef);
        const audioPath = await content.link(`${viewDir}/${audioName}`, audioRef);
        files.push(
          {
            role: "video",
            path: videoPath,
            absolutePath: content.viewAbs(`${viewDir}/${videoName}`),
            sizeBytes: videoRef.sizeBytes,
            contentType: videoDl.contentType,
            sourceUrl: videoDl.sourceUrl,
            sha256: videoRef.sha256,
          },
          {
            role: "audio",
            path: audioPath,
            absolutePath: content.viewAbs(`${viewDir}/${audioName}`),
            sizeBytes: audioRef.sizeBytes,
            contentType: audioDl.contentType,
            sourceUrl: audioDl.sourceUrl,
            sha256: audioRef.sha256,
          },
        );
        assets.push(
          {
            name: videoName,
            role: "video",
            sha256: videoRef.sha256,
            object: videoRef.objectPath,
            sizeBytes: videoRef.sizeBytes,
            contentType: videoDl.contentType,
            sourceUrl: videoDl.sourceUrl,
            extra: { page: videoPage.page, part: videoPage.part, height, codec: codecs },
          },
          {
            name: audioName,
            role: "audio",
            sha256: audioRef.sha256,
            object: audioRef.objectPath,
            sizeBytes: audioRef.sizeBytes,
            contentType: audioDl.contentType,
            sourceUrl: audioDl.sourceUrl,
            extra: { page: videoPage.page, part: videoPage.part },
          },
        );
      }
    }

    // 媒体流不可用（付费未购买 / 未转码完成等）时告警，但不阻断字幕等增强数据。
    if (params.download !== false && !selected) {
      this.addWarning({
        code: "stream-unavailable",
        message:
          resolvedPage.streamUnavailable ??
          "playurl 未返回可下载的 DASH 流，已跳过视频/音频下载；字幕等其它数据不受影响。",
        details: { bvid: info.bvid, page: videoPage.page, viewDir },
      });
    }

    // ── 字幕：独立于媒体流的可选增强（subtitle 参数单独控制），付费未购买视频亦可全量获取 ──
    if (params.subtitle !== false) {
      // 路径 A（快）：wbi/v2 返回了明文 subtitle_url —— Node 侧直接拉取。
      for (const sub of resolvedPage.subtitles) {
        const downloaded = await this.downloadSubtitle(
          sub,
          referer,
          content,
          viewDir,
          videoPage,
        );
        if (!downloaded) continue;
        subtitles.push(downloaded.file);
        assets.push(downloaded.asset);
      }

      // 路径 B（回退）：wbi/v2 无字幕（付费 upower 视频常见），但 subtitle/web/view
      // protobuf 里有字幕，且其混淆 URL 可离线还原为真实 aisubtitle 地址。
      if (subtitles.length === 0) {
        const captured = await this.fetchPaidSubtitles(
          page,
          info,
          referer,
          videoPage,
          content,
          viewDir,
        );
        for (const item of captured) {
          subtitles.push(item.file);
          assets.push(item.asset);
        }
      }
    }

    return {
      result: {
        page: videoPage,
        playUrl: resolvedPage.playUrl,
        selected: {
          video: selected?.video ?? null,
          audio: selected?.audio ?? null,
        },
        streamUnavailable: resolvedPage.streamUnavailable,
        files,
        merged,
        subtitles,
      },
      assets,
    };
  }

  /**
   * 下载单条字幕 JSON 并落盘。aisubtitle CDN 无 CORS 且校验 Referer 防盗链，
   * 故走 Node 侧 fetch；任何失败都只告警、返回 null，不阻断视频下载。
   */
  private async downloadSubtitle(
    sub: BiliResolvedPage["subtitles"][number],
    referer: string,
    content: ContentStore,
    viewDir: string,
    videoPage: BiliResolvedPage["page"],
  ): Promise<{ file: BiliDownloadedSubtitle; asset: ContentAsset } | null> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15_000);
      let buffer: Buffer;
      try {
        const response = await fetch(sub.url, {
          method: "GET",
          headers: {
            Accept: "application/json, */*",
            Referer: referer,
            Origin: BILIBILI_WWW,
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          },
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new EndpointHttpError(
            `HTTP ${response.status} ${response.statusText}`,
            { scope: this.id },
          );
        }
        buffer = Buffer.from(await response.arrayBuffer());
      } finally {
        clearTimeout(timer);
      }

      const ref = await content.ingestBuffer(buffer, ".json");
      const name = subtitleAssetName({
        page: videoPage.page,
        part: videoPage.part,
        lan: sub.lan,
      });
      const path = await content.link(`${viewDir}/${name}`, ref);
      return {
        file: {
          lan: sub.lan,
          lanDoc: sub.lanDoc,
          path,
          absolutePath: content.viewAbs(`${viewDir}/${name}`),
          sizeBytes: ref.sizeBytes,
          contentType: "application/json",
          sourceUrl: sub.url,
          sha256: ref.sha256,
        },
        asset: {
          name,
          role: "subtitle",
          sha256: ref.sha256,
          object: ref.objectPath,
          sizeBytes: ref.sizeBytes,
          contentType: "application/json",
          sourceUrl: sub.url,
          extra: {
            page: videoPage.page,
            part: videoPage.part,
            lan: sub.lan,
            lanDoc: sub.lanDoc,
            aiType: sub.aiType,
          },
        },
      };
    } catch (err) {
      this.addWarning({
        code: "subtitle-download-failed",
        message: `字幕 ${sub.lanDoc}(${sub.lan}) 下载失败，已跳过；视频不受影响。`,
        details: {
          error: err instanceof Error ? err.message : String(err),
          url: sub.url,
          viewDir,
        },
      });
      return null;
    }
  }

  /**
   * 付费(upower)视频字幕路径：字幕仅由 subtitle/web/view(protobuf) 下发，其 subtitle_url
   * 被混淆为占位域名。本方法实时取该 protobuf（带登录 Cookie），离线还原出真实 aisubtitle
   * URL（见 subtitle-meta.decodeSubtitleUrl），再 Node 侧带 Referer 直接拉取字幕全文。
   * 任何失败都只告警，不阻断视频/其它数据。
   */
  private async fetchPaidSubtitles(
    page: Page,
    info: BiliVideoResolveResult["video"],
    referer: string,
    videoPage: BiliResolvedPage["page"],
    content: ContentStore,
    viewDir: string,
  ): Promise<{ file: BiliDownloadedSubtitle; asset: ContentAsset }[]> {
    let meta: BiliSubtitleViewItem[];
    try {
      meta = await this.fetchSubtitleMeta(page, info.aid, videoPage.cid);
    } catch {
      return [];
    }
    if (meta.length === 0) return [];

    const results: { file: BiliDownloadedSubtitle; asset: ContentAsset }[] = [];
    for (const m of meta) {
      if (!m.realUrl) {
        this.addWarning({
          code: "subtitle-decode-failed",
          message: `字幕 ${m.lanDoc}(${m.lan}) 的混淆地址无法还原，已跳过；视频不受影响。`,
          details: { bvid: info.bvid, cid: videoPage.cid, obf: m.obfuscatedUrl.slice(0, 80) },
        });
        continue;
      }
      const saved = await this.downloadSubtitle(
        {
          id: m.id,
          lan: m.lan,
          lanDoc: m.lanDoc,
          url: m.realUrl,
          aiType: 1,
          aiStatus: null,
          type: null,
        },
        referer,
        content,
        viewDir,
        videoPage,
      );
      if (saved) {
        results.push(saved);
      }
    }
    return results;
  }

  /** in-page 拉取 subtitle/web/view(protobuf)，解析出字幕元数据并还原真实 URL。 */
  private async fetchSubtitleMeta(
    page: Page,
    aid: number,
    cid: number,
  ): Promise<BiliSubtitleViewItem[]> {
    const url = `${BILIBILI_API_BASE}/x/v2/subtitle/web/view?oid=${cid}&pid=${aid}&type=1`;
    const b64 = await page.evaluate(async (u: string) => {
      try {
        const r = await fetch(u, { credentials: "include" });
        if (!r.ok) return null;
        const bytes = new Uint8Array(await r.arrayBuffer());
        let s = "";
        for (let i = 0; i < bytes.length; i += 1) {
          s += String.fromCharCode(bytes[i]);
        }
        return btoa(s);
      } catch {
        return null;
      }
    }, url);
    if (!b64) return [];
    return parseSubtitleView(Buffer.from(b64, "base64"));
  }

  protected get pipeline(): ProjectionPipeline<
    BiliVideoDownloadParams,
    BiliVideoDownloadResult,
    BiliVideoDownloadResult,
    BiliVideoDownloadProjected
  > {
    return {
      envelope: (data) =>
        projectBiliVideoDownloadAiReady(data),
    };
  }
}

async function ensureVideoPage(page: Page, videoUrl: string): Promise<void> {
  const current = page.url();
  if (current.startsWith(videoUrl)) return;
  await page.goto(videoUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
}