/**
 * 指标目录 Goal
 *
 * GET pine-facade/list?filter=<分组> —— 拉取某分组的全部指标条目。
 *
 * ══════════════ 为什么用 @Expanded 承载「多分组」 ══════════════
 *
 * 上游一次只能查一个 `filter`，而用户往往想「在常规指标 + K线形态里一起找」。
 * 分组清单由入参决定（`categories`），因此走 `@Expanded` 从入参算出请求数量
 * ——要几个分组发几次，与 tv-search 的 offset 数组同一手法。
 *
 * 不用 `@Paginated`：这个接口**没有分页**，一次返回该分组全量（standard 145 条、
 * fundamental 1442 条），分页机制在这里没有对应物。
 *
 * ══════════════ 关键词过滤为什么在本地做 ══════════════
 *
 * 实测上游**没有关键词搜索参数**：`list` 只认 `filter`（分组），
 * 前端「搜指标」是把整个分组拉到浏览器里做本地过滤（见 docs §8.2）。
 * 所以这里也只能拉全量再本地筛 —— 这不是偷懒，是上游能力的边界。
 * 好在单分组体量可控（最大 1442 条 / 713KB），一次请求即可。
 */
import { BaseGoal, Goal, Endpoint, Expanded, Aggregate } from "@spider/core";
import type { GoalContext } from "@spider/core";
import { TV_PINE_FACADE_HOST } from "@src/constants";
import { TV_PINE_GOAL_DEFAULTS } from "@src/thrall/shared";
import type {
  RawPineListItem,
  TvStudyAccess,
  TvStudyCatalogItem,
  TvStudyCatalogResult,
} from "@src/types/indicator.types";

/**
 * `scriptAccess` → 免费/付费判定。
 *
 * 实测只见过两种取值，但**刻意不做穷举断言**：上游随时可能新增
 * （如 `open_with_auth`），遇到未知值归为 `unknown` 而非猜测，
 * 由投影层在 insights 里如实告知「权限未知」。
 */
function toAccess(raw: string | undefined): TvStudyAccess {
  if (raw === "open_no_auth") return "free";
  if (raw === "closed_no_auth") return "restricted";
  return "unknown";
}

/**
 * 上游 `scriptIdPart` 的空格转义还原。
 *
 * 上游用 `%1` 表示空格、`%25` 表示百分号（如 `Bars%1Up%1Dn%1Strategy`
 * = "Bars Up Dn Strategy"、`24h%25Volume` = "24h%Volume"）。
 * 这里只做**展示用**的还原，`pineId` 字段仍保留上游原值
 * —— 因为下游 translate 请求必须用原值（§3.5 上游 ID 不透明原则）。
 */
function humanizePineId(pineId: string): string {
  return pineId.replace(/%25/g, "%").replace(/%1/g, " ");
}

/** 从 extra.stats 汇总输出通道数（各类 plot 之和） */
function toPlotCount(stats: Record<string, number> | undefined): number | null {
  if (!stats || typeof stats !== "object") return null;
  let sum = 0;
  let seen = false;
  for (const v of Object.values(stats)) {
    if (Number.isFinite(v)) {
      sum += Number(v);
      seen = true;
    }
  }
  return seen ? sum : null;
}

/** Raw → 领域对象：显式枚举字段，禁止 spread（§3.5） */
function toCatalogItem(
  raw: RawPineListItem,
  category: string,
): TvStudyCatalogItem | null {
  const pineId = typeof raw.scriptIdPart === "string" ? raw.scriptIdPart : "";
  if (!pineId) return null;

  const extra = raw.extra ?? {};
  return {
    pineId,
    // 上游 scriptName 已是可读名；缺失时退回 pineId 的转义还原
    name: raw.scriptName?.trim() || humanizePineId(pineId),
    shortName: extra.shortDescription ?? null,
    version: typeof raw.version === "string" ? raw.version : "",
    access: toAccess(raw.scriptAccess),
    accessRaw: raw.scriptAccess ?? null,
    kind: extra.kind ?? null,
    isPriceStudy: typeof extra.is_price_study === "boolean" ? extra.is_price_study : null,
    plotCount: toPlotCount(extra.stats),
    category,
    fundamentalCategory: extra.fundamentalCategory ?? null,
    financialPeriod: extra.financialPeriod ?? null,
    tags: Array.isArray(extra.tags) ? extra.tags.filter((t): t is string => typeof t === "string") : [],
  };
}

