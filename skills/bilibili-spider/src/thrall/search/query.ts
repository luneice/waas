import { BILIBILI_SITE } from "@src/constants";
import type { BiliSearchKind, BiliSearchParams } from "@src/types/search.types";
import type { WbiParams } from "@src/thrall/wbi";

export interface BiliSearchKindConfig {
  pageSize: number;
  adResource: "5654" | "5646";
  defaultOrder: string;
  defaultCategoryId: "" | "0";
  dynamicOffset: boolean;
  pagePath: string;
  includeDuration: boolean;
  includeWebRollPage: boolean;
}

export interface NormalizedBiliSearchParams {
  keyword: string;
  kind: BiliSearchKind;
  page: number;
  maxPages: number;
  pageSize: number;
  order: string;
  pubtimeBeginS: number;
  pubtimeEndS: number;
  duration: string;
  tids: string;
  categoryId: number;
  orderSort: 0 | 1;
  userType: 0 | 1 | 2 | 3;
  offsetStep: number;
  qvId: string;
}

export const SEARCH_KIND_CONFIG: Record<BiliSearchKind, BiliSearchKindConfig> = {
  video: {
    pageSize: 42,
    adResource: "5654",
    defaultOrder: "",
    defaultCategoryId: "",
    dynamicOffset: true,
    pagePath: "video",
    includeDuration: true,
    includeWebRollPage: true,
  },
  media_bangumi: {
    pageSize: 12,
    adResource: "5646",
    defaultOrder: "",
    defaultCategoryId: "",
    dynamicOffset: false,
    pagePath: "bangumi",
    includeDuration: true,
    includeWebRollPage: false,
  },
  media_ft: {
    pageSize: 12,
    adResource: "5646",
    defaultOrder: "",
    defaultCategoryId: "",
    dynamicOffset: false,
    pagePath: "pgc",
    includeDuration: true,
    includeWebRollPage: false,
  },
  live: {
    pageSize: 42,
    adResource: "5646",
    defaultOrder: "online",
    defaultCategoryId: "",
    dynamicOffset: true,
    pagePath: "live",
    includeDuration: true,
    includeWebRollPage: false,
  },
  article: {
    pageSize: 20,
    adResource: "5646",
    defaultOrder: "totalrank",
    defaultCategoryId: "0",
    dynamicOffset: false,
    pagePath: "article",
    includeDuration: true,
    includeWebRollPage: false,
  },
  bili_user: {
    pageSize: 36,
    adResource: "5646",
    defaultOrder: "",
    defaultCategoryId: "",
    dynamicOffset: true,
    pagePath: "upuser",
    includeDuration: true,
    includeWebRollPage: false,
  },
};

export const SEARCH_KIND_ALIASES: Record<string, BiliSearchKind> = {
  video: "video",
  bangumi: "media_bangumi",
  media_bangumi: "media_bangumi",
  pgc: "media_ft",
  media_ft: "media_ft",
  live: "live",
  article: "article",
  upuser: "bili_user",
  bili_user: "bili_user",
};

export function canonicalSearchKind(value: unknown): BiliSearchKind | null {
  const raw = String(value ?? "video").trim();
  if (!raw) return "video";
  return SEARCH_KIND_ALIASES[raw] ?? null;
}

export function isDynamicOffsetKind(kind: BiliSearchKind): boolean {
  return SEARCH_KIND_CONFIG[kind].dynamicOffset;
}

export function pageToDynamicOffset(
  page: number,
  offsetStep: number,
): number {
  return Math.max(0, page - 1) * offsetStep;
}

export function dynamicOffsetToPage(
  dynamicOffset: number,
  offsetStep: number,
): number {
  return Math.floor(dynamicOffset / offsetStep) + 1;
}

