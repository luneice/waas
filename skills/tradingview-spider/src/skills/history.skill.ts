/**
 * tv-history —— 历史 K 线序列
 *
 * 支持指定分辨率与时间范围；跨时间范围靠 `request_more_data` 自动翻页，
 * 直到覆盖到请求的起始时间、或触达上游数据边界、或达到 maxRounds 安全阀。
 *
 * 多标的时**共用一条连接**（逐个建 chart 会话），避免为每个标的重复握手。
 */

import {
  InvalidParamsError,
  type PageContext,
  type ProjectionPipeline,
  type SkillParamSchema,
} from "@spider/core";
import type { Page } from "puppeteer-core";
import { TvWsSkillBase, TvWsDiagnosticsSlot } from "@src/skills/tv-ws-skill-base";
import {
  HISTORY_DEFAULT_ADJUSTMENT,
  HISTORY_DEFAULT_BARS,
  HISTORY_DEFAULT_MAX_ROUNDS,
  HISTORY_DEFAULT_PAGE_BARS,
  HISTORY_DEFAULT_RESOLUTION,
  HISTORY_DEFAULT_TIMEOUT_MS,
  HISTORY_DEFAULT_TIMEZONE,
  HISTORY_KNOWN_ADJUSTMENTS,
  HISTORY_MAX_SYMBOLS,
} from "@src/constants";
import { projectHistoryAiReady } from "@src/projections/history.ai-ready";
import {
  ID_NAMESPACES,
  assertTickerShape,
  nsTag,
} from "@src/projections/id-namespace";
import type { TvHistoryResult, TvSeries } from "@src/types/history.types";
import type { TvHistoryProjected } from "@src/types/projected.types";
import type { TvWsDiagnostics } from "@src/types/ws.types";

export interface TvHistoryParams {
  symbols?: string[];
  resolution?: string;
  adjustment?: string;
  from?: string | number;
  to?: string | number;
  bars?: number;
  pageBars?: number;
  maxRounds?: number;
  timezone?: string;
  includeBars?: boolean;
}

/** 复权口径形状校验（反注入）——只拦形状不拦取值，枚举归上游定义 */
const ADJUSTMENT_RE = /^[a-z_]{1,20}$/;

/**
 * 解析时间入参：接受 `YYYY-MM-DD` 或 Unix 秒。
 * 返回 null 表示未提供（不翻页，只取首批）。
 */
function parseTime(v: unknown, field: string, scope: string): number | null {
  if (v === undefined || v === null || v === "") return null;

  if (typeof v === "number" && Number.isFinite(v)) return Math.floor(v);

  const str = String(v).trim();
  if (/^-?\d+$/.test(str)) return Math.floor(Number(str));

  const ms = Date.parse(str);
  if (Number.isNaN(ms)) {
    throw new InvalidParamsError(
      `${field}="${str}" 无法解析。请用 YYYY-MM-DD（如 2014-01-01）或 Unix 秒级时间戳。`,
      { scope, details: { [field]: str } },
    );
  }
  return Math.floor(ms / 1000);
}

export class TvHistorySeriesSkill extends TvWsSkillBase<
  TvHistoryParams,
  TvHistoryResult,
  TvHistoryProjected
