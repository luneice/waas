import { test } from "vitest";
import assert from "node:assert/strict";

import { extractPublishedAtFromText } from "@src/enrichment/readability.extractor";

test.each([
  ["发布时间：2026-08-10 19:08 信息来源：某平台", "2026-08-10 19:08"],
  ["发布日期 2026年8月10日", "2026-8-10"],
  ["Published on: 2026-08-10T19:08:30+08:00", "2026-08-10T19:08:30+08:00"],
] as const)("可从语义标签文本提取发布时间：%s", (text, expected) => {
  assert.equal(extractPublishedAtFromText(text), expected);
});

test("无发布语义标签时不猜测时间", () => {
  assert.equal(extractPublishedAtFromText("页面中只有 2026-08-10 的普通文本"), undefined);
});
