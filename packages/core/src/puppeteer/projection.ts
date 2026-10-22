// ============================================================================
// ProjectionPipeline — Puppeteer Skill 的"数据投影管道"
// ============================================================================
//
// 历史：BaseSkill / PuppeteerSkill / 各 skill 包内基类 各自有一个 `project()`
// 覆写。三处隐式覆盖容易丢上下文（如 ctx）、丢去噪、丢 emit。
//
// 现在统一为一条带 4 个具名阶段的管道：
//
//   normalize  → 通用裁剪 / 命名归一化（如 stripNoise）
//   project    → 业务字段抽取（如 brief 投影器）
//   envelope   → 包装成 AI-ready envelope（如 ai-ready 投影器）
//   emit       → 副作用产出（如 markdown 落盘）— 不改变返回值
//
// 所有阶段均可选，默认 identity。CLI `--raw` 或
// `options.projectionMode === "raw"` 时整个 pipeline 被跳过，
// 直接返回 fetchData 的原始结果（用于核对上游响应）。
// ============================================================================

import type { Artifact } from "../storage/interfaces";
import type { SkillWarning } from "../skill/interfaces";
import type { RuntimeContext } from "../runtime";
import type { PageContext } from "./context";

/** Projection 阶段共享的上下文 */
export interface ProjectionContext<TParams extends object> {
  readonly params: TParams;
  readonly pageContext: PageContext<TParams>;
  readonly artifacts: readonly Artifact[];
  readonly warnings: readonly SkillWarning[];
  readonly runtime: RuntimeContext;
  /** 收集额外软告警（会写入 SkillResult.metadata.warnings） */
  addWarning(w: SkillWarning): void;
}

/**
 * ProjectionPipeline<TParams, TRaw, TPayload, TEnvelope>
 *
 * - TRaw       : fetchData 的原始输出（去噪输入）
 * - TPayload   : project 后的中间结构（通常 = TRaw 或裁剪后类型）
 * - TEnvelope  : envelope 后的最终返回类型（= TProjected）
 *
 * 每个阶段可同步或异步；省略某阶段 = identity。
 */
export interface ProjectionPipeline<
  TParams extends object,
  TRaw,
  TPayload = TRaw,
  TEnvelope = TPayload,
> {
  normalize?(
    raw: TRaw,
    ctx: ProjectionContext<TParams>,
  ): TRaw | Promise<TRaw>;

  project?(
    raw: TRaw,
    ctx: ProjectionContext<TParams>,
  ): TPayload | Promise<TPayload>;

  envelope?(
    payload: TPayload,
    ctx: ProjectionContext<TParams>,
  ): TEnvelope | Promise<TEnvelope>;

  emit?(
    envelope: TEnvelope,
    ctx: ProjectionContext<TParams>,
  ): Promise<void>;
}

/** 运行投影管道。`mode === "raw"` 时跳过所有阶段。 */
export async function runProjectionPipeline<
  TParams extends object,
  TRaw,
  TPayload,
  TEnvelope,
>(
  pipeline: ProjectionPipeline<TParams, TRaw, TPayload, TEnvelope>,
  raw: TRaw,
  ctx: ProjectionContext<TParams>,
  mode: "normal" | "raw" = "normal",
): Promise<TRaw | TEnvelope> {
  if (mode === "raw") return raw;

  const normalized = pipeline.normalize
    ? await pipeline.normalize(raw, ctx)
    : raw;
  const payload = pipeline.project
    ? await pipeline.project(normalized, ctx)
    : (normalized as unknown as TPayload);
  const envelope = pipeline.envelope
    ? await pipeline.envelope(payload, ctx)
    : (payload as unknown as TEnvelope);
  if (pipeline.emit) await pipeline.emit(envelope, ctx);
  return envelope;
}
