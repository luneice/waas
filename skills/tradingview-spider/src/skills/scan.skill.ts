/**
 * tv-scan —— 批量截面扫描
 *
 * 一次请求取多个标的在指定字段上的快照（非推送、无历史）。
 * 多国宏观指标横向对比的首选路径。
 */

import {
  InvalidParamsError,
  type BaseGoal,
  type ProjectionPipeline,
  type SkillParamSchema,
} from "@spider/core";
import { TvSkillBase } from "@src/skills/tv-skill-base";
import {
  SCAN_DEFAULT_COLUMNS,
  SCAN_DEFAULT_RANGE,
  SCAN_DEFAULT_MARKET,
  SCAN_MARKET_NAMES,
} from "@src/constants";
import { ScannerScanGoal } from "@src/thrall/scan";
import { projectScanAiReady } from "@src/projections/scan.ai-ready";
import {
  ID_NAMESPACES,
  assertTickerShape,
  nsTag,
  partitionScannerTickers,
} from "@src/projections/id-namespace";
import type { TvScanFilter, TvScanResult } from "@src/types/scan.types";
import type { TvScanProjected } from "@src/types/projected.types";

export interface TvScanParams {
  market?: string;
  tickers?: string[];
  columns?: string[];
  filter?: TvScanFilter[];
  preset?: string;
  sortBy?: string;
  sortOrder?: string;
  range?: [number, number];
  lang?: string;
  /** 由 normalizeParams 填充，供 Goal 层回显 */
  droppedTickers?: string[];
}

const RANGE_MAX_SPAN = 500;

export class TvScannerScanSkill extends TvSkillBase<
  TvScanParams,
  TvScanResult,
  TvScanProjected
