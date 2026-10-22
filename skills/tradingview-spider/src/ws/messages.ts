/**
 * 协议消息构造器
 *
 * 每个函数对应一条 `{m, p}` 出站消息。**参数顺序是位置敏感的**，
 * `createSeries` 的 7 个位置参数尤其容易写错，因此集中在这里并配单测。
 */

import { TV_WS_AUTH_TOKEN } from "@src/constants";
import type { TvOutMessage } from "@src/types/ws.types";

// ============================================================================
// 会话 ID 生成
// ============================================================================

const ID_ALPHABET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/**
 * 生成会话 ID。
 *
 * 前缀（`qs_` / `cs_`）只是可读性约定，协议不做校验。
 * `rand` 可注入以便快照测试复现。
 */
export function makeSessionId(
  prefix: string,
  rand: () => number = Math.random,
): string {
  let s = "";
  for (let i = 0; i < 12; i++) {
    s += ID_ALPHABET[Math.floor(rand() * ID_ALPHABET.length)];
  }
  return `${prefix}_${s}`;
}

// ============================================================================
// 连接初始化
// ============================================================================

/** 数据质量档位（low 可降低推送频率与带宽） */
export function setDataQuality(quality = "low"): TvOutMessage {
  return { m: "set_data_quality", p: [quality] };
}

/**
 * 鉴权。
 *
 * ⚠️ 传的是固定字面量而非 JWT —— 实测已登录页面自身就这么发（见 constants.ts）。
 */
export function setAuthToken(token: string = TV_WS_AUTH_TOKEN): TvOutMessage {
  return { m: "set_auth_token", p: [token] };
}

/** 界面语言（影响 description 等文本字段的语种） */
export function setLocale(locale: readonly [string, string]): TvOutMessage {
  return { m: "set_locale", p: [locale[0], locale[1]] };
}

// ============================================================================
// 报价会话（quote_session）
// ============================================================================

export function quoteCreateSession(sessionId: string): TvOutMessage {
  return { m: "quote_create_session", p: [sessionId] };
}

/** 声明要订阅哪些字段；必须在 add_symbols 之前发 */
export function quoteSetFields(
  sessionId: string,
  fields: readonly string[],
): TvOutMessage {
  return { m: "quote_set_fields", p: [sessionId, ...fields] };
}

export function quoteAddSymbols(
  sessionId: string,
  symbols: readonly string[],
): TvOutMessage {
  return { m: "quote_add_symbols", p: [sessionId, ...symbols] };
}

// ============================================================================
// 图表会话（chart_session）
// ============================================================================

export function chartCreateSession(sessionId: string): TvOutMessage {
  return { m: "chart_create_session", p: [sessionId, "disable_statistics"] };
}

export function switchTimezone(
  sessionId: string,
  timezone: string,
): TvOutMessage {
  return { m: "switch_timezone", p: [sessionId, timezone] };
}

/**
 * 扩展 symbol 编码 —— 带复权/会话等修饰的标的表达。
 *
 * 上游有两种 symbol 形态：裸 ticker（`SSE:601398`）与扩展形式
 * （`={"adjustment":"dividends","symbol":"SSE:601398"}`，等号后跟 JSON）。
 * HAR 里两种都出现过（后者见 `={"metric":"ytm","symbol":"TVC:CN10Y"}`）。
 *
 * ⚠️ **键必须按字典序排列**：前端的编码函数是
 * `"="+JSON.stringify(Object.keys(e).sort().reduce(...))`，
 * 服务端拿它当缓存键，乱序会命中不同的键。这里照抄该语义。
 *
 * 传 `adjustment` 为 null / 上游默认值时返回裸 ticker —— 不为「显式」而
 * 无谓改变线上报文形态（默认口径下两种写法等价，裸形式与既有快照一致）。
 */
export function encodeExtendedSymbol(
  ticker: string,
  modifiers: Record<string, string | undefined>,
): string {
  const entries = Object.entries(modifiers).filter(
    ([, v]) => v !== undefined && v !== null && v !== "",
  );
  if (entries.length === 0) return ticker;

  const obj: Record<string, string> = { symbol: ticker };
  for (const [k, v] of entries) obj[k] = v as string;

  const sorted = Object.keys(obj)
    .sort()
    .reduce<Record<string, string>>((acc, k) => {
      acc[k] = obj[k];
      return acc;
    }, {});

  return "=" + JSON.stringify(sorted);
}

