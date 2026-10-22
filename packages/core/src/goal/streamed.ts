/**
 * 流式端点 —— `@Streamed` 修饰符
 *
 * 与 `@Paginated` / `@Expanded` 同为叠加在 `@Endpoint` 上的修饰符，
 * 承载「响应体读不完」的推送类协议（SSE / WebSocket / NDJSON 长响应）。
 *
 * ══════════════ 为什么 HTTP 那三个装饰器表达不了流 ══════════════
 *
 * `@Endpoint` / `@Paginated` / `@Expanded` 共享一个隐含假设：**每次交互有明确的
 * "完成"时刻，数据是有界的**。推送类协议破坏的正是这个假设 —— 数据是无界的流，
 * "完成"不是协议事件而是业务判断。于是流比 HTTP 多出两件事：
 *
 *   ① `reduce` —— HTTP 方法体拿到完整响应，流拿到的是碎片，
 *      必须先归一成累加器状态，再交给方法体投影。
 *   ② `until`  —— 终止条件由业务给出，**且必须能读到入参**。
 *
 * ══════════════ until 为什么必须拿到 ctx（血的教训）══════════════
 *
 * `@Paginated.stopWhen(response, page, accumulated)` **拿不到 ctx**，读不到用户传的
 * maxPages。tradingview-spider 曾因此改用「装饰器给硬上限 20 + 聚合层按入参裁剪」，
 * 实测：用户传 maxPages=1 时上游被打了 **20 次**请求，而输出的 pagesFetched 因为
 * 裁剪过仍显示 1 —— 从结果完全看不出超发。
 *
 * 流的终止条件几乎必然依赖入参（"取到 2014 年为止" / "取满 N 条"），
 * 所以 `until` 的第三个参数就是 ctx。这是本抽象与 stopWhen 的关键差异。
 *
 * @example
 * ```typescript
 * @Endpoint("/events", { method: "GET" })
 * @Streamed<SseEvent, Acc>({
 *   decode: "sse",
 *   seed: () => ({ items: [], lastId: null }),
 *   reduce: (acc, ev) => {
 *     if (ev.event === "tick") acc.items.push(JSON.parse(ev.data));
 *     if (ev.id) acc.lastId = ev.id;
 *     return acc;
 *   },
 *   until: (acc, ev, ctx) => ev.event === "done" || acc.items.length >= ctx.params.limit,
 *   idleTimeout: 30_000,
 *   maxDuration: 120_000,
 * })
 * fetchTicks(acc: Acc): Tick[] {
 *   return acc.items;   // ← 方法体仍是投影，与 @Endpoint 完全一致
 * }
 * ```
 */

import "reflect-metadata";
import type { GoalContext } from "./interfaces";

/**
 * 事件解码策略。
 *
 * - `"sse"`    —— W3C Server-Sent Events（core 内置）
 * - `"ndjson"` —— 按行分隔的 JSON（core 内置）
 * - 自定义函数 —— 自带分帧的协议（如 WebSocket 的私有分帧）传解码器工厂
 */
export type StreamDecode<TEvent> =
  | "sse"
  | "ndjson"
  | (() => {
      push(chunk: string): TEvent[];
      flush(): TEvent[];
    });

export interface StreamedOptions<TEvent, TAcc> {
  /** 依赖的前序端点（同 @Paginated / @Expanded） */
  dependencies?: string[];

  /** 事件解码策略 */
  decode: StreamDecode<TEvent>;

  /** 累加器初值。每次执行都新建，避免跨次串数据 */
  seed: (ctx: GoalContext) => TAcc;

  /**
   * 增量合并 —— HTTP 模型里没有的那一块。
   * 抛错会中止整条流并向上传播。
   */
  reduce: (acc: TAcc, event: TEvent, ctx: GoalContext) => TAcc;

  /**
   * 终止判定，返回 true 即收口。
   * ★ 第三个参数是 ctx —— 终止条件读得到入参（见文件头「血的教训」）。
   */
  until?: (acc: TAcc, event: TEvent, ctx: GoalContext) => boolean;

  /**
   * 多久没有**新事件**判定为断流（毫秒）。
   *
   * 与 maxDuration 是两回事：一条正常长连接可能挂 10 分钟只推 3 条，
   * 单靠总时长无法区分"慢"和"死"。
   */
  idleTimeout?: number;

  /** 整条流的硬上限（毫秒）。流没有协议级"完成"，必须有兜底 */
  maxDuration?: number;

  /** 事件数硬上限，防御上游疯狂推送打爆内存 */
  maxEvents?: number;

  /**
   * ⚠️ 注意：`@Endpoint` 的 `timeout` 对流式端点**不生效**。
   * 那是「整个请求的上限」，会把一条正常的长连接在 30 秒时掐断。
   * 流的时间控制一律走上面的 idleTimeout / maxDuration。
   */
  [key: string]: unknown;
}

/** 元数据键 —— 与 @Paginated / @Expanded 同构的延迟合并机制 */
export const STREAMED_METADATA_KEY = Symbol("ai-spider:streamed");

/**
 * `@Streamed` 装饰器 —— 必须与 `@Endpoint` 共存，不能独立使用。
 *
 * 书写顺序无关：`finalizeGoalMetadata()` 会在实例化时延迟合并
 * （同 @Paginated / @Expanded 的处理）。
 */
export function Streamed<TEvent, TAcc>(
  options: StreamedOptions<TEvent, TAcc>,
): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    // 延后到 finalizeGoalMetadata 合并：装饰器求值顺序不可控，
    // @Endpoint 可能还没跑（与 @Paginated 完全同构的处理）
    Reflect.defineMetadata(
      STREAMED_METADATA_KEY,
      options,
      target,
      propertyKey,
    );
    return descriptor;
  };
}
