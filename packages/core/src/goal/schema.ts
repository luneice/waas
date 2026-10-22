// ============================================================================
// Endpoint 响应 Schema 校验抽象 — 与 zod 解耦
// ============================================================================
//
// 设计原则：
//   - 只校验"我关心的字段"。其它字段允许漂移，不报错。
//     使用 zod 时建议 z.object({...}).passthrough()
//   - 校验失败时抛出 UpstreamShapeChangedError，AI 消费方据此识别"上游接口变化"
//   - 不强制依赖 zod —— 任何实现 ResponseValidator 接口的对象都可以
// ============================================================================

import { UpstreamShapeChangedError } from "../errors";
import { currentRuntime } from "../runtime";

/**
 * 通用校验器接口 — 所有 zod schema 都天然实现该接口。
 *
 * 兼容签名：
 *   - zod: `z.object({...}).safeParse(input)` 直接匹配
 *   - 自定义: 实现 safeParse 返回 { success, data | error }
 */
export interface ResponseValidator<T = unknown> {
  safeParse(input: unknown): SafeParseResult<T>;
}

export type SafeParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: { issues?: unknown[]; message?: string } };

/** Endpoint 上的 schema 选项 */
export interface EndpointSchemaOptions<T = unknown> {
  /** 校验器（推荐 zod schema，使用 .passthrough() 允许未声明字段） */
  schema: ResponseValidator<T>;
  /**
   * 不通过时的处理策略：
   *   - "throw"（默认）：抛 UpstreamShapeChangedError，Skill 走 failure 分支
   *   - "warn"：记录警告，继续把原始 response 传给方法体
   */
  onMismatch?: "throw" | "warn";
}

/**
 * 校验入口 — 由 GoalExecutor 在调用方法体之前调用。
 * 返回校验后的数据；失败时按 onMismatch 抛错或返回原始数据 + 告警。
 */
export function validateResponse<T = unknown>(
  raw: unknown,
  options: EndpointSchemaOptions<T> | undefined,
  context: { goalId: string; methodName: string; url: string },
): T | unknown {
  if (!options || !options.schema) return raw;

  const result = options.schema.safeParse(raw);
  if (result.success) return result.data;

  // failure 分支 — 此处 result.success 为 false，TS 会窄化出 .error
  const failure = result as {
    success: false;
    error: { issues?: unknown[]; message?: string };
  };
  const issues = (failure.error.issues ?? []) as Array<{
    path?: Array<string | number>;
    message?: string;
    code?: string;
  }>;

  const summary = issues.length
    ? issues.slice(0, 5).map((i) => {
        const path = i.path && i.path.length > 0 ? i.path.join(".") : "<root>";
        return `${path}: ${i.message ?? "invalid"}`;
      })
    : [failure.error.message ?? "schema mismatch"];

  if (options.onMismatch === "warn") {
    currentRuntime().events.emitError({
      errorKind: "schema-mismatch",
      category: "schema",
      phase: "endpoint",
      scope: `${context.goalId}.${context.methodName}`,
      message: "Schema mismatch ignored by warn policy",
      retryable: false,
      details: {
        goalId: context.goalId,
        methodName: context.methodName,
        url: context.url,
        issues: summary,
      },
    });
    return raw;
  }

  throw new UpstreamShapeChangedError(
    `[${context.goalId}] ${context.methodName} response shape changed: ${summary.join("; ")}`,
    {
      phase: "endpoint",
      scope: `${context.goalId}.${context.methodName}`,
      details: { url: context.url, issues: summary },
    },
  );
}
