// ============================================================================
// Page 层重试 — 装饰器 + helper
// ============================================================================
//
// 设计原则：
//   - 不依赖于 Goal 层的 retry（那个是 endpoint 单次 HTTP 重试）
//   - 这里管的是「Page 操作失败」，例如 page.goto 抖动、waitForSelector 超时
//   - 用装饰器声明在 Skill 类上：@RetryNavigation / @RetryStage
//   - 实际执行通过 RetryPolicy.run() helper，可在自定义 fetchData 中复用
//
// 错误分类联动：
//   - 默认只对 SpiderError.isRetryable() === true 的错误重试
//   - 也可指定 retryIf(err) 自定义判定
//   - 重试耗尽后抛 RetryExhaustedError，cause 为最后一次原始错误
// ============================================================================

import "reflect-metadata";
import { RetryExhaustedError, SpiderError, toSpiderError } from "../errors";
import { currentRuntime } from "../runtime";
import type { StageName } from "./decorators";

export type RetryBackoff = "constant" | "linear" | "exponential";

export interface RetryPolicyOptions {
  /** 最大重试次数（不含首次执行；3 = 最多 4 次执行） */
  times?: number;
  /** 首次重试延迟 ms */
  delayMs?: number;
  /** 最大延迟 ms（exponential 时封顶） */
  maxDelayMs?: number;
  /** 退避策略 */
  backoff?: RetryBackoff;
  /** 自定义判定是否值得重试；返回 false 则立刻抛错 */
  retryIf?: (err: SpiderError, attempt: number) => boolean;
  /** 标识（出现在日志里） */
  label?: string;
}

export interface RetryRunContext {
  scope?: string;
  skillId?: string;
  phase?: string;
}

