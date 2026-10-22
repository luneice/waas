/**
 * 批量截面扫描 —— AI-Ready 信封
 *
 * `meta.columns` 是**必须回显**的字段：响应 `d` 是位置数组，请求侧的 columns
 * 顺序是消费方还原字段名的唯一依据。
 */

import { isoTime } from "@src/projections/envelope";
import { ID_NAMESPACES, producerMeta } from "@src/projections/id-namespace";
import type { TvScanResult, TvScanRow } from "@src/types/scan.types";
import type {
  TvScanItemProjected,
  TvScanMeta,
  TvScanProjected,
} from "@src/types/projected.types";

function projectItem(row: TvScanRow): TvScanItemProjected {
  return { ticker: row.ticker, values: row.values };
}

function buildScanInsights(
  items: TvScanItemProjected[],
  result: TvScanResult,
): string[] {
  const out: string[] = [];
  const q = result.query;

  if (items.length === 0) {
    out.push(
      `当前条件在「${q.market}」扫描域下没有返回任何行。` +
        `常见原因：① 传入的标的不在该扫描域的索引内（如宏观美联储口径需改用 tv-history/tv-quote）；` +
        `② filter 条件过窄；③ market 选错（当前 ${q.market}）。`,
    );
  } else {
    out.push(
      `「${q.market}」扫描域返回 ${items.length} 行` +
        `（上游命中总数 ${result.totalCount}，本次取 range=[${q.range[0]}, ${q.range[1]}]）。`,
    );
    out.push(
      `返回字段（顺序即上游位置数组的解码键）：${q.columns.join(" / ")}。`,
    );
  }

  // 被丢弃的标的必须显式告知，否则消费方以为"查了但没数据"
  if (result.droppedTickers.length > 0) {
    out.push(
      `⚠️ 有 ${result.droppedTickers.length} 个标的因不在截面扫描索引内被跳过：` +
        `${result.droppedTickers.join("、")}。这类标的请改用 tv-history（历史序列）或 tv-quote（最新值）。`,
    );
  }

  if (q.sortBy && items.length > 0) {
    out.push(
      `按 ${q.sortBy} ${q.sortOrder === "asc" ? "升序" : "降序"} 排列，` +
        `首行 ${items[0].ticker}，末行 ${items[items.length - 1].ticker}。`,
    );
  }

  return out;
}

export function projectScanAiReady(result: TvScanResult): TvScanProjected {
  const items = result.rows.map(projectItem);
  const q = result.query;

  const meta: TvScanMeta & {
    skill: string;
    semantics: string;
    crawledAt: string;
  } = {
    skill: "tv-scan",
    semantics:
      `截面扫描快照：「${q.market}」域下 ${items.length} 个标的在 ` +
      `${q.columns.join("/")} 字段上的一次性查询结果（非推送、无历史）`,
    crawledAt: isoTime(result.crawledAt),
    market: q.market,
    columns: q.columns,
    totalCount: result.totalCount,
    returnedCount: items.length,
    range: q.range,
    preset: q.preset,
    sortBy: q.sortBy,
    sortOrder: q.sortOrder,
    droppedTickers: result.droppedTickers,
    ...producerMeta(ID_NAMESPACES.TICKER),
  };

  return { meta, insights: buildScanInsights(items, result), items };
}
