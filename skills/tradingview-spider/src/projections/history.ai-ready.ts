/**
 * 历史 K 线序列 —— AI-Ready 信封
 *
 * bar 保持紧凑 `{t,o,h,l,c,v}`，**不逐根附 ISO 时间串** —— 5000 根 × 8 标的会
 * 让 payload 翻倍且零信息量。人读锚点由 `meta.barSchema` + `range.fromISO/toISO`
 * + insights 提供。
 *
 * ★ **复权口径是价格字段的前提，不是可选元信息**：同一个 ticker 在不同口径下
 * 历史价位可以差一个数量级（格力 2005 年首根开盘价 splits 口径下是 0.7756，
 * 未复权是 8 元左右）。因此每个 item 都带 `adjustment` 块，且以**服务端回显的
 * 生效值**为准而非请求值 —— 指数/汇率/利率类标的会静默忽略请求的口径，
 * 只回显请求值会让 Agent 以为做了复权。
 */

import {
  ADJUSTMENT_SEMANTICS,
  HISTORY_DEFAULT_ADJUSTMENT,
} from "@src/constants";
import { fromUnixSec, isoTime, pct, toDateStr } from "@src/projections/envelope";
import type { TvHistoryResult, TvSeries } from "@src/types/history.types";
import type {
  TvHistoryItemProjected,
  TvHistoryMeta,
  TvHistoryProjected,
  TvSeriesStats,
} from "@src/types/projected.types";

/** 口径中文说明；上游给了未登记的取值时不编造语义，如实标注 */
function adjustmentSemantics(kind: string | null): string {
  if (kind === null) return "上游未回显复权口径，无法确认";
  return ADJUSTMENT_SEMANTICS[kind] ?? `上游口径 "${kind}"（本包未登记其语义）`;
}

/**
 * 判定请求口径是否被上游采纳。
 *
 * `allowed_adjustment === "none"` 是明确的「该标的无复权概念」信号；
 * 此外只要生效值与请求值不同就算未采纳。上游未回显时不做判定（返回 false），
 * 因为「未回显」不等于「被忽略」，宁可不报也不误报。
 */
function isAdjustmentIgnored(
  requested: string,
  effective: string | null,
  allowed: string | null,
): boolean {
  if (requested === HISTORY_DEFAULT_ADJUSTMENT) return false;
  if (allowed === "none") return true;
  if (effective === null) return false;
  return effective !== requested;
}

function computeStats(series: TvSeries): TvSeriesStats {
  const bars = series.bars;
  if (bars.length === 0) {
    return { first: null, last: null, min: null, max: null, changeAbs: null, changePercent: null };
  }
  const first = bars[0].close;
  const last = bars[bars.length - 1].close;
  let min = bars[0].low;
  let max = bars[0].high;
  for (const b of bars) {
    if (b.low < min) min = b.low;
    if (b.high > max) max = b.high;
  }
  const changeAbs = last - first;
  // 首值为 0 时百分比无意义（除零），给 null 而非 Infinity
  const changePercent = first !== 0 ? (changeAbs / Math.abs(first)) * 100 : null;
  return { first, last, min, max, changeAbs, changePercent };
}

