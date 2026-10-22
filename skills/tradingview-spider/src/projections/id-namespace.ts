/**
 * ID 命名空间登记表 —— 单一事实源
 *
 * 本站的 `EXCHANGE:CODE` 看起来只有一种形态，实际上按上游数据源分成**互不通用的
 * 子命名空间**，而且短大写串（`NASDAQ` / `global` / `close`）在不同参数位上指向
 * 完全不同的字典。集中登记在此，并提供：
 *   - `ID_NAMESPACES` / `ID_NAMESPACE_INFO`：命名空间字典与产出/消费/警告说明
 *   - `nsTag(ns)`：生成 `[ns:xxx]` 前缀，供 paramSchema.description 使用
 *   - `producerMeta(ns)`：产出方 meta 块，标注 idNamespace + idConsumers
 *
 * 与 xhs-spider 的同名模块不同，本表是**可执行的**：`classifyTicker` /
 * `partitionScannerTickers` / `assertTickerShape` 把最容易踩的陷阱做成运行时拦截，
 * 而不只是写给人看的文档。原因见下方「陷阱 ①」——静默空集是最难排查的一类错误。
 *
 * 任何新增 ID 类入参/输出，必须先在此处登记。
 */

import { InvalidParamsError } from "@spider/core";

export const ID_NAMESPACES = {
  /** 全局标的主键 `EXCHANGE:CODE` —— 报价/K线/截面三条下游链路的唯一入口 */
  TICKER: "tv-ticker",
  /** 宏观子命名空间（美联储口径）：**只在 WS 链路有效** */
  TICKER_FRED: "tv-ticker-fred",
  /** 宏观子命名空间（本站自建全球库）：WS 与截面扫描都有效 */
  TICKER_ECONOMICS: "tv-ticker-economics",
  /** 交易所 / 数据源前缀（ticker 冒号左半，如 NASDAQ / TVC / FRED / ECONOMICS） */
  EXCHANGE: "tv-exchange",
  /** 截面扫描的扫描域路径段（global / china / bonds / bond） */
  SCAN_MARKET: "tv-scan-market",
  /** 截面扫描的返回字段名（请求侧顺序即响应位置数组的解码键） */
  SCAN_COLUMN: "tv-scan-column",
  /** 实时报价订阅的字段名（WS quote_set_fields） */
  QUOTE_FIELD: "tv-quote-field",
  /** 技术指标标识（pineId，如 STD;Aroon_Oscillator） */
  STUDY_PINE_ID: "tv-study-pine-id",
  /** 指标目录分组（standard / candlestick / fundamental / saved） */
  STUDY_CATEGORY: "tv-study-category",
} as const;

export type TvIdNamespace = (typeof ID_NAMESPACES)[keyof typeof ID_NAMESPACES];

export interface IdNamespaceInfo {
  /** 中文名 */
  label: string;
  /** 该命名空间从哪里产出（含字段路径） */
  producedBy: string;
  /** 可被哪些 Skill 的哪些入参消费 */
  consumedBy: string[];
  /** 关键警告（与哪些命名空间易混淆） */
  warning?: string;
}

