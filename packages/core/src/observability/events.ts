// ============================================================================
// ObsEvent — 统一事件模型
// ============================================================================
//
// 所有可观测性数据都规范化为 ObsEvent，由 ObservabilityBus 分发到多个 Sink。
// 事件结构刻意贴合 OpenTelemetry 的 Span 概念，便于未来桥接 OTLP。
// ============================================================================

import { randomUUID, randomBytes } from "crypto";

// ── ID 生成 ─────────────────────────────────────────────────────────────────

export function newTraceId(): string {
  return randomUUID();
}

/** 短一点的 spanId（16 hex chars）— 便于 grep / 终端阅读 */
export function newSpanId(): string {
  return randomBytes(8).toString("hex");
}

// ── Span 类型 ──────────────────────────────────────────────────────────────

export type SpanKind =
  | "task" //   CLI 一次完整调用
  | "skill" //  一次 Skill.execute
  | "stage" //  Lifecycle Stage（setup/extract/...）
  | "hook" //   单个 Hook 在某 Stage 的调用
  | "navigate" //  page.goto
  | "goal" //   GoalExecutor.execute
  | "endpoint"; //  单次 HTTP 请求（含 retry 累计）

// ── 公共字段 ───────────────────────────────────────────────────────────────

export interface ObsEventBase {
  /** 事件类型判别字段（如 "skill.start"） */
  kind: string;
  /** ISO8601 时间戳 */
  ts: string;
  /** 一次 CLI 调用 = 一条 trace */
  traceId: string;
  /** 当前操作 span */
  spanId: string;
  /** 父 span（root 为空） */
  parentSpanId?: string;
}

// ── Body 引用（大对象不内嵌，外置到 BodyStore） ──────────────────────────

export interface BodyRef {
  /** sha256 hex（前 16 char 即可唯一） */
  hash: string;
  /** 字节数 */
  bytes: number;
  /** MIME / 自描述类型 */
  mime: string;
  /** 前 256 字符预览（仅文本类） */
  preview?: string;
  /** 在 BodyStore 中的相对路径（如 bodies/<hash>.json） */
  path: string;
}

// ── 各类事件 ───────────────────────────────────────────────────────────────

export interface TaskStartEvent extends ObsEventBase {
  kind: "task.start";
  /** 调用方标识（来自 _meta.caller / SPIDER_CALLER） */
  caller?: string;
  /** AI 自报的调用动机（来自 _meta.rationale / --rationale / SPIDER_RATIONALE） */
  rationale?: string;
  /** CLI argv 摘要 */
  argv: string[];
  /** 进程信息 */
  pid: number;
  cwd: string;
}

export interface TaskEndEvent extends ObsEventBase {
  kind: "task.end";
  durationMs: number;
  status: "success" | "failure";
  /** 退出码 */
  exitCode: number;
  /** 失败错误简述 */
  error?: string;
}

export interface SkillStartEvent extends ObsEventBase {
  kind: "skill.start";
  skillId: string;
  skillName: string;
  /** 入参（已脱敏） */
  params?: Record<string, unknown>;
  /** 入参完整 BodyRef（含全量原文） */
  paramsRef?: BodyRef;
}

export interface SkillEndEvent extends ObsEventBase {
  kind: "skill.end";
  skillId: string;
  durationMs: number;
  status: "success" | "failure";
  /** 数据摘要（计数 / 关键字段），不含完整 body */
  resultSummary?: Record<string, unknown>;
  /** 完整结果 BodyRef */
  resultRef?: BodyRef;
  /** 产物清单数量 */
  artifactCount?: number;
  errorKind?: string;
  errorMessage?: string;
  warnings?: number;
}

export interface StageEvent extends ObsEventBase {
  kind: "stage.start" | "stage.end";
  skillId: string;
  stage: string;
  /** stage.end 字段 */
  durationMs?: number;
  status?: "success" | "failure" | "skipped";
  hookCount?: number;
}

export interface HookInvokeEvent extends ObsEventBase {
  kind: "hook.invoke";
  skillId: string;
  stage: string;
  hookName: string;
  durationMs: number;
  status: "success" | "failure" | "skipped";
  /** Hook 返回的 signal */
  signal?: "skipStage" | "skipPipeline" | "abort";
  errorMessage?: string;
}

