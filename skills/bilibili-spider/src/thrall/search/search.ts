/**
 * Goal: Bilibili 搜索（GET `/x/web-interface/wbi/search/type`）
 *
 * 声明式实现，对齐 xhs-spider 的 Goal 范式：
 *   - `@Endpoint fetchNav`                → 取 WBI imgKey/subKey
 *   - `@Endpoint @Expanded fetchSearchPages` → 按 page+maxPages 生成页号数组，
 *      逐页（concurrency=1）请求并 WBI 签名；每页产出 BiliSearchPageResult
 *   - `@Aggregate aggregate`              → 跨页归一化 + dedupeKey 去重，组装结果
 *
 * 替代了上一版手写命令式循环 `services/search-runner.ts`。
 * 默认 maxPages=1，常规调用只发一次搜索请求；用户显式翻页时按主键去重。
 */
import {
  Aggregate,
  BaseGoal,
  Endpoint,
  Expanded,
  Goal,
  UpstreamShapeChangedError,
  type GoalContext,
} from "@spider/core";
import { BILIBILI_API_BASE } from "@src/constants";
import { BILI_GOAL_DEFAULTS } from "@src/thrall/shared";
import {
  buildQueryEcho,
  buildSearchApiParams,
  isDynamicOffsetKind,
  pageToDynamicOffset,
} from "@src/thrall/search/query";
import type { NormalizedBiliSearchParams } from "@src/thrall/search/query";
import {
  extractSearchPage,
  normalizeRawItem,
} from "@src/thrall/search/normalizer";
import { extractWbiKey, signWbiParams, type WbiKeys } from "@src/thrall/wbi";
import type {
  BiliApiResponse,
  BiliFetchedPage,
  BiliLivePageInfo,
  BiliSearchItem,
  BiliSearchResult,
  RawBiliSearchData,
} from "@src/types/search.types";

export interface BiliSearchGoalParams
  extends NormalizedBiliSearchParams,
    Record<string, unknown> {}

/** 单页原始搜索响应 + 其页号（@Expanded 方法体产物，交给 aggregate 解析）。 */
interface BiliRawSearchPage {
  sourcePage: number;
  data: RawBiliSearchData;
}

interface WbiNavData {
  wbi_img?: {
    img_url?: string;
    sub_url?: string;
  };
}

/** 由 page + maxPages 生成要抓取的页号数组（@Expanded 的 source）。 */
function buildPageNumbers(params: BiliSearchGoalParams): number[] {
  const start = Math.max(1, Math.floor(Number(params.page ?? 1)));
  const count = Math.max(1, Math.floor(Number(params.maxPages ?? 1)));
  return Array.from({ length: count }, (_, i) => start + i);
}

@Goal({
  id: "bili-search",
  name: "Bilibili 搜索",
  baseURL: BILIBILI_API_BASE,
  defaults: BILI_GOAL_DEFAULTS,
})
export class BiliSearchGoal extends BaseGoal<
  BiliSearchResult,
  BiliSearchGoalParams
> {
  @Endpoint("/x/web-interface/nav", { method: "GET" })
  fetchNav(response: BiliApiResponse<WbiNavData>): WbiKeys {
    const imgUrl = response?.data?.wbi_img?.img_url;
    const subUrl = response?.data?.wbi_img?.sub_url;
    if (!imgUrl || !subUrl) {
      throw new UpstreamShapeChangedError(
        "Bilibili nav response missing data.wbi_img.{img_url,sub_url}",
        {
          scope: "bili-search",
          details: { code: response?.code, message: response?.message },
        },
      );
    }
    return { imgKey: extractWbiKey(imgUrl), subKey: extractWbiKey(subUrl) };
  }

  @Endpoint("/x/web-interface/wbi/search/type", {
    method: "GET",
    dependencies: ["fetchNav"],
  })
  @Expanded<number, BiliRawSearchPage>({
    dependencies: ["fetchNav"],
    source: (ctx) => buildPageNumbers(ctx.params as BiliSearchGoalParams),
    params: (pageNum, _index, ctx) => {
      const params = ctx.params as BiliSearchGoalParams;
      return signWbiParams(
        buildSearchApiParams(params, pageNum),
        ctx.get<WbiKeys>("fetchNav"),
      );
    },
    concurrency: 1,
  })
  fetchSearchPages(
    response: BiliApiResponse<RawBiliSearchData>,
    sourcePage: number,
  ): BiliRawSearchPage {
    if (response.code !== 0) {
      throw new UpstreamShapeChangedError(
        `Bilibili search API returned code=${response.code} message=${response.message ?? response.msg ?? ""}`,
        {
          scope: "bili-search",
          details: {
            code: response.code,
            message: response.message ?? response.msg,
          },
        },
      );
    }
    if (!response.data || typeof response.data !== "object") {
      throw new UpstreamShapeChangedError(
        "Bilibili search API response missing data object",
        { scope: "bili-search" },
      );
    }
    return { sourcePage, data: response.data };
  }

  @Aggregate()
  aggregate(ctx: GoalContext<BiliSearchGoalParams>): BiliSearchResult {
    const params = ctx.params;
    const rawPages = ctx.get<BiliRawSearchPage[]>("fetchSearchPages");

    const seen = new Set<string>();
    const items: BiliSearchItem[] = [];
    const pages: BiliFetchedPage[] = [];
    let duplicateCount = 0;
    let totalResults: number | null = null;
    let totalPages: number | null = null;
    let livePageInfo: BiliLivePageInfo | undefined;

    for (const { sourcePage, data } of rawPages) {
      const extracted = extractSearchPage(params.kind, data);
      const dynamicOffset = isDynamicOffsetKind(params.kind)
        ? pageToDynamicOffset(sourcePage, params.offsetStep)
        : null;

      totalResults = extracted.totalResults;
      totalPages = extracted.totalPages;
      if (extracted.livePageInfo) livePageInfo = extracted.livePageInfo;

      let addedCount = 0;
      let pageDuplicateCount = 0;
      for (const raw of extracted.items) {
        const item = normalizeRawItem(params.kind, raw);
        if (!item) continue;
        if (seen.has(item.dedupeKey)) {
          duplicateCount += 1;
          pageDuplicateCount += 1;
          continue;
        }
        seen.add(item.dedupeKey);
        items.push(item);
        addedCount += 1;
      }

      pages.push({
        page: sourcePage,
        dynamicOffset,
        returnedCount: extracted.items.length,
        addedCount,
        duplicateCount: pageDuplicateCount,
        totalResults: extracted.totalResults,
        totalPages: extracted.totalPages,
        livePageInfo: extracted.livePageInfo,
      });
    }

    return {
      keyword: params.keyword,
      kind: params.kind,
      qvId: params.qvId,
      query: buildQueryEcho(params),
      crawledAt: new Date(),
      totalResults,
      totalPages,
      pagesFetched: pages.length,
      duplicateCount,
      returnedCount: items.length,
      items,
      pages,
      livePageInfo,
    };
  }
}
