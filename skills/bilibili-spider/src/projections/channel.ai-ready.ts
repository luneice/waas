/**
 * 合集/系列详情 AI-Ready 投影（bili-channel）。
 *
 * 与 creator-channels（目录 + 预览）正交：这里是单个 season/series 内的全量稿件。
 */

import {
  fromUnix,
  hms,
  isoTime,
  wan,
  type BiliListEnvelope,
} from "@src/projections/envelope";
import type {
  BiliChannelArchive,
  BiliChannelResult,
} from "@src/types/channel.types";

export interface BiliChannelArchiveProjected {
  aid: number;
  bvid: string;
  title: string;
  cover: string;
  durationSeconds: number;
  duration: string | null;
  publishedAt: string | null;
  url: string;
  stats: { view: number; danmaku: number };
}

export type BiliChannelAiReady = BiliListEnvelope<
  BiliChannelArchiveProjected,
  {
    kind: BiliChannelResult["kind"];
    id: number;
    mid: string;
    name: string;
    cover: string;
    description: string;
    total: number | null;
    pagesFetched: number;
    returnedCount: number;
  }
>;

export function projectBiliChannelAiReady(
  data: BiliChannelResult,
): BiliChannelAiReady {
  const label = data.kind === "season" ? "合集" : "系列";
  return {
    meta: {
      skill: "bili-channel",
      semantics: `${label} id=${data.id}（mid=${data.mid}）内的全量稿件`,
      kind: data.kind,
      id: data.id,
      mid: data.mid,
      name: data.meta.name,
      cover: data.meta.cover,
      description: data.meta.description,
      total: data.total,
      pagesFetched: data.pagesFetched,
      returnedCount: data.returnedCount,
      crawledAt: isoTime(data.crawledAt),
      units: { view: "次", danmaku: "条" },
    },
    insights: buildInsights(data, label),
    items: data.items.map(projectArchive),
  };
}

function projectArchive(
  archive: BiliChannelArchive,
): BiliChannelArchiveProjected {
  return {
    aid: archive.aid,
    bvid: archive.bvid,
    title: archive.title,
    cover: archive.cover,
    durationSeconds: archive.duration,
    duration: hms(archive.duration),
    publishedAt: fromUnix(archive.pubdate),
    url: archive.url,
    stats: { view: archive.view, danmaku: archive.danmaku },
  };
}

function buildInsights(data: BiliChannelResult, label: string): string[] {
  const out: string[] = [];
  const name = data.meta.name ? `「${data.meta.name}」` : `id=${data.id}`;
  out.push(
    `${label}${name}：抓取 ${data.pagesFetched} 页，返回 ${data.returnedCount} 个稿件${
      data.total !== null ? `（${label}内共 ${data.total} 个）` : ""
    }。`,
  );

  if (data.items.length === 0) {
    out.push(`该${label}下无公开稿件。`);
    return out;
  }

  if (data.total !== null && data.returnedCount < data.total) {
    out.push(
      `尚未取全（${data.returnedCount}/${data.total}），继续增大 page/maxPages 可补齐。`,
    );
  }

  const views = data.items.map((x) => x.view).filter(Number.isFinite);
  if (views.length > 0) {
    const sum = views.reduce((a, b) => a + b, 0);
    out.push(
      `样本总播放 ${wan(sum)}，均播 ${wan(Math.round(sum / views.length))}。`,
    );
    const top = [...data.items].sort((a, b) => b.view - a.view)[0];
    out.push(`最高播放：「${top.title}」${wan(top.view)}（${top.bvid}）。`);
  }

  const durations = data.items
    .map((x) => x.duration)
    .filter((d) => typeof d === "number" && d > 0);
  if (durations.length > 0) {
    const total = durations.reduce((a, b) => a + b, 0);
    out.push(`总时长约 ${hms(total)}，单个平均 ${hms(Math.round(total / durations.length))}。`);
  }

  const times = data.items
    .map((x) => x.pubdate)
    .filter((t) => typeof t === "number" && t > 0);
  if (times.length > 0) {
    out.push(`发布时间跨度：${fromUnix(Math.min(...times))} ~ ${fromUnix(Math.max(...times))}。`);
  }
  return out;
}
