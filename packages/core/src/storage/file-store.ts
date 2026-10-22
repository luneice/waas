import { writeFile, mkdir, readFile, stat } from "fs/promises";
import { join, resolve, relative, dirname, extname, basename } from "path";
import { createHash } from "crypto";
import type {
  IArtifactSink,
  Artifact,
  ArtifactMeta,
  ArtifactConflictPolicy,
} from "./interfaces";
import { SpiderError } from "../errors";
import { currentRuntime } from "../runtime";

// ============================================================================
// MIME → 扩展名映射
// ============================================================================

const MIME_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "image/bmp": ".bmp",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "audio/mpeg": ".mp3",
  "audio/mp4": ".m4a",
  "audio/ogg": ".ogg",
  "audio/wav": ".wav",
  "text/vtt": ".vtt",
  "application/json": ".json",
};

function mimeToExt(contentType: string): string {
  const mime = contentType.split(";")[0].trim().toLowerCase();
  return MIME_EXT[mime] ?? "";
}

function hasExtension(name: string): boolean {
  return /\.\w{2,5}$/.test(name);
}

// ============================================================================
// FileArtifactSink — 本地文件系统存储 + 冲突防护
// ============================================================================

export interface FileArtifactSinkOptions {
  /** 写入冲突策略（默认 "rename"） */
  conflictPolicy?: ArtifactConflictPolicy;
  /** @deprecated logger 不再作为诊断通道，保留字段仅兼容旧调用。 */
  logger?: unknown;
}

export class FileArtifactSink implements IArtifactSink {
  private readonly outputDir: string;
  private readonly conflictPolicy: ArtifactConflictPolicy;

  /**
   * 写入 key → 已落盘绝对路径 的映射，供同实例去重 / rename 使用。
   * 进程级别的去重；不跨进程。
   */
  private readonly writtenKeys = new Map<
    string,
    { absPath: string; sha256: string }
  >();

  constructor(outputDir: string, options: FileArtifactSinkOptions = {}) {
    this.outputDir = resolve(outputDir);
    this.conflictPolicy = options.conflictPolicy ?? "rename";
    void options.logger;
  }

  async write(
    key: string,
    data: Buffer | string,
    meta: ArtifactMeta,
  ): Promise<Artifact> {
    const ext = mimeToExt(meta.contentType);
    const initialKey = hasExtension(key) ? key : key + ext;
    const buf = typeof data === "string" ? Buffer.from(data, "utf-8") : data;
    const newSha = sha256Of(buf);

    // ── 检查冲突 ──
    const finalKey = await this.resolveConflict(initialKey, buf, newSha);
    if (finalKey.skip) {
      const prev = this.writtenKeys.get(initialKey)!;
      const a: Artifact = {
        path: relative(this.outputDir, prev.absPath),
        role: meta.role,
        contentType: meta.contentType,
        sourceUrl: meta.sourceUrl,
        sizeBytes: buf.length,
        reused: true,
        contentSha256: prev.sha256,
      };
      currentRuntime().events.emit({
        kind: "artifact.write",
        role: meta.role,
        path: a.path,
        contentType: meta.contentType,
        bytes: buf.length,
        sourceUrl: meta.sourceUrl,
        reused: true,
      });
      return a;
    }
    if (finalKey.dedupe) {
      const prev = this.writtenKeys.get(initialKey)!;
      const a: Artifact = {
        path: relative(this.outputDir, prev.absPath),
        role: meta.role,
        contentType: meta.contentType,
        sourceUrl: meta.sourceUrl,
        sizeBytes: buf.length,
        reused: true,
        contentSha256: prev.sha256,
      };
      currentRuntime().events.emit({
        kind: "artifact.write",
        role: meta.role,
        path: a.path,
        contentType: meta.contentType,
        bytes: buf.length,
        sourceUrl: meta.sourceUrl,
        reused: true,
      });
      return a;
    }

    const absPath = join(this.outputDir, finalKey.key);
    await mkdir(dirname(absPath), { recursive: true });
    await writeFile(absPath, buf);

    this.writtenKeys.set(finalKey.key, { absPath, sha256: newSha });

    const artifact: Artifact = {
      path: relative(this.outputDir, absPath),
      role: meta.role,
      contentType: meta.contentType,
      sourceUrl: meta.sourceUrl,
      sizeBytes: buf.length,
      contentSha256: newSha,
    };
    currentRuntime().events.emit({
      kind: "artifact.write",
      role: meta.role,
      path: artifact.path,
      contentType: meta.contentType,
      bytes: buf.length,
      sourceUrl: meta.sourceUrl,
    });
    return artifact;
  }

  // ── 冲突仲裁 ──

  private async resolveConflict(
    key: string,
    buf: Buffer,
    sha: string,
  ): Promise<{ key: string; skip?: boolean; dedupe?: boolean }> {
    const exists = await this.keyExists(key);
    if (!exists) return { key };

    switch (this.conflictPolicy) {
      case "overwrite":
        return { key };
      case "skip":
        return { key, skip: true };
      case "error": {
        throw new SpiderError({
          kind: "pipeline-error",
          message: `[storage] artifact key conflict: "${key}" already exists (policy=error)`,
          scope: "FileArtifactSink",
          phase: "persist",
          details: { key, policy: "error" },
        });
      }
      case "dedupe": {
        const existing = this.writtenKeys.get(key);
        const prevSha =
          existing?.sha256 ??
          (await this.sha256OfFile(join(this.outputDir, key)));
        if (prevSha === sha) {
          if (!existing) {
            this.writtenKeys.set(key, {
              absPath: join(this.outputDir, key),
              sha256: prevSha,
            });
          }
          return { key, dedupe: true };
        }
        return { key: this.uniqueKey(key) };
      }
      case "rename":
      default:
        return { key: this.uniqueKey(key) };
    }
  }

  private async keyExists(key: string): Promise<boolean> {
    if (this.writtenKeys.has(key)) return true;
    try {
      await stat(join(this.outputDir, key));
      return true;
    } catch {
      return false;
    }
  }

  private uniqueKey(key: string): string {
    const dir = dirname(key);
    const ext = extname(key);
    const base = basename(key, ext);
    let i = 1;
    while (true) {
      const candidate = join(dir, `${base}_${i}${ext}`).replace(/\\/g, "/");
      if (!this.writtenKeys.has(candidate)) {
        // 同步检查文件系统也有可能（多 sink 同目录）
        try {
          // 用 statSync 避免在循环内 await — 这里数量有限
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require("fs").statSync(join(this.outputDir, candidate));
        } catch {
          return candidate;
        }
      }
      i++;
      if (i > 9999) {
        throw new SpiderError({
          kind: "pipeline-error",
          message: `[storage] cannot allocate unique key for "${key}" after 9999 attempts`,
          scope: "FileArtifactSink",
          phase: "persist",
        });
      }
    }
  }

  private async sha256OfFile(absPath: string): Promise<string> {
    try {
      const buf = await readFile(absPath);
      return sha256Of(buf);
    } catch {
      return "";
    }
  }
}

function sha256Of(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}
