/**
 * 付费/受限视频字幕解析：`/x/v2/subtitle/web/view` protobuf + 混淆 URL 解密。
 *
 * 背景：付费（upower）视频 `/x/player/wbi/v2` 返回 subtitles:[]，字幕改由
 * `GET /x/v2/subtitle/web/view`（无需 WBI 签名）以 protobuf 下发。其中字幕地址
 * 形如 `//subtitle.bilibili.com/<percent-encoded 混淆path>?auth_key=<明文>`，
 * subtitle.bilibili.com 仅为占位 host，真实地址需客户端解密：
 *   - percent-decode 混淆 path 得 raw bytes；前部含可丢弃 nonce；
 *   - 以 42 字节常量 key 做重复密钥 XOR；
 *   - 扫描起始 offset，命中 `bfs/ai_subtitle/prod/` 前缀者即真实 path；
 *   - 真实 URL = `https://aisubtitle.hdslb.com/{path}?auth_key={明文auth_key}`。
 *
 * 该 key 已用多个不同视频样本验证为通用常量。解密是 best-effort：任一步失败
 * （结构异常 / 扫不到前缀）都返回空，绝不抛错阻断主流程。
 */

/** 42 字节重复密钥 XOR key（开头为 ASCII "bilibili"）。 */
const SUBTITLE_XOR_KEY = Uint8Array.from(
  Buffer.from(
    "62696c6962696c6943757e4c2178737e665e2672402776683d715d717b65656e672a7345675e6b70234a",
    "hex",
  ),
);

/** 真实字幕 path 前缀，用作解密命中校验。 */
const REAL_PATH_PREFIX = "bfs/ai_subtitle/prod/";
const AISUBTITLE_HOST = "https://aisubtitle.hdslb.com/";
const SUBTITLE_PLACEHOLDER_HOST = "subtitle.bilibili.com/";

/** protobuf wire 解析出的一条字段。 */
interface PbField {
  field: number;
  /** wire type 0：varint；wire type 2：bytes。 */
  value: bigint | Uint8Array;
}

/** 解出的一条混淆字幕元数据（尚未解密 URL）。 */
export interface ObfuscatedSubtitle {
  idStr: string;
  lan: string;
  lanDoc: string;
  /** field5 原始混淆 URL：`//subtitle.bilibili.com/...?auth_key=...`。 */
  obfuscatedUrl: string;
}

/** 解析一段 protobuf（仅 varint / length-delimited，其余 wire type 截断）。 */
function parseProtobuf(bytes: Uint8Array): PbField[] {
  const out: PbField[] = [];
  let i = 0;
  while (i < bytes.length) {
    const tag = bytes[i++];
    const field = tag >> 3;
    const wireType = tag & 0x07;
    if (wireType === 0) {
      let value = 0n;
      let shift = 0n;
      while (i < bytes.length) {
        const b = bytes[i++];
        value |= BigInt(b & 0x7f) << shift;
        if ((b & 0x80) === 0) break;
        shift += 7n;
      }
      out.push({ field, value });
    } else if (wireType === 2) {
      let len = 0;
      let shift = 0;
      while (i < bytes.length) {
        const b = bytes[i++];
        len |= (b & 0x7f) << shift;
        if ((b & 0x80) === 0) break;
        shift += 7;
      }
      out.push({ field, value: bytes.subarray(i, i + len) });
      i += len;
    } else {
      // group / fixed32 / fixed64 不在字幕响应里出现，遇到即停止以保安全。
      break;
    }
  }
  return out;
}

function findBytes(fields: PbField[], field: number): Uint8Array | null {
  for (const f of fields) {
    if (f.field === field && f.value instanceof Uint8Array) return f.value;
  }
  return null;
}

function decodeUtf8(bytes: Uint8Array | null): string {
  return bytes ? new TextDecoder().decode(bytes) : "";
}

/**
 * 解析 `/x/v2/subtitle/web/view` protobuf（base64），抽取每条字幕的语言与混淆 URL。
 * 结构容错：顶层 field1 = body；body 内每个 field3 = 一条字幕项。
 */
export function parseSubtitleViewProtobuf(base64: string): ObfuscatedSubtitle[] {
  let buf: Uint8Array;
  try {
    buf = Uint8Array.from(Buffer.from(base64, "base64"));
  } catch {
    return [];
  }
  if (buf.length === 0) return [];

  const top = parseProtobuf(buf);
  const body = findBytes(top, 1);
  // 部分响应可能没有外层 field1 包裹，回退为直接解析顶层。
  const container = body ? parseProtobuf(body) : top;

  const results: ObfuscatedSubtitle[] = [];
  for (const f of container) {
    if (f.field !== 3 || !(f.value instanceof Uint8Array)) continue;
    const item = parseProtobuf(f.value);
    const obfuscatedUrl = decodeUtf8(findBytes(item, 5));
    if (!obfuscatedUrl.includes(SUBTITLE_PLACEHOLDER_HOST)) continue;
    results.push({
      idStr: decodeUtf8(findBytes(item, 2)),
      lan: decodeUtf8(findBytes(item, 3)) || "und",
      lanDoc: decodeUtf8(findBytes(item, 4)) || "字幕",
      obfuscatedUrl,
    });
  }
  return results;
}

/**
 * 解密混淆字幕 URL → 真实 aisubtitle.hdslb.com 绝对地址；失败返回 null。
 *
 * 输入形如 `//subtitle.bilibili.com/<percent-encoded 混淆>?auth_key=<明文>`。
 */
export function deobfuscateSubtitleUrl(obfuscatedUrl: string): string | null {
  const hostIdx = obfuscatedUrl.indexOf(SUBTITLE_PLACEHOLDER_HOST);
  if (hostIdx < 0) return null;
  const afterHost = obfuscatedUrl.slice(hostIdx + SUBTITLE_PLACEHOLDER_HOST.length);
  const qIdx = afterHost.indexOf("?auth_key=");
  if (qIdx < 0) return null;
  const encodedPath = afterHost.slice(0, qIdx);
  const authKey = afterHost.slice(qIdx + "?auth_key=".length);
  if (!authKey) return null;

  let raw: Uint8Array;
  try {
    raw = decodePercentBytes(encodedPath);
  } catch {
    return null;
  }

  const key = SUBTITLE_XOR_KEY;
  for (let off = 0; off < raw.length; off++) {
    const dec = new Uint8Array(raw.length - off);
    for (let i = 0; i < dec.length; i++) dec[i] = raw[off + i] ^ key[i % key.length];
    const path = new TextDecoder("latin1").decode(dec);
    if (path.startsWith(REAL_PATH_PREFIX)) {
      return `${AISUBTITLE_HOST}${path}?auth_key=${authKey}`;
    }
  }
  return null;
}

/** percent-decode 为字节（保留非 ASCII 字节，避免 decodeURIComponent 的 UTF-8 校验）。 */
function decodePercentBytes(s: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "%" && i + 2 < s.length) {
      out.push(parseInt(s.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      out.push(c.charCodeAt(0) & 0xff);
    }
  }
  return Uint8Array.from(out);
}
