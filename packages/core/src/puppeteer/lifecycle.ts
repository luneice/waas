import type { Page } from "puppeteer-core";
import {
  HookAbortError,
  type HookFn,
  type IPageHook,
  type HookSignal,
} from "./hooks";
import type { PageContext } from "./context";
import { currentRuntime } from "../runtime";

// ============================================================================
// Data Pipeline 阶段名（用于 skipPipeline 语义）
// ============================================================================

/** 被视为 Data Pipeline 的阶段；skipPipeline 会跳过这些阶段的剩余部分 */
export const DATA_PIPELINE_STAGES: readonly string[] = [
  "extract",
  "transform",
  "persist",
];

// ============================================================================
// LifecycleStage — 抽象基类
// ============================================================================

/**
 * LifecycleStage — 页面生命周期中的一个执行阶段。
 *
 * 行为契约：
 *   - 每个 Hook 进入前**惰性**求值 `shouldActivate(ctx)`
 *   - Hook 返回 HookSignal 时：
 *       - skipStage    → break，本 Stage 不再执行后续 Hook
 *       - skipPipeline → 抛出受控错误由 PageLifecycle 捕获，终止后续 Pipeline Stage
 *       - abort        → 抛出 HookAbortError，execute() 走 failure 分支
 */
export abstract class LifecycleStage {
  abstract readonly name: string;

  protected abstract pick(hook: IPageHook): HookFn | undefined;

  async run(
    hooks: IPageHook[],
    page: Page,
    ctx: PageContext<object>,
  ): Promise<void> {
    for (const hook of hooks) {
      if (hook.shouldActivate && !hook.shouldActivate(ctx)) {
        currentRuntime().events.emit({
          kind: "hook.invoke",
          stage: this.name,
          hookName: hook.name,
          durationMs: 0,
          status: "skipped",
          skillId: "",
        });
        continue;
      }
      const fn = this.pick(hook);
      if (!fn) continue;

      const startedAt = Date.now();
      let result: HookSignal | void | undefined;
      try {
        result = (await fn.call(hook, page, ctx)) as
          | HookSignal
          | void
          | undefined;
      } catch (err) {
        currentRuntime().events.emit({
          kind: "hook.invoke",
          stage: this.name,
          hookName: hook.name,
          durationMs: Date.now() - startedAt,
          status: "failure",
          errorMessage: (err as Error).message,
          skillId: "",
        });
        throw err;
      }

      let signal: "skipStage" | "skipPipeline" | "abort" | undefined;
      const sig = (result ?? undefined) as HookSignal | undefined;
      if (sig?.abort) signal = "abort";
      else if (sig?.skipPipeline) signal = "skipPipeline";
      else if (sig?.skipStage) signal = "skipStage";

      currentRuntime().events.emit({
        kind: "hook.invoke",
        stage: this.name,
        hookName: hook.name,
        durationMs: Date.now() - startedAt,
        status: "success",
        signal,
        skillId: "",
      });

      if (!result) continue;
      if (result.abort) {
        throw new HookAbortError(
          result.abort.reason,
          (result.abort.kind ?? "hook-abort") as never,
        );
      }
      if (result.skipPipeline) {
        throw new PipelineHalt(this.name);
      }
      if (result.skipStage) {
        return;
      }
    }
  }
}

// ============================================================================
// PipelineHalt — 受控信号（非错误），由 PageLifecycle.run 捕获
// ============================================================================

/** 内部控制流信号：skipPipeline 被触发后，终止 Data Pipeline 阶段链。 */
export class PipelineHalt extends Error {
  constructor(readonly originStage: string) {
    super(`pipeline halted at stage "${originStage}"`);
    this.name = "PipelineHalt";
  }
}

// ============================================================================
// Page Control 阶段
// ============================================================================

export class SetupStage extends LifecycleStage {
  readonly name = "setup";
  protected pick(h: IPageHook) {
    return h.setup;
  }
}

export class ReadyStage extends LifecycleStage {
  readonly name = "ready";
  protected pick(h: IPageHook) {
    return h.ready;
  }
}

export class InteractStage extends LifecycleStage {
  readonly name = "interact";
  protected pick(h: IPageHook) {
    return h.interact;
  }
}

// ============================================================================
// Data Pipeline 阶段
// ============================================================================

export class ExtractStage extends LifecycleStage {
  readonly name = "extract";
  protected pick(h: IPageHook) {
    return h.extract;
  }
}

export class TransformStage extends LifecycleStage {
  readonly name = "transform";
  protected pick(h: IPageHook) {
    return h.transform;
  }
}

export class PersistStage extends LifecycleStage {
  readonly name = "persist";
  protected pick(h: IPageHook) {
    return h.persist;
  }
}

/**
 * Emit 阶段已被废弃，副作用产出请使用 ProjectionPipeline.emit。
 */

// ============================================================================
// Cleanup 阶段
// ============================================================================

/**
 * Teardown — 清理阶段。
 *
 * 两个关键差异：
 *   1. 忽略 shouldActivate：setup 挂的资源一定要清（幂等检查在 Hook 内部完成）
 *   2. 吞异常：teardown 永不阻断流程
 */
export class TeardownStage extends LifecycleStage {
  readonly name = "teardown";
  protected pick(h: IPageHook) {
    return h.teardown;
  }

  override async run(
    hooks: IPageHook[],
    page: Page,
    ctx: PageContext<object>,
  ): Promise<void> {
    for (const hook of hooks) {
      const fn = this.pick(hook);
      if (!fn) continue;
      try {
        await fn.call(hook, page, ctx);
      } catch {
        /* teardown 永不阻断 */
      }
    }
  }
}

// ============================================================================
// PageLifecycle — 阶段的有序组合
// ============================================================================

export class PageLifecycle {
  constructor(private readonly stages: LifecycleStage[]) {}

  stage(name: string): LifecycleStage | undefined {
    return this.stages.find((s) => s.name === name);
  }

  /** 执行指定名称的 Stage */
  async run(
    name: string,
    hooks: IPageHook[],
    page: Page,
    ctx: PageContext<object>,
  ): Promise<void> {
    const s = this.stage(name);
    if (!s) return;
    await s.run(hooks, page, ctx);
  }

  /**
   * 按 DATA_PIPELINE_STAGES 顺序执行 Data Pipeline。
   * 若某 Hook 发出 skipPipeline，捕获 PipelineHalt 并返回当前已完成的 Stage。
   */
  async runDataPipeline(
    hooks: IPageHook[],
    page: Page,
    ctx: PageContext<object>,
  ): Promise<{ halted: boolean; at?: string }> {
    try {
      for (const stageName of DATA_PIPELINE_STAGES) {
        await this.run(stageName, hooks, page, ctx);
      }
      return { halted: false };
    } catch (err) {
      if (err instanceof PipelineHalt) {
        return { halted: true, at: err.originStage };
      }
      throw err;
    }
  }
}

// ============================================================================
// 默认实例
// ============================================================================

/**
 * 标准页面生命周期：
 *   setup → [navigate] → ready → interact → [fetchData] → extract →
 *   transform → persist → teardown
 *
 * 方括号标注的阶段由 Skill 模板方法完成，不经过 PageLifecycle。
 * teardown 由独立实例在 finally 中执行，不受 skipPipeline 影响。
 */
export const defaultLifecycle = new PageLifecycle([
  new SetupStage(),
  new ReadyStage(),
  new InteractStage(),
  new ExtractStage(),
  new TransformStage(),
  new PersistStage(),
]);

/** TeardownStage 独立实例 — 在 finally 中使用 */
export const teardownStage = new TeardownStage();
