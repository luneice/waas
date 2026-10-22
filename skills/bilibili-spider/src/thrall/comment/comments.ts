/**
 * Goal: 评论主楼单页（GET `/x/v2/reply/wbi/main`，WBI 签名）
 *
 * 单页范式（对齐 creator/feed 的单页 + continuation）：一次执行抓一页，aggregate
 * 产出 BiliCommentsPage（含 items/topItems/total/nextOffset/isEnd）。多页连抓由
 * Skill 层按 offset 游标编排循环（honor 动态 maxPages + 硬上限）。
 *
 * 评论区由 (oid, type) 定位，调用方在 params 注入；mode=3 热度 / 2 时间。
 * 主楼对象内嵌 .replies[] 已含少量热门子回复，默认直接保留。
 * 实现依据 docs/comment-extract-analysis.md。
 */
import {
  Aggregate,
  BaseGoal,
  Endpoint,
  Goal,
  GoalContext,
  UpstreamShapeChangedError,
} from "@spider/core";
import { BILIBILI_API_BASE, BILIBILI_REPLY_WEB_LOCATION } from "@src/constants";
import { BILI_GOAL_DEFAULTS } from "@src/thrall/shared";
import { extractWbiKeysFromNav } from "@src/thrall/creator/shared";
import { signWbiParams, type WbiKeys, type WbiParams } from "@src/thrall/wbi";
import { mapReply } from "@src/thrall/comment/parse";
import type { BiliApiEnvelope } from "@src/types/creator.types";
import type {
  BiliCommentItem,
  BiliCommentsPage,
  RawReply,
  RawReplyMainData,
} from "@src/types/comment.types";

export interface BiliCommentsPageGoalParams extends Record<string, unknown> {
  oid: string;
  type: number;
  mode: number;
  offset: string;
}

/** 构造主楼请求参数（未签名）。 */
function buildMainParams(ctx: GoalContext): WbiParams {
  const offset = String(ctx.params.offset ?? "");
  return {
    oid: String(ctx.params.oid ?? ""),
    type: Number(ctx.params.type ?? 1),
    mode: Number(ctx.params.mode ?? 3),
    pagination_str: JSON.stringify({ offset }),
    plat: 1,
    seek_rpid: "",
    web_location: BILIBILI_REPLY_WEB_LOCATION,
  };
}

function mapReplies(raw: RawReply[] | null | undefined): BiliCommentItem[] {
  return (Array.isArray(raw) ? raw : []).map((r) => mapReply(r));
}

@Goal({
  id: "bili-comments-main",
  name: "Bilibili 评论主楼",
  baseURL: BILIBILI_API_BASE,
  defaults: BILI_GOAL_DEFAULTS,
})
export class BiliCommentsPageGoal extends BaseGoal<
  BiliCommentsPage,
  BiliCommentsPageGoalParams
> {
  @Endpoint("/x/web-interface/nav", { method: "GET" })
  fetchNav(response: BiliApiEnvelope<unknown>): WbiKeys {
    return extractWbiKeysFromNav(response as never);
  }

  @Endpoint("/x/v2/reply/wbi/main", {
    method: "GET",
    dependencies: ["fetchNav"],
    query: (ctx: GoalContext) =>
      signWbiParams(buildMainParams(ctx), ctx.get<WbiKeys>("fetchNav")),
  })
  fetchMain(response: BiliApiEnvelope<RawReplyMainData>): RawReplyMainData {
    if (response.code !== 0) {
      throw new UpstreamShapeChangedError(
        `reply/wbi/main returned code=${response.code} message=${response.message ?? response.msg ?? ""}`,
        { scope: "bili-comments-main", details: { code: response.code } },
      );
    }
    return response.data ?? {};
  }

  @Aggregate()
  aggregate(ctx: GoalContext): BiliCommentsPage {
    const data = ctx.get<RawReplyMainData>("fetchMain") ?? {};
    const cursor = data.cursor ?? {};
    const nextOffset = cursor.pagination_reply?.next_offset ?? null;
    return {
      items: mapReplies(data.replies),
      topItems: mapReplies(data.top_replies),
      total: typeof cursor.all_count === "number" ? cursor.all_count : null,
      nextOffset: nextOffset || null,
      isEnd: Boolean(cursor.is_end),
    };
  }
}
