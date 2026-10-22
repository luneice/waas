/**
 * 站点常量与上游枚举提示清单
 *
 * 上游端点族：`stock.xueqiu.com/v5/stock/finance/cn/{report}.json`
 * 四个报表端点的入参、响应信封、翻页机制完全一致，差异仅在 `list[]` 字段集。
 *
 * 详见 `docs/api/README.md`（人读导航）与 `docs/api/openapi.yaml`（机器可读契约）。
 */

/** 页面壳站点 —— 导航目标，用于建立同源上下文与登录态 */
export const XUEQIU_SITE = "https://xueqiu.com";

/** 财务数据 API base —— 唯一承载业务数据的域名 */
export const STOCK_API_BASE = "https://stock.xueqiu.com";

/** 个股详情页路径模板（导航用，`{symbol}` 由 Skill 替换） */
export const STOCK_DETAIL_PATH = "/snowman/S/{symbol}/detail";

/** 四张报表的端点路径 */
export const FINANCE_ENDPOINTS = {
  income: "/v5/stock/finance/cn/income.json",
  balance: "/v5/stock/finance/cn/balance.json",
  cashFlow: "/v5/stock/finance/cn/cash_flow.json",
  indicator: "/v5/stock/finance/cn/indicator.json",
} as const;

/**
 * B 组 · 股权与公司运作端点路径（f10）。
 *
 * ⚠️ 8 个 HAR 收敛为 6 个端点：`bonus` 同时承载分红与增发；
 * `topHolders` 靠 `circula=0/1` 区分全体/流通股东。
 */
export const F10_ENDPOINTS = {
  /** 分红 + 增发 + 配股（三块数据在一个响应里） */
  bonus: "/v5/stock/f10/cn/bonus.json",
  /** 十大股东 / 十大流通股东（circula 区分） */
  topHolders: "/v5/stock/f10/cn/top_holders.json",
  /** 股东人数与筹码结构 */
  holders: "/v5/stock/f10/cn/holders.json",
  /** 基金持股明细 */
  orgHolding: "/v5/stock/f10/cn/org_holding/detail.json",
  /** 限售解禁（type=restricts） */
  sharesChg: "/v5/stock/f10/cn/shareschg.json",
  /** 高管增减持 */
  skHolderChg: "/v5/stock/f10/cn/skholderchg.json",
} as const;

/** f10 端点的默认每页条数 */
export const F10_DEFAULT_SIZE = 10;

/** f10 端点的默认最大翻页数 */
export const F10_DEFAULT_MAX_PAGES = 10;

/** 日期索引类端点默认取多少期 */
export const F10_DEFAULT_MAX_PERIODS = 8;

/**
 * 单次请求返回的报告期数。
 *
 * 上游 `count` 参数，抓包中恒为 5（上限未验证）。
 * 同时是翻页终止判据：返回条数 < count 即到达最早一期。
 */
export const DEFAULT_PAGE_SIZE = 5;

/** 默认抓取页数 —— 5 期 × 8 页 = 40 期，约 10 年，足够做趋势分析 */
export const DEFAULT_MAX_PAGES = 8;

/**
 * ⚠️ `type` 参数的**已验证取值提示清单** —— 不是白名单，禁止用于拦截。
 *
 * 这是**上游定义**的枚举（CLAUDE.md §3.6）：只做形状校验，取值透传给上游判定。
 *
 * 血的教训：利润表 HAR 只出现 all/Q1–Q4 五个取值，据此写白名单会拦掉
 * 资产负债表 HAR 中实际存在的 S0–S4（单季口径）。一次抓包只覆盖了
 * 你走过的那条用户路径，**永远可能存在未列出的取值**。
 */
export const KNOWN_REPORT_TYPES = [
  // ── 定期报告口径（report_name 措辞为「…季报」，累计值 / 时点余额）──
  "all", // 全部期次倒序
  "Q1", // 仅一季报
  "Q2", // 仅中报（非"第二季度"）
  "Q3", // 仅三季报
  "Q4", // 仅年报（非"第四季度"）
  // ── 单季口径（report_name 措辞为「…季度」，相邻期机械差分）──
  // ⚠️ 语义正确性是 per-field 的，见 S_SERIES_UNSAFE_FIELDS
  "S0", // 全部期次的单季值
  "S1",
  "S2",
  "S3",
  "S4",
] as const;

/** `type` 取值的形状校验 —— 仅防注入，不判定业务合法性 */
export const REPORT_TYPE_SHAPE = /^[A-Za-z][A-Za-z0-9]{0,7}$/;

/** 标的代码形状校验 —— 仅防注入，不做交易所代码白名单 */
export const SYMBOL_SHAPE = /^[A-Z]{2}\d{6}$/;

/**
 * 🔴 `S` 系列（单季口径）下**语义失真**的字段清单。
 *
 * 上游对全族端点套用同一套差分逻辑，未区分流量/存量字段。
 * 对**时点存量**字段做差分得到的是「期间变动额」而非「余额」，数值荒谬。
 *
 * 判据是**字段的类型**（流量 vs 存量），不是表的类型 ——
 * 现金流量表虽是流量表，内部却混着 2 个时点余额字段。
 *
 * 实测证据见 `docs/api/README.md` §4.3 / §5.3。
 */
export const S_SERIES_UNSAFE_FIELDS: Record<string, "all" | readonly string[]> =
  {
    /**
     * 资产负债表：**全表禁用**。
     * 实测 S2「2023二季度」total_assets = −73.58 亿（负的总资产）、
     * S0「2025四季度」asset_liab_ratio = −5.45%（负的资产负债率）。
     */
    balance: "all",

    /**
     * 现金流量表：仅 2 个时点余额字段失真，其余 36 个流量字段正确。
     *
     * ⚠️ **这比资产负债表的坑更隐蔽**：失真后 final_balance_of_cce 仍是
     * 正的、量级合理的数字（2025四季度真实期末 483.63 亿，S0 返回 216.79 亿
     * ——实为当季净增额），从结果完全看不出错误。
     */
    cashFlow: ["initial_balance_of_cce", "final_balance_of_cce"],

    /** 利润表：纯流量表，S 系列语义正确（但 HAR 未覆盖，未实测上游是否接受） */
    income: [],

    /** 主要财务指标：比率差分无意义；HAR 中未出现 S 系列 */
    indicator: "all",
  };
