/**
 * Bilibili 评论（统一评论区）类型定义
 *
 * 评论区按 `(oid, type)` 二元组定位，与内容形态解耦（视频/专栏/图文共用同一接口
 * `/x/v2/reply/wbi/main`，WBI 签名）。评论内容支持文字（content.message）与图片
 * （content.pictures[]）。详见 docs/comment-extract-analysis.md。
 *
 * 评论区定位（HAR 实证）：
 *   - 视频：type=1，oid=aid
 *   - 老版专栏 cv：type=12，oid=cvId
 *   - opus 图文/动态：type=basic.comment_type，oid=basic.comment_id_str
 *     （来自 /x/polymer/web-dynamic/v1/detail）
 */

// ============================================================================
// 入参
// ============================================================================

/** 排序模式：3=按热度（默认），2=按时间。 */
export type BiliCommentMode = 2 | 3;

export interface BiliCommentParams {
  // ── 高层入口（任一即可，内部归一为 oid+type）──
  /** 视频 BV 号 */
  bvid?: string;
  /** 视频 av 号（数字） */
  aid?: number | string;
  /** 老版专栏 cv 号（纯数字或 cvXXXX） */
  cvId?: string;
  /** opus 主键（图文/动态数字串） */
  opusId?: string;
  /** 内容 URL：视频 /video/、专栏 /opus/、/read/cv */
  url?: string;

  // ── 低层直传（调试 / 已知评论区）──
  /** 评论区 oid，与 type 配对直传 */
  oid?: string | number;
  /** 评论区 type，与 oid 配对直传 */
  type?: number;

  // ── 抓取控制 ──
  /** 排序：3=热度（默认）/ 2=时间 */
  mode?: BiliCommentMode;
  /** 主楼连续抓取页数（默认 3，硬上限见 constants） */
  maxPages?: number;
  /** 跨 maxPages 续取游标；首次留空，续取传上一次返回的 nextOffset */
  offset?: string;

  // ── 楼中楼 ──
  /** 是否为每条主楼追加完整楼中楼（默认 false，仅用主楼内嵌的少量热门子回复） */
  includeReplies?: boolean;
  /** includeReplies=true 时每条主楼最多追加的子回复数（默认 10） */
  repliesLimit?: number;

  // ── 输出控制 ──
  /** 是否下载评论配图并本地化，默认 true；false 时保留远程原图 URL */
  downloadImages?: boolean;
  /** 输出目录；不传使用 storageRoot/bilibili */
  outputDir?: string;
  /** 单图下载超时（毫秒），默认 30000 */
  imageTimeoutMs?: number;
}

// ============================================================================
// 评论区定位
// ============================================================================

/** 评论区定位二元组（oid + type）。 */
export interface BiliCommentSubject {
  /** 评论区主键 */
  oid: string;
  /** 评论区类型：1=视频 / 12=专栏 cv / 11、17 等=图文动态 */
  type: number;
  /** 定位来源，便于诊断 */
  origin: "direct" | "video" | "article" | "opus";
}

// ============================================================================
// 结构化评论
// ============================================================================

/** 评论配图（content.pictures[] 项）。 */
export interface BiliCommentImage {
  /** 原图远程 URL（已升级为 https） */
  url: string;
  /** 落盘后相对 outputDir 的本地路径；未下载或失败时为空 */
  localPath?: string;
  width?: number;
  height?: number;
  /** 原始体积（KB，上游 img_size） */
  sizeKb?: number;
  /** 落盘字节数 */
  sizeBytes?: number;
}

/** 评论用户（member）。 */
export interface BiliCommentUser {
  mid: number;
  name: string;
  avatar: string;
  /** 等级（level_info.current_level） */
  level: number;
}

/** 单条评论（主楼或楼中楼，结构同构）。 */
export interface BiliCommentItem {
  /** 评论主键（rpid_str） */
  rpid: string;
  user: BiliCommentUser;
  /** 文字内容（content.message） */
  message: string;
  /** 配图（content.pictures[]） */
  images: BiliCommentImage[];
  like: number;
  /** 发布时间（秒级时间戳，ctime） */
  publishedAt: number;
  /** 子回复总数（rcount） */
  replyCount: number;
  /** IP 属地（reply_control.location，去前缀） */
  location: string | null;
  /** 楼中楼（内嵌热门子回复 + includeReplies 追加） */
  replies: BiliCommentItem[];
}

// ============================================================================
// 结果
// ============================================================================

/** 单页主楼抓取产物（Goal 输出）。 */
export interface BiliCommentsPage {
  items: BiliCommentItem[];
  /** 置顶评论（top_replies），与普通楼分开 */
  topItems: BiliCommentItem[];
  /** 评论区总数（cursor.all_count） */
  total: number | null;
  /** 下一页游标（cursor.pagination_reply.next_offset） */
  nextOffset: string | null;
  /** 是否到底（cursor.is_end） */
  isEnd: boolean;
}

/** fetchData 输出（含落盘副作用产物）。 */
export interface BiliCommentsResult {
  source: BiliCommentSubject & { mode: BiliCommentMode };
  meta: {
    /** 评论区总数（cursor.all_count） */
    total: number | null;
  };
  /** 本次实际抓取的主楼页数 */
  pagesFetched: number;
  /** 返回的主楼条数（去重后） */
  returnedCount: number;
  /** 置顶评论 */
  topItems: BiliCommentItem[];
  /** 主楼（含楼中楼） */
  items: BiliCommentItem[];
  /** 跨 maxPages 续取游标；null 表示已到底 */
  nextOffset: string | null;
  hasMore: boolean;
  /** 落盘文件（相对 outputDir） */
  files: {
    markdown: string | null;
    meta: string | null;
    images: string[];
  };
  outputDir: string;
  crawledAt: Date;
}

export type { BiliCommentsAiReady } from "@src/projections/comment.ai-ready";
import type { BiliCommentsAiReady as _AiReady } from "@src/projections/comment.ai-ready";

/** 对外投影 = AI-Ready 信封（meta + insights + topItems + items） */
export type BiliCommentsProjected = _AiReady;

// ============================================================================
// 上游原始响应（reply/wbi/main 与 reply/reply）
// ============================================================================

export interface RawReplyPicture {
  img_src?: string;
  img_width?: number;
  img_height?: number;
  img_size?: number;
}

export interface RawReplyMember {
  mid?: string;
  uname?: string;
  avatar?: string;
  level_info?: { current_level?: number };
}

export interface RawReplyContent {
  message?: string;
  pictures?: RawReplyPicture[] | null;
}

export interface RawReply {
  rpid_str?: string;
  member?: RawReplyMember;
  content?: RawReplyContent;
  like?: number;
  ctime?: number;
  rcount?: number;
  reply_control?: { location?: string };
  replies?: RawReply[] | null;
}

export interface RawReplyCursor {
  is_end?: boolean;
  all_count?: number;
  pagination_reply?: { next_offset?: string };
}

export interface RawReplyMainData {
  cursor?: RawReplyCursor;
  replies?: RawReply[] | null;
  top_replies?: RawReply[] | null;
}

export interface RawReplyReplyData {
  replies?: RawReply[] | null;
}
