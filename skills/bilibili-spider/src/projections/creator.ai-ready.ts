/**
 * 创作者模块 AI-Ready 投影 —— 6 个 Skill 的语义信封。
 *
 * 显式枚举字段，不 spread 上游对象：上游新增字段不会静默泄漏给消费者。
 * 时间统一转 ISO 8601（上游给的是秒级时间戳）；时长统一给 `H:MM:SS` 可读串
 * 并保留原始秒数，让 Agent 既能直接展示也能继续计算。
 */

import {
  fromUnix,
  hms,
  isoTime,
  wan,
  type BiliDetailEnvelope,
  type BiliListEnvelope,
} from "@src/projections/envelope";
import type {
  BiliArchive,
  BiliArchivePreview,
  BiliCreatorArticleItem,
  BiliCreatorArticlesResult,
  BiliCreatorAudioItem,
  BiliCreatorAudiosResult,
  BiliCreatorChannel,
  BiliCreatorChannelsResult,
  BiliCreatorFeedItem,
  BiliCreatorFeedResult,
  BiliCreatorProfileResult,
  BiliCreatorVideoItem,
  BiliCreatorVideosResult,
} from "@src/types/creator.types";

const COMMON_UNITS = {
  view: "次",
  play: "次",
  like: "次",
  coin: "个",
  favorite: "次",
  reply: "条",
  share: "次",
  danmaku: "条",
  follower: "人",
  following: "人",
  comment: "条",
  forward: "次",
  collect: "次",
};

// ============================================================================
// 1. 创作者名片（bili-creator）
// ============================================================================

export interface BiliCreatorProfileDetail {
  mid: string;
  name: string;
  avatar: string;
  signature: string;
  sex: string | null;
  level: number | null;
  birthday: string | null;
  /** 官方认证；未认证为 null */
  official: { role: number; title: string; type: number } | null;
  /** 大会员状态；非会员为 null */
  vip: { type: number; status: number; label: string } | null;
  liveRoom: {
    roomId: number;
    title: string;
    url: string;
    liveStatus: number;
  } | null;
  relation: {
    following: number;
    follower: number;
    black: number;
    whisper: number;
  } | null;
  /** 累计播放/获赞 */
  upstat: { archiveView: number; articleView: number; likes: number } | null;
  /** 各模块条目数，可作为后续列表 Skill 的目录依据 */
  moduleCounts: Record<string, number> | null;
  notice: string;
  masterpiece: BiliArchiveProjected[];
}

export type BiliCreatorProfileAiReady = BiliDetailEnvelope<
  BiliCreatorProfileDetail,
  { mid: string }
>;

export function projectBiliCreatorProfileAiReady(
  data: BiliCreatorProfileResult,
): BiliCreatorProfileAiReady {
  const detail: BiliCreatorProfileDetail = {
    mid: data.mid,
    name: data.name,
    avatar: data.face,
    signature: data.sign,
    sex: data.sex,
    level: data.level,
    birthday: data.birthday,
    official: data.official,
    vip: data.vip,
    liveRoom: data.liveRoom,
    relation: data.relation,
    upstat: data.upstat,
    moduleCounts: data.navnum,
    notice: data.notice,
    masterpiece: data.masterpiece.map(projectArchive),
  };

  return {
    meta: {
      skill: "bili-creator",
      semantics: `创作者名片：mid=${data.mid}（资料卡 + 各模块条目数 + 代表作）`,
      mid: data.mid,
      crawledAt: isoTime(data.crawledAt),
      units: COMMON_UNITS,
    },
    insights: buildProfileInsights(data),
    detail,
  };
}

