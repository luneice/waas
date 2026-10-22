import type {
  ISkill,
  SkillExecuteOptions,
  SkillResult,
  SkillParamSchema,
} from "./interfaces";
import { currentRuntime } from "../runtime";

// ============================================================================
// Skill 注册表
// ============================================================================

/** 任意参数的 Skill（用于注册表内部存储） */
type RegisteredSkill = ISkill<object, unknown, unknown>;

/** Skill 摘要信息（用于列表展示） */
export interface SkillInfo {
  id: string;
  name: string;
  description: string;
  paramSchema: SkillParamSchema[];
}

/**
 * SkillRegistry — 注册、发现、按 ID 调用 Skill
 */
export class SkillRegistry {
  private skills = new Map<string, RegisteredSkill>();

  /** 注册 Skill（支持链式调用） */
  register(skill: RegisteredSkill): this {
    this.skills.set(skill.id, skill);
    return this;
  }

  /** 按 ID 获取 Skill */
  get<P extends object = Record<string, unknown>, R = unknown>(
    id: string,
  ): ISkill<P, R> | undefined {
    return this.skills.get(id) as ISkill<P, R> | undefined;
  }

  /** 列出所有已注册 Skill */
  list(): SkillInfo[] {
    return [...this.skills.values()].map(
      ({ id, name, description, paramSchema }) => ({
        id,
        name,
        description,
        paramSchema,
      }),
    );
  }

  /** 按 ID 执行 Skill */
  async execute<T>(
    id: string,
    params: Record<string, unknown>,
    options?: SkillExecuteOptions,
  ): Promise<SkillResult<T>> {
    const skill = this.skills.get(id);
    if (!skill) {
      throw new Error(`Skill "${id}" not registered`);
    }
    return currentRuntime().tracer.span(
      "skill",
      { skillId: id },
      async ({ spanId, parentSpanId }) => {
        const rt = currentRuntime();
        const startedAt = Date.now();
        const safeParams = rt.redact(params) as Record<string, unknown>;
        const paramsRef = rt.blobs.put(params, "application/json");
        rt.events.emit({
          kind: "skill.start",
          spanId,
          parentSpanId,
          skillId: id,
          skillName: skill.name,
          params: safeParams,
          paramsRef,
        });

        let result: SkillResult<T>;
        try {
          result = (await skill.execute(params, options)) as SkillResult<T>;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          rt.events.emit({
            kind: "skill.end",
            spanId,
            parentSpanId,
            skillId: id,
            durationMs: Date.now() - startedAt,
            status: "failure",
            errorKind: "pipeline-error",
            errorMessage: msg,
          });
          throw err;
        }

        const success = result.success;
        const resultRef = rt.blobs.put(result, "application/json");
        rt.events.emit({
          kind: "skill.end",
          spanId,
          parentSpanId,
          skillId: id,
          durationMs: Date.now() - startedAt,
          status: success ? "success" : "failure",
          resultSummary: summarize(result),
          resultRef,
          artifactCount: success ? (result.artifacts?.length ?? 0) : undefined,
          errorKind: success ? undefined : result.metadata.errorInfo?.kind,
          errorMessage: success ? undefined : result.error,
          warnings: result.metadata.warnings?.length,
        });
        return result;
      },
    );
  }
}

/** 计算结果摘要（不含完整 body） */
function summarize(result: SkillResult<unknown>): Record<string, unknown> {
  const meta = result.metadata;
  const out: Record<string, unknown> = {
    durationMs: meta.durationMs,
    success: result.success,
  };
  if (result.success) {
    const data = result.data as unknown;
    if (Array.isArray(data)) out.itemCount = data.length;
    else if (data && typeof data === "object") {
      const r = data as Record<string, unknown>;
      // 常见列表字段
      for (const k of ["items", "list", "data", "results", "records"]) {
        const v = r[k];
        if (Array.isArray(v)) out[`${k}Count`] = v.length;
      }
      out.keys = Object.keys(r).slice(0, 16);
    }
  }
  return out;
}
