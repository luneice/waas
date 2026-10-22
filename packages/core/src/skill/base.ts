import type {
  ISkill,
  SkillExecuteOptions,
  SkillResult,
  SkillResultSuccess,
  SkillResultFailure,
  SkillResultMetadata,
  SkillParamSchema,
  SkillWarning,
} from "./interfaces";
import {
  InvalidParamsError,
  MissingContextError,
  SpiderError,
  toSpiderError,
  parseLegacyKind,
  type SpiderErrorInfo,
} from "../errors";


/**
 * BaseSkill — Skill 抽象基类。
 *
 * 提供：
 *   - paramSchema 自动校验（`validateWithSchema`）
 *   - 通用 buildSuccess / buildFailure（自动填充 SpiderErrorInfo）
 *   - 软告警收集（`addWarning` 由子类调用，会进入返回体的 metadata.warnings）
 *
 * 子类应通过抛出 SpiderError 子类来传达故障。**禁止**抛裸 Error/string —
 * 实在必要时 buildFailure 会用 toSpiderError 兜底为 pipeline-error。
 */
export abstract class BaseSkill<
  TParams extends object,
  TResult,
  TProjected = TResult,
  TOptions extends SkillExecuteOptions = SkillExecuteOptions,
> implements ISkill<TParams, TResult, TProjected, TOptions> {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly paramSchema: SkillParamSchema[];

  /** 当次 execute() 累积的软告警 — 由 collectWarning 写入，buildSuccess/Failure 读取后清空 */
  private warnings: SkillWarning[] = [];

  /** 收集软告警（出现在 metadata.warnings） */
  protected addWarning(warning: SkillWarning): void {
    this.warnings.push(warning);
  }

  /** 只读快照（供 ProjectionPipeline 在 envelope 阶段读取当前已累积告警） */
  protected peekWarnings(): readonly SkillWarning[] {
    return this.warnings;
  }

  /** 子类可选覆写：参数归一化 / 校验 */
  protected normalizeParams(params: TParams): TParams {
    return params;
  }

  /**
   * 基于 paramSchema 的自动参数校验。
   * 在 execute 流程中于 normalizeParams 之后调用。
   * 对可安全转换的类型自动做 coerce（string→number / string→boolean）。
   */
  protected validateWithSchema(params: TParams): void {
    if (!this.paramSchema || this.paramSchema.length === 0) return;

    const errors: string[] = [];
    let missingOnly = true;
    const bag = params as Record<string, unknown>;

    for (const schema of this.paramSchema) {
      let value = bag[schema.name];

      if (
        schema.required &&
        (value === undefined || value === null || value === "")
      ) {
        errors.push(`参数 "${schema.name}" 为必填项`);
        continue;
      }
      if (value === undefined || value === null) continue;

      // ── auto-coerce 常见类型偏差 ──
      const actualType = Array.isArray(value) ? "array" : typeof value;
      if (actualType !== schema.type) {
        const coerced = this.coerceParam(value, schema.type);
        if (coerced !== undefined) {
          bag[schema.name] = coerced;
        } else {
          errors.push(
            `参数 "${schema.name}" 类型不匹配：期望 ${schema.type}，实际 ${actualType}`,
          );
          missingOnly = false;
        }
      }
    }

    if (errors.length === 0) return;

    const detail = `参数校验失败:\n  - ${errors.join("\n  - ")}`;
    if (missingOnly) {
      throw new MissingContextError(detail, {
        scope: this.id,
        details: { issues: errors },
      });
    }
    throw new InvalidParamsError(detail, {
      scope: this.id,
      details: { issues: errors },
    });
  }

  /**
   * 尝试将 value 安全转换为目标类型。
   * 成功返回转换后的值，不可转换返回 undefined。
   */
  private coerceParam(
    value: unknown,
    target: SkillParamSchema["type"],
  ): unknown | undefined {
    if (target === "number" && typeof value === "string") {
      const n = Number(value);
      if (!Number.isNaN(n)) return n;
    }
    if (target === "boolean" && typeof value === "string") {
      if (value === "true" || value === "1") return true;
      if (value === "false" || value === "0") return false;
    }
    if (target === "boolean" && typeof value === "number") {
      return value !== 0;
    }
    if (target === "string" && (typeof value === "number" || typeof value === "boolean")) {
      return String(value);
    }
    return undefined;
  }

  /** 统一执行入口 — 子类必须实现 */
  abstract execute(
    params: TParams,
    options?: TOptions,
  ): Promise<SkillResult<TProjected>>;

  // ── 内部辅助 ──

  protected buildSuccess(
    data: TProjected,
    params: TParams,
    startedAt: Date,
  ): SkillResultSuccess<TProjected> {
    const metadata = this.buildMetadata(params, startedAt);
    return { success: true, data, metadata };
  }

  /**
   * 统一构建失败结果。
   *
   * 接受三种输入：
   *   - SpiderError 实例（推荐）：直接把 toErrorInfo() 写入 metadata.errorInfo
   *   - 任意 Error：归一化为 SpiderError（pipeline-error 兜底）
   *   - 字符串（兼容旧代码）：尝试从 "[kind] msg" 解析 kind
   */
  protected buildFailure(
    error: unknown,
    params: TParams,
    startedAt: Date,
  ): SkillResultFailure {
    const spider = this.normalizeFailure(error);
    const metadata = this.buildMetadata(
      params,
      startedAt,
      spider.toErrorInfo(),
    );
    // 失败事件由上层 Tracer 包装统一发出（避免双发）

    return {
      success: false,
      error: spider.message,
      metadata,
    };
  }

  private normalizeFailure(error: unknown): SpiderError {
    if (error instanceof SpiderError) return error;
    if (typeof error === "string") {
      const kind = parseLegacyKind(error) ?? "pipeline-error";
      const message = error.replace(/^\[[\w-]+\]\s*/, "");
      return new SpiderError({
        kind,
        message: message || error,
        scope: this.id,
      });
    }
    return toSpiderError(error, "pipeline-error", { scope: this.id });
  }

  private buildMetadata(
    params: TParams,
    startedAt: Date,
    errorInfo?: SpiderErrorInfo,
  ): SkillResultMetadata {
    const completedAt = new Date();
    const warnings = this.consumeWarnings();
    const meta: SkillResultMetadata = {
      skillId: this.id,
      skillName: this.name,
      params: params as unknown as Record<string, unknown>,
      startedAt,
      completedAt,
      durationMs: completedAt.getTime() - startedAt.getTime(),
    };
    if (errorInfo) meta.errorInfo = errorInfo;
    if (warnings.length > 0) meta.warnings = warnings;
    return meta;
  }

  private consumeWarnings(): SkillWarning[] {
    const list = this.warnings;
    this.warnings = [];
    return list;
  }
}
