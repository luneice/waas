/**
 * 视频下载 AI-Ready 投影（bili-video）。
 *
 * 这是提取型 Skill：真正的产物是落盘文件，`content.pages[]` 描述每个分 P 的
 * 选流结果与文件清单。信封的 `meta.files` 汇总便于 Agent 一眼看到落了什么。
 */

import { hms, isoTime, type BiliContentEnvelope } from "@src/projections/envelope";
import type {
  BiliDownloadedPage,
  BiliSelectedMediaStream,
  BiliVideoDownloadResult,
} from "@src/types/video.types";

export interface BiliStreamProjected {
  id: number;
  bandwidth: number | null;
  mimeType: string | null;
  codecs: string | null;
  width: number | null;
  height: number | null;
  frameRate: string | null;
  codecid: number | null;
}

export interface BiliDownloadedFileProjected {
  role: string;
  path: string;
  absolutePath: string;
  sizeBytes: number;
  contentType: string;
}

export interface BiliDownloadedPageProjected {
  page: BiliDownloadedPage["page"];
  playUrl: BiliDownloadedPage["playUrl"];
  selected: {
    video: BiliStreamProjected | null;
    audio: BiliStreamProjected | null;
  };
  /** DASH 流不可用的原因（付费未购买 / 未转码完成等）；可下载时为 null */
  streamUnavailable: string | null;
  files: BiliDownloadedFileProjected[];
  merged: BiliDownloadedFileProjected | null;
  subtitles: {
    lan: string;
    lanDoc: string;
    path: string;
    absolutePath: string;
    sizeBytes: number;
    contentType: string;
  }[];
}

export interface BiliVideoDownloadContent {
  pages: BiliDownloadedPageProjected[];
}

export type BiliVideoDownloadAiReady = BiliContentEnvelope<
  BiliVideoDownloadContent,
  {
    source: BiliVideoDownloadResult["source"];
    video: {
      aid: number;
      bvid: string;
      title: string;
      url: string;
      owner: BiliVideoDownloadResult["video"]["owner"];
      pageCount: number;
    };
    requested: BiliVideoDownloadResult["requested"];
    outputDir: string;
    /** 落盘汇总：mediaCount 为音/视频分片数（不含合并成品），mergedCount 为合并成品数，totalBytes 为全部落盘文件字节和（每文件计一次） */
    files: {
      mediaCount: number;
      mergedCount: number;
      subtitleCount: number;
      totalBytes: number;
    };
  }
>;

export function projectBiliVideoDownloadAiReady(
  data: BiliVideoDownloadResult,
): BiliVideoDownloadAiReady {
  const pages = data.pages.map(projectPage);
  const files = summarizeFiles(pages);

  return {
    meta: {
      skill: "bili-video",
      semantics: `视频「${data.video.title}」（${data.video.bvid}）分 P 选流与落盘结果`,
      source: data.source,
      video: {
        aid: data.video.aid,
        bvid: data.video.bvid,
        title: data.video.title,
        url: data.video.url,
        owner: data.video.owner,
        pageCount: data.video.pages.length,
      },
      requested: data.requested,
      outputDir: data.outputDir,
      files,
      crawledAt: isoTime(undefined),
    },
    insights: buildInsights(data, pages, files),
    content: { pages },
  };
}

function projectPage(page: BiliDownloadedPage): BiliDownloadedPageProjected {
  return {
    page: page.page,
    playUrl: page.playUrl,
    selected: {
      video: page.selected.video ? projectStream(page.selected.video) : null,
      audio: page.selected.audio ? projectStream(page.selected.audio) : null,
    },
    streamUnavailable: page.streamUnavailable,
    files: page.files.map((file) => ({
      role: file.role,
      path: file.path,
      absolutePath: file.absolutePath,
      sizeBytes: file.sizeBytes,
      contentType: file.contentType,
    })),
    merged: page.merged
      ? {
          role: page.merged.role,
          path: page.merged.path,
          absolutePath: page.merged.absolutePath,
          sizeBytes: page.merged.sizeBytes,
          contentType: page.merged.contentType,
        }
      : null,
    subtitles: page.subtitles.map((sub) => ({
      lan: sub.lan,
      lanDoc: sub.lanDoc,
      path: sub.path,
      absolutePath: sub.absolutePath,
      sizeBytes: sub.sizeBytes,
      contentType: sub.contentType,
    })),
  };
}

