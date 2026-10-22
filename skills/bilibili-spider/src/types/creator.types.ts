/**
 * Bilibili 创作者（space.bilibili.com/{mid}）类型定义
 *
 * 见 docs/space-extract-analysis.md。枚举组 Skill 以 `mid` 为入口，各模块产出
 * 结构化结果 + AI-ready projected。命名对齐 search/video/article 既有约定。
 */

// ============================================================================
// 通用
// ============================================================================

/** B 站标准 API 响应包络。 */
export interface BiliApiEnvelope<T> {
  code: number;
  message?: string;
  msg?: string;
  ttl?: number;
  data?: T;
}

/** 隐私墙错误码：用户隐私设置未公开。 */
export const BILI_PRIVACY_CODE = 53013;

/** 所有创作者 Skill 的公共入参（归一后只保留 mid）。 */
export interface BiliCreatorMidParams {
  /** 用户主页 URL、`space.bilibili.com/{mid}` 或纯数字 mid。 */
  mid: string | number;
  [key: string]: unknown;
}

// ============================================================================
// 对外投影 —— 均为 AI-Ready 信封（meta + insights + items/detail）
// 定义在 projections/creator.ai-ready.ts，此处只做汇总别名
// ============================================================================

import type * as _CreatorAiReady from "@src/projections/creator.ai-ready";

// ============================================================================
// 1. 创作者名片（profile）
// ============================================================================

export interface BiliCreatorProfileParams extends BiliCreatorMidParams {}

/** UP 主名片 + 各模块计数 + 代表作。 */
export interface BiliCreatorProfileResult {
  mid: string;
  name: string;
  face: string;
  sign: string;
  sex: string | null;
  level: number | null;
  birthday: string | null;
  /** 认证信息（official）。 */
  official: { role: number; title: string; type: number } | null;
  /** 大会员状态。 */
  vip: { type: number; status: number; label: string } | null;
  /** 直播间。 */
  liveRoom: {
    roomId: number;
    title: string;
    url: string;
    liveStatus: number;
  } | null;
  /** 关注/粉丝（relation/stat）。 */
  relation: {
    following: number;
    follower: number;
    black: number;
    whisper: number;
  } | null;
  /** 累计播放/获赞（upstat）。 */
  upstat: {
    archiveView: number;
    articleView: number;
    likes: number;
  } | null;
  /** 各模块条目数（navnum）。 */
  navnum: Record<string, number> | null;
  /** 空间公告（notice），无则空串。 */
  notice: string;
  /** 代表作（masterpiece），最多 3 个置顶稿件。 */
  masterpiece: BiliArchive[];
  crawledAt: Date;
}

export type BiliCreatorProfileProjected = _CreatorAiReady.BiliCreatorProfileAiReady;

// ============================================================================
// 2. 投稿视频（videos — arc/search）
// ============================================================================

export type BiliCreatorVideosOrder = "pubdate" | "click" | "stow";

export interface BiliCreatorVideosParams extends BiliCreatorMidParams {
  /** 排序：pubdate(最新) / click(最多播放) / stow(最多收藏)。 */
  order?: BiliCreatorVideosOrder;
  /** 分区筛选 tid，0=全部。 */
  tid?: number;
  /** 空间内搜索关键词（在该 UP 稿件内检索）。 */
  keyword?: string;
  /** 起始页码，从 1 开始。 */
  page?: number;
  /** 连续抓取页数。 */
  maxPages?: number;
  /** 每页条数（默认 25）。 */
  pageSize?: number;
}

/** 投稿稿件（arc/search vlist 项）。 */
export interface BiliCreatorVideoItem {
  aid: number;
  bvid: string;
  title: string;
  description: string;
  cover: string;
  url: string;
  duration: string;
  createdAt: number;
  typeId: number;
  play: number;
  comment: number;
  videoReview: number;
}

export interface BiliCreatorVideosResult {
  mid: string;
  order: BiliCreatorVideosOrder;
  tid: number;
  keyword: string;
  /** 该 UP 投稿总数（page.count）。 */
  total: number | null;
  pagesFetched: number;
  returnedCount: number;
  duplicateCount: number;
  items: BiliCreatorVideoItem[];
  /** 分区分布（tlist）。 */
  partitions: { tid: number; name: string; count: number }[];
  crawledAt: Date;
}

export type BiliCreatorVideosProjected = _CreatorAiReady.BiliCreatorVideosAiReady;

