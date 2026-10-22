// ============================================================================
// Skill 参数元数据
// ============================================================================

import type { Artifact } from "../storage/interfaces";
import type { SkillFailureKind, SpiderErrorInfo } from "../errors";

/** Skill 参数描述（自文档化 / 校验） */
export interface SkillParamSchema {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  required: boolean;
  default?: unknown;
  description: string;
}

// ============================================================================
// Skill 执行选项
// ============================================================================

/** 通用执行选项 */
export interface SkillExecuteOptions {
  /**
   * 静默模式：抑制所有非错误日志输出。
   * 等价于将 logger level 设为 "error"。
   * 注意：错误信息仍会通过 SkillResultFailure.metadata.errorInfo 返回给调用方。
   */
  silent?: boolean;

  /**
   * 投影模式：
   *   - undefined / "normal" （默认）：走完整 ProjectionPipeline
   *   - "raw"：跳过 normalize/project/envelope/emit，返回 fetchData 原文
   *
   * CLI 对应参数：--raw。取代以前的 XHS_RAW 环境变量。
   */
  projectionMode?: "normal" | "raw";
}

// ============================================================================
// AI 可消费的诊断信息
// ============================================================================

/**
 * 在成功结果中也可附带的"软告警"。
 * 例如：schema 漂移但成功降级、媒体下载部分失败等。
 *
 * 设计意图：让 AI 消费方能感知"虽然成功，但有需要关注的事情"，
 * 而无需依赖污染 stdout 的 console.log。
 */
export interface SkillWarning {
  /** 简短分类标签（如 "schema-drift" / "media-download-partial"） */
  code: string;
  /** 人类可读消息 */
  message: string;
  /** 任意结构化补充信息 */
  details?: Record<string, unknown>;
}

// ============================================================================
// Skill 执行结果
// ============================================================================

/** 执行元信息 */
export interface SkillResultMetadata {
  skillId: string;
  skillName: string;
  params: Record<string, unknown>;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  /**
   * 失败时的结构化错误信息 — AI 消费方据此分类处理：
   *   - kind: 标准化错误代码（switch 友好）
   *   - category: 抽象大类（用于路由）
   *   - phase / scope: 故障定位
   *   - details: 附加信息（如 endpoint url、schema issues）
   */
  errorInfo?: SpiderErrorInfo;
  /** 软告警（可同时出现在成功 / 失败结果中） */
  warnings?: SkillWarning[];
}

/** 成功返回体 */
export interface SkillResultSuccess<T> {
  success: true;
  data: T;
  error?: undefined;
  metadata: SkillResultMetadata;
  /** 管道产物清单（持久化的媒体文件、API 快照等） */
  artifacts?: Artifact[];
}

/** 失败返回体 */
export interface SkillResultFailure {
  success: false;
  /** 失败时 data 可选 — 部分 skill 提供降级数据 */
  data?: unknown;
  error: string;
  metadata: SkillResultMetadata;
}

/**
 * 统一返回体 — Discriminated Union
 *
 * ```typescript
 * const result = await skill.execute(params);
 * if (result.success) {
 *   result.data // T
 * } else {
 *   const info = result.metadata.errorInfo;
 *   if (info?.kind === "not-logged-in") { /* prompt user *\/ }
 * }
 * ```
 */
export type SkillResult<T> = SkillResultSuccess<T> | SkillResultFailure;

// ============================================================================
// 错误分类（兼容旧导入路径） — 真正定义在 ../errors/kinds.ts
// ============================================================================

export type { SkillFailureKind } from "../errors/kinds";

/**
 * @deprecated 优先抛 `new SpiderError({ kind, message, ... })` 或具体子类
 * （如 NotLoggedInError、MissingContextError）。
 * 保留此函数用于过渡期 / 字符串拼接场景。
 */
export function formatError(kind: SkillFailureKind, message: string): string {
  return `[${kind}] ${message}`;
}

// ============================================================================
// Skill 公共契约
// ============================================================================

export interface ISkill<
  TParams extends object = Record<string, unknown>,
  TResult = unknown,
  TProjected = TResult,
  TOptions extends SkillExecuteOptions = SkillExecuteOptions,
> {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly paramSchema: SkillParamSchema[];

  execute(
    params: TParams,
    options?: TOptions,
  ): Promise<SkillResult<TProjected>>;
}
