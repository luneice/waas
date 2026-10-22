import {
  Aggregate,
  BaseGoal,
  Endpoint,
  Expanded,
  Goal,
  GoalContext,
} from "@spider/core";
import { BILIBILI_API_BASE, BILIBILI_SPACE_WEB_LOCATION } from "@src/constants";
import { BILI_GOAL_DEFAULTS, dedupeBy, midOf, num } from "@src/thrall/shared";
import { buildPageNumbers } from "@src/thrall/creator/shared";
import {
  type BiliApiEnvelope,
  type BiliArchivePreview,
  type BiliCreatorChannel,
  type BiliCreatorChannelsResult,
} from "@src/types/creator.types";

interface RawArchive {
  aid?: number;
  bvid?: string;
  title?: string;
  pic?: string;
  duration?: number;
  pubdate?: number;
  stat?: { view?: number; danmaku?: number };
}

interface RawSeason {
  meta?: {
    season_id?: number;
    name?: string;
    cover?: string;
    description?: string;
    total?: number;
    mid?: number;
  };
  archives?: RawArchive[];
}

interface RawSeries {
  meta?: {
    series_id?: number;
    name?: string;
    cover?: string;
    description?: string;
    total?: number;
    mid?: number;
  };
  archives?: RawArchive[];
}

interface RawSeasonsSeriesData {
  items_lists?: {
    page?: { page_num?: number; page_size?: number; total?: number };
    seasons_list?: RawSeason[];
    series_list?: RawSeries[];
  };
}

interface CollectionPageBundle {
  items: BiliCreatorChannel[];
  total: number | null;
}

function mapArchive(raw: RawArchive): BiliArchivePreview {
  const bvid = raw.bvid ?? "";
  return {
    aid: num(raw.aid),
    bvid,
    title: raw.title ?? "",
    cover: raw.pic ?? "",
    duration: num(raw.duration),
    pubdate: num(raw.pubdate),
    view: num(raw.stat?.view),
    danmaku: num(raw.stat?.danmaku),
  };
}

function mapSeason(raw: RawSeason): BiliCreatorChannel {
  const id = num(raw.meta?.season_id);
  const mid = num(raw.meta?.mid);
  return {
    kind: "season",
    id,
    name: raw.meta?.name ?? "",
    cover: raw.meta?.cover ?? "",
    description: raw.meta?.description ?? "",
    total: num(raw.meta?.total),
    url:
      mid && id
        ? `https://space.bilibili.com/${mid}/channel/collectiondetail?sid=${id}`
        : "",
    previews: (raw.archives ?? []).map(mapArchive),
  };
}

function mapSeries(raw: RawSeries): BiliCreatorChannel {
  const id = num(raw.meta?.series_id);
  const mid = num(raw.meta?.mid);
  return {
    kind: "series",
    id,
    name: raw.meta?.name ?? "",
    cover: raw.meta?.cover ?? "",
    description: raw.meta?.description ?? "",
    total: num(raw.meta?.total),
    url:
      mid && id
        ? `https://space.bilibili.com/${mid}/channel/seriesdetail?sid=${id}`
        : "",
    previews: (raw.archives ?? []).map(mapArchive),
  };
}

/**
 * Goal: 合集与系列（/x/polymer/web-space/seasons_series_list）
 *
 * 无 WBI 签名，page_num/page_size 翻页。每个合集/系列内联预览级 archives（非全量）。
 * 全量稿件需以 season_id/series_id 二次抓取，本 Goal 仅产出目录 + 预览。
 */
@Goal({
  id: "bili-creator-channels",
  name: "Bilibili 创作者合集系列",
  baseURL: BILIBILI_API_BASE,
  defaults: BILI_GOAL_DEFAULTS,
})
export class BiliCreatorChannelsGoal extends BaseGoal<BiliCreatorChannelsResult> {
  @Endpoint("/x/polymer/web-space/seasons_series_list", { method: "GET" })
  @Expanded<number, CollectionPageBundle>({
    source: (ctx) => buildPageNumbers(ctx.params),
    params: (pageNum, _index, ctx) => ({
      mid: midOf(ctx),
      page_num: pageNum,
      page_size: num(ctx.params.pageSize) || 20,
      web_location: BILIBILI_SPACE_WEB_LOCATION,
    }),
    concurrency: 1,
  })
  fetchCollectionPage(
    response: BiliApiEnvelope<RawSeasonsSeriesData>,
    _pageNum: number,
  ): CollectionPageBundle {
    const lists = response?.data?.items_lists;
    const seasons = Array.isArray(lists?.seasons_list)
      ? lists!.seasons_list!.map(mapSeason)
      : [];
    const series = Array.isArray(lists?.series_list)
      ? lists!.series_list!.map(mapSeries)
      : [];
    return {
      items: [...seasons, ...series],
      total: typeof lists?.page?.total === "number" ? lists.page.total : null,
    };
  }

  @Aggregate()
  aggregate(ctx: GoalContext): BiliCreatorChannelsResult {
    const bundles = ctx.get<CollectionPageBundle[]>("fetchCollectionPage") ?? [];
    let total: number | null = null;
    for (const bundle of bundles) {
      if (bundle.total !== null) total = bundle.total;
    }

    const { items } = dedupeBy(
      bundles.flatMap((b) => b.items),
      (item) => (item.id ? `${item.kind}:${item.id}` : ""),
    );

    return {
      mid: midOf(ctx),
      total,
      pagesFetched: bundles.length,
      returnedCount: items.length,
      items,
      crawledAt: new Date(),
    };
  }
}
