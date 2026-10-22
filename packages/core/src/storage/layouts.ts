// ============================================================================
// 内置目录布局策略 — 通用组织范式，不含任何数据源专有知识
// ============================================================================
//
// 「源 A 用方式 A、源 B 用方式 B」通过给不同 skill 的 registry 注入不同
// LayoutStrategy 实现。prefix（源 id）由拥有该源的 skill 用常量传入——
// core 只认识 `sourceId: string` 这个槽，不认识任何具体值。
// ============================================================================

import type { LayoutStrategy, LayoutRequest } from "./interfaces";

/**
 * 清洗为文件系统安全的 slug 片段：
 * 去除路径分隔符与控制字符，压缩空白，限长。
 */
export function sanitizeSlug(input: string, maxLen = 120): string {
  const cleaned = (input || "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f]/g, "")
    .replace(/[/\\:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  const safe = cleaned.length > 0 ? cleaned : "document";
  return safe.length > maxLen ? safe.slice(0, maxLen) : safe;
}

/**
 * 从 provenance 取用于日期分层的时刻：优先 publishedAt，回退 collectedAt。
 * 返回 { yyyy, mm, dd }；无有效日期时返回 null。
 */
function datePartsOf(req: LayoutRequest): {
  yyyy: string;
  mm: string;
  dd: string;
} | null {
  const raw = req.provenance?.publishedAt ?? req.provenance?.collectedAt;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return {
    yyyy: String(d.getUTCFullYear()).padStart(4, "0"),
    mm: String(d.getUTCMonth() + 1).padStart(2, "0"),
    dd: String(d.getUTCDate()).padStart(2, "0"),
  };
}

function joinKey(parts: string[]): string {
  return parts.filter((p) => p.length > 0).join("/");
}

/**
 * 扁平布局：`<prefix>/<slug>`（等价现有行为）。
 * 简单场景，或不需要按时间/主体归档的源。
 */
export class FlatLayout implements LayoutStrategy {
  constructor(private readonly prefix: string) {}

  resolve(req: LayoutRequest): string {
    return joinKey([this.prefix, sanitizeSlug(req.slug)]);
  }
}

/**
 * 日期布局：`<prefix>/<yyyy>/<mm>/<dd>/<slug>`。
 * 日期取 publishedAt（回退 collectedAt）；无有效日期时降级为扁平。
 */
export class DateLayout implements LayoutStrategy {
  constructor(private readonly prefix: string) {}

  resolve(req: LayoutRequest): string {
    const slug = sanitizeSlug(req.slug);
    const parts = datePartsOf(req);
    if (!parts) return joinKey([this.prefix, slug]);
    return joinKey([this.prefix, parts.yyyy, parts.mm, parts.dd, slug]);
  }
}
