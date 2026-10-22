/**
 * Goal: 楼中楼完整子回复（GET `/x/v2/reply/reply`）
 *
 * includeReplies=true 时按主楼 rpid（root）抓取一页完整楼中楼，补全主楼内嵌的
 * 少量热门子回复。该接口非 WBI 签名，参数 type/oid/root/ps/pn/web_location。
 * 未在 HAR 中实证，采用标准参数 + 优雅降级（失败仅告警，保留内嵌子回复）。
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
import { mapReply } from "@src/thrall/comment/parse";
import type { BiliApiEnvelope } from "@src/types/creator.types";
import type {
  BiliCommentItem,
  RawReply,
  RawReplyReplyData,
} from "@src/types/comment.types";

export interface BiliCommentRepliesGoalParams extends Record<string, unknown> {
  oid: string;
  type: number;
  root: string;
  ps: number;
  pn: number;
}

@Goal({
  id: "bili-comments-replies",
  name: "Bilibili 楼中楼",
  baseURL: BILIBILI_API_BASE,
  defaults: BILI_GOAL_DEFAULTS,
})
export class BiliCommentRepliesGoal extends BaseGoal<
  BiliCommentItem[],
  BiliCommentRepliesGoalParams
> {
  @Endpoint("/x/v2/reply/reply", {
    method: "GET",
    query: (ctx: GoalContext) => ({
      oid: String(ctx.params.oid ?? ""),
      type: Number(ctx.params.type ?? 1),
      root: String(ctx.params.root ?? ""),
      ps: Number(ctx.params.ps ?? 10),
      pn: Number(ctx.params.pn ?? 1),
      web_location: BILIBILI_REPLY_WEB_LOCATION,
    }),
  })
  fetchReplies(response: BiliApiEnvelope<RawReplyReplyData>): RawReply[] {
    if (response.code !== 0) {
      throw new UpstreamShapeChangedError(
        `reply/reply returned code=${response.code} message=${response.message ?? response.msg ?? ""}`,
        { scope: "bili-comments-replies", details: { code: response.code } },
      );
    }
    return Array.isArray(response.data?.replies) ? response.data!.replies! : [];
  }

  @Aggregate()
  aggregate(ctx: GoalContext): BiliCommentItem[] {
    const raw = ctx.get<RawReply[]>("fetchReplies") ?? [];
    return raw.map((r) => mapReply(r));
  }
}
