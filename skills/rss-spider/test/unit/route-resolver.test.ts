/**
 * route-resolver 单元测试（L1，纯函数）。
 *
 * resolveRouteConfig 的优先级三级回退：显式参数 > 环境变量 > 内嵌默认，
 * 每一级又分 embedded/external 两种 baseUrl 形态——共 2×3=6 个组合。
 *
 * ⚠ 读 process.env.RSSHUB_BASE_URL，用例之间必须清理，否则会互相污染。
 */
import { test, beforeEach, afterEach } from "vitest";
import assert from "node:assert/strict";

import { normalizeRoute, buildRouteUrl, resolveRouteConfig, EMBEDDED_BASE_URL } from "@src/rsshub/route-resolver";

const ORIGINAL_ENV = process.env.RSSHUB_BASE_URL;

beforeEach(() => {
  delete process.env.RSSHUB_BASE_URL;
});

afterEach(() => {
  if (ORIGINAL_ENV === undefined) delete process.env.RSSHUB_BASE_URL;
  else process.env.RSSHUB_BASE_URL = ORIGINAL_ENV;
});

// ============================================================================
// normalizeRoute / buildRouteUrl
// ============================================================================

test("normalizeRoute：补齐前导斜杠", () => {
  assert.equal(normalizeRoute("bilibili/user/video/1"), "/bilibili/user/video/1");
  assert.equal(normalizeRoute("/already/slashed"), "/already/slashed");
});

test("normalizeRoute：空白/空串 → missing-context", () => {
  assert.throws(
    () => normalizeRoute("   "),
    (err: unknown) => (err as { kind: string }).kind === "missing-context",
  );
});

test("buildRouteUrl：拼接 baseUrl 与 route，去除多余斜杠", () => {
  assert.equal(buildRouteUrl("https://rsshub.example.invalid/", "/github/trending/daily"), "https://rsshub.example.invalid/github/trending/daily");
  assert.equal(buildRouteUrl("https://rsshub.example.invalid", "github/trending/daily"), "https://rsshub.example.invalid/github/trending/daily");
});

// ============================================================================
// resolveRouteConfig —— 三级优先级 × embedded/external 两形态
// ============================================================================

test("优先级①显式参数：embedded 形态", () => {
  const r = resolveRouteConfig("/x", "rsshub://embedded");
  assert.equal(r.source, "param-override");
  assert.equal(r.mode, "embedded-package");
  assert.equal(r.resolvedBaseUrl, "rsshub://embedded");
});

test("优先级①显式参数：external 形态", () => {
  const r = resolveRouteConfig("/x", "https://my-rsshub.example.invalid/");
  assert.equal(r.source, "param-override");
  assert.equal(r.mode, "external-http");
  assert.equal(r.resolvedBaseUrl, "https://my-rsshub.example.invalid");
});

test("优先级②环境变量：显式参数缺失时回退 env，embedded 形态", () => {
  process.env.RSSHUB_BASE_URL = "rsshub://embedded";
  const r = resolveRouteConfig("/x");
  assert.equal(r.source, "env-default");
  assert.equal(r.mode, "embedded-package");
});

test("优先级②环境变量：external 形态", () => {
  process.env.RSSHUB_BASE_URL = "https://env-rsshub.example.invalid";
  const r = resolveRouteConfig("/x");
  assert.equal(r.source, "env-default");
  assert.equal(r.mode, "external-http");
  assert.equal(r.resolvedBaseUrl, "https://env-rsshub.example.invalid");
});

test("优先级③内嵌默认：显式参数与 env 都缺失", () => {
  const r = resolveRouteConfig("/x");
  assert.equal(r.source, "embedded-default");
  assert.equal(r.mode, "embedded-package");
  assert.equal(r.resolvedBaseUrl, "rsshub://embedded");
});

test("优先级：显式参数优先于环境变量（即便二者都给了）", () => {
  process.env.RSSHUB_BASE_URL = "https://env-rsshub.example.invalid";
  const r = resolveRouteConfig("/x", "https://param-rsshub.example.invalid");
  assert.equal(r.source, "param-override");
  assert.equal(r.resolvedBaseUrl, "https://param-rsshub.example.invalid");
});

test("EMBEDDED_BASE_URL 常量导出值稳定", () => {
  assert.equal(EMBEDDED_BASE_URL, "rsshub://embedded");
});