export interface NavigateEvent extends ObsEventBase {
  kind: "navigate.start" | "navigate.end";
  skillId: string;
  url?: string;
  /** end 字段 */
  durationMs?: number;
  status?: "success" | "failure";
  retryCount?: number;
  errorMessage?: string;
}

export interface GoalEvent extends ObsEventBase {
  kind: "goal.start" | "goal.end";
  goalId: string;
  goalName?: string;
  /** end 字段 */
  durationMs?: number;
  status?: "success" | "failure";
  endpointCount?: number;
  errorMessage?: string;
}

export interface EndpointRequestEvent extends ObsEventBase {
  kind: "endpoint.request";
  goalId: string;
  methodName: string;
  method: string;
  url: string;
  /** 第几次尝试（含重试） */
  attempt: number;
  /** 请求 body / headers / query 引用 */
  requestRef?: BodyRef;
  headers?: Record<string, string>;
}

export interface EndpointResponseEvent extends ObsEventBase {
  kind: "endpoint.response";
  goalId: string;
  methodName: string;
  method: string;
  url: string;
  attempt: number;
  status: "success" | "failure";
  httpStatus?: number;
  durationMs: number;
  responseRef?: BodyRef;
  errorKind?: string;
  errorMessage?: string;
}

/**
 * 投影事件 — Goal 内 endpoint 方法（projection / shape mapping）执行后的输出快照。
 *
 * 与 `endpoint.response` 的区别：
 *   - response 记录的是 HTTP 原始 payload（schema 校验前的字节）；
 *   - projection 记录的是 `goalFn[methodName](validated, ...)` 的返回值，
 *     即业务侧已裁剪 / 重塑后的"投影后"数据。
 *
 * 同一次 endpoint 调用可能产生多条 projection 事件：
 *   - single：1 条
 *   - paginated：每页 1 条（page 字段标识）
 *   - expanded：每个 item 1 条（itemIndex 字段标识）
 *
 * 若 endpoint 未声明对应的 projection 方法，则 `hasProjection=false`，
 * `projectionRef` 仍指向"validated payload"（保持事件链完整）。
 */
export interface EndpointProjectionEvent extends ObsEventBase {
  kind: "endpoint.projection";
  goalId: string;
  methodName: string;
  url: string;
  /** 对应成功 endpoint.response 的 attempt（如可获取） */
  attempt?: number;
  /** 调度模式 */
  mode: "single" | "paginated" | "expanded";
  /** 分页页码（mode=paginated 时） */
  page?: number;
  /** 展开项索引（mode=expanded 时） */
  itemIndex?: number;
  status: "success" | "failure";
  /** 投影函数本身的耗时（毫秒），不含 HTTP */
  durationMs: number;
  /** 是否实际声明了 projection 方法 */
  hasProjection: boolean;
  /** 投影输出的 BodyStore 引用 */
  projectionRef?: BodyRef;
  /** 失败时的错误信息 */
  errorKind?: string;
  errorMessage?: string;
}

export interface InterceptEvent extends ObsEventBase {
  kind: "intercept.match";
  skillId?: string;
  /** Slot / interceptor name */
  slot: string;
  url: string;
  mime?: string;
  bytes?: number;
  bodyRef?: BodyRef;
}

export interface ArtifactWriteEvent extends ObsEventBase {
  kind: "artifact.write";
  skillId?: string;
  role: string;
  path: string;
  contentType: string;
  bytes: number;
  sourceUrl?: string;
  reused?: boolean;
}

export interface ErrorEvent extends ObsEventBase {
  kind: "error";
  skillId?: string;
  errorKind: string;
  category?: string;
  phase?: string;
  scope?: string;
  message: string;
  retryable?: boolean;
  details?: Record<string, unknown>;
}

export type ObsEvent =
  | TaskStartEvent
  | TaskEndEvent
  | SkillStartEvent
  | SkillEndEvent
  | StageEvent
  | HookInvokeEvent
  | NavigateEvent
  | GoalEvent
  | EndpointRequestEvent
  | EndpointResponseEvent
  | EndpointProjectionEvent
  | InterceptEvent
  | ArtifactWriteEvent
  | ErrorEvent;
