/**
 * WS 分帧编解码 —— 纯函数，无副作用，全部可单测
 *
 * 分帧格式：`~m~<字节长度>~m~<payload>`，一个 TCP 帧可能拼接多条消息。
 * 心跳帧的 payload 是 `~h~<序号>`，需原样回声。
 *
 * ══════════════ 两个容易踩坑的决策（改动前先看这里）══════════════
 *
 * ① **编码用字节长度，不是字符长度**。当前出站消息恰好全是 ASCII，但
 *    `set_locale`、未来的中文符号表达式一旦出现多字节字符，用 `.length` 就会
 *    声明出错误的长度。这是个潜伏 bug，直接用 TextEncoder 断掉。
 *
 * ② **解码忽略声明的长度，按分隔符切分**。`lang=zh` 时 payload 里带中文
 *    （description / short_name），声明的**字节数** ≠ JS 字符串**字符数**，
 *    按声明数字去 slice 会把多字节字符从中间截断，产生看不懂的乱码帧。
 *    因此改为按 `/~m~\d+~m~/` 分隔符定位边界。
 *    副作用：若 payload 内部恰好出现 `~m~数字~m~` 字面量会误切 —— 用
 *    `decodeMessages` 的重拼兜底覆盖（切坏的片段 JSON.parse 会失败，与下一段
 *    重拼后重试）。
 */

import type {
  TvFrameChunk,
  TvInMessage,
  TvOutMessage,
} from "@src/types/ws.types";

/** UTF-8 字节长度 */
function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

/** 把 payload 文本包成协议帧 */
export function encodeFrame(payload: string): string {
  return `~m~${byteLength(payload)}~m~${payload}`;
}

/** 把出站消息编成协议帧 */
export function encodeMessage(msg: TvOutMessage): string {
  return encodeFrame(JSON.stringify(msg));
}

/** 判断一个 chunk 是否是心跳 */
export function isHeartbeat(chunk: string): boolean {
  return chunk.startsWith("~h~");
}

/**
 * 心跳回声帧 —— 必须与收到的帧字节一致。
 *
 * 注意心跳 chunk 是纯 ASCII（`~h~` + 数字），所以 byteLength === length，
 * 这里仍走 encodeFrame 以保持单一实现。
 */
export function encodeHeartbeatEcho(chunk: string): string {
  return encodeFrame(chunk);
}

/**
 * 拆帧：把一次 onmessage 收到的原始文本切成若干 chunk。
 *
 * 按分隔符定位边界（原因见文件头决策 ②）。
 */
export function parseFrames(raw: string): TvFrameChunk[] {
  const out: TvFrameChunk[] = [];
  const re = /~m~(\d+)~m~/g;
  let match = re.exec(raw);

  while (match !== null) {
    const start = match.index + match[0].length;
    re.lastIndex = start;
    const next = re.exec(raw);
    const text = raw.slice(start, next === null ? raw.length : next.index);
    out.push({ kind: isHeartbeat(text) ? "heartbeat" : "payload", text });
    match = next;
  }

  return out;
}

/** 单条 payload 文本 → 业务消息；形状不符返回 null（由调用方决定如何处置） */
export function decodeMessage(text: string): TvInMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.m !== "string" || !Array.isArray(obj.p)) return null;
  return obj as unknown as TvInMessage;
}

export interface DecodeBatchResult {
  messages: TvInMessage[];
  /** 无法解析的片段数（协议漂移或切分失败的信号） */
  malformed: number;
}

/**
 * 批量解码 payload 文本，带**坏帧重拼兜底**。
 *
 * 若某段 JSON.parse 失败，尝试与后一段重新拼接（覆盖 payload 内部恰好含
 * `~m~数字~m~` 导致误切的情形）再解一次；仍失败才计入 malformed。
 */
export function decodeMessages(payloads: readonly string[]): DecodeBatchResult {
  const messages: TvInMessage[] = [];
  let malformed = 0;

  for (let i = 0; i < payloads.length; i++) {
    const text = payloads[i];
    const msg = decodeMessage(text);
    if (msg !== null) {
      messages.push(msg);
      continue;
    }

    // 与下一段重拼后重试一次
    if (i + 1 < payloads.length) {
      const joined = decodeMessage(text + payloads[i + 1]);
      if (joined !== null) {
        messages.push(joined);
        i += 1; // 消费掉被拼进来的那一段
        continue;
      }
    }
    malformed += 1;
  }

  return { messages, malformed };
}