export function buildSearchApiParams(
  params: NormalizedBiliSearchParams,
  page: number,
): WbiParams {
  const config = SEARCH_KIND_CONFIG[params.kind];
  const base: WbiParams = {
    category_id:
      params.kind === "article" ? String(params.categoryId) : config.defaultCategoryId,
    search_type: params.kind,
    ad_resource: config.adResource,
    __refresh__: "true",
    _extra: "",
    context: "",
    page,
    page_size: params.pageSize,
    order: params.order,
    pubtime_begin_s: params.pubtimeBeginS,
    pubtime_end_s: params.pubtimeEndS,
    from_spmid: "333.337",
    platform: "pc",
    highlight: 1,
    single_column: 0,
    keyword: params.keyword,
    qv_id: params.qvId,
    source_tag: 3,
    gaia_vtoken: "",
    web_location: 1430654,
  };

  if (config.includeDuration) {
    base.duration = params.duration;
  }

  if (params.kind === "video") {
    base.dynamic_offset = pageToDynamicOffset(page, params.offsetStep);
    base.web_roll_page = 1;
    if (params.tids) base.tids = params.tids;
  }

  if (params.kind === "live") {
    base.dynamic_offset = pageToDynamicOffset(page, params.offsetStep);
  }

  if (params.kind === "bili_user") {
    base.order_sort = params.orderSort;
    base.user_type = params.userType;
    base.dynamic_offset = pageToDynamicOffset(page, params.offsetStep);
  }

  return base;
}

export function buildSearchReferer(
  params: Pick<
    NormalizedBiliSearchParams,
    "kind" | "keyword" | "order" | "orderSort"
  >,
  page: number,
  dynamicOffset: number | null,
): string {
  const config = SEARCH_KIND_CONFIG[params.kind];
  const url = new URL(`/${config.pagePath}`, BILIBILI_SITE);
  url.searchParams.set("keyword", params.keyword);

  if (page > 1) url.searchParams.set("page", String(page));
  if (dynamicOffset !== null && dynamicOffset > 0) {
    url.searchParams.set("o", String(dynamicOffset));
  }
  if (params.order) url.searchParams.set("order", params.order);
  if (params.kind === "bili_user" && params.orderSort === 1) {
    url.searchParams.set("order_sort", "1");
  }

  return url.toString();
}

export function buildQueryEcho(params: NormalizedBiliSearchParams) {
  return {
    page: params.page,
    maxPages: params.maxPages,
    pageSize: params.pageSize,
    order: params.order || null,
    pubtimeBeginS: params.pubtimeBeginS,
    pubtimeEndS: params.pubtimeEndS,
    duration: params.duration || null,
    tids: params.tids || null,
    categoryId: params.kind === "article" ? params.categoryId : null,
    orderSort: params.kind === "bili_user" ? params.orderSort : null,
    userType: params.kind === "bili_user" ? params.userType : null,
    offsetStep: isDynamicOffsetKind(params.kind) ? params.offsetStep : null,
  };
}

export function normalizeSearchNumbers(
  params: BiliSearchParams,
  kind: BiliSearchKind,
  qvId: string,
): NormalizedBiliSearchParams {
  const config = SEARCH_KIND_CONFIG[kind];
  return {
    keyword: params.keyword.trim(),
    kind,
    page: Math.floor(Number(params.page ?? 1)),
    maxPages: Math.floor(Number(params.maxPages ?? 1)),
    pageSize: Math.floor(Number(params.pageSize ?? config.pageSize)),
    order: String(params.order ?? config.defaultOrder),
    pubtimeBeginS: Math.floor(Number(params.pubtimeBeginS ?? 0)),
    pubtimeEndS: Math.floor(Number(params.pubtimeEndS ?? 0)),
    duration:
      params.duration === undefined || params.duration === null
        ? ""
        : String(params.duration),
    tids:
      params.tids === undefined || params.tids === null
        ? ""
        : String(params.tids),
    categoryId: Math.floor(Number(params.categoryId ?? 0)),
    orderSort: Number(params.orderSort ?? 0) === 1 ? 1 : 0,
    userType: normalizeUserType(params.userType),
    offsetStep: Math.floor(Number(params.offsetStep ?? 24)),
    qvId,
  };
}

function normalizeUserType(value: unknown): 0 | 1 | 2 | 3 {
  const n = Math.floor(Number(value ?? 0));
  return n === 1 || n === 2 || n === 3 ? n : 0;
}
