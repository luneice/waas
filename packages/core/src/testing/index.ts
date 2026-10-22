// ============================================================================
// @spider/core/testing — 测试替身与夹具（对外导出，业务包 devtime 引用）
// ============================================================================
//
// 分层对应 docs/TESTING.md：
//   L1（纯函数）  createSnapshotter · invokeNormalize · createTestContext
//   L2（模块级）  FakeUpstream → FakePage → FakeSessionProvider
//                 → runSkillWithFixtures（一站式 harness，唯一入口）
//   拦截器回放     createFakeResponse + FakePage.dispatch("response", r)
//
// 设计要点集中在两个文件的头注释里，改这里之前先读：
//   fake-page.ts   —— evaluate 为什么必须走 node:vm（序列化边界）
//   fake-upstream.ts —— 未命中为什么默认 throw（fixture 缺口即测试缺陷）
//
// ⚠️ 本模块只在 devtime 被测试引用，不进任何 skill 的生产 bundle。
// ============================================================================

import { PageContext } from "../puppeteer/context";
import type { BrowserSkillOptions } from "../puppeteer/interfaces";

// ── 运行时夹具 ──
export { createTestRuntime, type TestRuntimeHandle } from "./runtime";
export { MemoryArtifactSink } from "../storage/memory-store";

// ── L2 替身四件套 ──
export { FakeUpstream } from "./fake-upstream";
export type {
  FixtureReply,
  RecordedCall,
  ResolvedReply,
} from "./fake-upstream";

export { FakePage, FakeEvaluateError } from "./fake-page";
export type { FakePageOptions } from "./fake-page";

export { FakeSessionProvider } from "./fake-session-provider";
export type { AcquireRecord } from "./fake-session-provider";

export { runSkillWithFixtures, memorySink } from "./run-skill";
export type { RunSkillFixtures, SkillRunOutcome } from "./run-skill";

// ── L1 辅助 ──
export {
  invokeNormalize,
  invokeValidate,
  invokeNormalizeAndValidate,
} from "./invoke-normalize";

export { createSnapshotter, DEFAULT_VOLATILE_KEYS } from "./snapshot";
export type { Snapshotter, SnapshotterOptions } from "./snapshot";

// ── 拦截器回放 ──
export { createFakeResponse } from "./fake-response";
export type { FakeResponseLike } from "./fake-response";

// ============================================================================
// createTestContext — 跳过 lifecycle 直接拿 PageContext
// ============================================================================

/** 单独验证 Hook 行为时用：一行构造 PageContext，不跑 execute() 全流程。 */
export function createTestContext<TParams extends object>(
  params: TParams,
  options?: BrowserSkillOptions,
): PageContext<TParams> {
  return new PageContext<TParams>(params, options);
}
