/**
 * 实时报价快照 —— AI-Ready 信封
 *
 * 上游 `qsd` 是增量推送，已在协议层按标的合并成完整快照。
 * 本层负责：把原始字段袋投影成显式枚举的业务字段 + 生成中文要点。
 */

import { fromUnixSec, isoTime, pct } from "@src/projections/envelope";
import { TV_NA_SENTINEL } from "@src/constants";
import type { TvQuoteResult } from "@src/types/quote.types";
import type {
  TvQuoteItemProjected,
  TvQuoteMeta,
  TvQuoteProjected,
} from "@src/types/projected.types";

/**
 * 从字段袋里安全取数值；缺失/非数值一律 null（不臆造 0）。
 *
 * ⚠️ 同时拦上游的 `1e+100` 哨兵。真机实测 `FRED:SOFR` 的 `volume` 就是这个值
 * ——它表示「该字段不适用」而非天文数字（利率类标的没有成交量概念）。
 * 这个哨兵**跨链路存在**（报价与指标都会出现），不是指标独有，
 * 所以取数的入口就要归一，否则会直接透给用户一个 1e+100。
 */
function n(values: Record<string, unknown>, key: string): number | null {
  const v = values[key];
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v === TV_NA_SENTINEL ? null : v;
}

function s(values: Record<string, unknown>, key: string): string | null {
  const v = values[key];
  return typeof v === "string" && v !== "" ? v : null;
}

/** 逐条投影：显式枚举字段，禁止 spread（§3.5） */
function projectItem(
  ticker: string,
  entry: { status: "ok" | "error"; values: Record<string, unknown> },
  includeRaw: boolean,
): TvQuoteItemProjected {
  const v = entry.values;
  const typespecs = Array.isArray(v.typespecs) ? (v.typespecs as string[]) : [];

  const item: TvQuoteItemProjected = {
    ticker,
    status: entry.status,
    description: s(v, "description") ?? s(v, "short_name"),
    assetType: s(v, "type"),
    typespecs,
    currency: s(v, "currency_code"),
    price: n(v, "lp"),
    changeAbs: n(v, "ch"),
    // 百分比保留上游原值，不做 /100（§3.5）
    changePercent: n(v, "chp"),
    bid: n(v, "bid"),
    ask: n(v, "ask"),
    volume: n(v, "volume"),
    open: n(v, "open_price"),
    high: n(v, "high_price"),
    low: n(v, "low_price"),
    prevClose: n(v, "prev_close_price"),
    quoteTime: fromUnixSec(n(v, "lp_time")),
    updateMode: s(v, "update_mode"),
    priceScale: n(v, "pricescale"),
    minMov: n(v, "minmov"),
  };

  if (includeRaw) item.raw = v;
  return item;
}

function buildQuoteInsights(
  items: TvQuoteItemProjected[],
  result: TvQuoteResult,
): string[] {
  const out: string[] = [];
  const ok = items.filter((i) => i.status === "ok");
  const failed = items.filter((i) => i.status !== "ok");

  if (ok.length === 0) {
    out.push(
      `请求的 ${result.query.symbols.length} 个标的均未取到报价。` +
        `请用 tv-search 确认 ticker 是否正确（必须带交易所前缀，如 NASDAQ:AAPL）。`,
    );
    return out;
  }

  out.push(
    `取到 ${ok.length}/${result.query.symbols.length} 个标的的实时快照` +
      `（采集时刻的最新价与当日涨跌）。`,
  );

  // 涨跌分布 —— Agent 拿到后最可能立刻算的东西
  const withChange = ok.filter((i) => i.changePercent !== null);
  if (withChange.length > 0) {
    const up = withChange.filter((i) => (i.changePercent as number) > 0).length;
    const down = withChange.filter((i) => (i.changePercent as number) < 0).length;
    out.push(`涨跌分布：上涨 ${up} / 下跌 ${down} / 持平 ${withChange.length - up - down}。`);

    const sorted = [...withChange].sort(
      (a, b) => (b.changePercent as number) - (a.changePercent as number),
    );
    const top = sorted[0];
    const bottom = sorted[sorted.length - 1];
    if (top !== bottom) {
      out.push(
        `涨幅最大 ${top.ticker} ${pct(top.changePercent)}，` +
          `跌幅最大 ${bottom.ticker} ${pct(bottom.changePercent)}。`,
      );
    }
  }

  // 非实时推送的标的必须提示，否则 Agent 会把延迟行情当实时用
  const notStreaming = ok.filter(
    (i) => i.updateMode !== null && i.updateMode !== "streaming",
  );
  if (notStreaming.length > 0) {
    out.push(
      `⚠️ ${notStreaming.length} 个标的非实时推送模式（${[...new Set(notStreaming.map((i) => i.updateMode))].join("/")}）：` +
        `可能是延迟行情或已收盘，勿当实时价使用 —— ${notStreaming.slice(0, 3).map((i) => i.ticker).join("、")}。`,
    );
  }

  if (failed.length > 0) {
    out.push(
      `未解析的标的（${failed.length} 个）：${failed.map((i) => i.ticker).join("、")}。` +
        `先用 tv-search 确认 ticker 是否存在。`,
    );
  }

  if (result.diagnostics.droppedFrames > 0) {
    out.push(
      `⚠️ 传输层丢弃了 ${result.diagnostics.droppedFrames} 帧（消费速度跟不上推送），数据可能不完整。`,
    );
  }

  return out;
}

export function projectQuoteAiReady(
  result: TvQuoteResult,
  includeRaw = false,
): TvQuoteProjected {
  const items = result.quotes.map((q) =>
    projectItem(q.ticker, { status: q.status === "ok" ? "ok" : "error", values: q.values }, includeRaw),
  );
  const ok = items.filter((i) => i.status === "ok").length;

  const meta: TvQuoteMeta & {
    skill: string;
    semantics: string;
    crawledAt: string;
  } = {
    skill: "tv-quote",
    semantics:
      `实时报价快照：${items.length} 个标的在采集时刻的最新价与当日涨跌；` +
      `增量推送已按标的合并为完整快照`,
    crawledAt: isoTime(result.crawledAt),
    requestedCount: result.query.symbols.length,
    returnedCount: items.length,
    okCount: ok,
    failedCount: items.length - ok,
    fields: result.query.fields,
    units: {
      price: "标的计价货币（见 items[].currency）",
      changePercent: "%（保留上游原值，未除以 100）",
      volume: "随标的类型而异；null = 该类标的无成交量概念",
    },
    transport: {
      rounds: result.diagnostics.rounds,
      drainCalls: result.diagnostics.drainCalls,
      droppedFrames: result.diagnostics.droppedFrames,
      unknownMessageKinds: result.diagnostics.unknownMessageKinds,
    },
  };

  return { meta, insights: buildQuoteInsights(items, result), items };
}
