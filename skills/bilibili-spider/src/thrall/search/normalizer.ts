import { UpstreamShapeChangedError } from "@spider/core";
import type {
  BiliLivePageInfo,
  BiliNormalizedItemType,
  BiliSearchItem,
  BiliSearchKind,
  RawBiliSearchData,
  RawBiliSearchItem,
} from "@src/types/search.types";

export interface FetchedSearchPage {
  data: RawBiliSearchData;
  items: RawBiliSearchItem[];
  totalResults: number | null;
  totalPages: number | null;
  livePageInfo?: BiliLivePageInfo;
}

export function extractSearchPage(
  kind: BiliSearchKind,
  data: RawBiliSearchData,
): FetchedSearchPage {
  if (kind === "live") {
    const result = data.result;
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      throw new UpstreamShapeChangedError(
        "Bilibili live search result is not grouped object",
        { scope: "bili-search", details: { kind } },
      );
    }
    const grouped = result as {
      live_room?: RawBiliSearchItem[];
      live_user?: RawBiliSearchItem[];
    };
    const rooms = Array.isArray(grouped.live_room)
      ? grouped.live_room.map((it) => ({ ...it, type: it.type ?? "live_room" }))
      : [];
    const users = Array.isArray(grouped.live_user)
      ? grouped.live_user.map((it) => ({ ...it, type: it.type ?? "live_user" }))
      : [];
    const livePageInfo = data.pageinfo;
    return {
      data,
      items: [...rooms, ...users],
      totalResults:
        toNumber(livePageInfo?.live_room?.total) ??
        toNumber(livePageInfo?.live_room?.numResults) ??
        toNumber(data.numResults) ??
        null,
      totalPages:
        toNumber(livePageInfo?.live_room?.numPages) ??
        toNumber(livePageInfo?.live_room?.pages) ??
        toNumber(data.numPages) ??
        null,
      livePageInfo,
    };
  }

  if (!Array.isArray(data.result)) {
    throw new UpstreamShapeChangedError(
      "Bilibili search result is not an array",
      { scope: "bili-search", details: { kind } },
    );
  }

  return {
    data,
    items: data.result as RawBiliSearchItem[],
    totalResults: toNumber(data.numResults) ?? null,
    totalPages: toNumber(data.numPages) ?? null,
  };
}

export function normalizeRawItem(
  kind: BiliSearchKind,
  raw: RawBiliSearchItem,
): BiliSearchItem | null {
  const itemType = normalizeItemType(kind, raw.type);
  const id = pickId(itemType, raw);
  if (!id) return null;

  const authorId = stringOrNull(raw.mid ?? raw.uid);
  const title =
    itemType === "bili_user"
      ? stripHtml(String(raw.uname ?? ""))
      : stripHtml(String(raw.title ?? raw.uname ?? ""));
  const cover = pickCover(itemType, raw);

  return {
    itemType,
    dedupeKey: `${itemType}:${id}`,
    id,
    title,
    description: pickDescription(itemType, raw),
    url: pickUrl(itemType, raw, id),
    cover,
    author: {
      id: itemType === "bili_user" ? id : authorId,
      name: stringOrNull(raw.author ?? raw.uname),
      avatar: stringOrNull(raw.upic ?? raw.uface),
    },
    stats: pickStats(itemType, raw),
    publishedAt: pickPublishedAt(itemType, raw),
    duration: stringOrNull(raw.duration),
    rank: {
      index: toNumber(raw.rank_index) ?? null,
      offset: toNumber(raw.rank_offset) ?? null,
    },
    extra: pickExtra(itemType, raw),
  };
}

function normalizeItemType(
  kind: BiliSearchKind,
  rawType: unknown,
): BiliNormalizedItemType {
  const value = String(rawType ?? "");
  if (value === "live_room" || value === "live_user") return value;
  return kind;
}

function pickId(
  itemType: BiliNormalizedItemType,
  raw: RawBiliSearchItem,
): string {
  switch (itemType) {
    case "video":
      return String(raw.bvid ?? raw.aid ?? raw.id ?? "");
    case "media_bangumi":
    case "media_ft":
      return String(raw.media_id ?? raw.season_id ?? raw.pgc_season_id ?? "");
    case "live_room":
      return String(raw.roomid ?? raw.id ?? "");
    case "live_user":
      return String(raw.uid ?? raw.mid ?? "");
    case "article":
      return String(raw.id ?? "");
    case "bili_user":
      return String(raw.mid ?? raw.uid ?? "");
    default:
      return "";
  }
}

function pickDescription(
  itemType: BiliNormalizedItemType,
  raw: RawBiliSearchItem,
): string | null {
  if (itemType === "bili_user") return stripHtmlOrNull(raw.usign);
  return stripHtmlOrNull(raw.description ?? raw.desc);
}

