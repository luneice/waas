import {
  Aggregate,
  BaseGoal,
  Endpoint,
  Goal,
  GoalContext,
  UpstreamShapeChangedError,
} from "@spider/core";
import { BILIBILI_API_BASE } from "@src/constants";
import { BILI_GOAL_DEFAULTS, midOf, num, paramStr } from "@src/thrall/shared";
import { signWbiParams, type WbiKeys, type WbiParams } from "@src/thrall/wbi";
import { extractWbiKeysFromNav } from "@src/thrall/creator/shared";
import {
  type BiliApiEnvelope,
  type BiliCreatorFeedItem,
  type BiliCreatorFeedResult,
} from "@src/types/creator.types";

const DYNAMIC_FEATURES =
  "itemOpusStyle,listOnlyfans,opusBigCover,onlyfansVote,forwardListHidden,decorationCard,commentsNewVersion,onlyfansAssetsV2,ugcDelete,onlyfansQaCard,avatarAutoTheme,sunflowerVersion";

interface RawDynamicStat {
  count?: number;
}

interface RawDynamicItem {
  id_str?: string;
  type?: string;
  modules?: {
    module_author?: { pub_ts?: number | string };
    module_dynamic?: {
      desc?: { text?: string } | null;
      major?: {
        type?: string;
        archive?: { jump_url?: string };
        opus?: { jump_url?: string };
      } | null;
    };
    module_stat?: {
      comment?: RawDynamicStat;
      forward?: RawDynamicStat;
      like?: RawDynamicStat;
    };
  };
}

interface RawDynamicFeedData {
  has_more?: boolean;
  offset?: string;
  items?: RawDynamicItem[];
}

function classifyKind(item: RawDynamicItem): BiliCreatorFeedItem["kind"] {
  const majorType = item.modules?.module_dynamic?.major?.type ?? "";
  if (item.type === "DYNAMIC_TYPE_FORWARD") return "forward";
  if (majorType === "MAJOR_TYPE_ARCHIVE") return "archive";
  if (majorType === "MAJOR_TYPE_OPUS" || majorType === "MAJOR_TYPE_DRAW")
    return "opus";
  if (item.type === "DYNAMIC_TYPE_WORD" || !majorType) return "word";
  return "other";
}

function normalizeJumpUrl(url: string | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}

function mapDynamicItem(raw: RawDynamicItem): BiliCreatorFeedItem {
  const dyn = raw.modules?.module_dynamic;
  const major = dyn?.major;
  const jump = major?.archive?.jump_url ?? major?.opus?.jump_url;
  const stat = raw.modules?.module_stat;
  const pubTs = raw.modules?.module_author?.pub_ts;
  return {
    idStr: raw.id_str ?? "",
    type: raw.type ?? "",
    kind: classifyKind(raw),
    text: dyn?.desc?.text ?? "",
    jumpUrl: normalizeJumpUrl(jump),
    publishedAt: pubTs !== undefined ? num(pubTs) : null,
    stats: {
      comment: num(stat?.comment?.count),
      forward: num(stat?.forward?.count),
      like: num(stat?.like?.count),
    },
  };
}

/**
 * Goal: 创作者动态时间线（/x/polymer/web-dynamic/v1/feed/space）
 *
 * WBI 签名 + offset 游标翻页，采用单页 + continuation 范式（对齐 dedao 续取）：
 * 一次执行拓一页，aggregate 产出 nextOffset/hasMore，由 Skill 透传给调用方续取。
 * 混合时间线（视频/图文/转发/纯文本均含），不做类型过滤。
 */
@Goal({
  id: "bili-creator-feed",
  name: "Bilibili 创作者动态",
  baseURL: BILIBILI_API_BASE,
  defaults: BILI_GOAL_DEFAULTS,
})
export class BiliCreatorFeedGoal extends BaseGoal<BiliCreatorFeedResult> {
  @Endpoint("/x/web-interface/nav", { method: "GET" })
  fetchNav(response: BiliApiEnvelope<unknown>): WbiKeys {
    return extractWbiKeysFromNav(response as never);
  }

  @Endpoint("/x/polymer/web-dynamic/v1/feed/space", {
    method: "GET",
    dependencies: ["fetchNav"],
    query: (ctx: GoalContext) => {
      const base: WbiParams = {
        offset: paramStr(ctx, "offset"),
        host_mid: midOf(ctx),
        timezone_offset: -480,
        platform: "web",
        features: DYNAMIC_FEATURES,
        web_location: "333.1387",
      };
      return signWbiParams(base, ctx.get<WbiKeys>("fetchNav"));
    },
  })
  fetchFeed(
    response: BiliApiEnvelope<RawDynamicFeedData>,
  ): RawDynamicFeedData {
    if (response.code !== 0) {
      throw new UpstreamShapeChangedError(
        `feed/space returned code=${response.code} message=${response.message ?? response.msg ?? ""}`,
        { scope: "bili-creator-feed", details: { code: response.code } },
      );
    }
    return response.data ?? {};
  }

  @Aggregate()
  aggregate(ctx: GoalContext): BiliCreatorFeedResult {
    const data = ctx.get<RawDynamicFeedData>("fetchFeed") ?? {};
    const rawItems = Array.isArray(data.items) ? data.items : [];
    const items = rawItems.map(mapDynamicItem);
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
