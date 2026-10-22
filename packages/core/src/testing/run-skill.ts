// ============================================================================
// runSkillWithFixtures — skill 模块测试（L2）的唯一入口
// ============================================================================
//
// 把「替身接线 + 运行时注入 + 执行」三件事收成一次调用：
//   FakePage(upstream) → FakeSessionProvider → 反射注入 skill.deps
//   → createTestRuntime → runWithRuntime（testing 是 §2.7 允许的调用点之一）
//
// ── 与 docs/TESTING.md §3.1 草案签名的差异（语义未变，仅多返回一层）──
//   草案是 `Promise<SkillResult<T>>`。实施时改为返回 SkillRunOutcome，因为
//   §3.2 要求的 RAII 平衡断言与 obs 事件流断言都必须拿到 provider / events；
//   若只回 SkillResult，每个用例都得自己把接线再做一遍，harness 就不成其为
//   「唯一入口」了。result 仍在 outcome.result 上，消费方式不变。
//
// ── 注入纪律 ──
//   sessionProvider 一律替换（测试就是要切断真浏览器）；
//   artifactSink **默认不动** —— 凭空塞一个 sink 会让 ArtifactPersistHook
//   挂上去，skill 的行为与生产态不再一致。只有显式给了 storageRoot /
//   artifactSink 才注入，此时是调用方明确要测落盘。
// ============================================================================

import type { ISkill, SkillResult } from "../skill/interfaces";
import type { SkillFailureKind } from "../errors";
import type { BrowserSkillOptions } from "../puppeteer/interfaces";
import type { IArtifactSink } from "../storage/interfaces";
import type { ObsEvent } from "../observability";
import { FileArtifactSink } from "../storage/file-store";
import { MemoryArtifactSink } from "../storage/memory-store";
import { runWithRuntime } from "../runtime";
import { FakeUpstream } from "./fake-upstream";
import { FakePage } from "./fake-page";
import { FakeSessionProvider } from "./fake-session-provider";
import { createTestRuntime } from "./runtime";

export interface RunSkillFixtures {
  /** 上游替身 —— 必填，fixture 缺口即测试失败（见 FakeUpstream 设计约束 1） */
  upstream: FakeUpstream;
  /** 页面 HTML（DOM 型 evaluate 回调需要，依赖可选的 linkedom） */
  html?: string;
  /** 复用已有 FakePage（同一实例跨多次 execute 断言导航次序时用） */
  page?: FakePage;
  /** 复用已有 provider（skill 构造时已注入的场景：registry 接线测试） */
  provider?: FakeSessionProvider;
  /** 显式指定 sink（给了才注入，见文件头「注入纪律」） */
  artifactSink?: IArtifactSink;
  /** 给了就用 FileArtifactSink 落到该目录（测真实落盘时用临时目录） */
  storageRoot?: string;
  /** 透传给 skill.execute 的执行选项（projectionMode: "raw" 等） */
  options?: BrowserSkillOptions;
}

export interface SkillRunOutcome<T> {
  result: SkillResult<T>;
  /** 按 emit 次序收集的可观测事件（断言 stage.start/end 配对用） */
  events: ObsEvent[];
  blobs: Map<string, unknown>;
  upstream: FakeUpstream;
  page: FakePage;
  provider: FakeSessionProvider;
  /** 实际生效的 sink（未注入时为 undefined —— skill 用的是自己的） */
  artifactSink?: IArtifactSink;

  /**
   * 断言成功并取出 data。
   *
   * 存在的理由：`assert.ok(result.success)` 失败时只打印 "expected true"，
   * 真正的诊断（errorInfo.kind / message）全丢了。这里把它带进断言消息。
   */
  expectSuccess(): T;
  /** 断言失败并取出 kind —— 错误矩阵用例的标准写法 */
  expectFailureKind(): SkillFailureKind;
}

/** 宽松的 skill 形参类型：harness 不关心 TParams/TResult 的具体收窄 */
type AnySkill<T> = ISkill<never, unknown, T, BrowserSkillOptions>;

export async function runSkillWithFixtures<T = unknown>(
  skill: AnySkill<T>,
  params: object,
  fixtures: RunSkillFixtures,
): Promise<SkillRunOutcome<T>> {
  const page =
    fixtures.page ??
    new FakePage({ upstream: fixtures.upstream, html: fixtures.html });
  const provider = fixtures.provider ?? new FakeSessionProvider(page);

  const artifactSink = resolveSink(fixtures);
  bindFakeDeps(skill, provider, artifactSink);

  const { runtime, events, blobs } = createTestRuntime();
  const result = (await runWithRuntime(runtime, () =>
    skill.execute(params as never, fixtures.options),
  )) as SkillResult<T>;

  return {
    result,
    events,
    blobs,
    upstream: fixtures.upstream,
    page,
    provider,
    artifactSink,
    expectSuccess(): T {
      if (!result.success) {
        const info = result.metadata.errorInfo;
        throw new Error(
          `期望 skill "${skill.id}" 成功，实际失败：` +
            `kind=${info?.kind ?? "<无>"} scope=${info?.scope ?? "<无>"} ` +
            `phase=${info?.phase ?? "<无>"} message=${result.error}`,
        );
      }
      return result.data;
    },
    expectFailureKind(): SkillFailureKind {
      if (result.success) {
        throw new Error(
          `期望 skill "${skill.id}" 失败，实际成功。data=${safePreview(result.data)}`,
        );
      }
      const kind = result.metadata.errorInfo?.kind;
      if (!kind) {
        throw new Error(
          `skill "${skill.id}" 失败但 metadata.errorInfo.kind 缺失 —— ` +
            `buildFailure 归一化被绕过了。error=${result.error}`,
        );
      }
      return kind;
    },
  };
}

function resolveSink(fixtures: RunSkillFixtures): IArtifactSink | undefined {
  if (fixtures.artifactSink) return fixtures.artifactSink;
  if (fixtures.storageRoot) return new FileArtifactSink(fixtures.storageRoot);
  return undefined;
}

/** 未指定 storageRoot 但要断言落盘内容时，用它取一个进程内 sink */
export function memorySink(): MemoryArtifactSink {
  return new MemoryArtifactSink();
}

/**
 * 反射改写 skill 的构造函数依赖。
 *
 * `deps` 是 protected readonly 字段，但 readonly 只约束**重新赋值字段本身**，
 * 改写它指向的对象属性在运行时完全合法。纯 BaseSkill（无浏览器链路）没有
 * deps，此时静默跳过 —— 那类 skill 的替身接缝不在这里。
 */
function bindFakeDeps(
  skill: object,
  provider: FakeSessionProvider,
  artifactSink?: IArtifactSink,
): void {
  const deps = (skill as { deps?: Record<string, unknown> }).deps;
  if (!deps || typeof deps !== "object") return;
  deps.sessionProvider = provider;
  if (artifactSink) deps.artifactSink = artifactSink;
}

function safePreview(value: unknown): string {
  try {
    const s = JSON.stringify(value);
    return s && s.length > 200 ? `${s.slice(0, 200)}…` : String(s);
  } catch {
    return "<不可序列化>";
  }
}