function buildProfileInsights(data: BiliCreatorProfileResult): string[] {
  const out: string[] = [];
  const level = data.level !== null ? `Lv${data.level}` : "等级未知";
  out.push(`「${data.name}」（${level}），mid=${data.mid}。`);

  if (data.relation) {
    out.push(
      `粉丝 ${wan(data.relation.follower)}，关注 ${wan(data.relation.following)}。`,
    );
  }
  if (data.upstat) {
    out.push(
      `累计视频播放 ${wan(data.upstat.archiveView)}，专栏阅读 ${wan(
        data.upstat.articleView,
      )}，获赞 ${wan(data.upstat.likes)}。`,
    );
  }
  if (data.official?.title) {
    out.push(`官方认证：${data.official.title}。`);
  }
  if (data.navnum) {
    const parts = Object.entries(data.navnum)
      .filter(([, v]) => typeof v === "number" && v > 0)
      .map(([k, v]) => `${k}=${v}`);
    if (parts.length > 0) {
      out.push(`各模块条目数：${parts.join("，")}（可据此决定是否调下游列表 Skill）。`);
    }
  }
  if (data.masterpiece.length > 0) {
    const top = data.masterpiece[0];
    out.push(
      `代表作 ${data.masterpiece.length} 个，首个「${top.title}」播放 ${wan(top.stats.view)}。`,
    );
  }
  if (data.liveRoom && data.liveRoom.liveStatus === 1) {
    out.push(`当前正在直播：「${data.liveRoom.title}」。`);
  }
  return out;
}

// ============================================================================
// 2. 投稿视频（bili-creator-videos）
// ============================================================================

export interface BiliCreatorVideoProjected {
  aid: number;
  bvid: string;
  title: string;
  description: string;
  cover: string;
  url: string;
  /** 上游给的可读时长串（如 `12:34`） */
  duration: string;
  publishedAt: string | null;
  typeId: number;
  stats: { play: number; comment: number; danmaku: number };
}

export type BiliCreatorVideosAiReady = BiliListEnvelope<
  BiliCreatorVideoProjected,
  {
    mid: string;
    order: string;
    tid: number;
    keyword: string;
    total: number | null;
    pagesFetched: number;
    returnedCount: number;
    duplicatesRemoved: number;
    partitions: { tid: number; name: string; count: number }[];
  }
>;

export function projectBiliCreatorVideosAiReady(
  data: BiliCreatorVideosResult,
): BiliCreatorVideosAiReady {
  return {
    meta: {
      skill: "bili-creator-videos",
      semantics: `mid=${data.mid} 的投稿视频列表（排序 ${data.order}${
        data.keyword ? `，空间内检索「${data.keyword}」` : ""
      }）`,
      mid: data.mid,
      order: data.order,
      tid: data.tid,
      keyword: data.keyword,
      total: data.total,
      pagesFetched: data.pagesFetched,
      returnedCount: data.returnedCount,
      duplicatesRemoved: data.duplicateCount,
      partitions: data.partitions,
      crawledAt: isoTime(data.crawledAt),
      units: COMMON_UNITS,
    },
    insights: buildVideosInsights(data),
    items: data.items.map(projectVideoItem),
  };
}

function projectVideoItem(item: BiliCreatorVideoItem): BiliCreatorVideoProjected {
  return {
    aid: item.aid,
    bvid: item.bvid,
    title: item.title,
    description: item.description,
    cover: item.cover,
    url: item.url,
    duration: item.duration,
    publishedAt: fromUnix(item.createdAt),
    typeId: item.typeId,
    stats: {
      play: item.play,
      comment: item.comment,
      danmaku: item.videoReview,
    },
  };
}

function buildVideosInsights(data: BiliCreatorVideosResult): string[] {
  const out: string[] = [];
  out.push(
    `抓取 ${data.pagesFetched} 页，返回投稿 ${data.returnedCount} 条${
      data.total !== null ? `（该 UP 投稿总数 ${data.total}）` : ""
    }。`,
  );
  if (data.items.length === 0) {
    out.push("当前条件下无投稿（也可能是隐私设置未公开该模块）。");
    return out;
  }
  if (data.duplicateCount > 0) {
    out.push(`翻页窗口重叠，已去重移除 ${data.duplicateCount} 条。`);
  }

  const plays = data.items.map((x) => x.play).filter(Number.isFinite);
  if (plays.length > 0) {
    const sum = plays.reduce((a, b) => a + b, 0);
    out.push(
      `本次样本总播放 ${wan(sum)}，均播 ${wan(Math.round(sum / plays.length))}。`,
    );
    const top = [...data.items].sort((a, b) => b.play - a.play)[0];
    out.push(`最高播放：「${top.title}」${wan(top.play)}（${top.bvid}）。`);
  }
  if (data.partitions.length > 0) {
    const top3 = [...data.partitions]
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map((p) => `${p.name}(${p.count})`);
    out.push(`主要分区分布：${top3.join("、")}。`);
  }
  return out;
}

