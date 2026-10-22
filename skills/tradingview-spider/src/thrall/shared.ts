/**
 * Goal 层共享配置
 *
 * 集中管理所有 Goal 的节流/重试/凭证基线，避免散落到各端点。
 *
 * ══════════════ credentials 的坑（实测踩过，别再改回去）══════════════
 *
 * 两个上游的 CORS 策略**不一致**，凭证模式必须分别设置：
 *   - 检索服务：响应头**没有** `access-control-allow-credentials`
 *     → 带凭证发请求会被浏览器直接拒绝（`Failed to fetch`，连请求都发不出去）
 *     → 必须 `credentials: "omit"`
 *   - 截面扫描：响应头有 `access-control-allow-credentials: true`
 *     → 可以带凭证（沿用框架默认的 "include"）
 *
 * 这也解释了为什么这两个接口在 curl 下都是 200、在页面里却一个成一个败：
 * curl 不执行 CORS 策略，浏览器才执行。
 */

/** 站点整体较为稳定，重试次数不必给太多；间隔留足避免触发风控 */
export const TV_GOAL_DEFAULTS = {
  retry: { count: 2, delay: 1500 },
  interval: 800,
  concurrency: 3,
  timeout: 30_000,
} as const;

/**
 * 检索服务专用默认值 —— 关键差异是 `credentials: "omit"`（原因见文件头）。
 */
export const TV_SEARCH_GOAL_DEFAULTS = {
  ...TV_GOAL_DEFAULTS,
  credentials: "omit" as RequestCredentials,
};

/**
 * 指标编译服务默认值。
 *
 * 响应头实测带 `access-control-allow-credentials: true`（同截面扫描），
 * 故沿用框架默认的 `include`，不像检索服务那样需要 omit。
 *
 * 超时给得比通用值宽：`translate` 要在服务端编译 Pine 脚本，单个响应可达
 * 85KB，`list?filter=fundamental` 更是 713KB。
 */
export const TV_PINE_GOAL_DEFAULTS = {
  ...TV_GOAL_DEFAULTS,
  timeout: 45_000,
};

/** 检索单页条数（上游固定步长） */
export const SEARCH_PAGE_SIZE = 50;
