/**
 * 解析 `GET /x/v2/subtitle/web/view` 返回的 protobuf 字幕元数据，并把其中被混淆的
 * `subtitle_url` 还原为可直接请求的真实地址。
 *
 * 背景：付费(upower)视频的字幕不再出现在 `player/wbi/v2` 的 JSON 里，仅由该 protobuf
 * 接口下发。其 `subtitle_url`（字段 5）形如
 * `//subtitle.bilibili.com/<percent-encoded 混淆path>?auth_key=<明文>`，
 * `subtitle.bilibili.com` 是占位域名（真实 DNS 为 NXDOMAIN），播放器客户端会把混淆
 * path 解密改写为 `https://aisubtitle.hdslb.com/bfs/ai_subtitle/prod/...`。
 *
 * 混淆算法（已逆向，多视频验证）：percent-decode 后丢弃前若干字节 nonce，其余与一段
 * 固定 42 字节密钥做循环 XOR，即得真实 path（必以 `bfs/ai_subtitle/prod/` 开头）。
 * 由于密钥固定、nonce 长度可由「解出的前缀」定位，故可纯离线还原真实 URL，配合实时
 * 取到的 auth_key（同在字段 5 里，且具时效）Node 侧直接 fetch 即可拿到字幕全文。
 *
 * 仅依赖手写的极简 protobuf reader，不引入任何 protobuf 依赖。
 */

import { UpstreamShapeChangedError } from "@spider/core";

/** 抛错归属标识（本模块解析 bili-video 字幕元数据）。 */
const SCOPE = "bili-video-subtitle";

/** 混淆 path 的循环 XOR 密钥（42 字节，硬编码常量，多视频/多语言验证通用）。 */
const SUBTITLE_XOR_KEY = Buffer.from(
  "62696c6962696c6943757e4c2178737e665e2672402776683d715d717b65656e672a7345675e6b70234a",
  "hex",
);

/** 解密后真实 path 的固定前缀，用于定位 nonce 长度。 */
const REAL_PATH_MARKER = "bfs/ai_subtitle/prod/";

export interface BiliSubtitleViewItem {
  /** 字幕 id（int64 数值的字符串形式）。 */
  id: string;
  /** 语言代码，如 ai-zh / ai-en / zh-CN。 */
  lan: string;
  /** 语言可读名，如「中文」。 */
  lanDoc: string;
  /** 占位混淆 URL（不可直接请求），保留以便排障。 */
  obfuscatedUrl: string;
  /** 明文 auth_key（具时效，须实时获取）。 */
  authKey: string | null;
  /** 还原出的可直接请求的真实字幕 URL；无法解密时为 null。 */
  realUrl: string | null;
}

interface ProtoField {
  field: number;
  wire: number;
  value: bigint | Uint8Array;
}

function readVarint(buf: Uint8Array, pos: number): [bigint, number] {
  let result = 0n;
  let shift = 0n;
  let i = pos;
  for (; i < buf.length; i += 1) {
    const byte = buf[i];
    result |= BigInt(byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) {
      return [result, i + 1];
    }
    shift += 7n;
  }
  throw new UpstreamShapeChangedError("protobuf varint truncated", {
    scope: SCOPE,
  });
}

/** 解析一段 protobuf 字节为字段列表（仅支持 wire type 0/2）。 */
function parseMessage(buf: Uint8Array): ProtoField[] {
  const fields: ProtoField[] = [];
  let pos = 0;
  while (pos < buf.length) {
    const [tag, afterTag] = readVarint(buf, pos);
    const field = Number(tag >> 3n);
    const wire = Number(tag & 7n);
    if (wire === 0) {
      const [value, next] = readVarint(buf, afterTag);
      fields.push({ field, wire, value });
      pos = next;
    } else if (wire === 2) {
      const [len, afterLen] = readVarint(buf, afterTag);
      const end = afterLen + Number(len);
      fields.push({ field, wire, value: buf.slice(afterLen, end) });
      pos = end;
    } else {
      // 不支持的 wire type（fixed32/64 等）—— 字幕元数据用不到，遇到即停止。
      break;
    }
  }
  return fields;
}

function asBytes(value: bigint | Uint8Array): Uint8Array {
  if (value instanceof Uint8Array) return value;
  return new Uint8Array();
}

function decodeUtf8(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("utf8");
}

