/**
 * 站点常量与端点定义。
 *
 * 域名保留真实值（代码必须能连上），但**品牌串不得进入 insights / meta.semantics /
 * 错误信息**——面向用户的文案一律用中性业务术语（见 claude/rules/tradingview-secrecy.md）。
 */

// ============================================================================
// 站点与端点
// ============================================================================

/** 主站（页面导航落地 + Origin/Referer 来源） */
export const TV_SITE = "https://cn.tradingview.com";

/** 标的检索服务 */
export const TV_SYMBOL_SEARCH_ENDPOINT =
  "https://symbol-search.tradingview.com/symbol_search/v3/";

/** 批量截面扫描服务（路径需拼 market 段：`/<market>/scan`） */
export const TV_SCANNER_HOST = "https://scanner.tradingview.com";

/** 实时行情 / K 线 WebSocket */
export const TV_WS_HOST = "wss://data.tradingview.com/socket.io/websocket";

/**
 * 技术指标编译服务。
 *
 * 与检索/扫描是**第三个独立域名**。指标的真实身份（pineId）与可执行产物
 * （ilTemplate）都只能从这里拿，WS 侧无法凭空生成 —— 这是指标链路必须
 * 「先 HTTP 编译、再 WS 挂载」两段式的根本原因。
 */
export const TV_PINE_FACADE_HOST = "https://pine-facade.tradingview.com";

/**
 * WS 鉴权字面量。
 *
 * ⚠️ 这不是 JWT ——实测（CDP 抓帧）**已登录页面自身**发送的 `set_auth_token`
 * 就是这个固定字符串。历史行情与基础报价无需真实 token，因此本包不做任何
 * token 提取，天然满足「凭据不出页面」（CLAUDE.md §4.6）。
 */
export const TV_WS_AUTH_TOKEN = "unauthorized_user_token";

// ============================================================================
// 默认值与上限
// ============================================================================

/** 检索单页条数（上游固定步长，翻页时 start 按此递增） */
export const SEARCH_PAGE_SIZE = 50;

/** tv-scan 默认返回字段 */
export const SCAN_DEFAULT_COLUMNS = [
  "name",
  "description",
  "close",
  "change",
] as const;

/** tv-scan 默认分页区间 */
export const SCAN_DEFAULT_RANGE: readonly [number, number] = [0, 50];

/**
 * tv-scan 已实测可用的扫描域（URL 路径段），按用途分组。
 *
 * ⚠️ **这不是白名单，只是「已验证可用」的提示清单**。上游的扫描域是开放集合，
 * 本站覆盖全球市场，随时可能新增国别域。因此 `normalizeParams` **不做枚举拦截**
 * ——传入未列出的域会直接透传给上游，由上游用 HTTP 400 告知不存在。
 *
 * 曾经把这里当白名单拦截，只放行 4 个域，结果把 crypto（5.8 万标的）、
 * futures（5.3 万）、forex、america、japan 等全部拒之门外——是真实的功能阉割。
 *
 * 实测各域标的量（2026-07）：global 45.9 万 / bond 17.9 万 / crypto 5.8 万 /
 * futures 5.3 万 / germany 3.6 万 / america 2 万 / uk 9354 / china 7374 …
 */
export const SCAN_MARKETS = {
  /** 全球全资产（不分国别），标的量最大 */
  global: "global",
  // ── 按国别/地区 ──
  america: "america",
  china: "china",
  japan: "japan",
  hongkong: "hongkong",
  uk: "uk",
  germany: "germany",
  france: "france",
  india: "india",
  korea: "korea",
  canada: "canada",
  australia: "australia",
  brazil: "brazil",
  // ── 按资产类别 ──
  /** 加密货币（现货/合约/指数） */
  crypto: "crypto",
  /** 加密货币币种维度 */
  coin: "coin",
  /** 外汇 */
  forex: "forex",
  /** 期货 */
  futures: "futures",
  /** 差价合约 */
  cfd: "cfd",
  /** 债券收益率族 */
  bonds: "bonds",
  /** 债券个券（含公司债） */
  bond: "bond",
} as const;

/** 已验证可用的扫描域名称列表（用于 description 提示，非拦截白名单） */
export const SCAN_MARKET_NAMES = Object.values(SCAN_MARKETS);

/** 默认扫描域 */
export const SCAN_DEFAULT_MARKET = SCAN_MARKETS.global;