// ============================================================================
// 3. 动态时间线（bili-creator-feed）
// ============================================================================

export interface BiliCreatorFeedProjectedItem {
  idStr: string;
  /** 卡片大类，比原始 DYNAMIC_TYPE_* 更适合分流处理 */
  kind: BiliCreatorFeedItem["kind"];
  rawType: string;
  text: string;
  jumpUrl: string | null;
  publishedAt: string | null;
  stats: { comment: number; forward: number; like: number };
}

export type BiliCreatorFeedAiReady = BiliListEnvelope<
  BiliCreatorFeedProjectedItem,
  {
    mid: string;
    pagesFetched: number;
    returnedCount: number;
    /** 游标翻页：续取时把该值传回 `offset` */
    nextOffset: string | null;
    hasMore: boolean;
  }
>;

export function projectBiliCreatorFeedAiReady(
  data: BiliCreatorFeedResult,
): BiliCreatorFeedAiReady {
  return {
    meta: {
      skill: "bili-creator-feed",
      semantics: `mid=${data.mid} 的动态时间线（游标翻页，按 offset 续取）`,
      mid: data.mid,
      pagesFetched: data.pagesFetched,
      returnedCount: data.returnedCount,
      nextOffset: data.nextOffset,
      hasMore: data.hasMore,
      crawledAt: isoTime(data.crawledAt),
      units: COMMON_UNITS,
    },
    insights: buildFeedInsights(data),
    items: data.items.map(projectFeedItem),
  };
}

function projectFeedItem(
  item: BiliCreatorFeedItem,
): BiliCreatorFeedProjectedItem {
  return {
    idStr: item.idStr,
    kind: item.kind,
    rawType: item.type,
    text: item.text,
    jumpUrl: item.jumpUrl,
    publishedAt: fromUnix(item.publishedAt),
    stats: item.stats,
  };
}

