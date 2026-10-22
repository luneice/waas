import { isoTime, type BiliEnvelope } from "@src/projections/envelope";
import type {
  BiliCommentItem,
  BiliCommentsResult,
} from "@src/types/comment.types";

/**
 * 评论提取 AI-ready 投影。
 * 仅做信封封装；落盘副作用在 Skill.fetchData 内完成。
 *
 * 信封在标准 `items` 之外多一个 `topItems`（置顶楼）—— 置顶与普通楼的语义不同，
 * 混进同一数组会让 Agent 误判热度排序，故分开。
 */

/** 投影后的评论；`replies` 递归同构（楼中楼） */
export interface BiliCommentProjected {
  rpid: string;
  user: BiliCommentItem["user"];
  message: string;
  /** `src` 本地化后指向落盘文件，否则回退远程 URL */
  images: {
    src: string;
    remoteUrl: string;
    localized: boolean;
    width: number | null;
    height: number | null;
  }[];
  like: number;
  publishedAt: BiliCommentItem["publishedAt"];
  location: string | null;
  replyCount: number;
  replies: BiliCommentProjected[];
}

export type BiliCommentsAiReady = BiliEnvelope<{
  source: BiliCommentsResult["source"];
  total: number | null;
  returnedCount: number;
  pagesFetched: number;
  /** 游标翻页：续取时把该值传回 `offset` */
  nextOffset: string | null;
  hasMore: boolean;
  outputDir: string;
  files: BiliCommentsResult["files"];
}> & {
  /** 置顶评论，与普通楼分开 */
  topItems: BiliCommentProjected[];
  items: BiliCommentProjected[];
};

function countImages(items: BiliCommentItem[]): number {
  let n = 0;
  const walk = (list: BiliCommentItem[]): void => {
    for (const item of list) {
      n += item.images.length;
      if (item.replies.length) walk(item.replies);
    }
  };
  walk(items);
  return n;
}

function projectItem(item: BiliCommentItem): BiliCommentProjected {
  return {
    rpid: item.rpid,
    user: item.user,
    message: item.message,
    images: item.images.map((img) => ({
      src: img.localPath ?? img.url,
      remoteUrl: img.url,
      localized: Boolean(img.localPath),
      width: img.width ?? null,
      height: img.height ?? null,
    })),
    like: item.like,
    publishedAt: item.publishedAt,
    location: item.location,
    replyCount: item.replyCount,
    replies: item.replies.map(projectItem),
  };
}

export function projectBiliCommentsAiReady(
  data: BiliCommentsResult,
): BiliCommentsAiReady {
  const imageCount = countImages([...data.topItems, ...data.items]);

  return {
    meta: {
      skill: "bili-comments",
      semantics: `Bilibili 评论提取：oid=${data.source.oid} type=${data.source.type}（${data.source.origin}）`,
      source: data.source,
      total: data.meta.total,
      returnedCount: data.returnedCount,
      pagesFetched: data.pagesFetched,
      nextOffset: data.nextOffset,
      hasMore: data.hasMore,
      outputDir: data.outputDir,
      files: data.files,
      crawledAt: isoTime(data.crawledAt),
      units: { like: "次", reply: "条" },
    },
    insights: buildInsights(data, imageCount),
    topItems: data.topItems.map(projectItem),
    items: data.items.map(projectItem),
  };
}

function buildInsights(data: BiliCommentsResult, imageCount: number): string[] {
  const out: string[] = [];
  const sortLabel = data.source.mode === 2 ? "时间" : "热度";
  out.push(
    `按${sortLabel}抓取主楼 ${data.returnedCount} 条（共 ${data.pagesFetched} 页${
      data.meta.total !== null ? `，评论区总数 ${data.meta.total}` : ""
    }）。`,
  );
  if (data.topItems.length > 0) {
    out.push(`含置顶评论 ${data.topItems.length} 条。`);
  }
  if (imageCount > 0) {
    out.push(`评论配图 ${imageCount} 张${data.files.images.length > 0 ? "（已本地化）" : "（保留远程 URL）"}。`);
  }
  if (data.hasMore) {
    out.push(`仍有更多评论，可携带 nextOffset 续取。`);
  } else {
    out.push("评论区已抓到底。");
  }
  return out;
}