export const ID_NAMESPACE_INFO: Record<TvIdNamespace, IdNamespaceInfo> = {
  [ID_NAMESPACES.TICKER]: {
    label: "标的主键 EXCHANGE:CODE",
    producedBy: "tv-search.items[*].ticker",
    consumedBy: ["tv-quote.symbols", "tv-history.symbols", "tv-scan.tickers"],
    warning:
      "必须带交易所前缀（AAPL 无效，NASDAQ:AAPL 才有效）；不同前缀的可用链路不同，见 tv-ticker-fred / tv-ticker-economics",
  },
  [ID_NAMESPACES.TICKER_FRED]: {
    label: "宏观标的（美联储口径）",
    producedBy:
      "tv-search(searchType=economic).items[*].ticker 中 exchange=FRED 的项",
    consumedBy: ["tv-quote.symbols", "tv-history.symbols"],
    warning:
      "实测该前缀不在截面扫描的索引内（投给 tv-scan 会被静默丢弃返回空集），只能走 tv-quote / tv-history",
  },
  [ID_NAMESPACES.TICKER_ECONOMICS]: {
    label: "宏观标的（全球央行口径）",
    producedBy:
      "tv-search(searchType=economic).items[*].ticker 中 exchange=ECONOMICS 的项",
    consumedBy: ["tv-quote.symbols", "tv-history.symbols", "tv-scan.tickers"],
    warning:
      "三条链路都可用；批量横向对比多国同类指标优先用本前缀（一次 tv-scan 即可，无需逐个建 WS 会话）",
  },
  [ID_NAMESPACES.EXCHANGE]: {
    label: "交易所 / 数据源前缀",
    producedBy: "tv-search.items[*].exchange",
    consumedBy: ["tv-search.exchange"],
    warning:
      "勿与 tv-scan-market 混用：NASDAQ / FRED 这类是交易所前缀，global / china 这类是扫描域，两者取值集合完全不相交",
  },
  [ID_NAMESPACES.SCAN_MARKET]: {
    label: "截面扫描域",
    producedBy: "常量枚举（global / china / bonds / bond），无产出 Skill",
    consumedBy: ["tv-scan.market"],
    warning:
      "这不是交易所代码也不是国家代码；勿把 tv-exchange 的值（NASDAQ / TVC）投到这里",
  },
  [ID_NAMESPACES.SCAN_COLUMN]: {
    label: "截面扫描字段名",
    producedBy: "上游字典，未穷举（本包只固化了实测可用的一小部分）",
    consumedBy: ["tv-scan.columns", "tv-scan.filter[*].left", "tv-scan.sortBy"],
    warning:
      "与 tv-quote-field 是两套命名空间，多数字段同名但未逐一验证，勿互相投喂",
  },
  [ID_NAMESPACES.QUOTE_FIELD]: {
    label: "实时报价字段名",
    producedBy: "上游字典，未穷举（本包默认字段集来自实测抓包）",
    consumedBy: ["tv-quote.fields"],
    warning:
      "与 tv-scan-column 是两套命名空间，多数字段同名但未逐一验证，勿互相投喂",
  },
  [ID_NAMESPACES.STUDY_PINE_ID]: {
    label: "技术指标标识",
    producedBy: "tv-indicator-list.items[*].pineId",
    consumedBy: ["tv-indicator.pineId"],
    warning:
      "形如 STD;Aroon_Oscillator（分号分隔，空格转义为 %1）。勿自行拼写：真实指标名与显示名不同（如「RSI 背离」的 pineId 是 STD;Divergence%1Indicator）；也勿与 ticker 混淆（那是 EXCHANGE:CODE 冒号分隔）",
  },
  [ID_NAMESPACES.STUDY_CATEGORY]: {
    label: "指标目录分组",
    producedBy: "常量枚举（standard / candlestick / fundamental / saved），无产出 Skill",
    consumedBy: ["tv-indicator-list.categories"],
    warning:
      "这不是 tv-scan-market（那是 global/china）也不是资产类别；fundamental 分组实测全部需付费权限",
  },
};

/**
 * 生成 paramSchema.description 的命名空间前缀。
 * 用法：description: `${nsTag(ID_NAMESPACES.TICKER)} 标的清单（来自 tv-search）`
 */
export function nsTag(ns: TvIdNamespace): string {
  return `[ns:${ns}]`;
}

/**
 * 生成产出方的 meta 块，让消费方 Agent 一眼看到「这个 ID 能投喂到哪些槽位」。
 */
export function producerMeta(ns: TvIdNamespace): {
  idNamespace: TvIdNamespace;
  idConsumers: string[];
  idWarning?: string;
} {
  const info = ID_NAMESPACE_INFO[ns];
  return {
    idNamespace: ns,
    idConsumers: info.consumedBy,
    ...(info.warning ? { idWarning: info.warning } : {}),
  };
}

// ============================================================================
// 可执行的陷阱防护
// ============================================================================

/**
 * ticker 形状白名单（反注入）。
 *
 * 刻意偏离 CLAUDE.md §3.5 建议的 `/^[\w-]{5,64}$/`：本站 ticker 必含冒号分隔的
 * 交易所前缀，且代码段合法字符包含 `.`（BRK.A）与 `!`（连续合约 CL1!），
 * 长度也可短至 `SP:SPX`（6 字符）。用通用正则会把大量合法值判死。
 */
const TICKER_RE = /^[A-Z0-9_.]{1,20}:[A-Za-z0-9_.\-!]{1,40}$/;

/** 已知在截面扫描索引内不存在的交易所前缀（实测结论，非推测） */
const SCANNER_BLIND_EXCHANGES = new Set(["FRED"]);

export interface TickerClassification {
  /** 原样透传的完整 ticker */
  ticker: string;
  /** 冒号左半，大写 */
  exchange: string;
  /** 冒号右半 */
  code: string;
  /** 归属的命名空间 */
  namespace: TvIdNamespace;
}

