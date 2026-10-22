/**
 * kind 元数据 —— 「情形 → kind → 处置」的唯一真理源。
 *
 * 三个消费者：
 *   1. Agent 规则文档：`skills/_shared/claude/rules/spider-runtime.md` §3 的错误表
 *      由 `scripts/gen-error-table.ts` 从这里生成（**不要手改那张表**）。
 *   2. 定时任务/编排层：`handlingOf(kind)` 给出机器可执行的处置动作，
 *      无人值守场景不必解析 markdown。
 *   3. Skill 作者：新增抛错场景时按 `trigger` 对号入座。
 *      **增设判据：处置不同才配新 kind** —— 处置与既有 kind 相同的场景一律复用
 *      既有 kind（靠 `details` 区分细节），防止枚举膨胀。
 *      反例存档：上游业务信封软失败（HTTP 200 + resultCode 异常）处置就是退避重试，
 *      与 endpoint-http 相同，所以不设 `upstream-soft-failure`。
 */
import type { SkillFailureKind } from "./kinds";

/** 机器可执行的处置动作 —— 比 isRetryable 二元更细的第三个派生维度 */
export type FailureHandling =
  | "backoff-retry" // 退避重试（瞬时故障）
  | "human" // 人工介入后恢复（登录 / 过验证 / 解风控）
  | "fix-params" // 修正入参后重试
  | "report-maintainer" // 报告维护者（契约漂移，重试无意义）
  | "accept-empty" // 正常空结果，按业务处理
  | "fix-code"; // 框架/实现缺陷，修代码

export interface KindMeta {
  /** 触发情形（可观测事实，供抛错方对号入座） */
  trigger: string;
  /** 处置动作（机器可执行） */
  handling: FailureHandling;
  /** Agent 处置文案（生成错误表用，中文） */
  action: string;
}

export const KIND_META: Record<SkillFailureKind, KindMeta> = {
  "browser-unavailable": {
    trigger: "CDP 端点连不上 / Chrome 未以远程调试模式启动",
    handling: "backoff-retry",
    action: "确认 Chrome 已按运行前置启动后重试；自动拉起失败按 §1.2 人机协作",
  },
  "browser-acquire-timeout": {
    trigger: "池化获取 Page 超时（并发打满且无人释放）",
    handling: "backoff-retry",
    action: "降并发后退避重试",
  },
  "navigation-failed": {
    trigger: "page.goto 失败",
    handling: "backoff-retry",
    action: "退避（1/2/4s）重试；反复失败检查网络与站点可达性",
  },
  "not-logged-in": {
    trigger: "缺少有效登录态",
    handling: "human",
    action: "提示用户在调试 Chrome 内登录目标站点，确认后重试",
  },
  "access-denied": {
    trigger: "已登录但无访问权限",
    handling: "human",
    action: "换账号或放弃该目标；不要自动重试",
  },
  "risk-control": {
    trigger: "触发站点风控/反爬：验证码、滑块、412/-352、下载到 HTML 拦截页等",
    handling: "human",
    action: "立即熔断：停止后续调用，按 §2 告警并等用户处理后恢复；禁止自动重试（会加剧封禁）",
  },
  "missing-context": {
    trigger: "必填参数缺失",
    handling: "fix-params",
    action: "查该 skill 文档参数表补齐",
  },
  "invalid-params": {
    trigger: "参数取值非法",
    handling: "fix-params",
    action: "按错误信息修正取值",
  },
  "upstream-shape-changed": {
    trigger: "响应结构与契约不符（接口演化/字段消失/类型漂移）",
    handling: "report-maintainer",
    action: "报告维护者——平台改版需更新契约；重试无意义",
  },
  "endpoint-http": {
    trigger: "上游非 2xx，或 HTTP 200 但业务信封软失败（resultCode 异常/偶发空壳）",
    handling: "backoff-retry",
    action: "先按各 skill rules 特例处置（如 401→刷新凭据）；其余短退避重试",
  },
  "endpoint-timeout": {
    trigger: "单次请求超时",
    handling: "backoff-retry",
    action: "退避（1/2/4s）重试",
  },
  "retry-exhausted": {
    trigger: "框架内重试次数耗尽",
    handling: "human",
    action: "检查浏览器登录态与网络后再试",
  },
  "hook-abort": {
    trigger: "Hook 主动 abortPipeline(reason)",
    handling: "fix-code",
    action: "读 reason 定位业务原因",
  },
  "pipeline-error": {
    trigger: "Hook/Stage 内部异常（含未分类的实现缺陷）",
    handling: "fix-code",
    action: "框架或实现缺陷，报告维护者",
  },
  "no-results": {
    trigger: "查询无命中（可判定的空，非异常）",
    handling: "accept-empty",
    action: "明确告知该筛选下无公开数据；换关键词/确认 ID，不自动放宽筛选",
  },
  unsupported: {
    trigger: "当前 skill 不支持该参数组合/能力",
    handling: "fix-params",
    action: "换 skill 或调整参数组合",
  },
};

/** 处置动作派生（与 categoryOf / isRetryable 并列的第三个派生函数） */
export function handlingOf(kind: SkillFailureKind): FailureHandling {
  return KIND_META[kind]?.handling ?? "fix-code";
}
