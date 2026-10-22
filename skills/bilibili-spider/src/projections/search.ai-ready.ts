import type {
  BiliFetchedPage,
  BiliSearchItem,
  BiliSearchResult,
} from "@src/types/search.types";

export interface BiliSearchAiReadyItem {
  rank: number | null;
  type: string;
  id: string;
  title: string;
  url: string | null;
  cover: string | null;
  author: {
    id: string | null;
    name: string | null;
    avatar: string | null;
  };
  stats: Record<string, number>;
  publishedAt: string | null;
  duration: string | null;
  extra: Record<string, unknown>;
}

export interface BiliSearchAiReady {
  meta: {
    skill: "bili-search";
    semantics: string;
    keyword: string;
    kind: string;
    query: BiliSearchResult["query"];
    qvId: string;
    crawledAt: string;
    /** 上游可见结果总数（部分分类不给，为 null） */
    total: number | null;
    totalPages: number | null;
    /** 本次抓取起始页码 */
    pageStart: number;
    pagesFetched: number;
    returnedCount: number;
    duplicatesRemoved: number;
    pagination: {
      strategy: "dynamic_offset" | "page";
      note: string;
      pages: BiliFetchedPage[];
    };
    units: Record<string, string>;
  };
  insights: string[];
  items: BiliSearchAiReadyItem[];
}

const KIND_LABELS: Record<string, string> = {
  video: "视频",
  media_bangumi: "番剧",
  media_ft: "影视",
  live: "直播",
  article: "专栏",
  bili_user: "用户",
};

const DYNAMIC_KINDS = new Set(["video", "live", "bili_user"]);

export function projectBiliSearchAiReady(
  input: BiliSearchResult,
): BiliSearchAiReady {
  const kindLabel = KIND_LABELS[input.kind] ?? input.kind;
  const isDynamic = DYNAMIC_KINDS.has(input.kind);
  const items = input.items.map(projectItem);

  return {
    meta: {
      skill: "bili-search",
      semantics: `Bilibili ${kindLabel}搜索：关键词「${input.keyword}」`,
      keyword: input.keyword,
      kind: input.kind,
      query: input.query,
      qvId: input.qvId,
      crawledAt:
        input.crawledAt instanceof Date
          ? input.crawledAt.toISOString()
          : String(input.crawledAt),
      total: input.totalResults,
      totalPages: input.totalPages,
      pageStart: input.query.page,
      pagesFetched: input.pagesFetched,
      returnedCount: input.returnedCount,
      duplicatesRemoved: input.duplicateCount,      pagination: {
        strategy: isDynamic ? "dynamic_offset" : "page",
        note: isDynamic
          ? "该分类按 PC 搜索页的 dynamic_offset=24 步长翻页，页间天然重叠，结果已按主键去重。"
          : "该分类按普通 page/page_size 翻页。",
        pages: input.pages,
      },
      units: {
        play: "次",
        danmaku: "条",
        favorite: "次",
        comment: "条",
        like: "次",
        view: "次",
        reply: "条",
        online: "人或热度值",
        attentions: "人",
        fans: "人",
        videos: "个",
      },
    },
    insights: buildInsights(input),
    items,
  };
}

function projectItem(item: BiliSearchItem): BiliSearchAiReadyItem {
  return {
    rank: item.rank.index,
    type: item.itemType,
    id: item.id,
    title: item.title,
    url: item.url,
    cover: item.cover,
    author: item.author,
    stats: compactStats(item.stats),
    publishedAt: item.publishedAt,
    duration: item.duration,
    extra: item.extra,
  };
}

function compactStats(stats: BiliSearchItem["stats"]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(stats)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      out[key] = value;
    }
  }
  return out;
}

function buildInsights(input: BiliSearchResult): string[] {
  const label = KIND_LABELS[input.kind] ?? input.kind;
  const out = [
    `关键词「${input.keyword}」${label}搜索：抓取 ${input.pagesFetched} 页，去重后返回 ${input.returnedCount} 条。`,
  ];
  if (input.totalResults !== null) {
    out.push(`上游可见结果数约 ${input.totalResults} 条。`);
  }
  if (input.duplicateCount > 0) {
    out.push(`翻页窗口存在重叠，本次去重移除 ${input.duplicateCount} 条重复结果。`);
  }
  if (input.items.length === 0) {
    out.push("当前条件下没有返回搜索结果。");
    return out;
  }

  const top = input.items[0];
  if (top) {
    const author = top.author.name ? ` @${top.author.name}` : "";
    out.push(`首条结果：${top.title}${author}。`);
  }

  const liveRooms = input.items.filter((x) => x.itemType === "live_room").length;
  const liveUsers = input.items.filter((x) => x.itemType === "live_user").length;
  if (liveRooms || liveUsers) {
    out.push(`直播结果拆分：直播间 ${liveRooms} 条，主播用户 ${liveUsers} 条。`);
  }

  return out;
}