const DEFAULTS: Required<Omit<RetryPolicyOptions, "retryIf" | "label">> = {
  times: 2,
  delayMs: 1000,
  maxDelayMs: 10_000,
  backoff: "exponential",
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function nextDelay(
  opts: Required<Omit<RetryPolicyOptions, "retryIf" | "label">>,
  attempt: number,
): number {
  switch (opts.backoff) {
    case "constant":
      return opts.delayMs;
    case "linear":
      return Math.min(opts.maxDelayMs, opts.delayMs * (attempt + 1));
    case "exponential":
    default:
      return Math.min(opts.maxDelayMs, opts.delayMs * Math.pow(2, attempt));
  }
}

export class RetryPolicy {
  private readonly opts: Required<
    Omit<RetryPolicyOptions, "retryIf" | "label">
  >;
  private readonly retryIf?: RetryPolicyOptions["retryIf"];
  private readonly label?: string;

  constructor(options: RetryPolicyOptions = {}) {
    this.opts = { ...DEFAULTS, ...options };
    this.retryIf = options.retryIf;
    this.label = options.label;
  }

  async run<T>(
    fn: () => Promise<T>,
    context: RetryRunContext = {},
  ): Promise<T> {
    let lastErr: SpiderError | undefined;
    const max = this.opts.times;
    for (let attempt = 0; attempt <= max; attempt++) {
      try {
        return await fn();
      } catch (err) {
        const wrapped = toSpiderError(err);
        lastErr = wrapped;

        // 是否还可以重试？
        const canRetry = attempt < max;
        const retryable = this.retryIf
          ? this.retryIf(wrapped, attempt)
          : wrapped.isRetryable();

        if (!canRetry || !retryable) {
          if (attempt > 0) {
            // 多次仍失败 → retry-exhausted
            throw new RetryExhaustedError(
              `[${this.label ?? "retry"}] giving up after ${attempt + 1} attempts: ${wrapped.message}`,
              {
                cause: wrapped,
                details: { attempts: attempt + 1, lastKind: wrapped.kind },
              },
            );
          }
          throw wrapped;
        }

        const delay = nextDelay(this.opts, attempt);
        currentRuntime().events.emitError({
          errorKind: "retry-attempt",
          category: "retry",
          phase: context.phase ?? this.label,
          scope: context.scope,
          skillId: context.skillId,
          message: "Retrying after recoverable error",
          error: wrapped,
          retryable: true,
          details: {
            label: this.label,
            attempt: attempt + 1,
            delayMs: delay,
            kind: wrapped.kind,
          },
        });
        await sleep(delay);
      }
    }
    // 不可达
    throw (
      lastErr ??
      new RetryExhaustedError(`[${this.label ?? "retry"}] unreachable`)
    );
  }
}

// ============================================================================
// 装饰器：@RetryNavigation 与 @RetryStage
// ============================================================================

const RETRY_NAVIGATION_KEY = Symbol("spider:retry-navigation");
const RETRY_STAGE_KEY = Symbol("spider:retry-stage");

export interface RetryStageEntry {
  /**
   * 可重试的 Lifecycle Stage —— 仅 Page Control 三阶段。
   *
   * 用 Extract 从 StageName 派生（成员改名/删除时编译报错），收窄依据是
   * PuppeteerSkill.execute() 的现实：只有 setup / ready / interact 经
   * runStage()（重试包装点）执行；extract / transform / persist 走
   * runDataPipeline()，对它们声明重试是静默死配置。数据获取的重试
   * 属于 Goal 层 RetryPolicy（executeWithRetry）。
   *
   * navigate 不是可插拔 Stage，重试用 @RetryNavigation；
   * teardown 忽略激活条件、吞掉所有异常以保证清理必然发生，重试无意义。
   */
  stage: Extract<StageName, "setup" | "ready" | "interact">;
  options: RetryPolicyOptions;
}

/**
 * 为 Skill 的 navigate 阶段加重试。
 * 默认重试 page.goto 引发的 NavigationFailedError / Timeout。
 */
export function RetryNavigation(
  options: RetryPolicyOptions = {},
): ClassDecorator {
  return function (target: Function) {
    Reflect.defineMetadata(RETRY_NAVIGATION_KEY, options, target);
  };
}

/**
 * 为某个 Lifecycle Stage 加重试。
 * 整个 Stage（包含其下所有 Hook）作为整体重试单元。
 */
export function RetryStage(
  stage: RetryStageEntry["stage"],
  options: RetryPolicyOptions = {},
): ClassDecorator {
  return function (target: Function) {
    const list =
      (Reflect.getOwnMetadata(RETRY_STAGE_KEY, target) as
        | RetryStageEntry[]
        | undefined) ?? [];
    Reflect.defineMetadata(
      RETRY_STAGE_KEY,
      [...list, { stage, options }],
      target,
    );
  };
}

export function getNavigationRetry(target: Function): RetryPolicy | undefined {
  // 沿继承链查找最近的声明
  let cur: Function | null = target;
  while (cur && cur !== Function.prototype && cur !== Object) {
    const opt = Reflect.getOwnMetadata(RETRY_NAVIGATION_KEY, cur) as
      | RetryPolicyOptions
      | undefined;
    if (opt) return new RetryPolicy({ label: "navigate", ...opt });
    cur = Object.getPrototypeOf(cur);
  }
  return undefined;
}

export function getStageRetries(
  target: Function,
): Map<RetryStageEntry["stage"], RetryPolicy> {
  const map = new Map<RetryStageEntry["stage"], RetryPolicy>();
  const chain: Function[] = [];
  let cur: Function | null = target;
  while (cur && cur !== Function.prototype && cur !== Object) {
    chain.unshift(cur);
    cur = Object.getPrototypeOf(cur);
  }
  for (const ctor of chain) {
    const list =
      (Reflect.getOwnMetadata(RETRY_STAGE_KEY, ctor) as
        | RetryStageEntry[]
        | undefined) ?? [];
    for (const e of list) {
      map.set(
        e.stage,
        new RetryPolicy({ label: `stage:${e.stage}`, ...e.options }),
      );
    }
  }
  return map;
}
