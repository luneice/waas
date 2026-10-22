import type { Page } from "puppeteer-core";
import type { IPageHook, HookOutcome } from "./hooks";
import type { PageContext } from "./context";
import type { CapturedEntry } from "./captured-entry";
import type { IArtifactSink, Artifact } from "../storage/interfaces";
import type { SlotKey } from "./slots";
import {
  ArtifactsSlot,
  ArtifactPrefixSlot,
  ArtifactLegendsSlot,
  CapturedMediaSlot,
} from "./slots";

// ============================================================================
// 兼容导出 — 常量形式的 Slot（方便消费者迁移）
// ============================================================================

/** @deprecated 使用 ArtifactsSlot */
export const ARTIFACTS_KEY = ArtifactsSlot.name;
/** @deprecated 使用 ArtifactPrefixSlot */
export const ARTIFACT_PREFIX_KEY = ArtifactPrefixSlot.name;
/** @deprecated 使用 ArtifactLegendsSlot */
export const ARTIFACT_LEGENDS_KEY = ArtifactLegendsSlot.name;

// ============================================================================
// ArtifactPersistHook — persist 阶段将 Buffer 捕获持久化到 IArtifactSink
// ============================================================================

export interface ArtifactPersistOptions {
  /**
   * 读取哪些 Slot 作为媒体来源（Map<url, CapturedEntry<Buffer>>）。
   * 未提供时默认 [CapturedMediaSlot]。
   */
  sources?: SlotKey<Map<string, CapturedEntry<Buffer>>>[];
  /** Artifact 默认 role 字段 */
  defaultRole?: string;
}

/**
 * 从显式声明的 sources Slot 中读取 Map<url, CapturedEntry<Buffer>>，
 * 按 MIME 分类写入 IArtifactSink，并将产物清单写回 ArtifactsSlot。
 *
 * 可配置行为（通过 Slot）：
 *   - ArtifactPrefixSlot  → 存储路径前缀（默认 "media"）
 *   - ArtifactLegendsSlot → Map<url, legend> 提供人类可读命名
 *
 * 按 MIME 自动分类到子目录：images/ audio/ video/ other/
 */
export class ArtifactPersistHook implements IPageHook {
  readonly name = "artifact-persist";
  private readonly sources: SlotKey<Map<string, CapturedEntry<Buffer>>>[];
  private readonly defaultRole: string;

  constructor(
    private readonly sink: IArtifactSink,
    options: ArtifactPersistOptions = {},
  ) {
    this.sources = options.sources ?? [CapturedMediaSlot];
    this.defaultRole = options.defaultRole ?? "content-image";
  }

  async persist(_page: Page, ctx: PageContext): Promise<HookOutcome> {
    const artifacts: Artifact[] = [];
    let index = 0;

    const prefix = ctx.get(ArtifactPrefixSlot) ?? "media";
    const legends = ctx.get(ArtifactLegendsSlot);

    for (const sourceSlot of this.sources) {
      const map = ctx.get(sourceSlot);
      if (!map) continue;

      for (const [url, entry] of map) {
        if (!isBufferEntry(entry)) continue;

        const subdir = mimeCategory(entry.mimeType);
        const legend = legends ? findLegend(url, legends) : undefined;
        const filename = deriveFilename(url, index++, legend);
        const relPath = `${subdir}/${filename}`;
        const key = `${prefix}/${relPath}`;

        const artifact = await this.sink.write(key, entry.body, {
          role: this.defaultRole,
          contentType: entry.mimeType,
          sourceUrl: url,
        });
        artifact.relativePath = relPath;
        artifacts.push(artifact);
      }
    }

    if (artifacts.length > 0) {
      ctx.set(ArtifactsSlot, artifacts);
    }
  }
}

// ── 内部辅助 ──

function isBufferEntry(entry: unknown): entry is CapturedEntry<Buffer> {
  if (entry == null || typeof entry !== "object") return false;
  const e = entry as Record<string, unknown>;
  return "body" in e && Buffer.isBuffer(e.body);
}

function mimeCategory(mime: string): string {
  const m = mime.split(";")[0].trim().toLowerCase();
  if (m.startsWith("image/")) return "images";
  if (m.startsWith("audio/")) return "audio";
  if (m.startsWith("video/")) return "video";
  return "other";
}

function findLegend(
  url: string,
  legends: Map<string, string>,
): string | undefined {
  const exact = legends.get(url);
  if (exact) return exact;
  try {
    return legends.get(new URL(url).pathname);
  } catch {
    return undefined;
  }
}

function deriveFilename(url: string, index: number, legend?: string): string {
  const prefix = String(index).padStart(3, "0");

  if (legend) {
    const sanitized = sanitizeFilename(legend);
    if (sanitized) {
      const ext = extFromUrl(url);
      return `${prefix}_${sanitized}${ext}`;
    }
  }

  try {
    const pathname = new URL(url).pathname;
    const basename = pathname.split("/").pop();
    if (basename && /\.\w{2,5}$/.test(basename)) {
      const sanitized = basename.replace(/[^a-zA-Z0-9._\u4e00-\u9fff-]/g, "_");
      return `${prefix}_${sanitized}`;
    }
  } catch {
    /* URL 解析失败 */
  }
  return `media_${prefix}`;
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .trim()
    .slice(0, 60);
}

function extFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.(\w{2,5})$/);
    if (match) return `.${match[1]}`;
  } catch {
    /* ignore */
  }
  return "";
}
