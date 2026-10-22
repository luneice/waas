/**
 * thrall/shared.ts 纯函数单测（L1）
 *
 * 这三个函数是端点族的共享地基，任何一处退化都会污染四张表：
 *   - `toValuePair`          二元组三态归一化
 *   - `nextFinanceCursor`    翻页游标推进
 *   - `unwrapFinanceEnvelope` 信封解包与错误判定
 */
import { test } from "vitest";
import assert from "node:assert/strict";

import {
  toValuePair,
  nextFinanceCursor,
  unwrapFinanceEnvelope,
  isSingleQuarterType,
  buildFinanceQuery,
} from "@src/thrall/shared";

// ============================================================================
// toValuePair —— 二元组三态
// ============================================================================

test("toValuePair：有值有同比", () => {
  assert.deepEqual(toValuePair([123.45, 0.34]), { value: 123.45, yoy: 0.34 });
});

test("toValuePair：[null, null] 表示科目本期不适用", () => {
  assert.deepEqual(toValuePair([null, null]), { value: null, yoy: null });
});

test("toValuePair：值为 0 必须保留，不得被吞成 null", () => {
  // CLAUDE.md §3.5：null = 数据源不提供，0 = 值确实为零，二者不可混用。
  // 实测 lt_payable_sum: [0.0, null] —— 用 `value || null` 会把真实的 0 吞掉。
  const r = toValuePair([0.0, null]);
  assert.equal(r.value, 0, "0 是有效值，不是缺失");
  assert.notEqual(r.value, null);
  assert.equal(r.yoy, null, "去年同期为 0 或缺失时无法算同比");
});

test("toValuePair：负值原样保留（少数股东损益、现金流常为负）", () => {
  assert.deepEqual(toValuePair([-143919355.89, -19.09]), {
    value: -143919355.89,
    yoy: -19.09,
  });
});

test("toValuePair：科学计数法（上游 Java 序列化产物）正常解析", () => {
  // 原始 JSON 中即为 3.0E8，JSON.parse 后已是 number
  assert.equal(toValuePair([3.0e8, null]).value, 300000000);
});

test("toValuePair：非数组 / 缺失 → 双 null，不抛异常", () => {
  assert.deepEqual(toValuePair(undefined), { value: null, yoy: null });
  assert.deepEqual(toValuePair(null), { value: null, yoy: null });
});

test("toValuePair：NaN / Infinity 归一为 null", () => {
  assert.deepEqual(toValuePair([NaN, Infinity]), { value: null, yoy: null });
});

// ============================================================================
// nextFinanceCursor —— 翻页游标
// ============================================================================

const period = (d: number) => ({ report_date: d, report_name: "x", ctime: null });

test("nextFinanceCursor：满页时返回末条 report_date + 1", () => {
  // +1 是必需的：上游比较为闭区间，直传会重复返回该条
  const periods = [period(1774886400000), period(1767110400000)];
  assert.equal(nextFinanceCursor(periods, 2), String(1767110400000 + 1));
});

test("nextFinanceCursor：不足一页 → null（终止翻页）", () => {
  // 上游不返回 has_more/total，条数不足是唯一可靠判据
  assert.equal(nextFinanceCursor([period(1774886400000)], 5), null);
});

test("nextFinanceCursor：空数组 → null", () => {
  assert.equal(nextFinanceCursor([], 5), null);
});

test("nextFinanceCursor：末条 report_date 异常 → null（防御性终止）", () => {
  const bad = [{ report_date: NaN, report_name: "x", ctime: null }] as never;
  assert.equal(nextFinanceCursor(bad, 1), null);
});

// ============================================================================
// unwrapFinanceEnvelope —— 信封解包
// ============================================================================

test("unwrapFinanceEnvelope：成功态返回 list", () => {
  const list = [period(1)];
  const out = unwrapFinanceEnvelope(
    { data: { list }, error_code: 0, error_description: "" },
    "test",
  );
  assert.deepEqual(out, list);
});

test("unwrapFinanceEnvelope：error_code 为 number 0 与缺失都算成功", () => {
  assert.deepEqual(unwrapFinanceEnvelope({ data: { list: [] } }, "test"), []);
});

test("unwrapFinanceEnvelope：400016 → NotLoggedInError（先判 code 再判 list）", () => {
  // 关键：鉴权失败时 data.list 也是 []，若先判 list 会误报成「无数据」
  assert.throws(
    () =>
      unwrapFinanceEnvelope(
        { data: { list: [] }, error_code: "400016", error_description: "请重新登录" },
        "test",
      ),
    (err: Error & { kind?: string }) => err.kind === "not-logged-in",
  );
});

test("unwrapFinanceEnvelope：其它业务错误码 → upstream-shape-changed", () => {
  assert.throws(
    () => unwrapFinanceEnvelope({ data: null, error_code: "500001" }, "test"),
    (err: Error & { kind?: string }) => err.kind === "upstream-shape-changed",
  );
});

test("unwrapFinanceEnvelope：error_code 是 string '0' 也算成功（类型漂移容忍）", () => {
  const out = unwrapFinanceEnvelope(
    { data: { list: [] }, error_code: "0" } as never,
    "test",
  );
  assert.deepEqual(out, []);
});

test("unwrapFinanceEnvelope：响应非对象 → upstream-shape-changed", () => {
  assert.throws(
    () => unwrapFinanceEnvelope(null, "test"),
    (err: Error & { kind?: string }) => err.kind === "upstream-shape-changed",
  );
});

test("unwrapFinanceEnvelope：data.list 缺失 → 空数组（不抛）", () => {
  assert.deepEqual(unwrapFinanceEnvelope({ data: {}, error_code: 0 }, "test"), []);
});

// ============================================================================
// 其它
// ============================================================================

test("isSingleQuarterType：S 系列识别", () => {
  for (const t of ["S0", "S1", "S4", "s2"]) {
    assert.equal(isSingleQuarterType(t), true, `${t} 应识别为单季口径`);
  }
  for (const t of ["all", "Q1", "Q4", "", "SS"]) {
    assert.equal(isSingleQuarterType(t), false, `${t} 不应识别为单季口径`);
  }
});

test("buildFinanceQuery：首页 timestamp 传空串", () => {
  const q = buildFinanceQuery("SH601127", "all", 5);
  assert.equal(q.timestamp, "", "首页传空串（实测与传当前时间戳等价）");
  assert.equal(q.is_detail, true);
  assert.equal(q.count, 5);
});

test("buildFinanceQuery：续页传游标", () => {
  const q = buildFinanceQuery("SH601127", "Q4", 5, "1743350400001");
  assert.equal(q.timestamp, "1743350400001");
});
