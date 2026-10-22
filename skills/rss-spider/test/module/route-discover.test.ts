/**
 * route-discover 模块测试（L2，docs/TESTING.md §3.3 标准三件）。
 *
 * RouteDiscoverSkill 是 BaseSkill 直接子类，唯一依赖 IRsshubDiscovery（纯接口），
 * 零网络、零浏览器——不经 runSkillWithFixtures/FakeUpstream/FakePage，直接
 * `new RouteDiscoverSkill({discovery: fake}).execute(params)` 即可驱动完整链路。
 *
 * 覆盖四个分派分支的互斥优先级（listNamespaces > url > namespace > query）、
 * count 计算、missing-context、discovery.initialize() 失败传播。
 *
 * 断言纪律（§8 红线）：只锁 kind 不锁 message。
 */
import { test } from "vitest";
import assert from "node:assert/strict";

import { RouteDiscoverSkill } from "@src/skill/route-discover.skill";
import { expectSnapshot } from "../helpers/snapshot";
import {
  createFakeDiscovery,
  createFailingDiscovery,
  sampleRoutes,
  sampleDetections,
} from "../fixtures/route-discover.fixture";

// ============================================================================
// ① 成功信封 —— 四个分派分支
// ============================================================================

test("成功信封：listNamespaces=true → matchMode=list-namespaces", async () => {
  const skill = new RouteDiscoverSkill({ discovery: createFakeDiscovery() });
  const result = await skill.execute({ listNamespaces: true });

  expectSnapshot("route-discover-list-namespaces", result);

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.matchMode, "list-namespaces");
  assert.deepEqual(result.data.namespaces, ["bilibili", "github"]);
  assert.equal(result.data.count, 2);
});

test("成功信封：传 url → matchMode=radar，命中检测结果", async () => {
  const skill = new RouteDiscoverSkill({ discovery: createFakeDiscovery() });
  const result = await skill.execute({ url: "https://www.bilibili.com/video/BV1xx" });

  expectSnapshot("route-discover-radar", result);

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.matchMode, "radar");
  assert.deepEqual(result.data.radarDetections, sampleDetections);
  assert.equal(result.data.count, 1);
});

test("成功信封：传 namespace → matchMode=namespace，返回该命名空间下全部路由", async () => {
  const skill = new RouteDiscoverSkill({ discovery: createFakeDiscovery() });
  const result = await skill.execute({ namespace: "bilibili" });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.matchMode, "namespace");
  assert.equal(result.data.routes?.length, 2);
  assert.equal(result.data.count, 2);
});

test("成功信封：传 query → matchMode=search，按关键词模糊匹配", async () => {
  const skill = new RouteDiscoverSkill({ discovery: createFakeDiscovery() });
  const result = await skill.execute({ query: "github" });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.matchMode, "search");
  assert.equal(result.data.count, 1);
  assert.equal(result.data.routes?.[0].namespace, "github");
});

// ============================================================================
// ② 分派优先级（互斥场景：listNamespaces > url > namespace > query）
// ============================================================================

test("优先级：listNamespaces 与 url 同传 → listNamespaces 优先", async () => {
  const skill = new RouteDiscoverSkill({ discovery: createFakeDiscovery() });
  const result = await skill.execute({
    listNamespaces: true,
    url: "https://www.bilibili.com/video/BV1xx",
  });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.matchMode, "list-namespaces");
});

test("优先级：url 与 namespace 同传 → url（radar）优先", async () => {
  const skill = new RouteDiscoverSkill({ discovery: createFakeDiscovery() });
  const result = await skill.execute({
    url: "https://www.bilibili.com/video/BV1xx",
    namespace: "github",
  });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.matchMode, "radar");
});

test("优先级：namespace 与 query 同传 → namespace 优先", async () => {
  const skill = new RouteDiscoverSkill({ discovery: createFakeDiscovery() });
  const result = await skill.execute({ namespace: "bilibili", query: "github" });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.matchMode, "namespace");
});

// ============================================================================
// ③ 错误 kind 矩阵
// ============================================================================

test("矩阵·非法参数：四个入口全缺 → missing-context", async () => {
  const skill = new RouteDiscoverSkill({ discovery: createFakeDiscovery() });
  const result = await skill.execute({});

  assert.equal(result.success, false);
  if (result.success) return;
  assert.equal(result.metadata.errorInfo?.kind, "missing-context");
});

test("矩阵·非法参数：listNamespaces=false 且其余全缺 → missing-context", async () => {
  const skill = new RouteDiscoverSkill({ discovery: createFakeDiscovery() });
  const result = await skill.execute({ listNamespaces: false });

  assert.equal(result.success, false);
  if (result.success) return;
  assert.equal(result.metadata.errorInfo?.kind, "missing-context");
});

test("矩阵·discovery.initialize() 失败 → 错误原样透传（pipeline-error 兜底）", async () => {
  const skill = new RouteDiscoverSkill({ discovery: createFailingDiscovery() });
  const result = await skill.execute({ url: "https://www.bilibili.com/video/BV1xx" });

  assert.equal(result.success, false);
  if (result.success) return;
  assert.ok(result.metadata.errorInfo?.kind, "buildFailure 必须归一化出 kind");
});

// ============================================================================
// ④ 正常空集
// ============================================================================

test("正常空集：url 命中域名但无匹配路由 → success + radarDetections:[]，不报错", async () => {
  const skill = new RouteDiscoverSkill({ discovery: createFakeDiscovery() });
  const result = await skill.execute({ url: "https://www.example-unknown-site.invalid/x" });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.deepEqual(result.data.radarDetections, []);
  assert.equal(result.data.count, 0);
});

test("正常空集：namespace 不存在 → success + routes:[]，不报错", async () => {
  const skill = new RouteDiscoverSkill({ discovery: createFakeDiscovery() });
  const result = await skill.execute({ namespace: "no-such-namespace" });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.deepEqual(result.data.routes, []);
  assert.equal(result.data.count, 0);
});

test("正常空集：query 搜不到任何路由 → success + routes:[]，不报错", async () => {
  const skill = new RouteDiscoverSkill({ discovery: createFakeDiscovery() });
  const result = await skill.execute({ query: "zzz-no-match-zzz" });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.deepEqual(result.data.routes, []);
  assert.equal(result.data.count, 0);
});

// ============================================================================
// ⑤ 元数据回显
// ============================================================================

test("元数据：metadata.params 回显入参，metadata.skillId/skillName 固定", async () => {
  const skill = new RouteDiscoverSkill({ discovery: createFakeDiscovery() });
  const result = await skill.execute({ namespace: "bilibili" });

  assert.equal(result.metadata.skillId, "route-discover");
  assert.equal(result.metadata.skillName, "RSSHub 路由发现");
  assert.deepEqual(result.metadata.params, { namespace: "bilibili" });
});
