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
  type BiliCreatorAudioItem,
  type BiliCreatorAudiosResult,
} from "@src/types/creator.types";

interface RawSong {
  id?: number;
  title?: string;
  cover?: string;
  intro?: string;
  bvid?: string;
  ctime?: number;
  passtime?: number;
  coin_num?: number;
  statistic?: { play?: number; collect?: number; comment?: number; share?: number };
}

interface RawSongUpperData {
  curPage?: number;
  pageCount?: number;
  totalSize?: number;
  pageSize?: number;
  data?: RawSong[];
}

interface AudioPageBundle {
  items: BiliCreatorAudioItem[];
  total: number | null;
}

function mapSong(raw: RawSong): BiliCreatorAudioItem {
  return {
    auid: num(raw.id),
    title: raw.title ?? "",
    cover: raw.cover ?? "",
    intro: raw.intro ?? "",
    bvid: raw.bvid ?? "",
    createdAt: num(raw.passtime ?? raw.ctime),
    coinNum: num(raw.coin_num),
    stats: {
      play: num(raw.statistic?.play),
      collect: num(raw.statistic?.collect),
      comment: num(raw.statistic?.comment),
      share: num(raw.statistic?.share),
    },
  };
}

/**
 * Goal: 音频作品列表（/audio/music-service/web/song/upper）
 *
 * 无 WBI 签名，pn/ps 翻页。@Expanded 按 page+maxPages 生成页号逐页抓取；
 * 注意外层 data 与内层 data.data 同名嵌套。aggregate 按 auid 去重汇总。
 */
@Goal({
  id: "bili-creator-audios",
  name: "Bilibili 创作者音频",
  baseURL: BILIBILI_API_BASE,
  defaults: BILI_GOAL_DEFAULTS,
})
export class BiliCreatorAudiosGoal extends BaseGoal<BiliCreatorAudiosResult> {
  @Endpoint("/audio/music-service/web/song/upper", { method: "GET" })
  @Expanded<number, AudioPageBundle>({
    source: (ctx) => buildPageNumbers(ctx.params),
    params: (pageNum, _index, ctx) => ({
      uid: midOf(ctx),
      pn: pageNum,
      ps: num(ctx.params.pageSize) || 42,
      order: 1,
      web_location: BILIBILI_SPACE_WEB_LOCATION,
    }),
    concurrency: 1,
  })
  fetchAudioPage(
    response: BiliApiEnvelope<RawSongUpperData>,
    _pageNum: number,
  ): AudioPageBundle {
    const data = response?.data ?? {};
    const list = Array.isArray(data.data) ? data.data : [];
    return {
      items: list.map(mapSong),
      total: typeof data.totalSize === "number" ? data.totalSize : null,
    };
  }

  @Aggregate()
  aggregate(ctx: GoalContext): BiliCreatorAudiosResult {
    const bundles = ctx.get<AudioPageBundle[]>("fetchAudioPage") ?? [];
    let total: number | null = null;
    for (const bundle of bundles) {
      if (bundle.total !== null) total = bundle.total;
    }

    const { items } = dedupeBy(
      bundles.flatMap((b) => b.items),
      (item) => item.auid,
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