/**
 * tv-search 已实测可用的 `search_type` 取值。
 *
 * ⚠️ 同样**不是白名单**。注意 `search_type`（检索入参）与结果里的 `type`
 * （资产类别）是**两套值域**：`option` / `spot` / `commodity` 作为 search_type
 * 会返回 HTTP 400，但这些资产本身能通过 `undefined` / `crypto` / `cfd` 搜到
 * （如 BINANCE:BTCUSDT 的 type 是 spot）。留空即不限类别，能搜到全部资产。
 */
export const SEARCH_TYPES = {
  /** 股票（含 ETF、存托凭证） */
  stock: "stock",
  futures: "futures",
  forex: "forex",
  /** 加密货币（返回 spot / swap / index） */
  crypto: "crypto",
  index: "index",
  /** 宏观经济指标（各国央行利率、CPI、逆回购等） */
  economic: "economic",
  bond: "bond",
  /** 差价合约（返回 commodity / index / forex） */
  cfd: "cfd",
} as const;

/** 已验证可用的 search_type 列表（用于 description 提示，非拦截白名单） */
export const SEARCH_TYPE_NAMES = Object.values(SEARCH_TYPES);

/**
 * tv-quote 默认订阅字段集 —— 全部来自 HAR 实测的 `quote_set_fields`。
 * 未列入的字段不代表不可用，但未经验证，由调用方显式传 `fields` 覆盖。
 */
export const QUOTE_DEFAULT_FIELDS = [
  "lp",
  "lp_time",
  "ch",
  "chp",
  "bid",
  "ask",
  "bid_size",
  "ask_size",
  "volume",
  "open_price",
  "high_price",
  "low_price",
  "prev_close_price",
  "description",
  "short_name",
  "exchange",
  "type",
  "typespecs",
  "currency_code",
  "timezone",
  "pricescale",
  "minmov",
  "update_mode",
] as const;

/** tv-quote 单次订阅标的数上限 */
export const QUOTE_MAX_SYMBOLS = 50;

/** tv-history 单次批量标的数上限（同一连接内并行开 chart 会话） */
export const HISTORY_MAX_SYMBOLS = 8;

/** tv-history 默认周期 */
export const HISTORY_DEFAULT_RESOLUTION = "1D";

/** tv-history 首批取数根数 */
export const HISTORY_DEFAULT_BARS = 300;

/** tv-history 每轮 request_more_data 追加根数 */
export const HISTORY_DEFAULT_PAGE_BARS = 5000;

/** tv-history 翻页轮数上限（安全阀，防止无限翻页） */
export const HISTORY_DEFAULT_MAX_ROUNDS = 10;

/** K 线时区（统一 UTC，避免跨市场时区换算歧义） */
export const HISTORY_DEFAULT_TIMEZONE = "Etc/UTC";

// ============================================================================
// 复权口径（adjustment）
// ============================================================================

/**
 * 上游默认复权口径 —— **只按拆股/送转/配股调整，不含现金分红**。
 *
 * 这个默认值不是本包选的，是上游前端的 `DEFAULT_ADJUSTMENT` 常量（HAR 里的
 * bundle 逐字节核对：`const n="regular", i="splits", s=!0`）。发裸 ticker 时
 * 服务端就按它算，`symbol_resolved` 会把生效口径回显在 `adjustment` 字段。
 *
 * ⚠️ **它与 A 股行情软件说的「前复权」不是一回事**：后者通常含分红。
 * 实测 `SSE:601398` 工商银行 2006-10 月线四价乘的是同一系数 0.98269，
 * 幅度只对得上资本行为，对不上累计每股 2 元以上的分红。用这个口径算
 * 价格涨跌幅没问题，算**总回报会系统性低估**（缺股息再投）。
 */
export const HISTORY_DEFAULT_ADJUSTMENT = "splits";

/**
 * 已验证可用的复权口径取值。
 *
 * ⚠️ **这不是白名单**（CLAUDE.md §3.6）——枚举归上游定义，`normalizeParams`
 * 只做形状校验不拦取值，未列出的值透传给上游判定。这个常量存在的目的是
 * 给 paramSchema.description 做提示、并被测试钉住，**不要**后人把它改成拦截表。
 */
export const HISTORY_KNOWN_ADJUSTMENTS = ["splits", "dividends", "none"] as const;

/** 各复权口径的中文语义 —— 投影层用它生成 meta.semantics，不自造词 */
export const ADJUSTMENT_SEMANTICS: Record<string, string> = {
  splits: "前复权（仅按拆股/送转/配股调整，**不含现金分红**）",
  dividends: "前复权（含现金分红与拆股/送转，即总回报口径）",
  none: "不复权（原始成交价，历史价位为当时真实盘面）",
};

// ============================================================================
// 技术指标（tv-indicator-list / tv-indicator）
// ============================================================================

