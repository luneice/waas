import type { SlotKey } from "./slots";
import { PipelineError } from "../errors/spider-error";

// ============================================================================
// PageContext — 类型化插槽的执行上下文
// ============================================================================

/**
 * Page 上下文 — 贯穿 setup → ready → interact → extract → transform →
 *               persist → teardown 全阶段。
 *
 * 设计要点：
 *   - `params` 在构造期冻结（Skill 已 normalize）
 *   - 跨阶段通信必须通过 `SlotKey<T>`，编译期即可校验值形状
 *   - 每次 execute() 都新建实例，避免并发竞态
 *   - 内部 Map 不暴露给外部（强制通过 get / set / require 访问）
 *
 * @typeParam TParams - 参数形状，默认 Record<string, unknown> 供 Hook 泛用
 */
export class PageContext<TParams extends object = Record<string, unknown>> {
  /** 阶段间数据存储（框架内部管理，对外通过 Slot API 访问） */
  private readonly _slots = new Map<string, unknown>();

  constructor(
    /** 归一化后的参数 */
    readonly params: TParams,
    /** 执行选项（由上层 Skill 传入，Pipeline 层不关心具体类型） */
    readonly options?: unknown,
  ) {}

  // ── Slot API（类型安全） ──

  /** 读取 Slot，不存在返回 undefined */
  get<T>(slot: SlotKey<T>): T | undefined {
    return this._slots.get(slot.name) as T | undefined;
  }

  /** 写入 Slot */
  set<T>(slot: SlotKey<T>, value: T): void {
    this._slots.set(slot.name, value);
  }

  /** 读取 Slot；不存在时抛错 */
  require<T>(slot: SlotKey<T>): T {
    if (!this._slots.has(slot.name)) {
      throw new PipelineError(`required slot "${slot.name}" is missing`, {
        scope: "page-context",
        details: { slot: slot.name },
      });
    }
    return this._slots.get(slot.name) as T;
  }

  /** Slot 是否已赋值 */
  has<T>(slot: SlotKey<T>): boolean {
    return this._slots.has(slot.name);
  }

  /** 删除 Slot 值 */
  delete<T>(slot: SlotKey<T>): boolean {
    return this._slots.delete(slot.name);
  }

  /** 读取-改-写：若 Slot 缺失则以 factory() 初始化后返回 */
  getOrCreate<T>(slot: SlotKey<T>, factory: () => T): T {
    let v = this._slots.get(slot.name) as T | undefined;
    if (v === undefined) {
      v = factory();
      this._slots.set(slot.name, v);
    }
    return v;
  }

  /**
   * 框架内部使用：遍历所有 slot 原始键值对（供测试/调试）。
   * 业务代码不要依赖此方法。
   * @internal
   */
  _debug_entries(): IterableIterator<[string, unknown]> {
    return this._slots.entries();
  }
}
