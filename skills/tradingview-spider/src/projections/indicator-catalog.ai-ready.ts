/**
 * 指标目录 —— AI-Ready 信封
 *
 * insights 的核心职责是**把免费/付费边界讲清**：上游 1600+ 条指标里有 1442 条
 * （基本面分组全部）需要付费权限，Agent 如果不知道这点，会反复挑到付费指标
 * 然后在 tv-indicator 那一步失败。
 */

import { isoTime } from "@src/projections/envelope";
import { ID_NAMESPACES, producerMeta } from "@src/projections/id-namespace";
import type {
  TvStudyCatalogItem,
  TvStudyCatalogResult,
} from "@src/types/indicator.types";
import type {
  TvStudyCatalogItemProjected,
  TvStudyCatalogMeta,
  TvStudyCatalogProjected,
} from "@src/types/projected.types";

/** 显式枚举字段，禁止 spread（§3.5） */
function projectItem(item: TvStudyCatalogItem): TvStudyCatalogItemProjected {
  return {
    pineId: item.pineId,
    name: item.name,
    shortName: item.shortName,
    version: item.version,
    access: item.access,
    kind: item.kind,
    isPriceStudy: item.isPriceStudy,
    plotCount: item.plotCount,
    category: item.category,
    fundamentalCategory: item.fundamentalCategory,
    financialPeriod: item.financialPeriod,
    tags: item.tags,
  };
}

function buildCatalogInsights(
  items: TvStudyCatalogItemProjected[],
  result: TvStudyCatalogResult,
  freeCount: number,
  restrictedCount: number,
): string[] {
  const out: string[] = [];
  const q = result.query;

  if (items.length === 0) {
    const scope = q.keyword ? `关键词「${q.keyword}」` : "当前筛选条件";
    out.push(
      `${scope}在 ${q.categories.join(" / ")} 分组的 ${result.totalBeforeFilter} 条指标中无匹配。` +
        `建议：① 换更短的关键词（匹配指标英文名/简称，如 RSI、MACD、Aroon）；` +
        `② 去掉 keyword 先浏览全量；③ 若找基本面科目请把 categories 设为 ["fundamental"]。`,
    );
    return out;
  }

  const countDesc = Object.entries(result.categoryCounts)
    .map(([c, n]) => `${c} ${n} 条`)
    .join("、");
  out.push(
    `从 ${countDesc}（共 ${result.totalBeforeFilter} 条）中筛出 ${items.length} 条` +
      `${q.keyword ? `（关键词「${q.keyword}」）` : ""}。`,
  );

  // 免费/付费分布 —— 这是 Agent 挑指标时最需要先知道的
  if (restrictedCount > 0) {
    out.push(
      `其中 ${freeCount} 条免费可直接用（access=free），` +
        `${restrictedCount} 条需付费权限（access=restricted）—— ` +
        `付费指标能否取到数据**未经验证**，建议优先选 free 的。`,
    );
  } else if (freeCount > 0) {
    out.push(`全部 ${freeCount} 条均为免费指标（access=free），可直接投给 tv-indicator。`);
  }

  // 列出前若干条免费指标，Agent 常常直接从这里挑
  const freeItems = items.filter((i) => i.access === "free").slice(0, 8);
  if (freeItems.length > 0) {
    out.push(
      `可直接使用的指标（pineId → 名称）：` +
        freeItems.map((i) => `${i.pineId} → ${i.name}`).join("；") +
        (items.filter((i) => i.access === "free").length > freeItems.length ? " 等" : "") +
        "。",
    );
  }

  // 主图/副图分布对绘图与解读有意义
  const priceStudies = items.filter((i) => i.isPriceStudy === true).length;
  if (priceStudies > 0 && priceStudies < items.length) {
    out.push(
      `${priceStudies} 条为主图叠加型（isPriceStudy=true，与价格同轴，如均线），` +
        `其余为独立副图型（如 RSI/MACD，量纲与价格无关）。`,
    );
  }

  if (result.truncatedCount > 0) {
    out.push(
      `⚠️ 还有 ${result.truncatedCount} 条符合条件但因 limit(${q.limit}) 未返回。` +
        `请调大 limit 或用更精确的 keyword 收窄。`,
    );
  }

  // 基本面分组的付费事实要单独强调（1442 条全部付费，最容易白跑）
  if (q.categories.includes("fundamental")) {
    out.push(
      `注意：fundamental 分组（财务科目当指标用）实测**全部需要付费权限**，` +
        `免费账号取不到数据。想要基本面数值可改用 tv-scan 的财务类 columns。`,
    );
  }

  out.push(
    `下一步：把 items[].pineId 传给 tv-indicator 取该指标在具体标的上的数值序列。`,
  );

  return out;
}

export function projectStudyCatalogAiReady(
  result: TvStudyCatalogResult,
): TvStudyCatalogProjected {
  const items = result.items.map(projectItem);
  const freeCount = items.filter((i) => i.access === "free").length;
  const restrictedCount = items.filter((i) => i.access === "restricted").length;

  const meta: TvStudyCatalogMeta & {
    skill: string;
    semantics: string;
    crawledAt: string;
  } = {
    skill: "tv-indicator-list",
    semantics:
      `技术指标目录：按分组拉取后本地关键词过滤的结果（上游无关键词搜索能力）；` +
      `access=free 可直接使用，restricted 需付费权限`,
    crawledAt: isoTime(result.crawledAt),
    categories: result.query.categories,
    keyword: result.query.keyword,
    accessFilter: result.query.accessFilter,
    kind: result.query.kind,
    categoryCounts: result.categoryCounts,
    totalBeforeFilter: result.totalBeforeFilter,
    returnedCount: items.length,
    truncatedCount: result.truncatedCount,
    freeCount,
    restrictedCount,
    ...producerMeta(ID_NAMESPACES.STUDY_PINE_ID),
  };

  return {
    meta,
    insights: buildCatalogInsights(items, result, freeCount, restrictedCount),
    items,
  };
}