/**
 * 指标目录分组（`pine-facade/list?filter=` 的取值）。
 *
 * ⚠️ 与 SCAN_MARKETS 同理，**这不是白名单**——上游随时可能新增分组，
 * `normalizeParams` 不做枚举拦截，未列出的取值透传给上游判定。
 *
 * 实测条目数与免费占比（2026-07-29）：
 *   standard    145 条（142 免费 / 3 付费）—— 常规技术指标库（MA/RSI/MACD…）
 *   candlestick  45 条（全部免费）        —— K 线形态识别
 *   fundamental 1442 条（**全部付费**）   —— 财务科目当指标用
 *   saved         0 条（本次样本为空）    —— 当前账号自建脚本，需登录态
 */
export const STUDY_CATEGORIES = {
  /** 常规技术指标库 —— 绝大多数免费，是默认分组 */
  standard: "standard",
  /** K 线形态识别 */
  candlestick: "candlestick",
  /** 基本面科目（实测全部需付费权限） */
  fundamental: "fundamental",
  /** 当前账号自建/自存脚本（需登录态） */
  saved: "saved",
} as const;

/** 已验证可用的目录分组列表（用于 description 提示，非拦截白名单） */
export const STUDY_CATEGORY_NAMES = Object.values(STUDY_CATEGORIES);

/** tv-indicator-list 默认拉取的分组（免费且实用的两个） */
export const STUDY_DEFAULT_CATEGORIES: readonly string[] = [
  STUDY_CATEGORIES.standard,
  STUDY_CATEGORIES.candlestick,
];

/** tv-indicator-list 默认返回条数上限（全量 1600+ 条会挤爆 Agent 上下文） */
export const STUDY_LIST_DEFAULT_LIMIT = 60;

/** tv-indicator-list 返回条数硬上限 */
export const STUDY_LIST_MAX_LIMIT = 500;

/** tv-indicator 单次批量标的数上限（每个标的一个 chart 会话） */
export const STUDY_MAX_SYMBOLS = 5;

/** tv-indicator 默认周期（与 tv-history 保持一致） */
export const STUDY_DEFAULT_RESOLUTION = HISTORY_DEFAULT_RESOLUTION;

/** tv-indicator 默认取数根数 */
export const STUDY_DEFAULT_BARS = 300;

/** tv-indicator 单标的整体超时（指标要等上游算完，比纯 K 线略宽） */
export const STUDY_DEFAULT_TIMEOUT_MS = 45_000;

/**
 * 上游「该值不适用 / 无值」的哨兵。
 *
 * ⚠️ 这**不是**真实数值 1e100，而是 NaN 的替代表示。必须归一为 `null` 再对外，
 * 否则会被当成天文数字参与统计（min/max 全被污染），或直接把 1e+100 透给用户。
 *
 * **跨链路存在，不是指标独有**（真机实测）：
 *   - 指标 `du.st[].v`：该通道在这根 K 线上无值（如均线头部未形成），约占 20%
 *   - 报价 `qsd.v`：该字段不适用于该类标的（如 `FRED:SOFR` 的 volume）
 *
 * 因此取数的**入口**就要归一，别指望在各链路末端各自记得处理。
 */
export const TV_NA_SENTINEL = 1e100;


// ============================================================================
// WS 传输层参数
// ============================================================================

/** 单次 drain 的最长等待（保持远小于 puppeteer 协议超时） */
export const WS_DRAIN_WAIT_MS = 2000;

/** 建连 + 等待 hello 帧的超时 */
export const WS_OPEN_TIMEOUT_MS = 15_000;

/** 页面侧帧缓冲上限，超出丢弃最旧帧并计数 */
export const WS_MAX_BUFFERED_FRAMES = 4000;

/** tv-quote 等待首帧完整快照的默认超时 */
export const QUOTE_DEFAULT_TIMEOUT_MS = 15_000;

/** tv-history 单标的整体超时 */
export const HISTORY_DEFAULT_TIMEOUT_MS = 60_000;

/**
 * 一轮 request_more_data 后无新数据的静默上限。
 *
 * 兜底用：尚未确认「每轮翻页是否必有 series_completed」，若某轮只推数据不推
 * completed，靠这个阈值收敛，避免死等到整体超时。
 */
export const WS_ROUND_IDLE_MS = 8000;

/** 界面语言（影响 description 等文本字段的语种） */
export const TV_LOCALE: readonly [string, string] = ["zh-Hans", "CN"];

/** 检索结果的默认语言 */
export const SEARCH_DEFAULT_LANG = "zh";

/** 检索结果的默认国家排序偏好 */
export const SEARCH_DEFAULT_SORT_COUNTRY = "CN";
