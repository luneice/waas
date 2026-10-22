/**
 * 分红方案解析器 —— 从 `plan_explain` 中文串提取结构化金额
 *
 * ## 为什么需要这个模块
 *
 * 🔴 上游**不提供任何结构化的分红金额字段**，金额只存在于中文串里：
 *
 * ```
 * "10派69.57元(实施方案)"       → 每 10 股派 69.57 元
 * "10转8股派25.2元(实施方案)"    → 每 10 股转增 8 股 + 派 25.2 元
 * ```
 *
 * 要算分红率/股息率就必须解析它。
 *
 * ## 设计纪律
 *
 * 1. **解析失败显式返回 null，绝不猜、绝不填 0** ——
 *    填 0 会让「未分红」与「解析失败」混为一谈，下游算分红率时
 *    把解析失败的期次当成零分红，结果系统性偏低。
 * 2. **永远保留原文** —— 消费方可核对，也便于发现未覆盖的形态。
 * 3. **状态不是「实施方案」时标记出来** —— `(预案)` / `(股东大会通过)`
 *    表示尚未实施，**不能计入已分红金额**。
 * 4. **本样本只见两种形态，但 A 股形态远不止**（送股、纯转增、不分配…），
 *    正则写宽松，不匹配就如实返回 null，不要为了"看起来能跑"而强行兜底。
 */

/** 分红方案的实施状态 */
export type BonusPlanStatus =
  /** 已实施 —— 只有这个状态的金额可计入已分红 */
  | "implemented"
  /** 预案 / 股东大会通过等，**尚未实施** */
  | "proposed"
  /** 无状态标注或状态未知 */
  | "unknown";

/** 解析后的分红方案 */
export interface ParsedBonusPlan {
  /**
   * 每股派息（元/股，**税前**）。
   *
   * ⚠️ 上游按「每 10 股」表述，此处已折算为**每 1 股**。
   * `null` 表示**解析失败或该方案不含派息**，由 `parsed` 字段区分。
   */
  dividendPerShare: number | null;
  /** 每股转增股数（股/股）。`null` 表示无转增或解析失败 */
  transferPerShare: number | null;
  /** 每股送股数（股/股）。`null` 表示无送股或解析失败 */
  bonusSharesPerShare: number | null;
  /** 实施状态 —— 非 `implemented` 时不应计入已分红金额 */
  status: BonusPlanStatus;
  /**
   * 是否成功解析出**任何**结构化信息。
   *
   * `false` 表示该 `plan_explain` 形态未被覆盖 —— 此时三个数值字段全为 null，
   * 消费方应回退到 `raw` 原文，**不要当成「未分红」**。
   */
  parsed: boolean;
  /** 原文 —— 永远保留，供核对与发现未覆盖形态 */
  raw: string;
}

/**
 * 每 N 股派 X 元：`10派69.57元` / `10派2.201281元`
 *
 * ⚠️ **基数与派息额之间可能隔着送转子句**：`10转8股派25.2元` 中，
 * 基数是句首的 `10`，不是紧邻「派」的 `8`（那是转增股数）。
 * 故用 `[^派]*?` 惰性跳过中间的送转部分，而非要求数字紧邻「派」。
 */
const DIVIDEND_RE = /(\d+(?:\.\d+)?)\s*(?:股)?[^派]*?派\s*(\d+(?:\.\d+)?)\s*元/;
/** 每 N 股转增 X 股：`10转8股` / `10转增8股` */
const TRANSFER_RE = /(\d+(?:\.\d+)?)\s*转(?:增)?\s*(\d+(?:\.\d+)?)\s*股/;
/** 每 N 股送 X 股：`10送3股` */
const BONUS_SHARE_RE = /(\d+(?:\.\d+)?)\s*送\s*(\d+(?:\.\d+)?)\s*股/;
/** 明确的不分配 */
const NO_DISTRIBUTION_RE = /不分配|不转增/;

/** 判定实施状态 */
function detectStatus(text: string): BonusPlanStatus {
  if (text.includes("实施方案")) return "implemented";
  if (
    text.includes("预案") ||
    text.includes("股东大会") ||
    text.includes("董事会")
  ) {
    return "proposed";
  }
  return "unknown";
}

/**
 * 解析分红方案文本。
 *
 * @example
 * parseBonusPlan("10派69.57元(实施方案)")
 * // → { dividendPerShare: 6.957, transferPerShare: null,
 * //     bonusSharesPerShare: null, status: "implemented", parsed: true, raw: "…" }
 *
 * @example 未覆盖的形态
 * parseBonusPlan("某种没见过的表述")
 * // → { dividendPerShare: null, …, parsed: false, raw: "某种没见过的表述" }
 * //   ⚠️ parsed:false 意味着"不知道"，不是"没分红"
 */
export function parseBonusPlan(planExplain: string | null | undefined): ParsedBonusPlan {
  const raw = typeof planExplain === "string" ? planExplain : "";
  const status = detectStatus(raw);

  const empty: ParsedBonusPlan = {
    dividendPerShare: null,
    transferPerShare: null,
    bonusSharesPerShare: null,
    status,
    parsed: false,
    raw,
  };

  if (!raw) return empty;

  // 明确的「不分配不转增」是**已知信息**（分红为 0），不是解析失败
  if (NO_DISTRIBUTION_RE.test(raw) && !DIVIDEND_RE.test(raw)) {
    return {
      dividendPerShare: 0,
      transferPerShare: 0,
      bonusSharesPerShare: 0,
      status,
      parsed: true,
      raw,
    };
  }

  const dividend = matchPerShare(raw, DIVIDEND_RE);
  const transfer = matchPerShare(raw, TRANSFER_RE);
  const bonusShares = matchPerShare(raw, BONUS_SHARE_RE);

  const parsed = dividend !== null || transfer !== null || bonusShares !== null;
  if (!parsed) return empty;

  return {
    dividendPerShare: dividend,
    transferPerShare: transfer,
    bonusSharesPerShare: bonusShares,
    status,
    parsed: true,
    raw,
  };
}

/**
 * 匹配「每 N 股 X」并折算为每 1 股。
 *
 * 返回 null 表示未匹配 —— 调用方据此判定该维度不适用或解析失败。
 */
function matchPerShare(text: string, re: RegExp): number | null {
  const m = re.exec(text);
  if (!m) return null;

  const base = Number(m[1]);
  const amount = Number(m[2]);
  if (!Number.isFinite(base) || !Number.isFinite(amount) || base === 0) {
    return null;
  }

  // 折算到每 1 股，保留足够精度（上游有 6 位小数的样本：10派2.201281元）
  return round(amount / base, 8);
}

function round(v: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

/**
 * 汇总一组分红方案的每股派息总额。
 *
 * ⚠️ **只累加 `status === "implemented"` 且 `parsed === true` 的记录** ——
 * 预案未实施、解析失败的都不计入。
 *
 * @returns `{ total, counted, skipped }` —— `skipped` 非零时消费方应知晓
 *          汇总不完整，不要当作精确值使用。
 */
export function sumImplementedDividend(plans: ParsedBonusPlan[]): {
  total: number;
  counted: number;
  skipped: number;
} {
  let total = 0;
  let counted = 0;
  let skipped = 0;

  for (const p of plans) {
    if (p.status === "implemented" && p.parsed && p.dividendPerShare !== null) {
      total += p.dividendPerShare;
      counted += 1;
    } else {
      skipped += 1;
    }
  }

  return { total: round(total, 8), counted, skipped };
}
