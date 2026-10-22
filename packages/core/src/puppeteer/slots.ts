// ============================================================================
// Typed Slot Keys — 替代 Map<string, unknown> 的弱契约
// ============================================================================

/**
 * SlotKey<T> — 携带类型信息的上下文键。
 *
 * 用 phantom type 让 ctx.get / ctx.set 在编译期就能验证值的形状。
 * 运行时只保留 `name` 作为底层 Map key，调试与日志友好。
 *
 * ⚠️ 两个不同的 SlotKey 若 name 相同，会指向同一存储槽 — 由调用方保证命名唯一。
 */
export interface SlotKey<T> {
  readonly name: string;
  /** 仅编译期存在的标记字段，用于携带类型信息 */
  readonly __type?: (value: T) => T;
}

/**
 * 定义一个新的类型化 Slot。
 *
 * @example
 * ```typescript
 * const ArticleSlot = defineSlot<ArticleResponse>("article");
 * ctx.set(ArticleSlot, response);      // 只接受 ArticleResponse
 * const v = ctx.get(ArticleSlot);      // v: ArticleResponse | undefined
 * const r = ctx.require(ArticleSlot);  // r: ArticleResponse（missing 时抛错）
 * ```
 */
export function defineSlot<T>(name: string): SlotKey<T> {
  return { name };
}

// ============================================================================
// 框架内置 Slot — 跨模块共享的标准键
// ============================================================================

import type { Artifact } from "../storage/interfaces";
import type { CapturedEntry } from "./captured-entry";

/** 已捕获的媒体资源（由 @CaptureMedia 默认写入） */
export const CapturedMediaSlot: SlotKey<Map<string, CapturedEntry<Buffer>>> =
  defineSlot("capturedMedia");

/** ArtifactPersistHook 持久化完成后写入的产物清单 */
export const ArtifactsSlot: SlotKey<Artifact[]> = defineSlot("artifacts");

/** 产物存储路径前缀（由 Skill 在 @Setup 阶段写入） */
export const ArtifactPrefixSlot: SlotKey<string> = defineSlot("artifactPrefix");

/**
 * URL → 人类可读名称 映射（由业务 transform hook 写入）。
 * ArtifactPersistHook 会优先用这里的 legend 作为落盘文件名。
 */
export const ArtifactLegendsSlot: SlotKey<Map<string, string>> =
  defineSlot("artifactLegends");
