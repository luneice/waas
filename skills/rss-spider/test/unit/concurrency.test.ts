/**
 * concurrency 单元测试（L1，纯函数）。
 */
import { test } from "vitest";
import assert from "node:assert/strict";

import { runWithConcurrency } from "@src/utils/concurrency";

test("runWithConcurrency：结果按原始顺序返回，不受完成顺序影响", async () => {
  const items = [30, 10, 20];
  const results = await runWithConcurrency(items, 3, async (ms) => {
    await new Promise((r) => setTimeout(r, ms));
    return ms;
  });
  assert.deepEqual(results, [30, 10, 20], "即便耗时长的排前面先开始，结果顺序应与输入顺序一致");
});

test("runWithConcurrency：concurrency=1 时严格串行", async () => {
  const order: number[] = [];
  await runWithConcurrency([1, 2, 3], 1, async (item) => {
    order.push(item);
    await new Promise((r) => setTimeout(r, 1));
    return item;
  });
  assert.deepEqual(order, [1, 2, 3]);
});

test("runWithConcurrency：concurrency 非法值（0/负数）被 clamp 为 1，不抛错", async () => {
  const results = await runWithConcurrency([1, 2], 0, async (x) => x * 2);
  assert.deepEqual(results, [2, 4]);
});

test("runWithConcurrency：空数组直接返回空数组", async () => {
  const results = await runWithConcurrency([], 3, async (x) => x);
  assert.deepEqual(results, []);
});
