// ============================================================================
// BodyStore — 内容寻址的 body 持久化（请求体 / 响应体 / 入参 / 结果）
// ============================================================================
//
// 设计：
//   - 同一 sha256 → 同一文件 → 自动去重（很多 API 反复返回同样 JSON）
//   - 大对象在文件系统，JSONL 只存 BodyRef 指针 → 事件文件不会膨胀
//   - 超过 bodyMaxBytes 的截断后再 hash，preview 仅取 previewBytes
//
// 文件名约定：
//   <obsDir>/bodies/<hash[0..2]>/<hash>.json   （JSON）
//   <obsDir>/bodies/<hash[0..2]>/<hash>.txt    （text）
//   <obsDir>/bodies/<hash[0..2]>/<hash>.bin    （binary）
// ============================================================================

import { createHash } from "crypto";
import { mkdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { getObsConfig } from "./config";
import type { BodyRef } from "./events";

const TEXT_MIMES = [
  "application/json",
  "text/",
  "application/xml",
  "application/javascript",
];

function isTextMime(mime: string): boolean {
  const m = mime.toLowerCase();
  return TEXT_MIMES.some((p) => m.startsWith(p));
}

function extOf(mime: string): string {
  if (mime.includes("json")) return ".json";
  if (isTextMime(mime)) return ".txt";
  return ".bin";
}

/**
 * 把任意值序列化为 buffer + 自描述 mime。
 *  - Buffer / Uint8Array → 透传
 *  - string → utf8 buffer，mime=text/plain（除非显式给）
 *  - 其它 → JSON.stringify
 */
function normalize(
  data: unknown,
  hintMime?: string,
): { buf: Buffer; mime: string } {
  if (Buffer.isBuffer(data)) {
    return { buf: data, mime: hintMime ?? "application/octet-stream" };
  }
  if (data instanceof Uint8Array) {
    return { buf: Buffer.from(data), mime: hintMime ?? "application/octet-stream" };
  }
  if (typeof data === "string") {
    return { buf: Buffer.from(data, "utf-8"), mime: hintMime ?? "text/plain" };
  }
  // 其它结构 → JSON
  let json: string;
  try {
    json = JSON.stringify(data, jsonReplacer, 2);
  } catch {
    json = JSON.stringify({ __serialize_failed: String(data) });
  }
  return { buf: Buffer.from(json ?? "null", "utf-8"), mime: hintMime ?? "application/json" };
}

function jsonReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Map) return Object.fromEntries(value);
  if (value instanceof Set) return Array.from(value);
  if (Buffer.isBuffer(value)) return `[Buffer ${value.length} bytes]`;
  if (value instanceof Uint8Array) return `[Bytes ${value.length}]`;
  return value;
}

export class BodyStore {
  private readonly rootDir: string;
  private readonly maxBytes: number;
  private readonly previewBytes: number;
  private readonly created = new Set<string>();

  constructor(opts?: { dir?: string; maxBytes?: number; previewBytes?: number }) {
    const cfg = getObsConfig();
    this.rootDir = opts?.dir ?? join(cfg.dir, "bodies");
    this.maxBytes = opts?.maxBytes ?? cfg.bodyMaxBytes;
    this.previewBytes = opts?.previewBytes ?? cfg.previewBytes;
  }

  /**
   * 把 data 内容寻址写入磁盘，返回 BodyRef。
   * 同 hash 已存在时不重复落盘。
   */
  put(data: unknown, hintMime?: string): BodyRef {
    const { buf: rawBuf, mime } = normalize(data, hintMime);
    let buf = rawBuf;
    let truncated = false;
    if (buf.length > this.maxBytes) {
      buf = buf.subarray(0, this.maxBytes);
      truncated = true;
    }

    const hash = createHash("sha256").update(buf).digest("hex");
    const ext = extOf(mime);
    const sub = hash.slice(0, 2);
    const rel = `${sub}/${hash}${ext}`;
    const abs = join(this.rootDir, rel);

    if (!this.created.has(abs) && !existsSync(abs)) {
      try {
        mkdirSync(join(this.rootDir, sub), { recursive: true });
        writeFileSync(abs, buf);
        this.created.add(abs);
      } catch {
        /* swallow — 可观测性不应阻断业务 */
      }
    }

    let preview: string | undefined;
    if (isTextMime(mime)) {
      try {
        preview = buf.subarray(0, this.previewBytes).toString("utf-8");
        if (truncated) preview += "…[truncated]";
      } catch {
        /* ignore */
      }
    }

    return {
      hash,
      bytes: rawBuf.length,
      mime,
      preview,
      // 绝对路径 — 让 `obs` 输出和用户都能直接 open 这个文件
      path: abs,
    };
  }
}
