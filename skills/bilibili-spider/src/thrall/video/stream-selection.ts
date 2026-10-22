import { UnsupportedError } from "@spider/core";
import type {
  BiliDashStream,
  BiliPlayUrlData,
  BiliSelectedMediaStream,
} from "@src/types/video.types";

export type CodecPreference = "avc" | "hevc" | "av1" | "best";

export interface SelectedDashStreams {
  video: BiliSelectedMediaStream;
  audio: BiliSelectedMediaStream;
}

/**
 * 从 playurl 选出 DASH video/audio 流。
 *
 * 无 DASH（付费视频未购买、新稿未转码完成、仅返回 durl/FLV 等）时返回 null，
 * 而非抛错 —— 这样字幕等其它增强数据仍可继续解析与下载，不被媒体流缺失阻断。
 */
export function selectDashStreams(
  data: BiliPlayUrlData,
  qn: number,
  preferCodec: CodecPreference,
): SelectedDashStreams | null {
  const videos = data.dash?.video ?? [];
  const audios = data.dash?.audio ?? [];
  if (videos.length === 0 || audios.length === 0) {
    return null;
  }

  const video = chooseVideo(videos, qn, preferCodec);
  const audio = [...audios].sort(
    (a, b) => Number(b.bandwidth ?? 0) - Number(a.bandwidth ?? 0),
  )[0];

  return {
    video: toSelected("video", video),
    audio: toSelected("audio", audio),
  };
}

/** 推断 DASH 流缺失的人类可读原因，用于告警与产出说明。 */
export function dashUnavailableReason(data: BiliPlayUrlData | null): string {
  if (!data) {
    return "playurl 未返回有效数据（付费视频未购买或视频未转码完成）";
  }
  if (Array.isArray(data.durl) && data.durl.length > 0) {
    return "playurl 仅返回 durl/FLV 回退格式（多为付费预览片段），当前下载器只处理 DASH";
  }
  return "playurl 未返回 DASH video/audio（付费视频未购买或视频未转码完成）";
}

function chooseVideo(
  videos: BiliDashStream[],
  qn: number,
  preferCodec: CodecPreference,
): BiliDashStream {
  const underRequested = videos.filter((s) => Number(s.id ?? 0) <= qn);
  const qualityPool = underRequested.length > 0 ? underRequested : videos;
  const codecPool =
    preferCodec === "best"
      ? qualityPool
      : qualityPool.filter((s) => matchesCodec(s, preferCodec));
  const pool = codecPool.length > 0 ? codecPool : qualityPool;

  return [...pool].sort((a, b) => scoreVideo(b) - scoreVideo(a))[0];
}

function scoreVideo(s: BiliDashStream): number {
  const pixels = Number(s.width ?? 0) * Number(s.height ?? 0);
  return Number(s.id ?? 0) * 1_000_000_000 + pixels * 100 + Number(s.bandwidth ?? 0);
}

function matchesCodec(s: BiliDashStream, preferCodec: CodecPreference): boolean {
  const codec = String(s.codecs ?? "").toLowerCase();
  const codecid = Number(s.codecid ?? 0);
  if (preferCodec === "avc") return codecid === 7 || codec.startsWith("avc");
  if (preferCodec === "hevc") return codecid === 12 || codec.startsWith("hev");
  if (preferCodec === "av1") return codecid === 13 || codec.startsWith("av01");
  return true;
}

function toSelected(
  role: "video" | "audio",
  stream: BiliDashStream,
): BiliSelectedMediaStream {
  const url = String(stream.baseUrl ?? stream.base_url ?? "");
  if (!url) {
    throw new UnsupportedError(`${role} stream missing baseUrl`, {
      scope: "bili-video-download",
      details: { id: stream.id, role },
    });
  }
  return {
    role,
    id: Number(stream.id ?? 0),
    url,
    backupUrls: [
      ...(stream.backupUrl ?? []),
      ...(stream.backup_url ?? []),
    ].map((u) => String(u)),
    bandwidth:
      stream.bandwidth !== undefined ? Number(stream.bandwidth) : null,
    mimeType: String(stream.mimeType ?? stream.mime_type ?? "") || null,
    codecs: String(stream.codecs ?? "") || null,
    width: stream.width !== undefined ? Number(stream.width) : null,
    height: stream.height !== undefined ? Number(stream.height) : null,
    frameRate: String(stream.frameRate ?? stream.frame_rate ?? "") || null,
    codecid: stream.codecid !== undefined ? Number(stream.codecid) : null,
  };
}
