import {
  Aggregate,
  BaseGoal,
  Endpoint,
  Expanded,
  Goal,
  GoalContext,
  UpstreamShapeChangedError,
} from "@spider/core";
import { BILIBILI_API_BASE } from "@src/constants";
import { BILI_GOAL_DEFAULTS, midOf, num } from "@src/thrall/shared";
import { buildPageNumbers } from "@src/thrall/creator/shared";
import {
  aggregateChannelPages,
  mapChannelArchive,
  type ChannelPageBundle,
  type RawChannelArchive,
} from "@src/thrall/channel/shared";
import type { BiliApiEnvelope } from "@src/types/creator.types";
import type { BiliChannelResult } from "@src/types/channel.types";

interface RawSeasonArchivesData {
  archives?: RawChannelArchive[];
  meta?: {
    season_id?: number;
    name?: string;
    cover?: string;
    description?: string;
    total?: number;
    mid?: number;
  };
  page?: { page_num?: number; page_size?: number; total?: number };
}

/**
 * Goal: 合集（season）全量稿件（/x/polymer/web-space/seasons_archives_list）
 *
 * 无 WBI；page_num/page_size 翻页。首页 meta 携带合集名/封面/简介，archives 为全量稿件。
 * 按 page..page+maxPages-1 连续抓取，aggregate 跨页按 aid 去重。
 */
@Goal({
  id: "bili-channel",
  name: "Bilibili 合集详情",
  baseURL: BILIBILI_API_BASE,
  defaults: BILI_GOAL_DEFAULTS,
})
export class BiliChannelSeasonGoal extends BaseGoal<BiliChannelResult> {
  @Endpoint("/x/polymer/web-space/seasons_archives_list", { method: "GET" })
  @Expanded<number, ChannelPageBundle>({
    source: (ctx) => buildPageNumbers(ctx.params),
    params: (pageNum, _index, ctx) => ({
      mid: midOf(ctx),
      season_id: String(ctx.params.id ?? ""),
      sort_reverse: false,
      page_num: pageNum,
      page_size: num(ctx.params.pageSize) || 30,
    }),
    concurrency: 1,
  })
  fetchSeasonPage(
    response: BiliApiEnvelope<RawSeasonArchivesData>,
    _pageNum: number,
  ): ChannelPageBundle {
    if (response.code !== 0) {
      throw new UpstreamShapeChangedError(
        `seasons_archives_list returned code=${response.code} message=${response.message ?? response.msg ?? ""}`,
        { scope: "bili-channel", details: { code: response.code } },
      );
    }
    const data = response.data ?? {};
    const archives = Array.isArray(data.archives) ? data.archives : [];
    const meta = data.meta
      ? {
          name: data.meta.name ?? "",
          cover: data.meta.cover ?? "",
          description: data.meta.description ?? "",
        }
      : undefined;
    return {
      items: archives.map(mapChannelArchive),
      total: typeof data.page?.total === "number" ? data.page.total : null,
      meta,
    };
  }

  @Aggregate()
  aggregate(ctx: GoalContext): BiliChannelResult {
    const bundles = ctx.get<ChannelPageBundle[]>("fetchSeasonPage") ?? [];
    return {
      kind: "season",
      id: num(ctx.params.id),
      mid: midOf(ctx),
      ...aggregateChannelPages(bundles),
      crawledAt: new Date(),
    };
  }
}