export function resolveSymbol(
  sessionId: string,
  symbolSlot: string,
  ticker: string,
): TvOutMessage {
  return { m: "resolve_symbol", p: [sessionId, symbolSlot, ticker] };
}

/**
 * 创建序列。**7 个位置参数，顺序不可错**：
 *   [0] 会话 ID
 *   [1] series ID（后续 request_more_data 用它定位）
 *   [2] series 版本标签，固定 "s1"
 *   [3] symbol slot（resolveSymbol 时声明的那个）
 *   [4] 分辨率（"1D" / "1W" / "1M" / "60" …）
 *   [5] 首批取数根数
 *   [6] 会话标签，留空字符串即可
 */
export function createSeries(
  sessionId: string,
  seriesId: string,
  symbolSlot: string,
  resolution: string,
  bars: number,
): TvOutMessage {
  return {
    m: "create_series",
    p: [sessionId, seriesId, "s1", symbolSlot, resolution, bars, ""],
  };
}

/**
 * 向前追加历史数据 —— 这是**唯一**能把数据拉到指定历史区间的机制。
 *
 * （`create_series` 的 `["bar_count", <ts>, N]` 锚点形式实测无效：锚点被服务端
 * 忽略，仍返回最新 N 根。详见 docs/tradingview-API分析.md §4.3.2。）
 */
export function requestMoreData(
  sessionId: string,
  seriesId: string,
  bars: number,
): TvOutMessage {
  return { m: "request_more_data", p: [sessionId, seriesId, bars] };
}

// ============================================================================
// 技术指标（study）
// ============================================================================

/**
 * Pine 脚本外壳标识 —— 指标类恒为此值。
 *
 * ⚠️ **真实指标身份不在这个字符串里**，而在 `inputs.pineId`。这是本协议最反直觉
 * 的一点，也是历史上「猜 pineIdFull」屡屡失败的根因：曾经试过直接传
 * `"STD;SMA"` 或 `"Moving Average@tv-basicstudies-241"` 当第 5 个位置参数，
 * 上游一律拒绝。正确做法见 `buildStudyInputs` 的文件注释。
 */
export const STUDY_SCRIPT_SHELL = "Script@tv-scripting-101!";

/** 策略类（kind=strategy）的外壳，与指标类不同 */
export const STUDY_STRATEGY_SHELL = "StrategyScript@tv-scripting-101!";

/** `{v, f, t}` 包装的输入值 —— 上游对可调参数要求这种三元组形式 */
export interface StudyInputValue {
  v: unknown;
  f: true;
  t: string;
}

/**
 * `create_study` 的 inputs 对象。
 *
 * ⚠️ **两种包装形态混用，不可统一**（HAR 逐字节核对）：
 *   - `text` / `pineId` / `pineVersion` → **裸字符串**
 *   - `pineFeatures` / `in_N` / `__fast_calc` / `__profile` → **`{v,f,t}` 三元组**
 *
 * 把裸字符串也包成三元组（或反之）都会被上游拒绝。
 */
export interface StudyInputs {
  /** 编译产物，原样透传 pine-facade/translate 的 result.ilTemplate */
  text: string;
  /** 真实指标标识，如 "STD;Aroon_Oscillator" */
  pineId: string;
  pineVersion: string;
  pineFeatures?: StudyInputValue;
  [key: string]: string | StudyInputValue | undefined;
}

/**
 * 挂载一个技术指标到已建立的 series 上。**6 个位置参数，顺序不可错**：
 *   [0] chart 会话 ID
 *   [1] study ID（客户端自生成，后续 remove_study 用它定位）
 *   [2] study 树位置标签，实测固定 "st1"（同一 series 挂多个指标时递增）
 *   [3] 父 series ID（create_series 时用的那个 sds_N）
 *   [4] 脚本外壳（见 STUDY_SCRIPT_SHELL —— 真实指标身份不在这里）
 *   [5] inputs 对象（见 StudyInputs 的两种包装形态说明）
 */
export function createStudy(
  sessionId: string,
  studyId: string,
  parentSeriesId: string,
  shell: string,
  inputs: StudyInputs,
  slot = "st1",
): TvOutMessage {
  return {
    m: "create_study",
    p: [sessionId, studyId, slot, parentSeriesId, shell, inputs],
  };
}

/** 卸载指标（服务端回 `study_deleted`） */
export function removeStudy(
  sessionId: string,
  studyId: string,
): TvOutMessage {
  return { m: "remove_study", p: [sessionId, studyId] };
}
