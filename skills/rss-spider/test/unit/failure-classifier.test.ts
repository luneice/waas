/**
 * failure-classifier 单元测试（L1，纯函数）。
 *
 * classifyRouteFailure 把 Error.message 归类为三种 FailureKind，
 * 判定优先级：显式前缀 > browser 关键词 > embedded runtime 缺失
 * （仅当 baseUrl 是 embedded 时才检测）> 连接性错误 > HTTP 状态码 > 默认兜底。
 */
import { test } from "vitest";
import assert from "node:assert/strict";

import { classifyRouteFailure, formatFailureMessage } from "@src/rsshub/failure-classifier";

const EMBEDDED = "rsshub://embedded";
const EXTERNAL = "https://my-rsshub.example.invalid";

test("显式前缀「服务不可用:」→ service_unavailable，剥离前缀", () => {
  const r = classifyRouteFailure(new Error("服务不可用: 连接超时"), "/x", EXTERNAL);
  assert.equal(r.kind, "service_unavailable");
  assert.equal(r.message, "连接超时");
  assert.equal(r.recoverable, true);
});

test("显式前缀「路由不可用:」→ route_unavailable，且 recoverable=false", () => {
  const r = classifyRouteFailure(new Error("路由不可用: 该站点已下线"), "/x", EXTERNAL);
  assert.equal(r.kind, "route_unavailable");
  assert.equal(r.recoverable, false);
});

test("显式前缀「浏览器能力不可用:」→ browser_capability_unavailable", () => {
  const r = classifyRouteFailure(new Error("浏览器能力不可用: 未配置 BROWSER_URL"), "/x", EXTERNAL);
  assert.equal(r.kind, "browser_capability_unavailable");
});

test("browser 关键词命中（未走显式前缀）→ browser_capability_unavailable", () => {
  const r = classifyRouteFailure(new Error("Failed to launch the browser process"), "/x", EXTERNAL);
  assert.equal(r.kind, "browser_capability_unavailable");
});

test("embedded baseUrl + 模块缺失关键词 → browser_capability_unavailable（非 embedded baseUrl 时不应触发同一判定）", () => {
  const r1 = classifyRouteFailure(new Error("Cannot find module 'rsshub'"), "/x", EMBEDDED);
  assert.equal(r1.kind, "browser_capability_unavailable");

  // 同样的错误信息，但 baseUrl 不是 embedded：不应命中「内嵌 runtime 缺失」分支，
  // 落到下面的连接性/默认判定。
  const r2 = classifyRouteFailure(new Error("Cannot find module 'rsshub'"), "/x", EXTERNAL);
  assert.notEqual(r2.message, r1.message);
});

test("连接性错误关键词（ECONNREFUSED）→ service_unavailable", () => {
  const r = classifyRouteFailure(new Error("connect ECONNREFUSED 127.0.0.1:1200"), "/x", EXTERNAL);
  assert.equal(r.kind, "service_unavailable");
  assert.ok(r.message.includes(EXTERNAL));
});

test("HTTP 状态码错误（Feed 请求失败: 503）→ route_unavailable", () => {
  const r = classifyRouteFailure(new Error("Feed 请求失败: 503 Service Unavailable (https://x.invalid)"), "/x", EXTERNAL);
  assert.equal(r.kind, "route_unavailable");
});

test("无法识别的错误信息 → 默认兜底 route_unavailable", () => {
  const r = classifyRouteFailure(new Error("某种从未见过的错误"), "/x", EXTERNAL);
  assert.equal(r.kind, "route_unavailable");
});

test("非 Error 对象（字符串/其它）也能正常分类，不抛出", () => {
  const r = classifyRouteFailure("纯字符串错误", "/x", EXTERNAL);
  assert.equal(r.kind, "route_unavailable");
});

test("formatFailureMessage：三种 kind 各自的前缀", () => {
  assert.ok(formatFailureMessage({ kind: "service_unavailable", message: "m", recoverable: true }).startsWith("服务不可用:"));
  assert.ok(formatFailureMessage({ kind: "route_unavailable", message: "m", recoverable: false }).startsWith("路由不可用:"));
  assert.ok(formatFailureMessage({ kind: "browser_capability_unavailable", message: "m", recoverable: true }).startsWith("浏览器能力不可用:"));
});
