export type BiliSearchKind =
  | "video"
  | "media_bangumi"
  | "media_ft"
  | "live"
  | "article"
  | "bili_user";

export type BiliNormalizedItemType =
  | BiliSearchKind
  | "live_room"
  | "live_user";

export interface BiliSearchParams {
  /** 搜索关键词 */
  keyword: string;
  /** 搜索分类，默认 video。别名支持 bangumi / pgc / upuser。 */
  kind?: BiliSearchKind | "bangumi" | "pgc" | "upuser";
  /** 起始页码，从 1 开始。默认 1。 */
  page?: number;
  /** 单次连续抓取页数。默认 1。动态偏移分页会自动去重。 */
  maxPages?: number;
  /** 覆盖接口 page_size；不传则按分类使用 HAR 中的默认值。 */
  pageSize?: number;
  /** 排序值，按分类透传。 */
  order?: string;
  /** 发布时间起始秒级时间戳，视频/专栏常用。默认 0。 */
  pubtimeBeginS?: number;
  /** 发布时间结束秒级时间戳，视频/专栏常用。默认 0。 */
  pubtimeEndS?: number;
  /** 视频时长筛选：0/空=不限，1=10min 以下，2=10-30min，3=30-60min，4=60min 以上。 */
  duration?: string | number;
  /** 视频分区 tids。 */
  tids?: string | number;
  /** 专栏分区 category_id，默认 0。 */
  categoryId?: number;
  /** 用户排序方向：0=降序，1=升序。 */
  orderSort?: 0 | 1;
  /** 用户类型：0=全部，1=UP 主，2=普通用户，3=认证用户。 */
  userType?: 0 | 1 | 2 | 3;
  /** 动态偏移分页步长，默认 24。 */
  offsetStep?: number;
  /** 搜索会话 ID；不传则自动生成 32 位随机串并在连续翻页中复用。 */
  qvId?: string;
}

export interface BiliApiResponse<TData> {
  code?: number;
  message?: string;
  msg?: string;
  ttl?: number;
  data?: TData;
}

export interface RawBiliSearchData<TResult = unknown> {
  seid?: string;
  page?: number;
  pagesize?: number;
  numResults?: number;
  numPages?: number;
  pageinfo?: BiliLivePageInfo;
  result?: TResult;
  rqt_type?: string;
  suggest_keyword?: string;
  egg_hit?: number;
  show_column?: number;
  [key: string]: unknown;
}

export interface BiliLivePageInfo {
  live_room?: BiliPageInfoUnit;
  live_user?: BiliPageInfoUnit;
  [key: string]: BiliPageInfoUnit | undefined;
}

export interface BiliPageInfoUnit {
  numResults?: number;
  pages?: number;
  total?: number;
  numPages?: number;
}

export interface RawBiliSearchItem {
  type?: string;
  id?: number | string;
  aid?: number | string;
  bvid?: string;
  title?: string;
  description?: string;
  desc?: string;
  author?: string;
  mid?: number | string;
  uid?: number | string;
  uname?: string;
  arcurl?: string;
  url?: string;
  goto_url?: string;
  pic?: string;
  cover?: string;
  user_cover?: string;
  uface?: string;
  upic?: string;
  play?: number | string;
  video_review?: number | string;
  danmaku?: number | string;
  favorites?: number | string;
  review?: number | string;
  reply?: number | string;
  like?: number | string;
  view?: number | string;
  pubdate?: number | string;
  senddate?: number | string;
  pub_time?: number | string;
  pubtime?: number | string;
  duration?: string;
  rank_index?: number | string;
  rank_offset?: number | string;
  media_id?: number | string;
  season_id?: number | string;
  pgc_season_id?: number | string;
  season_type?: number | string;
  season_type_name?: string;
  org_title?: string;
  areas?: string;
  styles?: string;
  staff?: string;
  cv?: string;
  eps?: unknown[];
  media_score?: { score?: number | string; user_count?: number | string };
  roomid?: number | string;
  short_id?: number | string;
  area?: string;
  cate_name?: string;
  tags?: string;
  live_status?: number | string;
  is_live?: number | string;
  live_time?: string;
  online?: number | string;
  attentions?: number | string;
  watched_show?: { text_small?: string; text_large?: string; text?: string };
  category_id?: number | string;
  category_name?: string;
  image_urls?: string[];
  fans?: number | string;
  videos?: number | string;
  level?: number | string;
  gender?: string | number;
  usign?: string;
  is_upuser?: number | boolean;
  room_id?: number | string;
  official_verify?: unknown;
  verify_info?: string;
  hit_columns?: string[];
  res?: unknown[];
  [key: string]: unknown;
}

export interface BiliItemRank {
  index: number | null;
  offset: number | null;
}

export interface BiliItemStats {
  play?: number;
  danmaku?: number;
  favorite?: number;
  comment?: number;
  like?: number;
  view?: number;
  reply?: number;
  online?: number;
  attentions?: number;
  fans?: number;
  videos?: number;
}

export interface BiliSearchItem {
  itemType: BiliNormalizedItemType;
  dedupeKey: string;
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  cover: string | null;
  author: {
    id: string | null;
    name: string | null;
    avatar: string | null;
  };
  stats: BiliItemStats;
  publishedAt: string | null;
  duration: string | null;
  rank: BiliItemRank;
  extra: Record<string, unknown>;
}

export interface BiliFetchedPage {
  page: number;
  dynamicOffset: number | null;
  returnedCount: number;
  addedCount: number;
  duplicateCount: number;
  totalResults: number | null;
  totalPages: number | null;
  livePageInfo?: BiliLivePageInfo;
}

export interface BiliSearchResult {
  keyword: string;
  kind: BiliSearchKind;
  qvId: string;
  query: {
    page: number;
    maxPages: number;
    pageSize: number;
    order: string | null;
    pubtimeBeginS: number;
    pubtimeEndS: number;
    duration: string | null;
    tids: string | null;
    categoryId: number | null;
    orderSort: 0 | 1 | null;
    userType: 0 | 1 | 2 | 3 | null;
    offsetStep: number | null;
  };
  crawledAt: Date;
  totalResults: number | null;
  totalPages: number | null;
  pagesFetched: number;
  duplicateCount: number;
  returnedCount: number;
  items: BiliSearchItem[];
  pages: BiliFetchedPage[];
  livePageInfo?: BiliLivePageInfo;
}

export type { BiliSearchAiReady } from "@src/projections/search.ai-ready";
import type { BiliSearchAiReady as _AiReady } from "@src/projections/search.ai-ready";

/** 对外投影 = AI-Ready 信封（meta + insights + items） */
export type BiliSearchProjected = _AiReady;
