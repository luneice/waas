/**
 * SSE（Server-Sent Events）事件解码器 —— 纯函数，零依赖
 *
 * 实现 W3C 标准（https://html.spec.whatwg.org/multipage/server-sent-events.html），
 * 零依赖、无站点特征，作为 `@Streamed` 的内置解码器之一。
 *
 * 本模块先在 skills/tradingview-spider 内落地并用真实 SSE 服务器验证
 * （TCP 分片重组、多行 data、中文多字节、注释心跳），确认契约手感后原样上提。
 *
 * ══════════════ 为什么需要「有状态的解码器」而不是纯 split ══════════════
 *
 * 网络分片与协议事件边界**无关**：一个 SSE 事件可能被 TCP 拆到两个 chunk，
 * 两个事件也可能挤在一个 chunk 里。实测（本地服务器故意分片写入）确认了这点。
 * 所以解码器必须持有跨 chunk 的残留缓冲 —— 用 `split("\n\n")` 一次性切会
 * 在分片处静默丢事件或产出半截 JSON，且症状是偶发的，极难排查。
 *
 * ══════════════ 规范细节（均已用真实字节验证）══════════════
 *
 *   `data: a` + `data: b`  → data 为 `"a\nb"`（多行用 \n 拼接，不是空格）
 *   `data:no-space`        → 冒号后**没有**空格时不吃字符，值为 `"no-space"`
 *   `data`（无冒号）        → 值为空串
 *   `: 注释`               → 整行忽略（很多服务端拿它做心跳保活）
 *   `event:` / `id:` / `retry:` → 事件类型 / 续传游标 / 重连间隔建议
 *   空行                   → 一个事件结束并派发
 *
 * 另外两条容易漏的：
 *   - 只有注释、没有任何字段的「事件」**不派发**（否则心跳会污染数据流）
 *   - `id` 含 NUL 字符时按规范应忽略该字段（这里一并处理，成本极低）
 */

/** 一条已还原的 SSE 事件 */
export interface SseEvent {
  /** 事件类型；缺省为 "message"（规范默认值） */
  event: string;
  /** 事件数据；多行 data 已用 \n 拼接 */
  data: string;
  /** 续传游标；用于断线后的 Last-Event-ID 头。无则为 null */
  id: string | null;
  /** 服务端建议的重连间隔（毫秒）。无则为 null */
  retry: number | null;
}

/** 解码器内部状态（跨 chunk 保留） */
interface DecoderState {
  /** 上一 chunk 末尾未构成完整行的残留 */
  buffer: string;
  /** 当前正在累积的事件字段 */
  dataLines: string[];
  eventType: string;
  lastEventId: string | null;
  retry: number | null;
  /** 本事件是否出现过任何字段（只有注释的不派发） */
  hasField: boolean;
}

function freshEvent(state: DecoderState): void {
  state.dataLines = [];
  state.eventType = "";
  state.retry = null;
  state.hasField = false;
}

/**
 * 创建一个有状态的 SSE 解码器。
 *
 * @returns `push(chunk)` 喂入原始文本，返回本次**新完成**的事件；
 *          `flush()` 流结束时调用，派发最后一个未以空行结尾的事件（若有）。
 */
export function createSseDecoder(): {
  push(chunk: string): SseEvent[];
  flush(): SseEvent[];
  /** 当前已知的最新 id，供断线重连时作 Last-Event-ID */
  lastEventId(): string | null;
} {
  const state: DecoderState = {
    buffer: "",
    dataLines: [],
    eventType: "",
    lastEventId: null,
    retry: null,
    hasField: false,
  };

  /** 把累积的字段收口成一个事件；不满足派发条件时返回 null */
  const dispatch = (): SseEvent | null => {
    // 只有注释、或什么都没有 → 不派发（心跳不该进数据流）
    if (!state.hasField) {
      freshEvent(state);
      return null;
    }
    const ev: SseEvent = {
      event: state.eventType || "message",
      data: state.dataLines.join("\n"),
      id: state.lastEventId,
      retry: state.retry,
    };
    freshEvent(state);
    return ev;
  };

  const handleLine = (line: string, out: SseEvent[]): void => {
    // 空行 = 事件边界
    if (line === "") {
      const ev = dispatch();
      if (ev) out.push(ev);
      return;
    }
    // 注释行：整行忽略（常见于保活）
    if (line.startsWith(":")) return;

    const colon = line.indexOf(":");
    let field: string;
    let value: string;
    if (colon === -1) {
      // 无冒号 → 整行是字段名，值为空串
      field = line;
      value = "";
    } else {
      field = line.slice(0, colon);
      value = line.slice(colon + 1);
      // 规范：冒号后**恰好一个**空格要被吃掉，多余的保留
      if (value.startsWith(" ")) value = value.slice(1);
    }

    switch (field) {
      case "data":
        state.dataLines.push(value);
        state.hasField = true;
        break;
      case "event":
        state.eventType = value;
        state.hasField = true;
        break;
      case "id":
        // 规范：含 NUL 字符的 id 必须忽略。判据是 NUL，不是空格 —— 空格在 id 里合法。
        if (!value.includes("\u0000")) {
          state.lastEventId = value;
          state.hasField = true;
        }
        break;
      case "retry": {
        // 规范：仅当全为数字时才生效
        if (/^\d+$/.test(value)) {
          state.retry = Number(value);
          state.hasField = true;
        }
        break;
      }
      default:
        // 未知字段按规范忽略（不计入 hasField，避免未知字段撑出空事件）
        break;
    }
  };

  return {
    push(chunk: string): SseEvent[] {
      const out: SseEvent[] = [];
      // CRLF / CR 统一成 LF：规范允许三种行分隔符
      state.buffer += chunk.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

      let idx: number;
      while ((idx = state.buffer.indexOf("\n")) !== -1) {
        const line = state.buffer.slice(0, idx);
        state.buffer = state.buffer.slice(idx + 1);
        handleLine(line, out);
      }
      // 剩余不足一行的留到下次 push —— 跨 chunk 重组的关键
      return out;
    },

    flush(): SseEvent[] {
      const out: SseEvent[] = [];
      // 流结束时缓冲里可能还有最后一行（无换行结尾）
      if (state.buffer !== "") {
        const line = state.buffer;
        state.buffer = "";
        handleLine(line, out);
      }
      const ev = dispatch();
      if (ev) out.push(ev);
      return out;
    },

    lastEventId(): string | null {
      return state.lastEventId;
    },
  };
}