function projectItem(
  series: TvSeries,
  includeBars: boolean,
  requestedAdjustment: string,
): TvHistoryItemProjected {
  const bars = series.bars;
  const effective = series.symbolMeta?.adjustment ?? null;
  const allowed = series.symbolMeta?.allowedAdjustment ?? null;
  const item: TvHistoryItemProjected = {
    ticker: series.ticker,
    resolution: series.resolution,
    status: series.status,
    adjustment: {
      requested: requestedAdjustment,
      effective,
      allowed,
      // ★ 被忽略时不能报请求口径的语义 —— 那会与实际价格矛盾
      semantics:
        allowed === "none"
          ? "该标的无复权概念（指数/汇率/利率等），价格为原始值"
          : adjustmentSemantics(effective ?? requestedAdjustment),
      ignored: isAdjustmentIgnored(requestedAdjustment, effective, allowed),
    },
    symbolMeta: series.symbolMeta
      ? {
          description: series.symbolMeta.description,
          assetType: series.symbolMeta.assetType,
          typespecs: series.symbolMeta.typespecs,
          timezone: series.symbolMeta.timezone,
          dataFrequency: series.symbolMeta.dataFrequency,
          currency: series.symbolMeta.currency,
          priceScale: series.symbolMeta.priceScale,
          minMov: series.symbolMeta.minMov,
        }
      : null,
    range: {
      fromTime: bars.length > 0 ? bars[0].time : null,
      toTime: bars.length > 0 ? bars[bars.length - 1].time : null,
      fromISO: bars.length > 0 ? fromUnixSec(bars[0].time) : null,
      toISO: bars.length > 0 ? fromUnixSec(bars[bars.length - 1].time) : null,
    },
    barCount: bars.length,
    dataCompleted: series.dataCompleted,
    roundsUsed: series.rounds,
    truncatedByMaxRounds: series.truncatedByMaxRounds,
    stats: computeStats(series),
    errorReason: series.errorReason,
  };

  if (includeBars) {
    item.bars = bars.map((b) => ({
      t: b.time,
      o: b.open,
      h: b.high,
      l: b.low,
      c: b.close,
      v: b.volume,
    }));
  }
  return item;
}

function buildHistoryInsights(
  items: TvHistoryItemProjected[],
  result: TvHistoryResult,
): string[] {
  const out: string[] = [];
  const ok = items.filter((i) => i.status === "ok" && i.barCount > 0);

  if (ok.length === 0) {
    out.push(
      `未取到任何 K 线数据（请求 ${result.query.symbols.length} 个标的）。` +
        `请确认 ticker（用 tv-search 检索）与 resolution 是否受支持。`,
    );
    return out;
  }

  const totalBars = ok.reduce((s, i) => s + i.barCount, 0);
  out.push(
    `取到 ${ok.length}/${result.query.symbols.length} 个标的的 ${result.query.resolution} 周期序列，` +
      `共 ${totalBars} 根 K 线。`,
  );

  // ★ 复权口径决定价格字段怎么读，必须在最前面说清（价格类标的才提）
  const priced = ok.filter((i) => i.adjustment.allowed !== "none");
  if (priced.length > 0) {
    const kinds = [
      ...new Set(priced.map((i) => i.adjustment.effective ?? i.adjustment.requested)),
    ];
    if (kinds.length === 1) {
      out.push(`价格口径：${adjustmentSemantics(kinds[0])}。`);
    } else {
      out.push(
        `⚠️ 各标的复权口径不一致，跨标的对比前先看 items[].adjustment：` +
          priced
            .map((i) => `${i.ticker}=${i.adjustment.effective ?? "未回显"}`)
            .join("、") +
          "。",
      );
    }
    // splits 最容易被误读成 A 股语境的「前复权」，单独点破
    if (kinds.includes(HISTORY_DEFAULT_ADJUSTMENT)) {
      out.push(
        `  注意：${HISTORY_DEFAULT_ADJUSTMENT} **不含现金分红**，与 A 股行情软件的「前复权」口径不同。` +
          `算价格涨跌幅可用；算总回报会低估，需改传 adjustment="dividends"。`,
      );
    }
  }

  const ignored = ok.filter((i) => i.adjustment.ignored);
  if (ignored.length > 0) {
    out.push(
      `⚠️ 以下标的**未采纳**请求的 adjustment="${result.query.adjustment}"，价格为未复权原值：` +
        ignored
          .map(
            (i) =>
              `${i.ticker}${i.adjustment.allowed === "none" ? "（该标的无复权概念）" : ""}`,
          )
          .join("、") +
        "。",
    );
  }

  for (const it of ok) {
    const parts: string[] = [
      `${it.ticker}：${it.barCount} 根，覆盖 ${toDateStr(it.range.fromTime)} ~ ${toDateStr(it.range.toTime)}`,
    ];
    if (it.stats.changePercent !== null) {
      parts.push(`期间 ${pct(it.stats.changePercent)}`);
    }
    if (it.stats.min !== null && it.stats.max !== null) {
      parts.push(`区间 ${it.stats.min} ~ ${it.stats.max}`);
    }
    out.push(parts.join("，") + "。");

    // 数据边界 ≠ 采集失败 —— 必须说清，否则 Agent 会当成取数不全
    if (it.dataCompleted) {
      out.push(
        `  ${it.ticker} 已取到该序列**最早可用数据**（上游数据边界，非采集失败）。`,
      );
    }
    // 被上限截断必须显式告知，否则用户以为拿到了完整区间
    if (it.truncatedByMaxRounds) {
      out.push(
        `  ⚠️ ${it.ticker} 因达到 maxRounds(${result.query.maxRounds}) 上限提前停止，` +
          `**未覆盖到请求的起始时间**。请调大 maxRounds 或 pageBars 后重试。`,
      );
    }
    // 发布频率粗于请求周期时会出现阶梯状重复值，属正常
    const freq = it.symbolMeta?.dataFrequency;
    if (freq && freq !== "D" && result.query.resolution === "1D") {
      out.push(
        `  ${it.ticker} 的原始发布频率为 ${freq}，按 1D 取会出现阶梯状重复值，属正常。`,
      );
    }
  }

  const failed = items.filter((i) => i.status !== "ok" || i.barCount === 0);
  if (failed.length > 0) {
    out.push(
      `未取到数据的标的：${failed.map((i) => `${i.ticker}${i.errorReason ? `（${i.errorReason}）` : ""}`).join("、")}。`,
    );
  }

  if (!result.query.includeBars) {
    out.push(`本次未返回 bars 明细（includeBars=false），仅给区间统计与元信息。`);
  }

  return out;
}

