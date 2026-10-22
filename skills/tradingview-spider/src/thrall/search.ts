/**
 * 标的检索 Goal
 *
 * GET symbol_search/v3/ —— 按关键词检索全球标的。
 *
 * ══════════════ 为什么用 @Expanded 而不是 @Paginated ══════════════
 *
 * 上游用 `start` 偏移翻页（步长 50），页数完全由入参 `maxPages` 决定。
 * `@Paginated` 的 `stopWhen(response, page, accumulated)` **拿不到 ctx**，
 * 因此无法读取用户传的 `maxPages`；装饰器选项又在类定义期求值，也读不到入参。
 *
 * 曾经的写法是「装饰器给硬上限 20 + aggregate 里按 maxPages 裁剪」——
 * **实测证明这是错的**：用户传 maxPages=1 时上游被打了 20 次请求，
 * 而输出的 pagesFetched 因为裁剪过仍显示 1，从结果完全看不出来。
 * 白白多打 19 次请求，既浪费也容易触发风控。
 *
 * 改用 `@Expanded`：页号数组由 `buildPageNumbers()` 从入参算出，
 * 要几页就发几次，精确可控（同 bilibili search 的做法）。
 * 代价是失去 `stopWhen` 的提前终止，故 `aggregate` 里按「上游剩余数为 0」
 * 判定 hasMore —— 多取的空页不会产生脏数据，只是浪费一次请求，
 * 而用户显式指定页数时这是可接受的。
 */
import { BaseGoal, Goal, Endpoint, Expanded, Aggregate } from "@spider/core";
import type { GoalContext } from "@spider/core";
import { TV_SYMBOL_SEARCH_ENDPOINT } from "@src/constants";
import { TV_SEARCH_GOAL_DEFAULTS, SEARCH_PAGE_SIZE } from "@src/thrall/shared";
import type {
  RawSymbolSearchItem,
  RawSymbolSearchResponse,
  TvListingRef,
  TvSearchResult,
  TvSymbolHit,
} from "@src/types/search.types";

/**
 * 剥离检索高亮标记。
 *
 * 上游在 `hl=1` 时用 `<em>` 包裹命中片段（如 `<em>SOFR</em>`）。`hl=1` 是 HAR
 * 实测的既有行为，改成 0 未经验证；与其依赖未验证参数，不如剥离已验证产物。
 */
function stripHighlight(s: string | undefined | null): string {
  if (!s) return "";
  return s.replace(/<\/?em>/g, "");
}

/** 拼接 ticker：交易所前缀 + 代码 */
function toTicker(item: RawSymbolSearchItem): string {
  const exchange = stripHighlight(item.exchange);
  const symbol = stripHighlight(item.symbol);
  return exchange ? `${exchange}:${symbol}` : symbol;
}

function toListingRef(item: RawSymbolSearchItem): TvListingRef {
  return {
    ticker: toTicker(item),
    exchange: stripHighlight(item.exchange),
    currency: item.currency_code ?? null,
    country: item.country ?? null,
  };
}

/** Raw → 领域对象：显式枚举字段，禁止 spread（§3.5） */
function toHit(item: RawSymbolSearchItem): TvSymbolHit {
  return {
    ticker: toTicker(item),
    code: stripHighlight(item.symbol),
    exchange: stripHighlight(item.exchange),
    description: stripHighlight(item.description),
    assetType: item.type ?? "",
    typespecs: Array.isArray(item.typespecs) ? item.typespecs : [],
    country: item.country ?? null,
    currency: item.currency_code ?? null,
    isin: item.isin ?? null,
    isPrimaryListing: item.is_primary_listing ?? null,
    economicCategory: item.economic_category?.name ?? null,
    alsoListedOn: Array.isArray(item.grouped_symbols)
      ? item.grouped_symbols.map(toListingRef)
      : [],
  };
}

