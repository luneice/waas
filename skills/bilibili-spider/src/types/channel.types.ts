/**
 * Bilibili 合集/系列详情类型（channel — 单个 season/series 的全量稿件）
 *
 * 与 bili-creator-channels（目录 + 预览）正交：本模块按 season_id/series_id 拉取
 * 单个合集或系列内的全量稿件并翻页。season 走 `/x/polymer/web-space/seasons_archives_list`，
 * series 走 `/x/series/archives`，均无 WBI 签名。
 */

export type BiliChannelKind = "season" | "series";

export interface BiliChannelParams {
  /** season(合集) / series(系列)。 */
  kind: BiliChannelKind;
  /** season_id 或 series_id（合集/系列详情页 ?sid= 的值）。 */
  id: string | number;
  /** UP 主 mid、主页 URL 或 space.bilibili.com/{mid}（两类接口均必填）。 */
  mid: string | number;
  /** 起始页码，从 1 开始。 */
  page?: number;
  /** 连续抓取页数，按 aid 去重。 */
  maxPages?: number;
  /** 每页条数（season=page_size / series=ps）。 */
  pageSize?: number;
}

/** 合集/系列内的全量稿件项。 */
export interface BiliChannelArchive {
  aid: number;
  bvid: string;
  title: string;
  cover: string;
  /** 时长（秒）。 */
  duration: number;
  pubdate: number;
  url: string;
  view: number;
  danmaku: number;
}

export interface BiliChannelResult {
  kind: BiliChannelKind;
  id: number;
  mid: string;
  /** 合集/系列元信息（series 接口不返回时仅含可得字段）。 */
  meta: {
    name: string;
    cover: string;
    description: string;
  };
  total: number | null;
  pagesFetched: number;
  returnedCount: number;
  items: BiliChannelArchive[];
  crawledAt: Date;
}

export type { BiliChannelAiReady } from "@src/projections/channel.ai-ready";
import type { BiliChannelAiReady as _AiReady } from "@src/projections/channel.ai-ready";

/** 对外投影 = AI-Ready 信封（meta + insights + items） */
export type BiliChannelProjected = _AiReady;