/**
 * 解析 ticker 并归类到具体命名空间。
 * 不做合法性拦截（那是 assertTickerShape 的职责），只做归类。
 */
export function classifyTicker(ticker: string): TickerClassification {
  const idx = ticker.indexOf(":");
  const exchange = idx > 0 ? ticker.slice(0, idx).toUpperCase() : "";
  const code = idx > 0 ? ticker.slice(idx + 1) : ticker;

  let namespace: TvIdNamespace = ID_NAMESPACES.TICKER;
  if (exchange === "FRED") namespace = ID_NAMESPACES.TICKER_FRED;
  else if (exchange === "ECONOMICS") namespace = ID_NAMESPACES.TICKER_ECONOMICS;

  return { ticker, exchange, code, namespace };
}

/**
 * 校验 ticker 形状；非法直接抛 InvalidParamsError（带引导语，不是干巴巴的报错）。
 */
export function assertTickerShape(ticker: string, scope: string): void {
  if (typeof ticker !== "string" || !TICKER_RE.test(ticker)) {
    throw new InvalidParamsError(
      `标的代码 "${ticker}" 格式非法，应为 "交易所前缀:代码"（如 NASDAQ:AAPL / ECONOMICS:USINTR）。` +
        `先用 tv-search 检索得到 items[].ticker，不要自行拼写。`,
      { scope, details: { ticker } },
    );
  }
}

/**
 * pineId 形状白名单（反注入）。
 *
 * 形态是 `<命名空间>;<指标名>`：命名空间实测有 `STD`（官方内建）与 `PUB`
 * （社区发布，形如 `PUB;<32位十六进制>`）；指标名段含 `%`（转义前缀，
 * `%1`=空格 `%25`=百分号）、`_`、字母数字。
 *
 * 刻意**不校验命名空间取值**：上游随时可能新增（如 `USER;`），
 * 只拦形状不拦取值，让上游的 4xx 来判定（CLAUDE.md §3.6）。
 */
const PINE_ID_RE = /^[A-Za-z]{2,10};[A-Za-z0-9_%.\-]{1,120}$/;

/**
 * 校验 pineId 形状。
 *
 * 最容易犯的错是拿**显示名**当 pineId（传 "RSI 背离" 或 "Aroon Oscillator"），
 * 因此错误信息要明确指向 tv-indicator-list 而不是只说"格式错误"。
 */
export function assertPineIdShape(pineId: string, scope: string): void {
  if (typeof pineId !== "string" || !PINE_ID_RE.test(pineId)) {
    throw new InvalidParamsError(
      `指标标识 "${pineId}" 格式非法，应为 "命名空间;指标名"（如 STD;Aroon_Oscillator / STD;RSI）。` +
        `注意这**不是**指标的显示名 —— 先用 tv-indicator-list 检索得到 items[].pineId 再传，不要自行拼写。`,
      { scope, details: { pineId } },
    );
  }
}

export interface ScannerTickerPartition {
  /** 截面扫描索引内确实存在的 ticker */
  accepted: string[];
  /** 被判定为「扫描索引内不存在」而丢弃的 ticker */
  dropped: string[];
}

/**
 * 陷阱 ①：把截面扫描查不到的前缀提前分流出去。
 *
 * 实测：`FRED:*` 投给扫描接口时上游返回 `{totalCount:0,data:[]}` —— **既不报错也
 * 不提示**，Agent 只会看到空集然后误以为「没有数据」。这里主动拦截：
 *   - 全部命中盲区 → 抛错并引导改用 tv-history / tv-quote（继续请求毫无意义）
 *   - 部分命中     → 丢弃 + 由调用方落告警与 insights（保住其余标的的结果）
 */
export function partitionScannerTickers(
  tickers: readonly string[],
  scope: string,
): ScannerTickerPartition {
  const accepted: string[] = [];
  const dropped: string[] = [];

  for (const t of tickers) {
    const { exchange } = classifyTicker(t);
    if (SCANNER_BLIND_EXCHANGES.has(exchange)) dropped.push(t);
    else accepted.push(t);
  }

  if (accepted.length === 0 && dropped.length > 0) {
    throw new InvalidParamsError(
      `传入的 ${dropped.length} 个标的全部属于截面扫描查不到的数据源（${[...SCANNER_BLIND_EXCHANGES].join(" / ")} 前缀），` +
        `继续请求只会得到空集。请改用 tv-history（取历史序列）或 tv-quote（取最新值）。`,
      { scope, details: { dropped } },
    );
  }

  return { accepted, dropped };
}
