import type { Page } from "puppeteer-core";
import type { IPageHook, ActivationPredicate, HookOutcome } from "./hooks";
import type { PageContext } from "./context";
import type { SlotKey } from "./slots";
import { defineSlot } from "./slots";
import type { CapturedEntry } from "./captured-entry";
export type { CapturedEntry } from "./captured-entry";

// ============================================================================
// Types
// ============================================================================

/** 拦截模式 */
export type InterceptMode = "first" | "all";

/** PageInterceptor 基础配置 */
export interface InterceptorOptions<TBody = unknown> {
  /**
   * 结果 Slot — 命中后的数据写入位置。
   *
   *   mode="first" → Slot<TBody>
   *   mode="all"   → Slot<Map<string, CapturedEntry<TBody>>>
   *
   * 为兼顾两种模式，Slot 类型在基类中声明为 unknown。
   * 推荐通过 `CaptureResponse` / `CaptureMedia` 装饰器构造以获得类型收窄。
   */
  into: SlotKey<unknown>;
  /** "first" — 命中首个后停止（带超时）；"all" — 持续收集直到 extract */
  mode?: InterceptMode;
  /** 超时 ms — 仅 mode=first 有效（默认 30_000） */
  timeoutMs?: number;
  /** 激活谓词 — 每个 Stage 进入前惰性求值 */
  activateWhen?: ActivationPredicate;
}

// ============================================================================
// PageInterceptor<TEvent> — 抽象基类
// ============================================================================

/**
 * PageInterceptor — 页面事件拦截器抽象基类。
 *
 * 通用职责：
 *   - first / all 双模式调度
 *   - 通过派生 Slot 管理内部状态，避免字符串键污染
 *   - 超时管理（setTimeout / clearTimeout 对齐 teardown）
 *   - teardown 自动清理监听器与 pending Promise
 *
 * 子类实现 4 个抽象方法：
 *   subscribe / unsubscribe / matches / parseEvent
 */
export abstract class PageInterceptor<TEvent> implements IPageHook {
  readonly name: string;
  protected readonly mode: InterceptMode;
  protected readonly timeoutMs: number;
  private readonly activate?: ActivationPredicate;

  /** 用户可见：结果写入槽（first 模式 → body；all 模式 → Map） */
  protected readonly resultSlot: SlotKey<unknown>;

  /** 内部：handler 引用，供 teardown 解绑 */
  private readonly handlerSlot: SlotKey<(event: TEvent) => void>;
  /** 内部：first 模式的等待 Promise */
  private readonly promiseSlot: SlotKey<Promise<unknown>>;
  /** 内部：first 模式超时 timer，供 teardown 清理 */
  private readonly timerSlot: SlotKey<ReturnType<typeof setTimeout>>;
  /** 内部：all 模式已收集的 Map */
  private readonly collectedSlot: SlotKey<Map<string, CapturedEntry>>;
  /** 内部：all 模式 pending Promise 数组（extract 等待其完成） */
  private readonly pendingSlot: SlotKey<Promise<void>[]>;

  constructor(options: InterceptorOptions) {
    this.name = `intercept:${options.into.name}`;
    this.mode = options.mode ?? "first";
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.activate = options.activateWhen;
    this.resultSlot = options.into;

    // 派生内部 Slot — 每个拦截器实例独占
    const ns = options.into.name;
    this.handlerSlot = defineSlot(`__intercept.handler:${ns}`);
    this.promiseSlot = defineSlot(`__intercept.promise:${ns}`);
    this.timerSlot = defineSlot(`__intercept.timer:${ns}`);
    this.collectedSlot = defineSlot(`__intercept.collected:${ns}`);
    this.pendingSlot = defineSlot(`__intercept.pending:${ns}`);
  }

  // ── 子类实现 ──

  protected abstract subscribe(
    page: Page,
    handler: (event: TEvent) => void,
  ): void;
  protected abstract unsubscribe(
    page: Page,
    handler: (event: TEvent) => void,
  ): void;
  protected abstract matches(event: TEvent): boolean;
  protected abstract parseEvent(event: TEvent): Promise<CapturedEntry>;

  // ── IPageHook 实现 ──

  shouldActivate(ctx: PageContext): boolean {
    return this.activate ? this.activate(ctx) : true;
  }

  async setup(page: Page, ctx: PageContext): Promise<HookOutcome> {
    if (ctx.get(this.handlerSlot)) {
      await this.teardown(page, ctx);
    }
    if (this.mode === "first") {
      this.setupFirst(page, ctx);
    } else {
      this.setupAll(page, ctx);
    }
  }

  async extract(_page: Page, ctx: PageContext): Promise<HookOutcome> {
    if (this.mode === "first") {
      const promise = ctx.get(this.promiseSlot);
      if (promise) {
        const body = await promise;
        // 即使为 null 也写入，方便下游判定"已尝试但未捕获"
        (ctx as PageContext).set(
          this.resultSlot as SlotKey<unknown>,
          body as unknown,
        );
        ctx.delete(this.promiseSlot);
      }
    } else {
      const pending = ctx.get(this.pendingSlot);
      if (pending && pending.length > 0) {
        await Promise.allSettled(pending);
        ctx.delete(this.pendingSlot);
      }
      const collected = ctx.get(this.collectedSlot);
      if (collected) {
        (ctx as PageContext).set(
          this.resultSlot as SlotKey<unknown>,
          new Map(collected),
        );
        ctx.delete(this.collectedSlot);
      }
    }
  }

  async teardown(page: Page, ctx: PageContext): Promise<HookOutcome> {
    const handler = ctx.get(this.handlerSlot);
    if (handler) {
      this.unsubscribe(page, handler);
      ctx.delete(this.handlerSlot);
    }
    const timer = ctx.get(this.timerSlot);
    if (timer) {
      clearTimeout(timer);
      ctx.delete(this.timerSlot);
    }
    ctx.delete(this.promiseSlot);
    ctx.delete(this.pendingSlot);
    ctx.delete(this.collectedSlot);
  }

  // ── 内部调度 ──

  private setupFirst(page: Page, ctx: PageContext): void {
    const promise = new Promise<unknown>((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.unsubscribe(page, handler);
        resolve(null);
      }, this.timeoutMs);
      ctx.set(this.timerSlot, timer);

      const handler = (event: TEvent) => {
        if (settled || !this.matches(event)) return;
        settled = true;
        clearTimeout(timer);
        ctx.delete(this.timerSlot);
        this.unsubscribe(page, handler);
        this.parseEvent(event).then(
          (entry) => resolve(entry.body),
          () => resolve(null),
        );
      };
      ctx.set(this.handlerSlot, handler);
      this.subscribe(page, handler);
    });
    ctx.set(this.promiseSlot, promise);
  }

  private setupAll(page: Page, ctx: PageContext): void {
    const collected = new Map<string, CapturedEntry>();
    const pending: Promise<void>[] = [];
    ctx.set(this.collectedSlot, collected);
    ctx.set(this.pendingSlot, pending);

    const handler = (event: TEvent) => {
      if (!this.matches(event)) return;
      const p = this.parseEvent(event).then(
        (entry) => {
          collected.set(entry.url, entry);
        },
        () => {
          /* 提取失败，忽略 */
        },
      );
      pending.push(p);
    };
    ctx.set(this.handlerSlot, handler);
    this.subscribe(page, handler);
  }
}
