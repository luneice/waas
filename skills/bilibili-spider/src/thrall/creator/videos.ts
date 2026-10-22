import {
  Aggregate,
  BaseGoal,
  Endpoint,
  Expanded,
  Goal,
  GoalContext,
  UpstreamShapeChangedError,
} from "@spider/core";
import { BILIBILI_API_BASE, BILIBILI_SPACE_WEB_LOCATION } from "@src/constants";
import {
  BILI_DM_FINGERPRINT,
  BILI_GOAL_DEFAULTS,
  dedupeBy,
  midOf,
  num,
  paramStr,
} from "@src/thrall/shared";
import { signWbiParams, type WbiKeys, type WbiParams } from "@src/thrall/wbi";
import {
  buildPageNumbers,
  extractWbiKeysFromNav,
} from "@src/thrall/creator/shared";
import {
  type BiliApiEnvelope,
  type BiliCreatorVideoItem,
  type BiliCreatorVideosOrder,
  type BiliCreatorVideosResult,
} from "@src/types/creator.types";

interface RawVlistItem {
  aid?: number;
  bvid?: string;
  title?: string;
  description?: string;
  pic?: string;
  length?: string;
  created?: number;
  typeid?: number;
  play?: number;
  comment?: number;
  video_review?: number;
}

interface RawArcSearchData {
  list?: {
    vlist?: RawVlistItem[];
    tlist?: Record<string, { name?: string; count?: number }> | null;
  };
  page?: { pn?: number; ps?: number; count?: number };
}

/** 每页包裹：携带该页归一项 + 总数/分区，供 aggregate 组装。 */
interface ArcPageBundle {
  items: BiliCreatorVideoItem[];
  total: number | null;
  partitions: { tid: number; name: string; count: number }[];
}

function mapVlistItem(raw: RawVlistItem): BiliCreatorVideoItem {
  const bvid = raw.bvid ?? "";
  return {
    aid: num(raw.aid),
    bvid,
    title: raw.title ?? "",
    description: raw.description ?? "",
    cover: raw.pic ?? "",
    url: bvid ? `https://www.bilibili.com/video/${bvid}` : "",
    duration: raw.length ?? "",
    createdAt: num(raw.created),
    typeId: num(raw.typeid),
    play: num(raw.play),
    comment: num(raw.comment),
    videoReview: num(raw.video_review),
  };
}

function buildArcParams(
  ctx: GoalContext,
  pageNum: number,
): WbiParams {
  return {
    mid: midOf(ctx),
    order: paramStr(ctx, "order", "pubdate"),
    tid: num(ctx.params.tid),
    keyword: paramStr(ctx, "keyword"),
    ps: num(ctx.params.pageSize) || 25,
    pn: pageNum,
    index: 1,
    order_avoided: true,
    platform: "web",
    web_location: BILIBILI_SPACE_WEB_LOCATION,
    ...BILI_DM_FINGERPRINT,
  };
}

/**
 * Goal: 投稿视频列表（/x/space/wbi/arc/search）
 *
 * WBI 签名 + pn/ps 翻页。fetchNav 取 WBI key；@Expanded 按 page+maxPages 生成页号，
 * 逐页（concurrency=1）签名请求，每页产出 ArcPageBundle（含 total/分区），
 * aggregate 跨页按 aid 去重并汇总。对齐 BiliSearchGoal 范式。
 */
@Goal({
  id: "bili-creator-videos",
  name: "Bilibili 创作者投稿视频",
  baseURL: BILIBILI_API_BASE,
  defaults: BILI_GOAL_DEFAULTS,
})
export class BiliCreatorVideosGoal extends BaseGoal<BiliCreatorVideosResult> {
  @Endpoint("/x/web-interface/nav", { method: "GET" })
  fetchNav(response: BiliApiEnvelope<unknown>): WbiKeys {
    return extractWbiKeysFromNav(response as never);
  }

  @Endpoint("/x/space/wbi/arc/search", {
    method: "GET",
    dependencies: ["fetchNav"],
  })
  @Expanded<number, ArcPageBundle>({
    dependencies: ["fetchNav"],
    source: (ctx) => buildPageNumbers(ctx.params),
    params: (pageNum, _index, ctx) =>
      signWbiParams(buildArcParams(ctx, pageNum), ctx.get<WbiKeys>("fetchNav")),
    concurrency: 1,
  })
  fetchArcPage(
    response: BiliApiEnvelope<RawArcSearchData>,
    _pageNum: number,
  ): ArcPageBundle {
    if (response.code !== 0) {
      throw new UpstreamShapeChangedError(
        `arc/search returned code=${response.code} message=${response.message ?? response.msg ?? ""}`,
        { scope: "bili-creator-videos", details: { code: response.code } },
      );
    }
    const data = response.data ?? {};
    const vlist = Array.isArray(data.list?.vlist) ? data.list!.vlist! : [];
    const tlist = data.list?.tlist ?? {};
    const partitions = Object.entries(tlist ?? {}).map(([tid, v]) => ({
      tid: num(tid),
      name: v?.name ?? "",
      count: num(v?.count),
    }));
    return {
      items: vlist.map(mapVlistItem),
      total: typeof data.page?.count === "number" ? data.page.count : null,
      partitions,
    };
  }

  @Aggregate()
  aggregate(ctx: GoalContext): BiliCreatorVideosResult {
    const bundles = ctx.get<ArcPageBundle[]>("fetchArcPage") ?? [];
    let total: number | null = null;
    let partitions: { tid: number; name: string; count: number }[] = [];

    for (const bundle of bundles) {
      if (bundle.total !== null) total = bundle.total;
      if (bundle.partitions.length) partitions = bundle.partitions;
    }

    const { items, duplicates } = dedupeBy(
      bundles.flatMap((b) => b.items),
      (item) => item.aid,
    );

    return {
      mid: midOf(ctx),
      order: paramStr(ctx, "order", "pubdate") as BiliCreatorVideosOrder,
      tid: num(ctx.params.tid),
      keyword: paramStr(ctx, "keyword"),
      total,
      pagesFetched: bundles.length,
      returnedCount: items.length,
      duplicateCount: duplicates,
      items,
      partitions,
      crawledAt: new Date(),
    };
  }
}
