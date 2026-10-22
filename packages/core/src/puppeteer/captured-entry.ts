/**
 * 拦截器捕获的条目 — 通用形状。
 * 独立成文件以避免 slots.ts ↔ interceptor.ts 的循环依赖。
 */
export interface CapturedEntry<TBody = unknown> {
  url: string;
  mimeType: string;
  body: TBody;
}