> {
  readonly id = "tv-history";
  readonly name = "历史 K 线序列";
  readonly description =
    "取标的的历史 K 线时间序列，支持指定分辨率（日/周/月/分钟线）与时间范围，超范围自动翻页。" +
    "覆盖全球市场全资产：股票、加密货币、期货、外汇、债券收益率、各国央行利率等。" +
    "典型用途：取某宏观指标的长期历史、做跨标的时间序列对比。要最新值请用 tv-quote。";

  readonly paramSchema: SkillParamSchema[] = [
    {
      name: "symbols",
      type: "array",
      required: true,
      description:
        `${nsTag(ID_NAMESPACES.TICKER)} 标的清单（EXCHANGE:CODE），来自 tv-search 的 items[].ticker。` +
        `1-${HISTORY_MAX_SYMBOLS} 个，共用一条连接。` +
        "例：[\"FRED:RRPONTSYAWARD\",\"ECONOMICS:USINTR\"]。",
    },
    {
      name: "resolution",
      type: "string",
      required: false,
      default: HISTORY_DEFAULT_RESOLUTION,
      description:
        "K 线周期。**实测可用**：1D（日线）/ 1W（周线）/ 1M（月线）。" +
        "分钟线按上游惯例传纯数字（1 / 60 / 240），未逐一实测。" +
        "注意：请求周期比标的原始发布频率更细时会出现阶梯状重复值，属正常（insights 会提示）。",
    },
    {
      name: "adjustment",
      type: "string",
      required: false,
      default: HISTORY_DEFAULT_ADJUSTMENT,
      description:
        `复权口径，默认 ${HISTORY_DEFAULT_ADJUSTMENT}（**这是上游默认值，不是本包选的**）。` +
        "已验证取值：splits=仅按拆股/送转/配股复权，**不含现金分红**；" +
        "dividends=含现金分红的前复权（总回报口径）；none=不复权（原始成交价）。" +
        "⚠️ splits 与 A 股行情软件说的「前复权」不是一回事（后者通常含分红），" +
        "用 splits 算价格涨跌幅没问题，算总回报会低估。" +
        "指数/汇率/利率等无复权概念的标的会忽略本参数（items[].adjustment.ignored 会标出）。" +
        "上游可能有未列出的取值，本参数只校验形状不做白名单拦截。",
    },
    {
      name: "from",
      type: "string",
      required: false,
      description:
        "起始时间：YYYY-MM-DD（如 2014-01-01）或 Unix 秒。" +
        "给了就自动翻页直到覆盖；不给则只取最近 bars 根。",
    },
    {
      name: "to",
      type: "string",
      required: false,
      description: "结束时间，格式同 from。默认取到最新。",
    },
    {
      name: "bars",
      type: "number",
      required: false,
      default: HISTORY_DEFAULT_BARS,
      description: `首批取数根数，默认 ${HISTORY_DEFAULT_BARS}。`,
    },
    {
      name: "pageBars",
      type: "number",
      required: false,
      default: HISTORY_DEFAULT_PAGE_BARS,
      description: `每轮向前追加的根数，默认 ${HISTORY_DEFAULT_PAGE_BARS}。`,
    },
    {
      name: "maxRounds",
      type: "number",
      required: false,
      default: HISTORY_DEFAULT_MAX_ROUNDS,
      description:
        `翻页轮数上限（安全阀），默认 ${HISTORY_DEFAULT_MAX_ROUNDS}。` +
        "因它提前停止时，insights 会明确告知未覆盖到请求的 from。",
    },
    {
      name: "timezone",
      type: "string",
      required: false,
      default: HISTORY_DEFAULT_TIMEZONE,
      description: `K 线时区，默认 ${HISTORY_DEFAULT_TIMEZONE}（避免跨市场时区换算歧义）。`,
    },
    {
      name: "includeBars",
      type: "boolean",
      required: false,
      default: true,
      description:
        "是否返回 bars 明细。设为 false 时只回区间统计与元信息，省 Agent 上下文。",
    },
  ];

  protected normalizeParams(params: TvHistoryParams): TvHistoryParams {
    const raw = Array.isArray(params.symbols) ? params.symbols : [];
    const symbols = [...new Set(raw.map((x) => String(x).trim()).filter(Boolean))];

    if (symbols.length === 0) {
      throw new InvalidParamsError(
        "symbols 必填且不能为空 —— 请传标的清单（EXCHANGE:CODE），" +
          "来自 tv-search 的 items[].ticker，不要自行拼写。",
        { scope: this.id },
      );
    }
    if (symbols.length > HISTORY_MAX_SYMBOLS) {
      throw new InvalidParamsError(
        `symbols 最多 ${HISTORY_MAX_SYMBOLS} 个（收到 ${symbols.length} 个）。` +
          "历史序列数据量大，请分批调用。",
        { scope: this.id, details: { count: symbols.length } },
      );
    }
    for (const t of symbols) assertTickerShape(t, this.id);

    const from = parseTime(params.from, "from", this.id);
    const to = parseTime(params.to, "to", this.id);
    if (from !== null && to !== null && from > to) {
      throw new InvalidParamsError(
        `from（${params.from}）不能晚于 to（${params.to}）。`,
        { scope: this.id },
      );
    }

    const clamp = (v: unknown, def: number, lo: number, hi: number): number => {
      const n = Math.floor(Number(v));
      return Number.isFinite(n) ? Math.min(Math.max(lo, n), hi) : def;
    };

    // 只校验形状（反注入），不拦取值 —— 枚举归上游定义（CLAUDE.md §3.6）
    const adjustment =
      params.adjustment?.trim().toLowerCase() || HISTORY_DEFAULT_ADJUSTMENT;
    if (!ADJUSTMENT_RE.test(adjustment)) {
      throw new InvalidParamsError(
        `adjustment="${params.adjustment}" 格式非法（应为小写字母，如 ` +
          `${HISTORY_KNOWN_ADJUSTMENTS.join(" / ")}）。`,
        { scope: this.id, details: { adjustment: params.adjustment } },
      );
    }

    return {
      symbols,
      resolution: params.resolution?.trim() || HISTORY_DEFAULT_RESOLUTION,
      adjustment,
      from: from ?? undefined,
      to: to ?? undefined,
      bars: clamp(params.bars, HISTORY_DEFAULT_BARS, 1, 20_000),
      pageBars: clamp(params.pageBars, HISTORY_DEFAULT_PAGE_BARS, 1, 50_000),
      maxRounds: clamp(params.maxRounds, HISTORY_DEFAULT_MAX_ROUNDS, 1, 50),
      timezone: params.timezone?.trim() || HISTORY_DEFAULT_TIMEZONE,
      includeBars: params.includeBars ?? true,
    };
  }

  protected async fetchData(
    _page: Page,
    params: TvHistoryParams,
    _options?: unknown,
    ctx?: PageContext<TvHistoryParams>,
  ): Promise<TvHistoryResult> {
    const client = this.requireWsClient(ctx as PageContext<TvHistoryParams>);
    const symbols = params.symbols as string[];
    const resolution = params.resolution as string;
    const adjustment = params.adjustment as string;
    const fromTs = (params.from as number | undefined) ?? null;

    const series: TvSeries[] = [];
    // 诊断累加：多标的共用一条连接，逐个会话的诊断需汇总
    const agg: TvWsDiagnostics = {
      rounds: 0,
      drainCalls: 0,
      droppedFrames: 0,
      unknownMessageKinds: [],
      sessionId: null,
    };
    const unknownSet = new Set<string>();

    for (const ticker of symbols) {
      try {
        const outcome = await client.history({
          ticker,
          resolution,
          adjustment,
          fromTs,
          bars: params.bars as number,
          pageBars: params.pageBars as number,
          maxRounds: params.maxRounds as number,
          timezone: params.timezone as string,
          timeoutMs: HISTORY_DEFAULT_TIMEOUT_MS,
        });

        series.push({
          ticker,
          resolution,
          status: "ok",
          symbolMeta: outcome.symbolMeta,
          bars: outcome.bars,
          dataCompleted: outcome.dataCompleted,
          rounds: outcome.rounds,
          truncatedByMaxRounds: outcome.truncatedByMaxRounds,
          errorReason: null,
        });

        agg.rounds += outcome.diagnostics.rounds;
        agg.drainCalls += outcome.diagnostics.drainCalls;
        agg.droppedFrames += outcome.diagnostics.droppedFrames;
        for (const k of outcome.diagnostics.unknownMessageKinds) unknownSet.add(k);
        agg.sessionId ??= outcome.diagnostics.sessionId;
      } catch (err) {
        // 单个标的失败不拖垮整批 —— 记录原因并继续（部分成功优于全盘失败）
        const message = err instanceof Error ? err.message : String(err);
        this.addWarning({
          code: "history-symbol-failed",
          message: `标的 ${ticker} 取数失败`,
          details: { ticker, error: message },
        });
        series.push({
          ticker,
          resolution,
          status: "error",
          symbolMeta: null,
          bars: [],
          dataCompleted: false,
          rounds: 0,
          truncatedByMaxRounds: false,
          errorReason: message,
        });
      }
    }

    agg.unknownMessageKinds = [...unknownSet];
    ctx?.set(TvWsDiagnosticsSlot, agg);

    return {
      query: {
        symbols,
        resolution,
        adjustment,
        from: fromTs,
        to: (params.to as number | undefined) ?? null,
        bars: params.bars as number,
        pageBars: params.pageBars as number,
        maxRounds: params.maxRounds as number,
        timezone: params.timezone as string,
        includeBars: params.includeBars as boolean,
      },
      series,
      diagnostics: agg,
      crawledAt: new Date(),
    };
  }

  protected get pipeline(): ProjectionPipeline<
    TvHistoryParams,
    TvHistoryResult,
    TvHistoryResult,
    TvHistoryProjected
  > {
    return {
      envelope: (data) => projectHistoryAiReady(data),
    };
  }
}