export function projectHistoryAiReady(
  result: TvHistoryResult,
): TvHistoryProjected {
  const includeBars = result.query.includeBars;
  const items = result.series.map((s) =>
    projectItem(s, includeBars, result.query.adjustment),
  );
  const ok = items.filter((i) => i.status === "ok" && i.barCount > 0).length;
  const totalBars = items.reduce((s, i) => s + i.barCount, 0);

  const meta: TvHistoryMeta & {
    skill: string;
    semantics: string;
    crawledAt: string;
  } = {
    skill: "tv-history",
    semantics:
      `历史 K 线序列：${result.query.resolution} 周期，时间为 Unix 秒级 UTC 时间戳；` +
      `价格口径 ${result.query.adjustment} = ${adjustmentSemantics(result.query.adjustment)}` +
      `（各标的的**生效**口径以 items[].adjustment.effective 为准）；` +
      `volume 为 null 表示该类标的无成交量概念（非缺失）`,
    crawledAt: isoTime(result.crawledAt),
    resolution: result.query.resolution,
    adjustment: result.query.adjustment,
    requestedFrom: fromUnixSec(result.query.from),
    requestedTo: fromUnixSec(result.query.to),
    requestedCount: result.query.symbols.length,
    returnedCount: items.length,
    okCount: ok,
    failedCount: items.length - ok,
    totalBars,
    barSchema:
      "t=Unix秒(UTC) o=开 h=高 l=低 c=收 v=成交量(null=该类标的无此概念)" +
      "；o/h/l/c 为复权后价格，口径见 items[].adjustment",
    includeBars,
    units: {
      t: "Unix 秒（UTC，可为负数=1970 年之前）",
      v: "成交量；null = 该类标的（收益率/利率等）无成交量概念",
      changePercent: "%（保留原值，未除以 100）",
    },
    transport: {
      rounds: result.diagnostics.rounds,
      drainCalls: result.diagnostics.drainCalls,
      droppedFrames: result.diagnostics.droppedFrames,
      unknownMessageKinds: result.diagnostics.unknownMessageKinds,
    },
  };

  return { meta, insights: buildHistoryInsights(items, result), items };
}
