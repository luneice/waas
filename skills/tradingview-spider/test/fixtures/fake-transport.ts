/**
 * 脚本化的 WS transport 测试替身
 *
 * core 的 `testing.FakePage` 用 node:vm 沙箱，里面**没有 WebSocket 全局**，
 * 所以 WS 路径无法走标准 harness。这个替身把测试缝提到 transport 接口之上：
 * 全程不需要 WebSocket、不需要浏览器，纯数据驱动。
 *
 * （这也是未来上提 core 时需要一并考虑的缺口：`FakePage` 沙箱缺 WebSocket，
 *   意味着任何 WS 工作都得自建替身。）
 */

import { encodeFrame } from "@src/ws/frame";
import type { TvOutMessage } from "@src/types/ws.types";
import type {
  TvWsDrainResult,
  TvWsOpenOptions,
  TvWsOpenResult,
  TvWsTransport,
} from "@src/ws/transport";

/** 一个 drain 批次的脚本 */
export interface ScriptedBatch {
  /** 本批次要吐出的消息（会被自动编帧） */
  messages?: TvOutMessage[];
  /** 直接给原始 payload 文本（测畸形帧用） */
  rawPayloads?: string[];
  /** 本批次结束后标记连接关闭 */
  closed?: boolean;
  /** 累计丢帧数 */
  dropped?: number;
}

export class FakeTvTransport implements TvWsTransport {
  /** 已发送的帧（原始文本），供断言发了什么、发了几次 */
  readonly sentFrames: string[] = [];
  /** open 时随建连一起发出的初始化帧（不走 send，故单独记） */
  readonly openedFrames: string[] = [];
  /** open 时请求方传的 token 占位串（断言鉴权是否按需启用） */
  authTokenPlaceholder: string | undefined;
  /** 每次 drain 的调用记录 */
  drainCalls = 0;
  opened = false;
  closed = false;

  private cursor = 0;

  /**
   * @param batches drain 脚本
   * @param authInjected 模拟页面侧是否取到登录 token（默认 true，
   *        便于多数用例不必关心鉴权；测未登录场景显式传 false）
   */
  constructor(
    private readonly batches: ScriptedBatch[],
    private readonly authInjected = true,
  ) {}

  async open(options: TvWsOpenOptions): Promise<TvWsOpenResult> {
    this.opened = true;
    this.openedFrames.push(...options.frames);
    this.authTokenPlaceholder = options.authTokenPlaceholder;
    return {
      hello: '{"session_id":"fake","protocol":"json"}',
      // 未请求鉴权时恒为 false（页面侧不会做替换）
      authInjected: options.authTokenPlaceholder ? this.authInjected : false,
    };
  }

  async send(frames: string[]): Promise<void> {
    this.sentFrames.push(...frames);
  }

  async drain(_maxWaitMs: number): Promise<TvWsDrainResult> {
    this.drainCalls += 1;
    const batch = this.batches[this.cursor];
    this.cursor += 1;

    // 脚本用尽 → 表现为连接关闭，避免测试挂死
    if (!batch) {
      return {
        payloads: [],
        closed: true,
        closeCode: 1000,
        closeReason: "script exhausted",
        dropped: 0,
      };
    }

    const payloads = [
      ...(batch.messages ?? []).map((m) => JSON.stringify(m)),
      ...(batch.rawPayloads ?? []),
    ];

    return {
      payloads,
      closed: batch.closed ?? false,
      closeCode: batch.closed ? 1000 : null,
      closeReason: null,
      dropped: batch.dropped ?? 0,
    };
  }

  async close(): Promise<void> {
    this.closed = true;
  }

  /** 解析已发送的帧为消息，便于断言时序 */
  sentMessages(): TvOutMessage[] {
    return this.sentFrames.map((f) => {
      // 帧格式 ~m~len~m~payload
      const idx = f.indexOf("~m~", 3);
      const payload = idx === -1 ? f : f.slice(idx + 3);
      return JSON.parse(payload) as TvOutMessage;
    });
  }

  /** 断言用：某方法名的消息发了几次 */
  countSent(method: string): number {
    return this.sentMessages().filter((m) => m.m === method).length;
  }
}

/** 便捷构造：把消息数组包成单批次脚本 */
export function batch(...messages: TvOutMessage[]): ScriptedBatch {
  return { messages };
}

/** 便捷构造：编帧后的原始文本（测粘包用） */
export function framed(...messages: TvOutMessage[]): string {
  return messages.map((m) => encodeFrame(JSON.stringify(m))).join("");
}
