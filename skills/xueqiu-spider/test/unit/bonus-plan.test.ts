/**
 * 分红方案解析器单测（L1）
 *
 * 这是 B 组唯一需要「从中文串提取数值」的地方，也是最容易出错的地方。
 * 核心纪律：**解析失败返回 null，绝不填 0** ——
 * 填 0 会让「未分红」与「解析失败」混为一谈，下游算分红率时系统性偏低。
 */
import { test } from "vitest";
import assert from "node:assert/strict";

import {
  parseBonusPlan,
  sumImplementedDividend,
} from "@src/projections/bonus-plan";

// ============================================================================
// 本样本已见的形态（真实数据）
// ============================================================================

test("纯派息：10派69.57元 → 每股 6.957 元", () => {
  const r = parseBonusPlan("10派69.57元(实施方案)");
  assert.equal(r.dividendPerShare, 6.957, "上游按每 10 股表述，须折算到每 1 股");
  assert.equal(r.transferPerShare, null);
  assert.equal(r.status, "implemented");
  assert.equal(r.parsed, true);
  assert.equal(r.raw, "10派69.57元(实施方案)", "原文必须保留");
});

test("转增+派息：10转8股派25.2元 → 两个维度都提取", () => {
  const r = parseBonusPlan("10转8股派25.2元(实施方案)");
  assert.equal(r.dividendPerShare, 2.52);
  assert.equal(r.transferPerShare, 0.8);
  assert.equal(r.parsed, true);
});

test("高精度派息：10派2.201281元 不丢精度", () => {
  const r = parseBonusPlan("10派2.201281元(实施方案)");
  assert.equal(r.dividendPerShare, 0.2201281);
});

// ============================================================================
// 🔴 解析失败必须显式，不能伪装成"未分红"
// ============================================================================

test("未覆盖形态 → parsed:false 且金额为 null（不是 0）", () => {
  const r = parseBonusPlan("某种从未见过的表述");
  assert.equal(r.parsed, false, "必须标记为未解析");
  assert.equal(r.dividendPerShare, null, "🔴 解析失败是 null，不是 0");
  assert.notEqual(r.dividendPerShare, 0, "填 0 会被误当成「未分红」");
  assert.equal(r.raw, "某种从未见过的表述", "原文必须保留供核对");
});

test("空值 / null → parsed:false，不抛异常", () => {
  for (const v of ["", null, undefined]) {
    const r = parseBonusPlan(v as never);
    assert.equal(r.parsed, false);
    assert.equal(r.dividendPerShare, null);
  }
});

test("明确「不分配不转增」→ parsed:true 且为 0（这是已知信息，非失败）", () => {
  const r = parseBonusPlan("不分配不转增");
  assert.equal(r.parsed, true, "「不分配」是明确信息，不是解析失败");
  assert.equal(r.dividendPerShare, 0, "此处的 0 表示确实没分红");
});

// ============================================================================
// 实施状态 —— 非「实施方案」不能计入已分红
// ============================================================================

test("状态识别：实施方案 / 预案 / 无标注", () => {
  assert.equal(parseBonusPlan("10派5元(实施方案)").status, "implemented");
  assert.equal(parseBonusPlan("10派5元(预案)").status, "proposed");
  assert.equal(parseBonusPlan("10派5元(股东大会通过)").status, "proposed");
  assert.equal(parseBonusPlan("10派5元").status, "unknown");
});

// ============================================================================
// A 股实际存在但本样本未出现的形态 —— 正则应尽量覆盖
// ============================================================================

test("送股：10送3股派2元", () => {
  const r = parseBonusPlan("10送3股派2元(实施方案)");
  assert.equal(r.bonusSharesPerShare, 0.3);
  assert.equal(r.dividendPerShare, 0.2);
});

test("纯转增无派息：10转10股 → 派息为 null 而非 0", () => {
  const r = parseBonusPlan("10转10股(实施方案)");
  assert.equal(r.transferPerShare, 1);
  assert.equal(r.dividendPerShare, null, "该方案不含派息，用 null 表示不适用");
  assert.equal(r.parsed, true, "转增被成功解析，整体算解析成功");
});

test("「转增」全称写法也能匹配", () => {
  assert.equal(parseBonusPlan("10转增5股(实施方案)").transferPerShare, 0.5);
});

// ============================================================================
// 汇总 —— 只累加已实施且解析成功的
// ============================================================================

test("汇总只计已实施记录，跳过的数量要透出", () => {
  const plans = [
    parseBonusPlan("10派10元(实施方案)"), // 计入 1.0
    parseBonusPlan("10派20元(实施方案)"), // 计入 2.0
    parseBonusPlan("10派30元(预案)"), // 跳过：未实施
    parseBonusPlan("看不懂的方案"), // 跳过：解析失败
  ];
  const r = sumImplementedDividend(plans);
  assert.equal(r.total, 3.0);
  assert.equal(r.counted, 2);
  assert.equal(
    r.skipped,
    2,
    "跳过数必须透出 —— 非零时汇总不完整，消费方不应当作精确值",
  );
});

test("全部解析失败时 total=0 但 counted=0 —— 消费方须据此判定不可用", () => {
  const r = sumImplementedDividend([parseBonusPlan("???"), parseBonusPlan("")]);
  assert.equal(r.counted, 0, "counted=0 是「无有效数据」的信号");
  assert.equal(r.skipped, 2);
});