> {
  readonly id = "tv-scan";
  readonly name = "批量截面扫描";
  readonly description =
    "一次请求取多个标的在指定字段上的截面快照（当前值，非推送、无历史），或按条件筛选标的。" +
    "覆盖全球市场全资产：股票（美/中/日/港/英/德/印/韩等）、加密货币、期货、外汇、债券、差价合约、宏观指标。" +
    "多国利率横向对比、跨市场筛选的首选。注意：只返回最新值，要历史序列用 tv-history。";

  readonly paramSchema: SkillParamSchema[] = [
    {
      name: "market",
      type: "string",
      required: false,
      default: SCAN_DEFAULT_MARKET,
      description:
        `${nsTag(ID_NAMESPACES.SCAN_MARKET)} 扫描域（URL 路径段），默认 ${SCAN_DEFAULT_MARKET}（全球全资产，45 万+ 标的）。` +
        `已验证可用：${SCAN_MARKET_NAMES.join(" / ")}。` +
        "按国别选 america/china/japan/hongkong/uk/germany 等，按资产类别选 crypto/futures/forex/cfd/bonds/bond。" +
        "**取值不做白名单拦截**（上游是开放集合，可能有未列出的域）；传错会由上游返回 HTTP 400。" +
        "**这不是交易所代码** —— 勿把 NASDAQ / TVC 这类值传进来（那是 tv-search 的 exchange）。",
    },
    {
      name: "tickers",
      type: "array",
      required: false,
      description:
        `${nsTag(ID_NAMESPACES.TICKER)} 直接指定标的清单（EXCHANGE:CODE），来自 tv-search 的 items[].ticker。` +
        "⚠️ 美联储口径（FRED 前缀）**不在本接口索引内**，传入会被自动剔除并在 insights 中告知；" +
        "这类标的请改用 tv-history / tv-quote。",
    },
    {
      name: "columns",
      type: "array",
      required: false,
      default: [...SCAN_DEFAULT_COLUMNS],
      description:
        `${nsTag(ID_NAMESPACES.SCAN_COLUMN)} 返回字段名列表，默认 ${SCAN_DEFAULT_COLUMNS.join("/")}。` +
        "响应按此顺序解码，meta.columns 会回显。" +
        "**与 tv-quote 的 fields 是两套命名空间**，多数字段同名但未逐一验证，勿互相投喂。",
    },
    {
      name: "filter",
      type: "array",
      required: false,
      description:
        "过滤条件数组 [{left,operation,right}]。operation 实测可用：" +
        "equal / in_range（right 为二元数组）/ nempty / has / match（正则）。",
    },
    {
      name: "preset",
      type: "string",
      required: false,
      description:
        "服务端预置查询模板，免手写完整 filter。实测可用：" +
        "ipo_calendar（IPO 日历）、stocks_related_bonds（个股关联债券）、earning（财报日历）。",
    },
    {
      name: "sortBy",
      type: "string",
      required: false,
      description: `${nsTag(ID_NAMESPACES.SCAN_COLUMN)} 排序字段名，取值同 columns 命名空间。`,
    },
    {
      name: "sortOrder",
      type: "string",
      required: false,
      default: "desc",
      description: "排序方向：asc / desc。仅在传了 sortBy 时生效。",
    },
    {
      name: "range",
      type: "array",
      required: false,
      default: [...SCAN_DEFAULT_RANGE],
      description: `分页起止下标 [start, end]，默认 [0, 50]，单次跨度上限 ${RANGE_MAX_SPAN}。`,
    },
    {
      name: "lang",
      type: "string",
      required: false,
      default: "zh",
      description: "返回文本字段（如 description）的语言。",
    },
  ];

  protected normalizeParams(params: TvScanParams): TvScanParams {
    // 扫描域**不做枚举拦截**：本站覆盖全球市场，域是开放集合（实测 20+ 个且
    // 可能新增）。曾经用白名单只放行 4 个，把 crypto/futures/forex/america
    // 等全拒之门外——是真实的功能阉割。传错由上游返回 400，比本地误判更可靠。
    // 这里只做形状校验，防路径注入。
    const market = params.market?.trim() || SCAN_DEFAULT_MARKET;
    if (!/^[a-z][a-z0-9_-]{0,30}$/.test(market)) {
      throw new InvalidParamsError(
        `market="${params.market}" 形状非法（应为小写字母开头的短标识，如 ${SCAN_MARKET_NAMES.slice(0, 4).join(" / ")}）。` +
          "（若你想传的是交易所代码如 NASDAQ，那是 tv-search 的 exchange 参数，不是这里。）",
        { scope: this.id, details: { market: params.market } },
      );
    }

    // 标的形状校验 + 扫描索引盲区分流（全盲区会抛错并引导改用其它 Skill）
    let tickers: string[] | null = null;
    let dropped: string[] = [];
    if (Array.isArray(params.tickers) && params.tickers.length > 0) {
      const unique = [...new Set(params.tickers.map((t) => String(t).trim()))];
      for (const t of unique) assertTickerShape(t, this.id);
      const part = partitionScannerTickers(unique, this.id);
      tickers = part.accepted;
      dropped = part.dropped;
    }

    const columns =
      Array.isArray(params.columns) && params.columns.length > 0
        ? [...new Set(params.columns.map((c) => String(c)))]
        : [...SCAN_DEFAULT_COLUMNS];

    const rawRange = Array.isArray(params.range)
      ? params.range
      : SCAN_DEFAULT_RANGE;
    const start = Math.max(0, Math.floor(Number(rawRange[0]) || 0));
    const endRaw = Math.floor(Number(rawRange[1]) || start + 50);
    const end = Math.min(Math.max(start + 1, endRaw), start + RANGE_MAX_SPAN);

    return {
      market,
      tickers,
      columns,
      filter: Array.isArray(params.filter) ? params.filter : null,
      preset: params.preset?.trim() || null,
      sortBy: params.sortBy?.trim() || null,
      sortOrder: params.sortOrder === "asc" ? "asc" : "desc",
      range: [start, end],
      lang: params.lang?.trim() || "zh",
      droppedTickers: dropped,
    } as TvScanParams;
  }

  protected createGoal(): BaseGoal<TvScanResult> {
    return new ScannerScanGoal();
  }

  protected get pipeline(): ProjectionPipeline<
    TvScanParams,
    TvScanResult,
    TvScanResult,
    TvScanProjected
  > {
    return {
      envelope: (data) => projectScanAiReady(data),
    };
  }
}