function projectStream(stream: BiliSelectedMediaStream): BiliStreamProjected {
  return {
    id: stream.id,
    bandwidth: stream.bandwidth,
    mimeType: stream.mimeType,
    codecs: stream.codecs,
    width: stream.width ?? null,
    height: stream.height ?? null,
    frameRate: stream.frameRate ?? null,
    codecid: stream.codecid ?? null,
  };
}

function summarizeFiles(pages: BiliDownloadedPageProjected[]) {
  let mediaCount = 0;
  let mergedCount = 0;
  let subtitleCount = 0;
  let totalBytes = 0;
  for (const page of pages) {
    // files 已是视图落盘完整清单（合并成品也在其中，page.merged 只是便捷引用），
    // 字节只按 files + subtitles 各累加一次；merged 单独计数、不再重复计字节。
    for (const f of page.files) {
      totalBytes += f.sizeBytes ?? 0;
      if (f.role === "merged") mergedCount++;
      else mediaCount++;
    }
    subtitleCount += page.subtitles.length;
    for (const s of page.subtitles) totalBytes += s.sizeBytes ?? 0;
  }
  return { mediaCount, mergedCount, subtitleCount, totalBytes };
}

function buildInsights(
  data: BiliVideoDownloadResult,
  pages: BiliDownloadedPageProjected[],
  files: ReturnType<typeof summarizeFiles>,
): string[] {
  const out: string[] = [];
  out.push(
    `视频「${data.video.title}」共 ${data.video.pages.length} 个分 P，本次处理 ${pages.length} 个。`,
  );

  if (!data.requested.download) {
    out.push("download=false：只解析选流与字幕，未落媒体文件（无需 ffmpeg）。");
  }

  const blocked = pages.filter((p) => p.streamUnavailable);
  if (blocked.length > 0) {
    const reasons = [...new Set(blocked.map((p) => p.streamUnavailable))];
    out.push(
      `${blocked.length} 个分 P 无可用 DASH 流：${reasons.join("；")}。字幕等增强数据仍可用。`,
    );
  }

  if (files.mediaCount > 0 || files.mergedCount > 0 || files.subtitleCount > 0) {
    const mb = (files.totalBytes / 1024 / 1024).toFixed(1);
    const media =
      files.mergedCount > 0
        ? `合并成品 ${files.mergedCount} 个 + 分片 ${files.mediaCount} 个`
        : `分片 ${files.mediaCount} 个（未合并）`;
    out.push(
      `落盘：${media}，字幕 ${files.subtitleCount} 个，合计约 ${mb} MB → ${data.outputDir}`,
    );
  }

  if (data.requested.merge && files.mergedCount === 0 && data.requested.download) {
    out.push("请求了合并但无合并产物 —— 检查本机是否安装 ffmpeg。");
  }

  const durations = pages
    .map((p) => p.playUrl.timelength)
    .filter((t): t is number => typeof t === "number" && t > 0);
  if (durations.length > 0) {
    const totalSec = Math.round(durations.reduce((a, b) => a + b, 0) / 1000);
    out.push(`总时长约 ${hms(totalSec)}。`);
  }

  const first = pages[0];
  if (first?.selected.video) {
    const v = first.selected.video;
    out.push(
      `首个分 P 选流：${v.width ?? "?"}x${v.height ?? "?"} @${v.frameRate ?? "?"}fps，编码 ${v.codecs ?? "未知"}。`,
    );
  }
  return out;
}
