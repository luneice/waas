// ============================================================================
// 内容可观测视图：路径与语义文件名
// ============================================================================
//
// 字节存于内容湖 objects/<sha>；本模块只负责「人/AI 视图」里的**语义化命名**：
//   - 视图目录（相对 ContentStore 的 views/ 根）
//   - 资产文件名（P01 - 正片 - 1080p - avc.mp4 / img-001.jpg）
//
// 设计原则（用户评审通过的 v2）：
//   - 机器脊柱 by-creator/<mid>/{videos,articles}/<id>：目录主键用稳定 ID，幂等
//   - 评论无 mid，按主体归类：by-subject/<typeName>-<oid>
//   - 人读派生视图 by-name/<创作者>/<kind>/<标题 [id]>：由 ContentStore 从 manifest 生成
//   - 文件名用 ' - ' 分层表达关注点：分P - 段名 - 清晰度 - 编码 - 角色，仅末尾保留扩展名点
// ============================================================================

export function safeFileName(input: string, fallback = "bilibili"): string {
  const normalized = input
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return normalized || fallback;
}

/** 视频编码 codecs 串转短名：avc1→avc，hev1/hvc1→hevc，av01→av1。 */
export function codecShortName(codecs?: string | null): string | null {
  if (!codecs) return null;
  const head = codecs.toLowerCase().split(".")[0].trim();
  if (head.startsWith("avc")) return "avc";
  if (head.startsWith("hev") || head.startsWith("hvc")) return "hevc";
  if (head.startsWith("av0")) return "av1";
  return head || null;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function pad3(n: number): string {
  return String(n).padStart(3, "0");
}

/** 创作者分组目录（相对 views/）。mid 缺省回退 _unknown。 */
export function creatorDir(mid?: string | number | null): string {
  const id = mid != null && String(mid).trim() ? String(mid).trim() : "_unknown";
  return `by-creator/${safeFileName(id, "_unknown")}`;
}

/** 视频视图目录：by-creator/<mid>/videos/<bvid>。一个稿件（多 P）共用。 */
export function videoViewDir(input: {
  mid?: string | number | null;
  bvid: string;
}): string {
  return `${creatorDir(input.mid)}/videos/${safeFileName(input.bvid, "video")}`;
}

/** 专栏视图目录：by-creator/<mid>/articles/opus-<id>（回退 cv-<id>）。 */
export function articleViewDir(input: {
  mid?: string | number | null;
  opusId?: string | null;
  cvId?: string | null;
}): string {
  const id = input.opusId
    ? `opus-${input.opusId}`
    : input.cvId
      ? `cv-${input.cvId}`
      : "article";
  return `${creatorDir(input.mid)}/articles/${safeFileName(id, "article")}`;
}

/** 评论主体类型名（type → 可读前缀）。 */
const COMMENT_TYPE_NAME: Record<number, string> = {
  1: "video",
  11: "dynamic-pic",
  12: "article",
  17: "dynamic",
  19: "audio-menu",
};

export function commentTypeName(type: number): string {
  return COMMENT_TYPE_NAME[type] ?? `type${type}`;
}

/** 评论视图目录：by-subject/<typeName>-<oid>（评论无创作者上下文，按主体归类）。 */
export function commentsViewDir(input: { type: number; oid: string | number }): string {
  const name = `${commentTypeName(input.type)}-${input.oid}`;
  return `by-subject/${safeFileName(name, String(input.oid))}`;
}

/**
 * 视频资产语义文件名。段间用 ' - ' 分隔，仅末尾保留扩展名点。形如：
 *   merged → P01 - 正片 - 1080p - avc.mp4
 *   video  → P01 - 正片 - 1080p - avc - video.m4s
 *   audio  → P01 - 正片 - audio.m4s
 */
export function videoAssetName(input: {
  page: number;
  part: string;
  role: "merged" | "video" | "audio";
  height?: number | null;
  codecs?: string | null;
}): string {
  const resLabel = input.height ? `${input.height}p` : null;
  const codec = codecShortName(input.codecs);
  const part = safeFileName(input.part, "");

  if (input.role === "audio") {
    const segs = [`P${pad2(input.page)}`, part || null, "audio"].filter(Boolean);
    return `${segs.join(" - ")}.m4s`;
  }
  const quality = [resLabel, codec].filter(Boolean) as string[];
  if (input.role === "video") {
    const segs = [`P${pad2(input.page)}`, part || null, ...quality, "video"].filter(Boolean);
    return `${segs.join(" - ")}.m4s`;
  }
  // merged
  const segs = [`P${pad2(input.page)}`, part || null, ...quality].filter(Boolean);
  return `${segs.join(" - ")}.mp4`;
}

/**
 * 字幕资产语义文件名。形如：P01 - 正片 - ai-zh.json
 */
export function subtitleAssetName(input: {
  page: number;
  part: string;
  lan: string;
}): string {
  const part = safeFileName(input.part, "");
  const lan = safeFileName(input.lan, "sub");
  const segs = [`P${pad2(input.page)}`, part || null, lan].filter(Boolean);
  return `${segs.join(" - ")}.json`;
}

/** 配图/资产顺序化文件名：img-001.jpg（保留出现顺序，扩展名来自内容湖对象）。 */
export function imageAssetName(index: number, ext: string): string {
  const e = ext.startsWith(".") ? ext : `.${ext}`;
  return `img-${pad3(index)}${e}`;
}