export interface StudyCatalogGoalParams extends Record<string, unknown> {
  categories: string[];
  keyword: string | null;
  accessFilter: string | null;
  kind: string | null;
  limit: number;
}

/** 单分组的抓取结果（端点方法体无 this，元信息只能塞返回值） */
interface CatalogPage {
  category: string;
  items: TvStudyCatalogItem[];
}

@Goal({
  id: "tv-indicator-list",
  name: "指标目录",
  baseURL: TV_PINE_FACADE_HOST,
  defaults: TV_PINE_GOAL_DEFAULTS,
})
export class StudyCatalogGoal extends BaseGoal<
  TvStudyCatalogResult,
  StudyCatalogGoalParams
> {
  @Endpoint("/pine-facade/list", { method: "GET" })
  @Expanded<string, CatalogPage>({
    source: (ctx) => (ctx.params as StudyCatalogGoalParams).categories,
    params: (category) => ({ filter: category }),
    // 串行：分组数很少（≤4），并发收益为零而风控风险实在
    concurrency: 1,
  })
  fetchCategory(response: RawPineListItem[], category: string): CatalogPage {
    const list = Array.isArray(response) ? response : [];
    const items: TvStudyCatalogItem[] = [];
    for (const raw of list) {
      const item = toCatalogItem(raw, category);
      if (item) items.push(item);
    }
    return { category, items };
  }

  @Aggregate()
  aggregate(ctx: GoalContext<StudyCatalogGoalParams>): TvStudyCatalogResult {
    const p = ctx.params;
    const pages = ctx.get<CatalogPage[]>("fetchCategory") ?? [];

    const categoryCounts: Record<string, number> = {};
    const all: TvStudyCatalogItem[] = [];
    const seen = new Set<string>();

    for (const page of pages) {
      categoryCounts[page.category] = page.items.length;
      for (const it of page.items) {
        // 同一 pineId 理论上不跨分组，但去重成本近零、防御收益明确
        const key = `${it.pineId}@${it.version}`;
        if (seen.has(key)) continue;
        seen.add(key);
        all.push(it);
      }
    }

    // ── 本地过滤（上游无关键词搜索能力，原因见文件头）──
    const kw = p.keyword?.toLowerCase() ?? null;
    const filtered = all.filter((it) => {
      if (p.accessFilter && it.access !== p.accessFilter) return false;
      if (p.kind && it.kind !== p.kind) return false;
      if (!kw) return true;
      // 名称、简称、pineId（含转义还原后的形态）、标签都参与匹配
      return (
        it.name.toLowerCase().includes(kw) ||
        (it.shortName?.toLowerCase().includes(kw) ?? false) ||
        it.pineId.toLowerCase().includes(kw) ||
        humanizePineId(it.pineId).toLowerCase().includes(kw) ||
        it.tags.some((t) => t.toLowerCase().includes(kw))
      );
    });

    // 免费优先、再按名称排序 —— 免费的能直接用，排前面对 Agent 更友好
    filtered.sort((a, b) => {
      const rank = (x: TvStudyCatalogItem) => (x.access === "free" ? 0 : 1);
      const d = rank(a) - rank(b);
      return d !== 0 ? d : a.name.localeCompare(b.name);
    });

    const items = filtered.slice(0, p.limit);

    return {
      query: {
        categories: p.categories,
        keyword: p.keyword,
        accessFilter: p.accessFilter,
        kind: p.kind,
        limit: p.limit,
      },
      items,
      categoryCounts,
      totalBeforeFilter: all.length,
      truncatedCount: Math.max(0, filtered.length - items.length),
      crawledAt: new Date(),
    };
  }
}