// ============================================================================
// 3. 动态时间线（feed — feed/space）
// ============================================================================

export interface BiliCreatorFeedParams extends BiliCreatorMidParams {
  /** 翻页游标，首页留空；续取传上一次返回的 offset。 */
  offset?: string;
  /** 最多翻页数。 */
  maxPages?: number;
}

export interface BiliCreatorFeedItem {
  idStr: string;
  /** DYNAMIC_TYPE_* 原始类型。 */
  type: string;
  /** 卡片大类：archive(视频) / opus(图文) / forward(转发) / word(文字) / other。 */
  kind: "archive" | "opus" | "forward" | "word" | "other";
  text: string;
  /** 视频/图文跳转地址（如有）。 */
  jumpUrl: string | null;
  publishedAt: number | null;
  stats: { comment: number; forward: number; like: number };
}

export interface BiliCreatorFeedResult {
  mid: string;
  pagesFetched: number;
  returnedCount: number;
  items: BiliCreatorFeedItem[];
  /** 下一页游标；null 表示无更多。 */
  nextOffset: string | null;
  hasMore: boolean;
  crawledAt: Date;
}

export type BiliCreatorFeedProjected = _CreatorAiReady.BiliCreatorFeedAiReady;

// ============================================================================
// 4. 图文专栏列表（articles — opus/feed/space）
// ============================================================================

export interface BiliCreatorArticlesParams extends BiliCreatorMidParams {
  /** 翻页游标，首页留空。 */
  offset?: string;
  /** 最多翻页数。 */
  maxPages?: number;
}

export interface BiliCreatorArticleItem {
  opusId: string;
  content: string;
  cover: string | null;
  url: string;
  stats: Record<string, number>;
}

export interface BiliCreatorArticlesResult {
  mid: string;
  pagesFetched: number;
  returnedCount: number;
  items: BiliCreatorArticleItem[];
  nextOffset: string | null;
  hasMore: boolean;
  crawledAt: Date;
}

export type BiliCreatorArticlesProjected = _CreatorAiReady.BiliCreatorArticlesAiReady;

// ============================================================================
// 5. 合集与系列列表（channels — seasons_series_list）
// ============================================================================

export interface BiliCreatorChannelsParams extends BiliCreatorMidParams {
  page?: number;
  maxPages?: number;
  pageSize?: number;
}

/** 合集/系列内预览稿件。 */
export interface BiliArchivePreview {
  aid: number;
  bvid: string;
  title: string;
  cover: string;
  duration: number;
  pubdate: number;
  view: number;
  danmaku: number;
}

export interface BiliCreatorChannel {
  /** season(合集) / series(系列)。 */
  kind: "season" | "series";
  /** season_id 或 series_id。 */
  id: number;
  name: string;
  cover: string;
  description: string;
  total: number;
  url: string;
  /** 预览级稿件（非全量；全量需用 bili-channel 按 id 二次抓取）。 */
  previews: BiliArchivePreview[];
}

export interface BiliCreatorChannelsResult {
  mid: string;
  total: number | null;
  pagesFetched: number;
  returnedCount: number;
  items: BiliCreatorChannel[];
  crawledAt: Date;
}

export type BiliCreatorChannelsProjected = _CreatorAiReady.BiliCreatorChannelsAiReady;

// ============================================================================
// 6. 投稿音频列表（audios — song/upper）
// ============================================================================

export interface BiliCreatorAudiosParams extends BiliCreatorMidParams {
  page?: number;
  maxPages?: number;
  pageSize?: number;
}

export interface BiliCreatorAudioItem {
  auid: number;
  title: string;
  cover: string;
  intro: string;
  bvid: string;
  createdAt: number;
  coinNum: number;
  stats: { play: number; collect: number; comment: number; share: number };
}

export interface BiliCreatorAudiosResult {
  mid: string;
  total: number | null;
  pagesFetched: number;
  returnedCount: number;
  items: BiliCreatorAudioItem[];
  crawledAt: Date;
}

export type BiliCreatorAudiosProjected = _CreatorAiReady.BiliCreatorAudiosAiReady;

// ============================================================================
// 共享：稿件对象（masterpiece 项 / 通用）
// ============================================================================

export interface BiliArchive {
  aid: number;
  bvid: string;
  title: string;
  cover: string;
  description: string;
  duration: number;
  pubdate: number;
  url: string;
  stats: {
    view: number;
    like: number;
    coin: number;
    favorite: number;
    reply: number;
    share: number;
    danmaku: number;
  };
}