function pickUrl(
  itemType: BiliNormalizedItemType,
  raw: RawBiliSearchItem,
  id: string,
): string | null {
  const direct = stringOrNull(raw.arcurl ?? raw.url ?? raw.goto_url);
  if (direct) return direct;
  if (itemType === "live_room") return `https://live.bilibili.com/${id}`;
  if (itemType === "bili_user") return `https://space.bilibili.com/${id}`;
  if (itemType === "article") return `https://www.bilibili.com/read/cv${id}`;
  return null;
}

function pickCover(
  itemType: BiliNormalizedItemType,
  raw: RawBiliSearchItem,
): string | null {
  if (itemType === "bili_user") return stringOrNull(raw.upic ?? raw.uface);
  if (itemType === "article") {
    return Array.isArray(raw.image_urls)
      ? stringOrNull(raw.image_urls[0])
      : stringOrNull(raw.pic ?? raw.cover);
  }
  return stringOrNull(raw.pic ?? raw.cover ?? raw.user_cover);
}

function pickStats(
  itemType: BiliNormalizedItemType,
  raw: RawBiliSearchItem,
) {
  if (itemType === "bili_user") {
    return {
      fans: toNumber(raw.fans) ?? 0,
      videos: toNumber(raw.videos) ?? 0,
    };
  }
  if (itemType === "live_room" || itemType === "live_user") {
    return {
      online: toNumber(raw.online) ?? 0,
      attentions: toNumber(raw.attentions) ?? 0,
    };
  }
  if (itemType === "article") {
    return {
      view: toNumber(raw.view) ?? 0,
      like: toNumber(raw.like) ?? 0,
      reply: toNumber(raw.reply) ?? 0,
    };
  }
  return {
    play: toNumber(raw.play) ?? 0,
    danmaku: toNumber(raw.danmaku ?? raw.video_review) ?? 0,
    favorite: toNumber(raw.favorites) ?? 0,
    comment: toNumber(raw.review) ?? 0,
    like: toNumber(raw.like) ?? 0,
  };
}

function pickPublishedAt(
  itemType: BiliNormalizedItemType,
  raw: RawBiliSearchItem,
): string | null {
  if (itemType === "live_room" || itemType === "live_user") {
    return stringOrNull(raw.live_time);
  }
  const value = raw.pubdate ?? raw.senddate ?? raw.pub_time ?? raw.pubtime;
  return timestampToIsoOrString(value);
}

function pickExtra(
  itemType: BiliNormalizedItemType,
  raw: RawBiliSearchItem,
): Record<string, unknown> {
  switch (itemType) {
    case "video":
      return {
        aid: raw.aid ?? null,
        bvid: raw.bvid ?? null,
        typeid: raw.typeid ?? null,
        typename: raw.typename ?? null,
        tag: stripHtmlOrNull(raw.tag),
      };
    case "media_bangumi":
    case "media_ft":
      return {
        seasonId: raw.season_id ?? raw.pgc_season_id ?? null,
        seasonType: raw.season_type ?? null,
        seasonTypeName: raw.season_type_name ?? null,
        orgTitle: stripHtmlOrNull(raw.org_title),
        areas: raw.areas ?? null,
        styles: raw.styles ?? null,
        staff: raw.staff ?? null,
        cv: raw.cv ?? null,
        score: raw.media_score ?? null,
        episodeCount: Array.isArray(raw.eps) ? raw.eps.length : null,
      };
    case "live_room":
    case "live_user":
      return {
        uid: raw.uid ?? null,
        roomid: raw.roomid ?? raw.room_id ?? null,
        area: stripHtmlOrNull(raw.area),
        cateName: stripHtmlOrNull(raw.cate_name),
        tags: stripHtmlOrNull(raw.tags),
        liveStatus: raw.live_status ?? raw.is_live ?? null,
        watchedText:
          raw.watched_show?.text_large ??
          raw.watched_show?.text_small ??
          raw.watched_show?.text ??
          null,
      };
    case "article":
      return {
        categoryId: raw.category_id ?? null,
        categoryName: stripHtmlOrNull(raw.category_name),
        commentUrl: raw.comment_url ?? null,
      };
    case "bili_user":
      return {
        level: toNumber(raw.level) ?? null,
        gender: raw.gender ?? null,
        isUpUser: Boolean(raw.is_upuser),
        isLive: Boolean(raw.is_live),
        roomId: raw.room_id ?? null,
        officialVerify: raw.official_verify ?? null,
        hitColumns: raw.hit_columns ?? [],
      };
    default:
      return {};
  }
}

function toNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function stringOrNull(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  return String(value);
}

function stripHtmlOrNull(value: unknown): string | null {
  const s = stringOrNull(value);
  return s ? stripHtml(s) : null;
}

export function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

function timestampToIsoOrString(value: unknown): string | null {
  const n = toNumber(value);
  if (n !== undefined && n > 0) return new Date(n * 1000).toISOString();
  return stringOrNull(value);
}
