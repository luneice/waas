import { InvalidParamsError } from "@spider/core";
import type { BiliVideoDownloadParams } from "@src/types/video.types";

export interface DirectVideoInput {
  mode: "direct";
  input: string;
  bvid?: string;
  aid?: number;
}

const BVID_RE = /BV[0-9A-Za-z]{8,16}/;
const AV_RE = /(?:^|\/|av)(?:av)?(\d{3,})/i;

export function resolveVideoInput(params: BiliVideoDownloadParams): DirectVideoInput {
  const directInput = firstNonBlank(params.url, params.bvid, params.id, params.aid);
  if (!directInput) {
    throw new InvalidParamsError(
      "需要传入 url/bvid/aid/id 指定要下载的视频",
      { scope: "bili-video" },
    );
  }
  const bvid = extractBvid(directInput);
  const aid = extractAid(directInput);
  if (!bvid && !aid) {
    throw new InvalidParamsError(
      "需要传入 BV 号、av 号、数字 aid 或 bilibili 视频 URL",
      { scope: "bili-video", details: { input: directInput } },
    );
  }
  return { mode: "direct", input: directInput, bvid, aid };
}

function firstNonBlank(...values: unknown[]): string | null {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
}

function extractBvid(input: string): string | undefined {
  const match = input.match(BVID_RE);
  return match?.[0];
}

function extractAid(input: string): number | undefined {
  if (/^\d+$/.test(input)) return Number(input);
  const match = input.match(AV_RE);
  const n = match?.[1] ? Number(match[1]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
