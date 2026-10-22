/**
 * tv-quote —— 实时报价快照
 *
 * 一次订阅多个标的，取它们在采集时刻的最新价与当日涨跌。
 * 与 tv-scan 的区别：本 Skill 走推送通道（能拿到 FRED 等扫描索引外的标的），
 * 且字段更贴近"行情"语义；tv-scan 走 HTTP 截面查询，字段面更宽但覆盖面受索引限制。
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
  QUOTE_DEFAULT_FIELDS,
  QUOTE_DEFAULT_TIMEOUT_MS,
  QUOTE_MAX_SYMBOLS,
} from "@src/constants";
import { projectQuoteAiReady } from "@src/projections/quote.ai-ready";
import {
  ID_NAMESPACES,
  assertTickerShape,
  nsTag,
} from "@src/projections/id-namespace";
import type { TvQuoteResult } from "@src/types/quote.types";
import type { TvQuoteProjected } from "@src/types/projected.types";

export interface TvQuoteParams {
  symbols?: string[];
  fields?: string[];
  timeoutMs?: number;
  includeRawFields?: boolean;
}

export class TvQuoteSnapshotSkill extends TvWsSkillBase<
  TvQuoteParams,
  TvQuoteResult,
  TvQuoteProjected
> {
  readonly id = "tv-quote";
  readonly name = "实时报价快照";
  readonly description =
    "取一批标的在采集时刻的最新价、涨跌、买卖盘、成交量等实时行情快照。" +
    "覆盖全球市场全资产：股票、加密货币、期货、外汇、债券、指数、各国央行利率等。" +
    "与 tv-scan 的区别：本 Skill 走行情推送通道，能取到扫描索引外的标的（如美联储口径的宏观指标）；" +
    "要历史序列请用 tv-history。";

  readonly paramSchema: SkillParamSchema[] = [
    {
      name: "symbols",
      type: "array",
      required: true,
      description:
        `${nsTag(ID_NAMESPACES.TICKER)} 标的清单（EXCHANGE:CODE），来自 tv-search 的 items[].ticker。` +
        `1-${QUOTE_MAX_SYMBOLS} 个，共用一条连接与一个会话。` +
        "例：[\"NASDAQ:AAPL\",\"BINANCE:BTCUSDT\",\"FRED:SOFR\"]。",
    },
    {
      name: "fields",
      type: "array",
      required: false,
      default: [...QUOTE_DEFAULT_FIELDS],
      description:
        `${nsTag(ID_NAMESPACES.QUOTE_FIELD)} 要订阅的行情字段，默认为实测可用的核心集（${QUOTE_DEFAULT_FIELDS.length} 个）。` +
        "**与 tv-scan 的 columns 是两套命名空间**，多数字段同名但未逐一验证，勿互相投喂。",
    },
    {
      name: "timeoutMs",
      type: "number",
      required: false,
      default: QUOTE_DEFAULT_TIMEOUT_MS,
      description:
        `等待首批完整快照的最长时间（毫秒），默认 ${QUOTE_DEFAULT_TIMEOUT_MS}。` +
        "超时会返回已合并的部分快照并在 insights 中标注。",
    },
    {
      name: "includeRawFields",
      type: "boolean",
      required: false,
      default: false,
      description:
        "是否在 items[].raw 里附带未投影的原始字段（排查用，会显著增大输出）。",
    },
  ];

  protected normalizeParams(params: TvQuoteParams): TvQuoteParams {
    const raw = Array.isArray(params.symbols) ? params.symbols : [];
    const symbols = [...new Set(raw.map((x) => String(x).trim()).filter(Boolean))];

    if (symbols.length === 0) {
      throw new InvalidParamsError(
        "symbols 必填且不能为空 —— 请传标的清单（EXCHANGE:CODE），" +
          "来自 tv-search 的 items[].ticker，不要自行拼写。",
        { scope: this.id },
      );
    }
    if (symbols.length > QUOTE_MAX_SYMBOLS) {
      throw new InvalidParamsError(
        `symbols 最多 ${QUOTE_MAX_SYMBOLS} 个（收到 ${symbols.length} 个）。` +
          "请分批调用。",
        { scope: this.id, details: { count: symbols.length } },
      );
    }
    for (const t of symbols) assertTickerShape(t, this.id);

    const fields =
      Array.isArray(params.fields) && params.fields.length > 0
        ? [...new Set(params.fields.map((f) => String(f)))]
        : [...QUOTE_DEFAULT_FIELDS];

    const rawTimeout = Math.floor(Number(params.timeoutMs));
    const timeoutMs = Number.isFinite(rawTimeout)
      ? Math.min(Math.max(1000, rawTimeout), 120_000)
      : QUOTE_DEFAULT_TIMEOUT_MS;

    return {
      symbols,
      fields,
      timeoutMs,
      includeRawFields: params.includeRawFields ?? false,
    };
  }

  protected async fetchData(
    _page: Page,
    params: TvQuoteParams,
    _options?: unknown,
    ctx?: PageContext<TvQuoteParams>,
  ): Promise<TvQuoteResult> {
    const client = this.requireWsClient(ctx as PageContext<TvQuoteParams>);
    const symbols = params.symbols as string[];
    const fields = params.fields as string[];

    const outcome = await client.quoteSnapshot({
      symbols,
      fields,
      timeoutMs: params.timeoutMs as number,
    });

    // 诊断走 Slot 传给投影阶段（不用实例字段，避免并发串数据）
    ctx?.set(TvWsDiagnosticsSlot, outcome.diagnostics);

    return {
      query: { symbols, fields, timeoutMs: params.timeoutMs as number },
      quotes: symbols.map((ticker) => {
        const q = outcome.quotes.get(ticker);
        return {
          ticker,
          status: q ? q.status : ("error" as const),
          values: q?.values ?? {},
        };
      }),
      diagnostics: outcome.diagnostics,
      crawledAt: new Date(),
    };
  }

  protected get pipeline(): ProjectionPipeline<
    TvQuoteParams,
    TvQuoteResult,
    TvQuoteResult,
    TvQuoteProjected
  > {
    return {
      envelope: (data, ctx) =>
        projectQuoteAiReady(data, ctx.params.includeRawFields === true),
    };
  }
}
