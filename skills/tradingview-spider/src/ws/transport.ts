/**
 * WS 传输层抽象 —— 全包唯一的「页面边界」缝
 *
 * 这个接口的存在同时解决两件事：
 *   1. **合规**：socket 关在页面里，只把解码后的协议文本递回 Node，
 *      凭据与会话永不出页面（CLAUDE.md §4.6）；
 *   2. **可测**：测试注入 `FakeTvTransport` 即可完整驱动状态机，
 *      不需要 WebSocket 全局、不需要浏览器
 *      （core 的 `testing.FakePage` 用 node:vm 沙箱，里面没有 WebSocket）。
 *
 * 框架不提供 WebSocket 相关能力（core 全量搜索只有 CDP 调试端点相关的
 * webSocketDebuggerUrl），所以这一层是必要的自建物；但**生命周期管理不在这里**
 * ——建连/释放由 `TvWsSkillBase` 的 `@Setup`/`@Teardown` 负责。
 */

import type { Page } from "puppeteer-core";
import { EndpointHttpError, EndpointTimeoutError } from "@spider/core";
import {
  pageWsOpen,
  pageWsSend,
  pageWsDrain,
  pageWsClose,
  type PageWsOpenArg,
  type PageWsDrainArg,
  type PageWsSendArg,
  type PageWsCloseArg,
} from "@src/ws/page-scripts";
import { WS_MAX_BUFFERED_FRAMES } from "@src/constants";

export interface TvWsOpenOptions {
  url: string;
  /** 已编好帧的初始化消息 */
  frames: string[];
  openTimeoutMs: number;
  /**
   * 需要在**页面侧**被替换成真实登录 token 的占位串。
   *
   * 传了就启用「页面内取 token、页面内用」（技术指标必需，见 page-scripts.ts
   * 的 `authTokenPlaceholder` 注释）；不传则沿用占位串（行情/K 线够用）。
   * Node 侧永远拿不到 token 本体，只能从 `TvWsOpenResult.authInjected` 知道成败。
   */
  authTokenPlaceholder?: string;
}

/** 建连结果 —— 刻意不含 token 本体（凭据不出页面） */
export interface TvWsOpenResult {
  /** 握手 hello 帧的原始文本 */
  hello: string | null;
  /** 是否成功注入了页面的登录 token（false = 该会话未登录或站点未内联 token） */
  authInjected: boolean;
}

export interface TvWsDrainResult {
  /** 原始 payload 文本（心跳已在页面侧回声并吞掉） */
  payloads: string[];
  closed: boolean;
  closeCode: number | null;
  closeReason: string | null;
  /** 累计丢帧数（>0 说明取数速度跟不上推送） */
  dropped: number;
}

export interface TvWsTransport {
  /** 建连并返回握手 hello 帧与鉴权注入结果 */
  open(options: TvWsOpenOptions): Promise<TvWsOpenResult>;
  send(frames: string[]): Promise<void>;
  drain(maxWaitMs: number): Promise<TvWsDrainResult>;
  close(): Promise<void>;
}

export type TvWsTransportFactory = (page: Page, scope: string) => TvWsTransport;

/** 页面内 window 状态键的前缀（每实例独立，避免同页并发串扰） */
const STATE_KEY_PREFIX = "__tv_ws_";

/**
 * 生产实现：socket 活在页面里，Node 侧只做 open/send/drain/close 四次跨界调用。
 *
 * 失败一律抛框架的 `SpiderError` 子类（带 scope），让 `errorInfo.kind` 与
 * Goal 链路保持同一套语义，Agent 的处置逻辑不必分叉。
 * 其中 `endpoint-timeout` / `endpoint-http` 都属可重试 kind，
 * 上层的 `RetryPolicy` 据此自动决策。
 */
class PageWsTransport implements TvWsTransport {
  private readonly key: string;

  constructor(
    private readonly page: Page,
    private readonly scope: string,
  ) {
    this.key = `${STATE_KEY_PREFIX}${Math.random().toString(36).slice(2, 10)}`;
  }

  async open(options: TvWsOpenOptions): Promise<TvWsOpenResult> {
    const arg: PageWsOpenArg = {
      url: options.url,
      frames: options.frames,
      key: this.key,
      openTimeoutMs: options.openTimeoutMs,
      maxBufferedFrames: WS_MAX_BUFFERED_FRAMES,
      authTokenPlaceholder: options.authTokenPlaceholder ?? "",
    };
    const res = await this.page.evaluate(pageWsOpen, arg);

    if (!res.ok) {
      const details = { endpoint: "ws", reason: res.error };
      if (res.errorKind === "timeout") {
        throw new EndpointTimeoutError(
          `行情通道建连超时（${options.openTimeoutMs}ms）`,
          { scope: this.scope, phase: "ws-open", details },
        );
      }
      throw new EndpointHttpError(
        `行情通道建连失败：${res.error ?? "unknown"}`,
        {
          scope: this.scope,
          phase: "ws-open",
          details,
        },
      );
    }
    return { hello: res.hello, authInjected: res.authInjected };
  }

  async send(frames: string[]): Promise<void> {
    if (frames.length === 0) return;
    const arg: PageWsSendArg = { key: this.key, frames };
    const res = await this.page.evaluate(pageWsSend, arg);
    if (!res.ok) {
      throw new EndpointHttpError(
        `行情通道发送失败：${res.error ?? "unknown"}`,
        {
          scope: this.scope,
          phase: "ws-send",
          details: { endpoint: "ws" },
        },
      );
    }
  }

  async drain(maxWaitMs: number): Promise<TvWsDrainResult> {
    const arg: PageWsDrainArg = { key: this.key, maxWaitMs };
    const res = await this.page.evaluate(pageWsDrain, arg);
    if (!res.ok) {
      throw new EndpointHttpError(
        `行情通道读取失败：${res.error ?? "unknown"}`,
        {
          scope: this.scope,
          phase: "ws-drain",
          details: { endpoint: "ws" },
        },
      );
    }
    return {
      payloads: res.payloads,
      closed: res.closed,
      closeCode: res.closeCode,
      closeReason: res.closeReason,
      dropped: res.dropped,
    };
  }

  async close(): Promise<void> {
    const arg: PageWsCloseArg = { key: this.key };
    // 清理必然发生：页面已崩溃时也不该把异常抛给调用方
    try {
      await this.page.evaluate(pageWsClose, arg);
    } catch {
      /* 页面已不可用，无需处理 */
    }
  }
}

export const createPageWsTransport: TvWsTransportFactory = (page, scope) =>
  new PageWsTransport(page, scope);
