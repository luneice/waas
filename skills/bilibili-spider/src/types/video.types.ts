export interface BiliVideoDownloadParams {
  /** 直接视频地址，支持 BV / av URL。 */
  url?: string;
  /** BV 号。 */
  bvid?: string;
  /** AV 数字 ID。 */
  aid?: number | string;
  /** 兼容简写：BV... / av... / 数字 AV。 */
  id?: string;

  /** 多 P 页码，1-based，默认 1。 */
  part?: number;
  /** selected=仅 part；all=下载全部分 P。默认 selected。 */
  partMode?: "selected" | "all";

  /** 期望清晰度，默认 80(1080P)。 */
  qn?: number;
  /** fnval，默认 4048，请求 DASH/高规格格式。 */
  fnval?: number;
  /** 编码偏好，默认 avc，兼容性最好。 */
  preferCodec?: "avc" | "hevc" | "av1" | "best";

  /** 是否实际下载媒体（视频/音频），默认 true；false 只解析并选择流。 */
  download?: boolean;
  /** 是否下载字幕，默认 true；与 download 相互独立，可只下字幕或只下视频。 */
  subtitle?: boolean;
  /** 是否用 ffmpeg 合并音视频，默认 true。 */
  merge?: boolean;
  /** 合并成功后是否保留 m4s 分片，默认 true。 */
  keepParts?: boolean;
  /** 输出目录；不传使用 registry 注入的 storageRoot/bilibili。 */
  outputDir?: string;
  /** 输出文件名前缀；不传用标题/BV 号生成。 */
  filename?: string;
  /** 浏览器分片下载块大小，默认 4MiB。 */
  chunkSizeBytes?: number;
  /** 分片请求超时，默认 30000ms。 */
  chunkTimeoutMs?: number;
  /** ffmpeg 可执行文件路径，默认 ffmpeg。 */
  ffmpegPath?: string;
}

export interface BiliVideoIdentity {
  aid: number;
  bvid: string;
  url: string;
}

export interface BiliVideoOwner {
  mid: number | null;
  name: string | null;
  face: string | null;
}

export interface BiliVideoPage {
  cid: number;
  page: number;
  part: string;
  duration: number | null;
}

export interface BiliVideoInfoResult extends BiliVideoIdentity {
  title: string;
  desc: string | null;
  pic: string | null;
  owner: BiliVideoOwner;
  pages: BiliVideoPage[];
  raw?: unknown;
}

export interface BiliDashStream {
  id: number;
  baseUrl?: string;
  base_url?: string;
  backupUrl?: string[];
  backup_url?: string[];
  bandwidth?: number;
  mimeType?: string;
  mime_type?: string;
  codecs?: string;
  width?: number;
  height?: number;
  frameRate?: string;
  frame_rate?: string;
  codecid?: number;
  size?: number;
  [key: string]: unknown;
}

export interface BiliDurlSegment {
  url: string;
  backup_url?: string[];
  size?: number;
  length?: number;
  order?: number;
}

export interface BiliPlayUrlData {
  quality?: number;
  format?: string;
  timelength?: number;
  accept_quality?: number[];
  accept_description?: string[];
  dash?: {
    duration?: number;
    video?: BiliDashStream[];
    audio?: BiliDashStream[];
    flac?: unknown;
    dolby?: unknown;
  };
  durl?: BiliDurlSegment[];
  support_formats?: unknown[];
  [key: string]: unknown;
}

export interface BiliPlayUrlResult {
  aid: number;
  bvid: string;
  cid: number;
  qn: number;
  data: BiliPlayUrlData;
}

/** 字幕元数据（来自 /x/player/wbi/v2 的 data.subtitle.subtitles[]）。 */
export interface BiliSubtitleMeta {
  /** 字幕 id_str。 */
  id: string;
  /** 语言代码，如 ai-zh / ai-en / zh-CN。 */
  lan: string;
  /** 语言可读名，如中文 / English。 */
  lanDoc: string;
  /** 字幕内容 JSON 绝对地址（已补 https:）。 */
  url: string;
  /** 是否 AI 生成（0=人工，1=AI）。 */
  aiType: number | null;
  /** AI 状态。 */
  aiStatus: number | null;
  /** 字幕类型。 */
  type: number | null;
}

/** 单个分 P 的解析结果（BiliVideoGoal 产物，尚未落盘）。 */
export interface BiliResolvedPage {
  page: BiliVideoPage;
  playUrl: {
    quality: number | null;
    acceptQuality: number[];
    acceptDescription: string[];
    timelength: number | null;
  };
  selected: {
    video: BiliSelectedMediaStream;
    audio: BiliSelectedMediaStream;
  } | null;
  /**
   * DASH 流不可用时的原因（付费未购买 / 未转码完成 / 仅 durl 回退等）；
   * 可用时为 null。此时仍可解析与下载字幕等增强数据。
   */
  streamUnavailable: string | null;
  /** 字幕列表；无字幕时为空数组。 */
  subtitles: BiliSubtitleMeta[];
}

/** BiliVideoGoal 聚合结果：视频信息 + 每个分 P 的选流。 */
export interface BiliVideoResolveResult {
  video: BiliVideoInfoResult;
  pages: BiliResolvedPage[];
}

export interface BiliSelectedMediaStream {
  role: "video" | "audio";
  id: number;
  url: string;
  backupUrls: string[];
  bandwidth: number | null;
  mimeType: string | null;
  codecs: string | null;
  width?: number | null;
  height?: number | null;
  frameRate?: string | null;
  codecid?: number | null;
}

export interface BiliDownloadedFile {
  role: "video" | "audio" | "merged";
  path: string;
  absolutePath: string;
  sizeBytes: number;
  contentType: string;
  sourceUrl?: string;
  /** 内容寻址哈希（下载/合并时增量计算），供内容湖去重与清单记录 */
  sha256?: string;
}

/** 已落盘的字幕文件。 */
export interface BiliDownloadedSubtitle {
  lan: string;
  lanDoc: string;
  path: string;
  absolutePath: string;
  sizeBytes: number;
  contentType: string;
  sourceUrl: string;
  sha256?: string;
}

export interface BiliDownloadedPage {
  page: BiliVideoPage;
  playUrl: {
    quality: number | null;
    acceptQuality: number[];
    acceptDescription: string[];
    timelength: number | null;
  };
  selected: {
    video: BiliSelectedMediaStream | null;
    audio: BiliSelectedMediaStream | null;
  };
  /** DASH 流不可用时的原因（付费未购买 / 未转码完成等）；可下载时为 null。 */
  streamUnavailable: string | null;
  files: BiliDownloadedFile[];
  merged: BiliDownloadedFile | null;
  /** 已落盘字幕；无字幕时为空数组。 */
  subtitles: BiliDownloadedSubtitle[];
}

export interface BiliVideoDownloadResult {
  source: { mode: "direct"; input: string };
  video: BiliVideoInfoResult;
  requested: {
    qn: number;
    preferCodec: string;
    partMode: string;
    download: boolean;
    subtitle: boolean;
    merge: boolean;
  };
  pages: BiliDownloadedPage[];
  outputDir: string;
}

export type { BiliVideoDownloadAiReady } from "@src/projections/video-download.ai-ready";
import type { BiliVideoDownloadAiReady as _AiReady } from "@src/projections/video-download.ai-ready";

/** 对外投影 = AI-Ready 信封（meta + insights + content.pages） */
export type BiliVideoDownloadProjected = _AiReady;
