/**
 * 流式端点的累积与终止语义 —— 纯函数状态机，与传输层无关
 *
 * 「无界事件流 → 有界结果」这一范式本身 —— 不含站点特征、不 import 任何传输层，
 * 是 `@Streamed` 的执行内核。
 *
 * **跨协议已验证**：先在 skills/tradingview-spider 内用 SSE（真实服务器）设计并验证，
 * 随后 WebSocket 原样复用本模块（契约一行未改，只在外面加了一层薄桥接）——
 * 两个形态迥异的协议都能承载，才上提到 core。
 *
 * ══════════════ 为什么 HTTP 那套装饰器表达不了流 ══════════════
 *
 * `@Endpoint` / `@Paginated` / `@Expanded` 共享一个隐含假设：**每次交互有明确
 * 的"完成"时刻，数据是有界的**（`await fetch()` 拿到完整 payload → 投影 → 存
 * ctx）。推送类协议破坏的正是这个假设：数据是无界的流，"完成"不是协议事件而是
 * 业务判断。
 *
 * 于是流比 HTTP 多出两件必须由框架承载的事：
 *   ① `reduce` —— HTTP 方法体拿到的是完整响应，流拿到的是碎片，
 *      必须先归一成累加器状态，再交给方法体投影。
 *   ② `until`  —— 终止条件必须由业务给出，且**必须能读到入参**。
 *
 * ══════════════ until 为什么必须拿到 ctx（血的教训）══════════════
 *
 * `@Paginated.stopWhen(response, page, accumulated)` **拿不到 ctx**，读不到用户
 * 传的 maxPages。本包曾因此改用「装饰器给硬上限 20 + 聚合层按入参裁剪」，
 * 实测：用户传 maxPages=1 时上游被打了 **20 次**请求，而输出的 pagesFetched
 * 因为裁剪过仍显示 1 —— 从结果完全看不出超发，白白多打 19 次还丢了数据。
 *
 * 流的终止条件几乎必然依赖入参（"取到 2014 年为止" / "取满 N 条"），
 * 这个错不能在新抽象里重犯，所以 `until` 的签名第三个参数就是 ctx。
 */

/** 终止原因 —— 必须让消费方能区分"正常收口"与"被迫中断" */
export type StreamStopReason =
  /** until 判定满足 —— 唯一的"正常"终止 */
  | "until"
  /** 上游主动关闭了流 */
  | "closed"
  /** 超过 idleTimeout 没有新事件（疑似断流） */
  | "idle-timeout"
  /** 超过 maxDuration 硬上限 */
  | "max-duration"
  /** 事件数超过 maxEvents 硬上限 */
  | "max-events";

/** 终止原因是否属于"数据可能不完整" —— 消费方据此决定要不要告警 */
export function isTruncated(reason: StreamStopReason): boolean {
  return reason !== "until" && reason !== "closed";
}

/**
 * 累积配置。
 *
 * @typeParam TEvent 单个流事件（SSE 是 SseEvent，WS 是解码后的协议消息）
 * @typeParam TAcc   累加器状态
 * @typeParam TCtx   执行上下文（框架里是 GoalContext，测试里可传任意对象）
 */
export interface StreamReducerOptions<TEvent, TAcc, TCtx = unknown> {
  /** 累加器初值。每次执行都新建，避免跨次串数据 */
  seed: (ctx: TCtx) => TAcc;

  /**
   * 增量合并 —— HTTP 模型里没有的那一块。
   *
   * 必须返回累加器（可以原地改后返回同一个对象，也可返回新对象）。
   * 抛错会中止整条流并向上传播。
   */
  reduce: (acc: TAcc, event: TEvent, ctx: TCtx) => TAcc;

  /**
   * 终止判定。返回 true 即收口。
   *
   * ★ 第三个参数是 ctx —— 终止条件读得到入参，这是本抽象与
   *   `@Paginated.stopWhen` 的关键差异（见文件头"血的教训"）。
   */
  until?: (acc: TAcc, event: TEvent, ctx: TCtx) => boolean;

  /**
   * 多久没有**新事件**判定为断流（毫秒）。
   *
   * 与 maxDuration 是两回事：一个正常的长连接可能挂 10 分钟只推 3 条，
   * 单靠 maxDuration 无法区分"慢"和"死"。
   */
  idleTimeout?: number;

  /** 整条流的硬上限（毫秒）。流没有协议级"完成"，必须有兜底 */
  maxDuration?: number;

  /** 事件数硬上限，防御性上限（防止上游疯狂推送打爆内存） */
  maxEvents?: number;
}

export interface StreamRunResult<TAcc> {
  acc: TAcc;
  /** 消费的事件数（注意：不等于上游推送数，reduce 抛错前的不计） */
  eventCount: number;
  stopReason: StreamStopReason;
  /** 是否因超时/上限被迫中断（数据可能不完整） */
  truncated: boolean;
  durationMs: number;
}

/** 事件源：任何能异步产出事件的东西（SSE reader / WS drain 循环 / 测试数组） */
export type StreamSource<TEvent> = AsyncIterable<TEvent>;

export interface RunStreamDeps {
  /** 注入时钟，便于测试用假时钟快进 */
  now?: () => number;
}

/**
 * 驱动一条事件流直到终止。
 *
 * 设计要点：**超时判定基于"事件到达时刻"而非定时器**。用定时器会引入真实等待
 * （测试要么真睡、要么依赖 fake timer 的实现细节），而按事件时刻判定让整个
 * 状态机保持纯粹 —— 喂什么事件、什么时刻，结果完全确定。
 *
 * 代价：如果上游**彻底静默**（一个事件都不来），本函数不会自行醒来。
 * 因此调用方（传输层）必须给底层 read 操作设一个不超过 idleTimeout 的读超时，
 * 让静默也能表现为"一次事件到达"或迭代结束。这个约束写在这里，
 * 是为了让上提 core 时不丢失。
 */
export async function runStream<TEvent, TAcc, TCtx = unknown>(
  source: StreamSource<TEvent>,
  options: StreamReducerOptions<TEvent, TAcc, TCtx>,
  ctx: TCtx,
  deps: RunStreamDeps = {},
): Promise<StreamRunResult<TAcc>> {
  const now = deps.now ?? (() => Date.now());
  const startedAt = now();

  let acc = options.seed(ctx);
  let eventCount = 0;
  let stopReason: StreamStopReason = "closed";
  let lastEventAt = startedAt;

  const finish = (reason: StreamStopReason): StreamRunResult<TAcc> => ({
    acc,
    eventCount,
    stopReason: reason,
    truncated: isTruncated(reason),
    durationMs: now() - startedAt,
  });

  for await (const event of source) {
    const at = now();

    // 先判超时，再消费 —— 事件迟到本身就是断流的证据
    if (
      options.idleTimeout !== undefined &&
      at - lastEventAt > options.idleTimeout
    ) {
      return finish("idle-timeout");
    }
    if (
      options.maxDuration !== undefined &&
      at - startedAt > options.maxDuration
    ) {
      return finish("max-duration");
    }

    lastEventAt = at;
    acc = options.reduce(acc, event, ctx);
    eventCount += 1;

    if (options.until?.(acc, event, ctx)) {
      stopReason = "until";
      break;
    }
    if (options.maxEvents !== undefined && eventCount >= options.maxEvents) {
      stopReason = "max-events";
      break;
    }
  }

  return finish(stopReason);
}
