import {
  Aggregate,
  BaseGoal,
  Endpoint,
  Goal,
  GoalContext,
  UpstreamShapeChangedError,
} from "@spider/core";
import { BILIBILI_API_BASE, BILIBILI_SPACE_WEB_LOCATION } from "@src/constants";
import { BILI_GOAL_DEFAULTS, midOf, paramStr } from "@src/thrall/shared";
import { signWbiParams, type WbiKeys } from "@src/thrall/wbi";
import { extractWbiKeysFromNav } from "@src/thrall/creator/shared";
import {
  type BiliApiEnvelope,
  type BiliCreatorArticleItem,
  type BiliCreatorArticlesResult,
} from "@src/types/creator.types";

interface RawOpusItem {
  opus_id?: string;
  content?: string;
  cover?: { url?: string } | string | null;
  jump_url?: string;
  stat?: Record<string, unknown>;
}

interface RawOpusFeedData {
  has_more?: boolean;
  offset?: string;
  items?: RawOpusItem[];
}

function coverUrl(cover: RawOpusItem["cover"]): string | null {
  if (!cover) return null;
  if (typeof cover === "string") return cover;
  return cover.url ?? null;
}

function normalizeJumpUrl(url: string | undefined, opusId: string): string {
  if (url) return url.startsWith("//") ? `https:${url}` : url;
  return opusId ? `https://www.bilibili.com/opus/${opusId}` : "";
}

function mapOpusItem(raw: RawOpusItem): BiliCreatorArticleItem {
  const opusId = raw.opus_id ?? "";
  const stats: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw.stat ?? {})) {
    if (typeof value === "number") stats[key] = value;
  }
  return {
    opusId,
    content: raw.content ?? "",
    cover: coverUrl(raw.cover),
    url: normalizeJumpUrl(raw.jump_url, opusId),
    stats,
  };
}

/**
 * Goal: 创作者图文专栏（/x/polymer/web-dynamic/v1/opus/feed/space）
 *
 * WBI 签名 + offset 游标翻页，单页 + continuation 范式（对齐 dedao 续取）。
 * 响应为裸 JSON。
 */
@Goal({
  id: "bili-creator-articles",
  name: "Bilibili 创作者图文",
  baseURL: BILIBILI_API_BASE,
  defaults: BILI_GOAL_DEFAULTS,
})
export class BiliCreatorArticlesGoal extends BaseGoal<BiliCreatorArticlesResult> {
  @Endpoint("/x/web-interface/nav", { method: "GET" })
  fetchNav(response: BiliApiEnvelope<unknown>): WbiKeys {
    return extractWbiKeysFromNav(response as never);
  }

  @Endpoint("/x/polymer/web-dynamic/v1/opus/feed/space", {
    method: "GET",
    dependencies: ["fetchNav"],
    query: (ctx: GoalContext) =>
      signWbiParams(
        {
          host_mid: midOf(ctx),
          page: 1,
          offset: paramStr(ctx, "offset"),
          type: "all",
          web_location: BILIBILI_SPACE_WEB_LOCATION,
        },
        ctx.get<WbiKeys>("fetchNav"),
      ),
  })
  fetchOpusFeed(response: BiliApiEnvelope<RawOpusFeedData>): RawOpusFeedData {
    if (response.code !== 0) {
      throw new UpstreamShapeChangedError(
        `opus/feed/space returned code=${response.code} message=${response.message ?? response.msg ?? ""}`,
        { scope: "bili-creator-articles", details: { code: response.code } },
      );
    }
    return response.data ?? {};
  }

  @Aggregate()
  aggregate(ctx: GoalContext): BiliCreatorArticlesResult {
    const data = ctx.get<RawOpusFeedData>("fetchOpusFeed") ?? {};
    const rawItems = Array.isArray(data.items) ? data.items : [];
    const items = rawItems.map(mapOpusItem);
    const hasMore = Boolean(data.has_more);
    return {
      mid: midOf(ctx),
      pagesFetched: 1,
      returnedCount: items.length,
      items,
      nextOffset: hasMore ? (data.offset ?? null) : null,
      hasMore,
      crawledAt: new Date(),
    };
  }
}
