import {
  Aggregate,
  BaseGoal,
  Endpoint,
  Goal,
  GoalContext,
} from "@spider/core";
import { BILIBILI_API_BASE, BILIBILI_SPACE_WEB_LOCATION } from "@src/constants";
import { BILI_GOAL_DEFAULTS, midOf, num } from "@src/thrall/shared";
import { signWbiParams, type WbiKeys } from "@src/thrall/wbi";
import { extractWbiKeysFromNav } from "@src/thrall/creator/shared";
import {
  BILI_PRIVACY_CODE,
  type BiliApiEnvelope,
  type BiliArchive,
  type BiliCreatorProfileResult,
} from "@src/types/creator.types";

// ── 原始响应分片 ──

interface RawAccInfo {
  mid?: number;
  name?: string;
  face?: string;
  sign?: string;
  sex?: string;
  level?: number;
  birthday?: string;
  official?: { role?: number; title?: string; type?: number };
  vip?: { type?: number; status?: number; label?: { text?: string } };
  live_room?: {
    roomid?: number;
    title?: string;
    url?: string;
    liveStatus?: number;
  };
}

interface RawRelationStat {
  following?: number;
  follower?: number;
  black?: number;
  whisper?: number;
}

interface RawUpstat {
  archive?: { view?: number };
  article?: { view?: number };
  likes?: number;
}

interface RawMasterpieceItem {
  aid?: number;
  bvid?: string;
  title?: string;
  pic?: string;
  desc?: string;
  duration?: number;
  pubdate?: number;
  short_link_v2?: string;
  stat?: {
    view?: number;
    like?: number;
    coin?: number;
    favorite?: number;
    reply?: number;
    share?: number;
    danmaku?: number;
  };
}

function mapMasterpiece(raw: RawMasterpieceItem): BiliArchive {
  const bvid = raw.bvid ?? "";
  return {
    aid: num(raw.aid),
    bvid,
    title: raw.title ?? "",
    cover: raw.pic ?? "",
    description: raw.desc ?? "",
    duration: num(raw.duration),
    pubdate: num(raw.pubdate),
    url: raw.short_link_v2 || (bvid ? `https://www.bilibili.com/video/${bvid}` : ""),
    stats: {
      view: num(raw.stat?.view),
      like: num(raw.stat?.like),
      coin: num(raw.stat?.coin),
      favorite: num(raw.stat?.favorite),
      reply: num(raw.stat?.reply),
      share: num(raw.stat?.share),
      danmaku: num(raw.stat?.danmaku),
    },
  };
}

/**
 * Goal: 创作者名片
 *
 * 聚合 acc/info(WBI) + relation/stat + upstat + navnum + notice + masterpiece，
 * 一次组装 UP 主名片。隐私墙（53013）/空 data 一律降级为空值，不抛错。
 */
@Goal({
  id: "bili-creator",
  name: "Bilibili 创作者名片",
  baseURL: BILIBILI_API_BASE,
  defaults: BILI_GOAL_DEFAULTS,
})
export class BiliCreatorProfileGoal extends BaseGoal<BiliCreatorProfileResult> {
  @Endpoint("/x/web-interface/nav", { method: "GET" })
  fetchNav(response: BiliApiEnvelope<unknown>): WbiKeys {
    return extractWbiKeysFromNav(response as never);
  }

  @Endpoint("/x/space/wbi/acc/info", {
    method: "GET",
    dependencies: ["fetchNav"],
    query: (ctx: GoalContext) =>
      signWbiParams(
        {
          mid: midOf(ctx),
          token: "",
          platform: "web",
          web_location: "1550101",
        },
        ctx.get<WbiKeys>("fetchNav"),
      ),
  })
  fetchAccInfo(response: BiliApiEnvelope<RawAccInfo>): RawAccInfo {
    return response?.data ?? {};
  }

  @Endpoint("/x/relation/stat", {
    method: "GET",
    query: (ctx: GoalContext) => ({
      vmid: midOf(ctx),
      web_location: BILIBILI_SPACE_WEB_LOCATION,
    }),
  })
  fetchRelationStat(response: BiliApiEnvelope<RawRelationStat>): RawRelationStat | null {
    return response?.data ?? null;
  }

