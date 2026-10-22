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

interface RawSeriesArchivesData {
  archives?: RawChannelArchive[];
  page?: { num?: number; size?: number; total?: number };
}

/**
 * Goal: 系列（series）全量稿件（/x/series/archives）
 *
 * 无 WBI；pn/ps 翻页。接口不返回 meta（系列名需另查 /x/series/series），
 * 故 meta 留空。按 page..page+maxPages-1 连续抓取，aggregate 跨页按 aid 去重。
 */
@Goal({
  id: "bili-channel",
  name: "Bilibili 系列详情",
  baseURL: BILIBILI_API_BASE,
  defaults: BILI_GOAL_DEFAULTS,
})
export class BiliChannelSeriesGoal extends BaseGoal<BiliChannelResult> {
  @Endpoint("/x/series/archives", { method: "GET" })
  @Expanded<number, ChannelPageBundle>({
    source: (ctx) => buildPageNumbers(ctx.params),
    params: (pageNum, _index, ctx) => ({
      mid: midOf(ctx),
      series_id: String(ctx.params.id ?? ""),
      only_normal: true,
      sort: "desc",
      pn: pageNum,
      ps: num(ctx.params.pageSize) || 30,
    }),
    concurrency: 1,
  })
  fetchSeriesPage(
    response: BiliApiEnvelope<RawSeriesArchivesData>,
    _pageNum: number,
  ): ChannelPageBundle {
    if (response.code !== 0) {
      throw new UpstreamShapeChangedError(
        `series/archives returned code=${response.code} message=${response.message ?? response.msg ?? ""}`,
        { scope: "bili-channel", details: { code: response.code } },
      );
    }
    const data = response.data ?? {};
    const archives = Array.isArray(data.archives) ? data.archives : [];
    return {
      items: archives.map(mapChannelArchive),
      total: typeof data.page?.total === "number" ? data.page.total : null,
    };
  }

  @Aggregate()
  aggregate(ctx: GoalContext): BiliChannelResult {
    const bundles = ctx.get<ChannelPageBundle[]>("fetchSeriesPage") ?? [];
    return {
      kind: "series",
      id: num(ctx.params.id),
      mid: midOf(ctx),
      ...aggregateChannelPages(bundles),
      crawledAt: new Date(),
    };
  }
}