function extractAuthKey(url: string): string | null {
  const match = /[?&]auth_key=([^&]+)/.exec(url);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * 把混淆的 `subtitle_url` 还原为可直接请求的真实 aisubtitle URL。
 *
 * 步骤：取占位域名后、`?` 前的 path → percent-decode 为字节 → 扫描丢弃前缀 nonce 的
 * 偏移，对其余字节与固定密钥循环 XOR，命中 `bfs/ai_subtitle/prod/` 即为真实 path →
 * 拼上 `https://aisubtitle.hdslb.com/` 与原 auth_key。任一步失败返回 null（不抛）。
 */
export function decodeSubtitleUrl(obfuscatedUrl: string): string | null {
  try {
    const hostSplit = obfuscatedUrl.split(".com/");
    if (hostSplit.length < 2) return null;
    const rest = hostSplit[1];
    const qIdx = rest.indexOf("?");
    const pathEnc = qIdx >= 0 ? rest.slice(0, qIdx) : rest;
    const query = qIdx >= 0 ? rest.slice(qIdx) : "";
    const raw = Buffer.from(decodePercentBytes(pathEnc));
    const markerBytes = Buffer.from(REAL_PATH_MARKER, "ascii");
    for (let off = 0; off + markerBytes.length <= raw.length; off += 1) {
      let ok = true;
      for (let i = 0; i < markerBytes.length; i += 1) {
        if ((raw[off + i] ^ SUBTITLE_XOR_KEY[i % SUBTITLE_XOR_KEY.length]) !== markerBytes[i]) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      const dec = Buffer.alloc(raw.length - off);
      for (let i = 0; i < dec.length; i += 1) {
        dec[i] = raw[off + i] ^ SUBTITLE_XOR_KEY[i % SUBTITLE_XOR_KEY.length];
      }
      const path = dec.toString("ascii");
      if (!/^bfs\/ai_subtitle\/prod\/[\w-]+$/.test(path)) return null;
      return `https://aisubtitle.hdslb.com/${path}${query}`;
    }
    return null;
  } catch {
    return null;
  }
}

/** percent-decode 为原始字节（保留非 ASCII 字节，不做 UTF-8 解释）。 */
function decodePercentBytes(s: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (ch === "%" && i + 2 < s.length) {
      const hex = s.slice(i + 1, i + 3);
      const code = Number.parseInt(hex, 16);
      if (!Number.isNaN(code)) {
        out.push(code);
        i += 2;
        continue;
      }
    }
    out.push(s.charCodeAt(i) & 0xff);
  }
  return out;
}

/**
 * 解析 subtitle/web/view 的 protobuf 响应。
 *
 * 结构（逆向自实际响应）：
 *   message Reply { SubtitleData data = 1; }
 *   message SubtitleData { repeated SubtitleItem subtitles = 3; ... }
 *   message SubtitleItem {
 *     int64  id   = 1;  string id_str = 2;  string lan = 3;
 *     string lan_doc = 4;  string subtitle_url = 5;  ...
 *   }
 */
export function parseSubtitleView(buffer: Uint8Array): BiliSubtitleViewItem[] {
  const top = parseMessage(buffer);
  const items: BiliSubtitleViewItem[] = [];
  for (const f of top) {
    if (f.field !== 1 || f.wire !== 2) continue;
    const data = parseMessage(asBytes(f.value));
    for (const df of data) {
      if (df.field !== 3 || df.wire !== 2) continue;
      const sub = parseMessage(asBytes(df.value));
      let id = "";
      let lan = "";
      let lanDoc = "";
      let url = "";
      for (const sf of sub) {
        if (sf.field === 2 && sf.wire === 2) id = decodeUtf8(asBytes(sf.value));
        else if (sf.field === 3 && sf.wire === 2) lan = decodeUtf8(asBytes(sf.value));
        else if (sf.field === 4 && sf.wire === 2) lanDoc = decodeUtf8(asBytes(sf.value));
        else if (sf.field === 5 && sf.wire === 2) url = decodeUtf8(asBytes(sf.value));
      }
      if (!lan && !url) continue;
      items.push({
        id,
        lan: lan || "und",
        lanDoc: lanDoc || lan || "字幕",
        obfuscatedUrl: url,
        authKey: extractAuthKey(url),
        realUrl: decodeSubtitleUrl(url),
      });
    }
  }
  return items;
}
