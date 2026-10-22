/**
 * WS transport → 流事件源 的桥接
 *
 * ══════════════ 这个文件是「抽象是否通用」的试金石 ══════════════
 *
 * `runStream` 是在 SSE 场景下设计并验证的。如果 WS 能原样复用它、只需在这里补
 * 一层薄桥接，说明「无界事件流 → 有界结果」这个抽象确实跨协议成立，可以上提
 * core；如果 WS 需要改 `runStream` 的契约，说明抽象还差东西 —— 那正是我们要在
 * 上提**之前**发现的信号。
 *
 * 实际适配下来只需处理两件事，都不涉及改动 `runStream`：
 *
 *   ① **拉 vs 推**：SSE 是 `reader.read()` 拉取，WS 是页面侧缓冲 + Node 侧
 *      `drain()` 轮询。两者都能包成 `AsyncIterable`，对 `runStream` 无差别。
 *
 *   ② **双向往返**：WS 需要在收到数据后回发消息（如翻页请求），SSE 单向没有
 *      这需求。这里用 `outbox` 承载 —— reduce 往里推消息，本迭代器在下一轮
 *      drain 前统一发出。**注意这是 WS 特有的，不属于流抽象本身**，
 *      上提 core 时应作为 transport 的可选能力，而非 `runStream` 的契约。
 *
 * ══════════════ 静默流的处理（runStream 明确要求的约束）══════════════
 *
 * `runStream` 的超时判定基于「事件到达时刻」而非定时器，所以它要求传输层给底层
 * read 设一个不超过 idleTimeout 的读超时，让静默也能表现为一次迭代。
 * 这里由 `drain(maxWaitMs)` 天然满足：它最多等 maxWaitMs 就返回（可能是空批次），
 * 空批次不产出事件但会推进循环，让 runStream 有机会判超时。
 */

import type { TvInMessage } from "@src/types/ws.types";
import { decodeMessages } from "@src/ws/frame";
import { encodeMessage } from "@src/ws/frame";
import type { TvOutMessage } from "@src/types/ws.types";
import type { TvWsTransport } from "@src/ws/transport";

/** 发信箱：reduce 阶段往里推消息，下一轮 drain 前统一发出 */
export class TvOutbox {
  private queue: TvOutMessage[] = [];

  /** 排队一条出站消息（在 reduce 里调用，保持 reduce 同步、可测） */
  push(msg: TvOutMessage): void {
    this.queue.push(msg);
  }

  /** 取走全部待发消息 */
  drain(): TvOutMessage[] {
    const out = this.queue;
    this.queue = [];
    return out;
  }

  get pending(): number {
    return this.queue.length;
  }
}

/** 流经 runStream 的 WS 事件 */
export interface TvWsStreamEvent {
  /** 解码后的协议消息 */
  message: TvInMessage;
  /** 该消息所在批次的丢帧累计数（>0 说明消费速度跟不上推送） */
  droppedFrames: number;
}

export interface WsSourceOptions {
  /** 单次 drain 的最长等待，必须 <= runStream 的 idleTimeout */
  drainWaitMs: number;
  /** 发信箱：每轮 drain 前把排队消息发出 */
  outbox: TvOutbox;
  /** 畸形帧计数回调（协议漂移的早期信号，不中断流） */
  onMalformed?: (count: number) => void;
}

/**
 * 把 WS transport 包装成 `runStream` 可消费的异步迭代器。
 *
 * 每轮循环：先发出 outbox 里排队的消息 → drain 一批 → 解码 → 逐条 yield。
 * 上游关闭时结束迭代（`runStream` 会记为 `closed`）。
 */
export async function* wsEventSource(
  transport: TvWsTransport,
  options: WsSourceOptions,
): AsyncIterable<TvWsStreamEvent> {
  for (;;) {
    // ① 先把 reduce 阶段排队的消息发出去（如 request_more_data）
    const pending = options.outbox.drain();
    if (pending.length > 0) {
      await transport.send(pending.map(encodeMessage));
    }

    // ② 取一批帧；空批次也会返回（这正是静默流能被判超时的原因）
    const batch = await transport.drain(options.drainWaitMs);

    // ③ 解码并逐条产出
    const { messages, malformed } = decodeMessages(batch.payloads);
    if (malformed > 0) options.onMalformed?.(malformed);

    for (const message of messages) {
      yield { message, droppedFrames: batch.dropped };
    }

    // ④ 上游关闭 → 结束迭代。放在产出之后，确保关闭前的最后一批数据不丢
    if (batch.closed) return;
  }
}
