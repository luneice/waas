import type { Page } from "puppeteer-core";
import type { PageContext } from "./context";
import type { SlotKey } from "./slots";

// ============================================================================
// Hook 执行信号 — 支持短路与中止
// ============================================================================

/**
 * Hook 返回的控制信号。
 * 返回 `void | undefined` 表示正常继续。
 */
export interface HookSignal {
  /** 跳过当前 Stage 剩余 Hook，其它 Stage 继续执行 */
  skipStage?: boolean;
  /** 跳过**所有后续** Data Pipeline 阶段（直接进入 projection → teardown） */
  skipPipeline?: boolean;
  /** 中止整个 Skill 执行，跳到 teardown 并产出 failure 结果 */
  abort?: { reason: string; kind?: string };
}

export type HookOutcome = void | HookSignal | undefined;

/** 快捷：跳过当前 Stage 剩余 Hook */
export const SKIP_STAGE: HookSignal = Object.freeze({ skipStage: true });

/** 快捷：跳过所有后续 Data Pipeline 阶段 */
export const SKIP_PIPELINE: HookSignal = Object.freeze({ skipPipeline: true });

/** 快捷：中止整个 Skill 执行 */
export function abortPipeline(reason: string, kind = "hook-abort"): HookSignal {
  return { abort: { reason, kind } };
}

// HookAbortError 现在由统一的错误体系（../errors）提供，从那里 re-export。
export { HookAbortError } from "../errors";

// ============================================================================
// Hook 签名
// ============================================================================

// Hook 操作的是通用上下文，不关心具体 TParams。
export type HookFn<TParams extends object = object> = (
  page: Page,
  ctx: PageContext<TParams>,
) => Promise<HookOutcome> | HookOutcome;

// ============================================================================
// IPageHook
// ============================================================================

/**
 * Page 生命周期 Hook — 可插拔的页面交互参与者。
 *
 * 一个 Hook 可实现任意阶段的组合。多个 Hook 按声明顺序执行。
 * 每个阶段方法可返回 `HookSignal` 控制流：跳过当前 Stage、跳过剩余管道、或中止。
 *
 * Page Control 阶段：
 *   setup     — 导航前：挂监听器、设置拦截、配置页面环境
 *   ready     — 导航后：等待页面可交互
 *   interact  — 操作页面：点击、滚动、填表、翻页
 *
 * Data Pipeline 阶段：
 *   extract   — 采集数据：收割被动捕获、主动下载
 *   transform — 加工数据：过滤、转换、元数据组装
 *   persist   — 持久化：写入外部存储，生成 Artifact 清单
 *
 * Cleanup：
 *   teardown  — 执行结束（finally）：清理监听器、释放资源
 *
 * 注意：navigate 和 fetchData 是 Skill 自身核心职责，不暴露为 Hook 阶段。
 * 副作用产出（落盘、通知）不是 Hook 阶段 —— 走 ProjectionPipeline.emit。
 */
export interface IPageHook {
  /** Hook 标识（日志 / 调试用） */
  readonly name: string;

  /**
   * 运行时激活条件 — 每个 Stage **进入前**都会重新求值（lazy）。
   * 默认 true（不实现则始终激活）。
   *
   * 这让 Hook 能响应前面 Stage 写入的 Slot，无需依赖已废弃的 initContext。
   *
   * teardown Stage 例外：为保证资源清理，即使 shouldActivate 返回 false
   * teardown 仍会被执行（见 TeardownStage）。
   */
  shouldActivate?(ctx: PageContext<object>): boolean;

  // ── Page Control ──

  setup?: HookFn;
  ready?: HookFn;
  interact?: HookFn;

  // ── Data Pipeline ──

  extract?: HookFn;
  transform?: HookFn;
  persist?: HookFn;

  // ── Cleanup ──

  teardown?: HookFn;
}

// ============================================================================
// 激活谓词辅助
// ============================================================================

export type ActivationPredicate = (ctx: PageContext<object>) => boolean;

/**
 * 基于参数字段的激活谓词。
 * @param name 参数键名
 * @param defaultValue 参数未定义时的默认值（truthy 判断）
 */
export function whenParam(
  name: string,
  defaultValue: boolean = false,
): ActivationPredicate {
  return (ctx) => {
    const p = ctx.params as Record<string, unknown>;
    const v = p[name];
    if (v === undefined || v === null) return defaultValue;
    return !!v;
  };
}

/** 参数字段严格不等于给定值时激活 */
export function whenParamNot(
  name: string,
  value: unknown,
): ActivationPredicate {
  return (ctx) => {
    const p = ctx.params as Record<string, unknown>;
    return p[name] !== value;
  };
}

/** 基于 Slot 存在性的激活谓词 */
export function whenSlot<T>(slot: SlotKey<T>): ActivationPredicate {
  return (ctx) => ctx.has(slot);
}

/** 取反 */
export function not(p: ActivationPredicate): ActivationPredicate {
  return (ctx) => !p(ctx);
}

/** 全部满足 */
export function allOf(...ps: ActivationPredicate[]): ActivationPredicate {
  return (ctx) => ps.every((p) => p(ctx));
}

/** 任一满足 */
export function anyOf(...ps: ActivationPredicate[]): ActivationPredicate {
  return (ctx) => ps.some((p) => p(ctx));
}
