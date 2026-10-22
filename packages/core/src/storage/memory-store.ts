import type {
  IArtifactSink,
  Artifact,
  ArtifactMeta,
  ArtifactConflictPolicy,
} from "./interfaces";
import { SpiderError } from "../errors";

/**
 * MemoryArtifactSink — 进程内 Map 存储，主要用于测试。
 *
 * 与 FileArtifactSink 行为一致地处理 conflictPolicy。
 */
export class MemoryArtifactSink implements IArtifactSink {
  readonly entries = new Map<
    string,
    { data: Buffer; meta: ArtifactMeta; artifact: Artifact }
  >();
  private readonly conflictPolicy: ArtifactConflictPolicy;

  constructor(conflictPolicy: ArtifactConflictPolicy = "rename") {
    this.conflictPolicy = conflictPolicy;
  }

  async write(
    key: string,
    data: Buffer | string,
    meta: ArtifactMeta,
  ): Promise<Artifact> {
    const buf = typeof data === "string" ? Buffer.from(data, "utf-8") : data;
    let finalKey = key;
    let reused = false;

    if (this.entries.has(key)) {
      switch (this.conflictPolicy) {
        case "overwrite":
          break;
        case "skip": {
          const prev = this.entries.get(key)!;
          return { ...prev.artifact, reused: true };
        }
        case "error":
          throw new SpiderError({
            kind: "pipeline-error",
            message: `[memory-sink] artifact key conflict: ${key}`,
            scope: "MemoryArtifactSink",
            phase: "persist",
          });
        case "dedupe": {
          const prev = this.entries.get(key)!;
          if (prev.data.equals(buf)) {
            reused = true;
            break;
          }
          finalKey = this.unique(key);
          break;
        }
        case "rename":
        default:
          finalKey = this.unique(key);
          break;
      }
    }

    const artifact: Artifact = {
      path: finalKey,
      role: meta.role,
      contentType: meta.contentType,
      sourceUrl: meta.sourceUrl,
      sizeBytes: buf.length,
      reused: reused || undefined,
    };
    if (!reused) this.entries.set(finalKey, { data: buf, meta, artifact });
    return artifact;
  }

  private unique(key: string): string {
    let i = 1;
    while (this.entries.has(`${key}.${i}`)) i++;
    return `${key}.${i}`;
  }
}
