import { dedupeBy, num } from "@src/thrall/shared";
import type { BiliChannelArchive, BiliChannelResult } from "@src/types/channel.types";

/** 兼容别名：channel 内沿用 numOf，实现统一复用 thrall/shared 的 num。 */
export { num as numOf } from "@src/thrall/shared";

/** 原始稿件项（season/series 两接口 archives[] 同构子集）。 */
export interface RawChannelArchive {
  aid?: number;
  bvid?: string;
  title?: string;
  pic?: string;
  duration?: number;
  pubdate?: number;
  stat?: { view?: number; vt?: number; danmaku?: number };
}

export function mapChannelArchive(raw: RawChannelArchive): BiliChannelArchive {
  const bvid = raw.bvid ?? "";
  return {
    aid: num(raw.aid),
    bvid,
    title: raw.title ?? "",
    cover: raw.pic ?? "",
    duration: num(raw.duration),
    pubdate: num(raw.pubdate),
    url: bvid ? `https://www.bilibili.com/video/${bvid}` : "",
    view: num(raw.stat?.view),
    danmaku: num(raw.stat?.danmaku),
  };
}

/** 每页包裹：归一稿件 + 总数 + 可选 meta（仅 season 首页携带）。 */
export interface ChannelPageBundle {
  items: BiliChannelArchive[];
  total: number | null;
  meta?: { name: string; cover: string; description: string };
}

/** 合集/系列的空 meta 占位（series 接口不返回 meta）。 */
const EMPTY_CHANNEL_META = { name: "", cover: "", description: "" };

/**
 * season/series 聚合公共逻辑：跨页取最后一次非空 total / meta，按 aid 去重并保序。
 * 调用方补充 kind/id/mid 即得 BiliChannelResult。
 */
export function aggregateChannelPages(
  bundles: ChannelPageBundle[],
): Pick<
  BiliChannelResult,
  "meta" | "total" | "pagesFetched" | "returnedCount" | "items"
> {
  let total: number | null = null;
  let meta = EMPTY_CHANNEL_META;
  for (const bundle of bundles) {
    if (bundle.total !== null) total = bundle.total;
    if (bundle.meta) meta = bundle.meta;
  }

  const { items } = dedupeBy(
    bundles.flatMap((b) => b.items),
    (item) => item.aid,
  );

  return {
    meta,
    total,
    pagesFetched: bundles.length,
    returnedCount: items.length,
    items,
  };
}
