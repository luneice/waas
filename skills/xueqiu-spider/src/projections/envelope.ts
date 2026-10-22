/**
 * AI-Ready 信封构造工具（端点族共享）
 *
 * 契约见 `skills/_shared/claude/rules/spider-runtime.md §4`：
 * Agent 优先读 `meta` + `insights` 做摘要/决策，明细在 `items[]`。
 */
import type { ValuePair } from "@src/types/common.types";

// ============================================================================
// 数值格式化（模块私有）
// ============================================================================

/** 万/亿分档格式化 —— 仅用于 insights 文案，不改变 items 里的原值 */
export function money(value: number | null): string {
  if (value === null) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e8) return `${(value / 1e8).toFixed(2)} 亿`;
  if (abs >= 1e4) return `${(value / 1e4).toFixed(2)} 万`;
  return value.toFixed(2);
}

/**
 * 小数比率 → 百分数文案。
 *
 * ⚠️ 仅用于 insights 展示。`items[]` 中的同比**原样透传**，
 * 不做 ×100 —— 换算交给消费方，避免二次转换歧义。
 */
export function pct(ratio: number | null): string {
  if (ratio === null) return "—";
  return `${(ratio * 100).toFixed(2)}%`;
}

/** 同比方向词 */
export function trend(ratio: number | null): string {
  if (ratio === null) return "同比不可比";
  if (ratio > 0) return `同比增 ${pct(ratio)}`;
  if (ratio < 0) return `同比降 ${pct(Math.abs(ratio))}`;
  return "同比持平";
}

/** 安全取二元组的值 */
export function val(pair: ValuePair | undefined): number | null {
  return pair?.value ?? null;
}

/** 安全取二元组的同比 */
export function yoy(pair: ValuePair | undefined): number | null {
  return pair?.yoy ?? null;
}

// ============================================================================
// 口径描述
// ============================================================================

/**
 * 构造 `meta.semantics` —— 一句中文说清这组数字的口径。
 *
 * **Agent 回写时只允许用这个口径，不得自造词**，所以必须由投影层给出。
 *
 * @param nature 表的性质。`flow` = 期间流量（利润表/现金流量表，各期为累计发生额）；
 *               `stock` = 时点存量（资产负债表，各期为期末余额，不可跨期相加）；
 *               `derived` = 衍生指标（主要财务指标）。
 */
export function buildSemantics(
  reportLabel: string,
  reportType: string,
  singleQuarter: boolean,
  currencyName: string | null,
  nature: "flow" | "stock" | "derived" = "flow",
): string {
  const scope = singleQuarter
    ? "单季发生额（相邻期差分，非累计值）"
    : reportTypeScope(reportType, nature);
  const unit = currencyName ? `，金额单位为${currencyName}元` : "";
  return `${reportLabel} · ${scope}${unit}`;
}

/** 报告期筛选的中文描述 —— 措辞随表的性质而变 */
function reportTypeScope(
  reportType: string,
  nature: "flow" | "stock" | "derived",
): string {
  const periodLabel = REPORT_TYPE_LABEL[reportType];

  if (nature === "stock") {
    // 时点存量：说"期末余额"，绝不能说"累计"
    return periodLabel
      ? `${periodLabel}（各期为该报告期末的时点余额）`
      : "全部报告期（各期为该报告期末的时点余额，不可跨期相加）";
  }

  if (nature === "derived") {
    return periodLabel
      ? `${periodLabel}（由报表数据计算出的衍生指标）`
      : "全部报告期（由报表数据计算出的衍生指标）";
  }

  // 期间流量：各期为年初至该期末的累计发生额
  return periodLabel
    ? `${periodLabel}（年初至该期末累计）`
    : "全部报告期（各期为年初至该期末的累计值）";
}

/** `type` → 中文期次标签。注意 Q2=中报、Q4=年报，不是第二/第四季度 */
const REPORT_TYPE_LABEL: Record<string, string> = {
  Q1: "各年一季报",
  Q2: "各年中报（非第二季度单季）",
  Q3: "各年三季报",
  Q4: "各年年报（非第四季度单季）",
};