function buildFeedInsights(data: BiliCreatorFeedResult): string[] {
  const out: string[] = [];
  out.push(`抓取 ${data.pagesFetched} 页，返回动态 ${data.returnedCount} 条。`);
  if (data.items.length === 0) {
    out.push("该 UP 此模块无公开动态。");
    return out;
  }

  const byKind = new Map<string, number>();
  for (const item of data.items) {
    byKind.set(item.kind, (byKind.get(item.kind) ?? 0) + 1);
  }
  const dist = [...byKind.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}=${v}`);
  out.push(`动态类型分布：${dist.join("，")}。`);

  const times = data.items
    .map((x) => x.publishedAt)
    .filter((t): t is number => typeof t === "number" && t > 0);
  if (times.length > 0) {
    const newest = fromUnix(Math.max(...times));
    const oldest = fromUnix(Math.min(...times));
    out.push(`时间跨度：${oldest} ~ ${newest}。`);
  }

  const hot = [...data.items].sort((a, b) => b.stats.like - a.stats.like)[0];
  if (hot && hot.stats.like > 0) {
    out.push(
      `最高赞动态 ${wan(hot.stats.like)} 赞：${hot.text.slice(0, 40)}${
        hot.text.length > 40 ? "…" : ""
      }`,
    );
  }
  out.push(
    data.hasMore
      ? "仍有更多动态，可携带 nextOffset 续取。"
      : "该 UP 动态已抓到底。",
  );
  return out;
}

// ============================================================================
// 4. 图文专栏列表（bili-creator-articles）
// ============================================================================

export interface BiliCreatorArticleProjected {
  opusId: string;
  /** 摘要文本（上游只给摘要，全文需调 bili-article） */
  summary: string;
  cover: string | null;
  url: string;
  stats: Record<string, number>;
}

export type BiliCreatorArticlesAiReady = BiliListEnvelope<
  BiliCreatorArticleProjected,
  {
    mid: string;
    pagesFetched: number;
    returnedCount: number;
    nextOffset: string | null;
    hasMore: boolean;
  }
>;

export function projectBiliCreatorArticlesAiReady(
  data: BiliCreatorArticlesResult,
): BiliCreatorArticlesAiReady {
  return {
    meta: {
      skill: "bili-creator-articles",
      semantics: `mid=${data.mid} 的图文专栏列表（游标翻页；正文需用 opusId 调 bili-article）`,
      mid: data.mid,
      pagesFetched: data.pagesFetched,
      returnedCount: data.returnedCount,
      nextOffset: data.nextOffset,
      hasMore: data.hasMore,
      crawledAt: isoTime(data.crawledAt),
      units: COMMON_UNITS,
    },
    insights: buildArticlesInsights(data),
    items: data.items.map(projectArticleItem),
  };
}

function projectArticleItem(
  item: BiliCreatorArticleItem,
): BiliCreatorArticleProjected {
  return {
    opusId: item.opusId,
    summary: item.content,
    cover: item.cover,
    url: item.url,
    stats: item.stats,
  };
}

function buildArticlesInsights(data: BiliCreatorArticlesResult): string[] {
  const out: string[] = [];
  out.push(`抓取 ${data.pagesFetched} 页，返回图文 ${data.returnedCount} 篇。`);
  if (data.items.length === 0) {
    out.push("该 UP 此模块无公开图文。");
    return out;
  }
  out.push("列表仅含摘要；需要正文时用 opusId 调 bili-article 逐篇提取。");
  out.push(
    data.hasMore
      ? "仍有更多图文，可携带 nextOffset 续取。"
      : "该 UP 图文已抓到底。",
  );
  return out;
}

// ============================================================================
// 5. 合集与系列（bili-creator-channels）
// ============================================================================

export interface BiliArchivePreviewProjected {
  aid: number;
  bvid: string;
  title: string;
  cover: string;
  durationSeconds: number;
  duration: string | null;
  publishedAt: string | null;
  stats: { view: number; danmaku: number };
}

export interface BiliCreatorChannelProjected {
  /** season(合集) / series(系列) —— 与 id 配对喂给 bili-channel */
  kind: BiliCreatorChannel["kind"];
  id: number;
  name: string;
  cover: string;
  description: string;
  /** 该合集/系列内稿件总数 */
  total: number;
  url: string;
  /** 预览级稿件（非全量）；全量需按 kind+id 调 bili-channel */
  previews: BiliArchivePreviewProjected[];
}

export type BiliCreatorChannelsAiReady = BiliListEnvelope<
  BiliCreatorChannelProjected,
  {
    mid: string;
    total: number | null;
    pagesFetched: number;
    returnedCount: number;
  }
>;

export function projectBiliCreatorChannelsAiReady(
  data: BiliCreatorChannelsResult,
): BiliCreatorChannelsAiReady {
  return {
    meta: {
      skill: "bili-creator-channels",
      semantics: `mid=${data.mid} 的合集/系列目录（含预览稿件；全量需按 kind+id 调 bili-channel）`,
      mid: data.mid,
      total: data.total,
      pagesFetched: data.pagesFetched,
      returnedCount: data.returnedCount,
      crawledAt: isoTime(data.crawledAt),
      units: COMMON_UNITS,
    },
    insights: buildChannelsInsights(data),
    items: data.items.map(projectChannel),
  };
}

function projectChannel(
  channel: BiliCreatorChannel,
): BiliCreatorChannelProjected {
  return {
    kind: channel.kind,
    id: channel.id,
    name: channel.name,
    cover: channel.cover,
    description: channel.description,
    total: channel.total,
    url: channel.url,
    previews: channel.previews.map(projectPreview),
  };
}

function projectPreview(
  preview: BiliArchivePreview,
): BiliArchivePreviewProjected {
  return {
    aid: preview.aid,
    bvid: preview.bvid,
    title: preview.title,
    cover: preview.cover,
    durationSeconds: preview.duration,
    duration: hms(preview.duration),
    publishedAt: fromUnix(preview.pubdate),
    stats: { view: preview.view, danmaku: preview.danmaku },
  };
}

function buildChannelsInsights(data: BiliCreatorChannelsResult): string[] {
  const out: string[] = [];
  const seasons = data.items.filter((x) => x.kind === "season").length;
  const series = data.items.filter((x) => x.kind === "series").length;
  out.push(
    `抓取 ${data.pagesFetched} 页，返回 ${data.returnedCount} 个（合集 ${seasons}，系列 ${series}）。`,
  );
  if (data.items.length === 0) {
    out.push("该 UP 此模块无公开合集/系列。");
    return out;
  }

  const archiveTotal = data.items.reduce((sum, x) => sum + (x.total ?? 0), 0);
  out.push(`覆盖稿件合计 ${archiveTotal} 个（items[].previews 只是预览，非全量）。`);

  const biggest = [...data.items].sort((a, b) => b.total - a.total)[0];
  out.push(
    `最大的是「${biggest.name}」（${biggest.kind}，id=${biggest.id}，${biggest.total} 个稿件）。`,
  );
  out.push("取某个合集/系列的全量稿件：用 items[].kind + items[].id 调 bili-channel。");
  return out;
}

// ============================================================================
// 6. 投稿音频（bili-creator-audios）
// ============================================================================

export interface BiliCreatorAudioProjected {
  auid: number;
  title: string;
  cover: string;
  intro: string;
  /** 关联视频 bvid；纯音频投稿可能为空串 */
  bvid: string;
  publishedAt: string | null;
  coinCount: number;
  stats: { play: number; collect: number; comment: number; share: number };
}

export type BiliCreatorAudiosAiReady = BiliListEnvelope<
  BiliCreatorAudioProjected,
  {
    mid: string;
    total: number | null;
    pagesFetched: number;
    returnedCount: number;
  }
>;

export function projectBiliCreatorAudiosAiReady(
  data: BiliCreatorAudiosResult,
): BiliCreatorAudiosAiReady {
  return {
    meta: {
      skill: "bili-creator-audios",
      semantics: `mid=${data.mid} 的投稿音频列表`,
      mid: data.mid,
      total: data.total,
      pagesFetched: data.pagesFetched,
      returnedCount: data.returnedCount,
      crawledAt: isoTime(data.crawledAt),
      units: COMMON_UNITS,
    },
    insights: buildAudiosInsights(data),
    items: data.items.map(projectAudioItem),
  };
}

function projectAudioItem(
  item: BiliCreatorAudioItem,
): BiliCreatorAudioProjected {
  return {
    auid: item.auid,
    title: item.title,
    cover: item.cover,
    intro: item.intro,
    bvid: item.bvid,
    publishedAt: fromUnix(item.createdAt),
    coinCount: item.coinNum,
    stats: item.stats,
  };
}

function buildAudiosInsights(data: BiliCreatorAudiosResult): string[] {
  const out: string[] = [];
  out.push(
    `抓取 ${data.pagesFetched} 页，返回音频 ${data.returnedCount} 条${
      data.total !== null ? `（总数 ${data.total}）` : ""
    }。`,
  );
  if (data.items.length === 0) {
    out.push("该 UP 此模块无公开音频。");
    return out;
  }

  const plays = data.items.map((x) => x.stats.play).filter(Number.isFinite);
  if (plays.length > 0) {
    const sum = plays.reduce((a, b) => a + b, 0);
    out.push(
      `样本总播放 ${wan(sum)}，均播 ${wan(Math.round(sum / plays.length))}。`,
    );
    const top = [...data.items].sort((a, b) => b.stats.play - a.stats.play)[0];
    out.push(`最高播放：「${top.title}」${wan(top.stats.play)}。`);
  }
  return out;
}

// ============================================================================
// 共享：稿件投影
// ============================================================================

export interface BiliArchiveProjected {
  aid: number;
  bvid: string;
  title: string;
  cover: string;
  description: string;
  durationSeconds: number;
  duration: string | null;
  publishedAt: string | null;
  url: string;
  stats: BiliArchive["stats"];
}

export function projectArchive(archive: BiliArchive): BiliArchiveProjected {
  return {
    aid: archive.aid,
    bvid: archive.bvid,
    title: archive.title,
    cover: archive.cover,
    description: archive.description,
    durationSeconds: archive.duration,
    duration: hms(archive.duration),
    publishedAt: fromUnix(archive.pubdate),
    url: archive.url,
    stats: archive.stats,
  };
}