/** 入参形状（由 Skill 的 normalizeParams 保证已归一） */
export interface SearchGoalParams extends Record<string, unknown> {
  text: string;
  searchType: string | null;
  exchange: string | null;
  lang: string;
  sortByCountry: string;
  start: number;
  maxPages: number;
  grouping: boolean;
}

/**
 * 由 start + maxPages 生成要抓取的偏移量数组（@Expanded 的 source）。
 *
 * `Number.isFinite` 兜底不可省：`Math.max(1, Math.floor(NaN))` 结果仍是 `NaN`，
 * 而 `Array.from({length: NaN})` 得到空数组 —— 一次请求都不发、静默返回空结果，
 * 是最难排查的一种失败。Skill 层虽已归一，但 Goal 不该依赖上游的清洗。
 */
export function buildStartOffsets(p: SearchGoalParams): number[] {
  const rawCount = Math.floor(Number(p.maxPages));
  const count = Number.isFinite(rawCount) ? Math.max(1, rawCount) : 1;
  const rawBase = Math.floor(Number(p.start));
  const base = Number.isFinite(rawBase) ? Math.max(0, rawBase) : 0;
  return Array.from({ length: count }, (_, i) => base + i * SEARCH_PAGE_SIZE);
}

/** 单页结果：业务数据 + 该页元信息（端点方法体是无 this 调用，不能用实例字段暂存） */
interface SearchPage {
  offset: number;
  remaining: number;
  hits: TvSymbolHit[];
}

@Goal({
  id: "tv-search",
  name: "标的检索",
  defaults: TV_SEARCH_GOAL_DEFAULTS,
})
export class SymbolSearchGoal extends BaseGoal<
  TvSearchResult,
  SearchGoalParams
> {
  @Endpoint(TV_SYMBOL_SEARCH_ENDPOINT, { method: "GET" })
  @Expanded<number, SearchPage>({
    source: (ctx) => buildStartOffsets(ctx.params as SearchGoalParams),
    params: (offset, _index, ctx) => {
      const p = ctx.params as SearchGoalParams;
      return {
        text: p.text,
        hl: 1,
        exchange: p.exchange ?? "",
        lang: p.lang,
        // 上游用字面量 "undefined" 表示不限类型（HAR 实测），非笔误
        search_type: p.searchType ?? "undefined",
        domain: "production",
        enable_grouping: p.grouping,
        sort_by_country: p.sortByCountry,
        promo: true,
        ...(offset > 0 ? { start: offset } : {}),
      };
    },
    // 串行翻页：检索接口无需并发，降低风控风险
    concurrency: 1,
  })
  fetchPage(response: RawSymbolSearchResponse, offset: number): SearchPage {
    const batch = Array.isArray(response?.symbols) ? response.symbols : [];
    return {
      offset,
      remaining: response?.symbols_remaining ?? 0,
      hits: batch.map(toHit),
    };
  }

  @Aggregate()
  aggregate(ctx: GoalContext<SearchGoalParams>): TvSearchResult {
    const p = ctx.params;
    const pages = ctx.get<SearchPage[]>("fetchPage") ?? [];

    // 翻页窗口可能重叠，按 ticker 去重（保序）
    const seen = new Set<string>();
    const hits: TvSymbolHit[] = [];
    for (const page of pages) {
      for (const h of page.hits) {
        if (h.ticker && !seen.has(h.ticker)) {
          seen.add(h.ticker);
          hits.push(h);
        }
      }
    }

    // 剩余数以最后一页的口径为准（@Expanded 保证结果与 source 同序）
    const last = pages.length > 0 ? pages[pages.length - 1] : null;
    const remaining = last?.remaining ?? 0;

    return {
      query: {
        text: p.text,
        searchType: p.searchType,
        exchange: p.exchange,
        lang: p.lang,
        start: p.start,
        maxPages: p.maxPages,
        grouping: p.grouping,
      },
      hits,
      pagesFetched: pages.length,
      remaining,
      hasMore: remaining > 0,
      nextStart: p.start + pages.length * SEARCH_PAGE_SIZE,
      crawledAt: new Date(),
    };
  }
}
