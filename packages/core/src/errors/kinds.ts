// ============================================================================
// SkillFailureKind — 标准化错误分类联合类型
// ============================================================================
//
// 设计原则：
//   - 自顶向下分组，从抽象类别 → 具体故障原因
//   - 每个 kind 携带"AI 消费者能直接据此采取行动"的信息
//   - 任何抛出的 SpiderError 都必须落到下表中的某个 kind
// ============================================================================

/** 浏览器/连接层故障 */
export type BrowserKind =
  | "browser-unavailable" // CDP 端点连不上
  | "browser-acquire-timeout" // 池化获取 Page 超时
  | "navigation-failed"; // page.goto 失败

/** 鉴权与会话故障 */
export type AuthKind =
  | "not-logged-in" // 缺少有效 session
  | "access-denied" // 已登录但无访问权限
  | "risk-control"; // 触发站点风控/反爬（验证码、滑块、412/-352、HTML 拦截页等），需人工处理后恢复

/** 入参故障（在到达远端之前由本地校验抛出） */
export type ParamsKind =
  | "missing-context" // 必填参数缺失
  | "invalid-params"; // 参数值不合法

/** 上游服务故障 */
export type UpstreamKind =
  | "upstream-shape-changed" // 响应 schema 与预期不一致（接口演化）
  | "endpoint-http" // HTTP 非 2xx
  | "endpoint-timeout" // 单次请求超时
  | "retry-exhausted"; // 重试次数耗尽

/** 管道控制信号导致的中止 */
export type PipelineKind =
  | "hook-abort" // Hook 主动 abortPipeline()
  | "pipeline-error"; // Hook/Stage 内部异常

/** 业务结果故障 */
export type BusinessKind =
  | "no-results" // 查询无命中（非异常，但视为 failure 便于 AI 处理）
  | "unsupported"; // 当前 skill 不支持该参数组合

/** 顶层联合 */
export type SkillFailureKind =
  | BrowserKind
  | AuthKind
  | ParamsKind
  | UpstreamKind
  | PipelineKind
  | BusinessKind;

/** 抽象类别 — 用于按大类聚合统计/路由 */
export type FailureCategory =
  | "browser"
  | "auth"
  | "params"
  | "upstream"
  | "pipeline"
  | "business";

const KIND_TO_CATEGORY: Record<SkillFailureKind, FailureCategory> = {
  "browser-unavailable": "browser",
  "browser-acquire-timeout": "browser",
  "navigation-failed": "browser",
  "not-logged-in": "auth",
  "access-denied": "auth",
  "risk-control": "auth",
  "missing-context": "params",
  "invalid-params": "params",
  "upstream-shape-changed": "upstream",
  "endpoint-http": "upstream",
  "endpoint-timeout": "upstream",
  "retry-exhausted": "upstream",
  "hook-abort": "pipeline",
  "pipeline-error": "pipeline",
  "no-results": "business",
  unsupported: "business",
};

export function categoryOf(kind: SkillFailureKind): FailureCategory {
  return KIND_TO_CATEGORY[kind] ?? "pipeline";
}

/** 是否值得重试（粗分类，具体策略由 RetryPolicy 决定） */
export function isRetryable(kind: SkillFailureKind): boolean {
  switch (kind) {
    case "browser-unavailable":
    case "browser-acquire-timeout":
    case "navigation-failed":
    case "endpoint-http":
    case "endpoint-timeout":
      return true;
    default:
      return false;
  }
}