  @Endpoint("/x/space/upstat", {
    method: "GET",
    query: (ctx: GoalContext) => ({
      mid: midOf(ctx),
      web_location: BILIBILI_SPACE_WEB_LOCATION,
    }),
  })
  fetchUpstat(response: BiliApiEnvelope<RawUpstat>): RawUpstat | null {
    return response?.data ?? null;
  }

  @Endpoint("/x/space/navnum", {
    method: "GET",
    query: (ctx: GoalContext) => ({
      mid: midOf(ctx),
      web_location: BILIBILI_SPACE_WEB_LOCATION,
    }),
  })
  fetchNavnum(
    response: BiliApiEnvelope<Record<string, unknown>>,
  ): Record<string, number> | null {
    const data = response?.data;
    if (!data || typeof data !== "object") return null;
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "number") out[key] = value;
    }
    return out;
  }

  @Endpoint("/x/space/notice", {
    method: "GET",
    query: (ctx: GoalContext) => ({
      mid: midOf(ctx),
      web_location: BILIBILI_SPACE_WEB_LOCATION,
    }),
  })
  fetchNotice(response: BiliApiEnvelope<string>): string {
    return typeof response?.data === "string" ? response.data : "";
  }

  @Endpoint("/x/space/masterpiece", {
    method: "GET",
    query: (ctx: GoalContext) => ({
      vmid: midOf(ctx),
      web_location: BILIBILI_SPACE_WEB_LOCATION,
    }),
  })
  fetchMasterpiece(
    response: BiliApiEnvelope<RawMasterpieceItem[]>,
  ): BiliArchive[] {
    if (response?.code === BILI_PRIVACY_CODE) return [];
    const list = Array.isArray(response?.data) ? response.data : [];
    return list.map(mapMasterpiece);
  }

  @Aggregate()
  aggregate(ctx: GoalContext): BiliCreatorProfileResult {
    const acc = ctx.get<RawAccInfo>("fetchAccInfo") ?? {};
    const relationRaw = ctx.get<RawRelationStat | null>("fetchRelationStat");
    const upstatRaw = ctx.get<RawUpstat | null>("fetchUpstat");
    const navnum = ctx.get<Record<string, number> | null>("fetchNavnum");
    const notice = ctx.get<string>("fetchNotice") ?? "";
    const masterpiece = ctx.get<BiliArchive[]>("fetchMasterpiece") ?? [];

    return {
      mid: String(ctx.params.mid ?? acc.mid ?? ""),
      name: acc.name ?? "",
      face: acc.face ?? "",
      sign: acc.sign ?? "",
      sex: acc.sex ?? null,
      level: typeof acc.level === "number" ? acc.level : null,
      birthday: acc.birthday ?? null,
      official: acc.official
        ? {
            role: num(acc.official.role),
            title: acc.official.title ?? "",
            type: num(acc.official.type),
          }
        : null,
      vip: acc.vip
        ? {
            type: num(acc.vip.type),
            status: num(acc.vip.status),
            label: acc.vip.label?.text ?? "",
          }
        : null,
      liveRoom: acc.live_room
        ? {
            roomId: num(acc.live_room.roomid),
            title: acc.live_room.title ?? "",
            url: acc.live_room.url ?? "",
            liveStatus: num(acc.live_room.liveStatus),
          }
        : null,
      relation: relationRaw
        ? {
            following: num(relationRaw.following),
            follower: num(relationRaw.follower),
            black: num(relationRaw.black),
            whisper: num(relationRaw.whisper),
          }
        : null,
      upstat: upstatRaw
        ? {
            archiveView: num(upstatRaw.archive?.view),
            articleView: num(upstatRaw.article?.view),
            likes: num(upstatRaw.likes),
          }
        : null,
      navnum,
      notice,
      masterpiece,
      crawledAt: new Date(),
    };
  }
}
