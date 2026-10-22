// ============================================================================
// ContentStore — 内容可观测层（Content Observability）
// ============================================================================
//
// 进程可观测（traces/ + bodies/）回答「怎么发生的」，给开发/运维/排错 AI 用。
// 内容可观测（本模块）回答「得到了什么」，给复盘的人 / 分析的 AI 用。
// 两者同源（共享 traceId），物理分层：
//
//   <root>/
//   ├── objects/<aa>/<sha256><ext>   不可变内容湖（content-addressed，天然去重 + 校验 + 幂等重下）
//   ├── manifest.jsonl               追加式内容清单（每行一条 ContentRecord，jq/rq 友好的全局索引）
//   └── views/                       从清单派生、可重建、零拷贝（symlink）的人/AI 视图
//
// 关键不变量：
//   - objects 只认字节，不认标题/作者/分类 —— 唯一真相
//   - views 里的语义文件名（P01 - 正片 - 1080p - avc.mp4）只是指向 object 的 symlink
//   - 任何视图都能从 manifest 重新生成，重组目录 = 重生成视图，永不搬字节、永不产生孤儿目录
//
// 视图分两类：
//   - 稳定脊柱（by-creator/<id>、by-subject/...）：目录主键用机器 ID，幂等，承载
//     manifest.view 字段，路径绝不随标题漂移 —— 由采集侧（skill）写入。
//   - 人读派生（by-name/<创作者>/<kind>/<标题 [id]>）：纯派生、可丢弃，由本模块在
//     appendManifest 时自动从 ContentRecord 生成，亦可由 `content rebuild-views`
//     整树重建。标题易变不要紧：重建 = 先删 by-name 再生成，天然无孤儿。
//
// ============================================================================

import { createHash } from "crypto";
import { createReadStream } from "fs";
import {
  mkdir,
  rename,
  stat,
  symlink,
  unlink,
  copyFile,
  writeFile,
  appendFile,
} from "fs/promises";
import { join, resolve, relative, dirname, extname } from "path";
import { currentTraceFrame } from "../observability/trace-context";

// ── 内容湖对象引用 ──────────────────────────────────────────────────────────

export interface ObjectRef {
  /** 内容 SHA256（hex） */
  sha256: string;
  /** 扩展名（含点，如 ".mp4"；可能为空串） */
  ext: string;
  /** 相对 root 的对象路径，如 "objects/ab/abcd...ef.mp4" */
  objectPath: string;
  /** 对象绝对路径 */
  absPath: string;
  /** 字节数 */
  sizeBytes: number;
  /** 是否命中已有对象（去重） */
  reused: boolean;
}

// ── 清单记录 ────────────────────────────────────────────────────────────────

export interface ContentAsset {
  /** 视图中的语义文件名，如 "P01.正片.1080p.avc.mp4" */
  name: string;
  /** 语义角色：video / audio / merged / image / markdown / meta ... */
  role: string;
  /** 内容寻址哈希 */
  sha256: string;
  /** objects/ 下相对路径 */
  object: string;
  /** 字节数 */
  sizeBytes: number;
  /** MIME */
  contentType?: string;
  /** 原始来源 URL */
  sourceUrl?: string;
  /** 领域附加信息（如视频的 height/codec/page） */
  extra?: Record<string, unknown>;
}

export interface ContentRecord {
  /** 内容形态：video / article / comments / ... */
  kind: string;
  /** 平台命名空间（如 bilibili） */
  platform: string;
  /** 内容主键（bvid / opus-xxx / video-aid ...） */
  id: string;
  /** 创作者（已知时） */
  creator?: { id: string; name?: string | null };
  /** 标题 */
  title?: string | null;
  /** 内容页 URL */
  url?: string | null;
  /** 发布时间（ISO） */
  publishedAt?: string | null;
  /** 采集时间（ISO） */
  collectedAt: string;
  /** 血缘：本次采集的 traceId，可 join 进程可观测 traces/ */
  traceId?: string;
  /** 主视图目录（相对 views/） */
  view: string;
  /** 资产清单 */
  assets: ContentAsset[];
}

// ── ContentStore ────────────────────────────────────────────────────────────

export class ContentStore {
  private readonly root: string;
  private readonly objectsDir: string;
  private readonly viewsDir: string;
  private readonly stagingDir: string;
  private readonly manifestPath: string;

  constructor(root: string) {
    this.root = resolve(root);
    this.objectsDir = join(this.root, "objects");
    this.viewsDir = join(this.root, "views");
    this.stagingDir = join(this.root, "objects", "_staging");
    this.manifestPath = join(this.root, "manifest.jsonl");
  }

  /** 内容根（与 sink outputDir 同根）。 */
  get rootDir(): string {
    return this.root;
  }

  /** 为下载器准备一个唯一的临时落盘路径（在内容湖暂存区，ingest 后会被移走）。 */
  async stagingPath(hint: string): Promise<string> {
    await mkdir(this.stagingDir, { recursive: true });
    const safe = hint.replace(/[^\w.-]/g, "_").slice(0, 80);
    return join(this.stagingDir, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`);
  }

  /** 视图相对路径 → 绝对路径。 */
  viewAbs(viewRelPath: string): string {
    return join(this.viewsDir, viewRelPath);
  }

  /** 视图相对路径 → 相对 root 的路径（用于 Artifact.path / 对外展示）。 */
  viewRootRel(viewRelPath: string): string {
    return relative(this.root, this.viewAbs(viewRelPath)).replace(/\\/g, "/");
  }

  // ── 内容湖 ──

  /**
   * 把一个已落盘文件移入内容湖（内容寻址 + 去重）。原文件被移走（命中则删除）。
   * 若已知 sha256（如下载时增量计算）可传入以省去二次读盘。
   */
  async ingestFile(
    srcAbsPath: string,
    opts: { ext?: string; sha256?: string } = {},
  ): Promise<ObjectRef> {
    const sha = opts.sha256 ?? (await sha256OfFile(srcAbsPath));
    const ext = normalizeExt(opts.ext ?? extname(srcAbsPath));
    const { objectPath, absPath } = this.objectLocation(sha, ext);

    const existing = await fileSize(absPath);
    if (existing !== null) {
      // 命中：删除来源，复用已有对象
      await unlink(srcAbsPath).catch(() => undefined);
      return { sha256: sha, ext, objectPath, absPath, sizeBytes: existing, reused: true };
    }

    await mkdir(dirname(absPath), { recursive: true });
    await rename(srcAbsPath, absPath).catch(async (err) => {
      // 跨设备 rename 失败 → 退化为复制 + 删源
      if ((err as NodeJS.ErrnoException).code === "EXDEV") {
        await copyFile(srcAbsPath, absPath);
        await unlink(srcAbsPath).catch(() => undefined);
        return;
      }
      throw err;
    });
    const size = (await fileSize(absPath)) ?? 0;
    return { sha256: sha, ext, objectPath, absPath, sizeBytes: size, reused: false };
  }

  /** 把内存字节写入内容湖（内容寻址 + 去重）。 */
  async ingestBuffer(data: Buffer, ext?: string): Promise<ObjectRef> {
    const sha = createHash("sha256").update(data).digest("hex");
    const normExt = normalizeExt(ext ?? "");
    const { objectPath, absPath } = this.objectLocation(sha, normExt);

    const existing = await fileSize(absPath);
    if (existing !== null) {
      return { sha256: sha, ext: normExt, objectPath, absPath, sizeBytes: existing, reused: true };
    }
    await mkdir(dirname(absPath), { recursive: true });
    await writeFile(absPath, data);
    return { sha256: sha, ext: normExt, objectPath, absPath, sizeBytes: data.length, reused: false };
  }

  // ── 视图（symlink 投影 + 人读真文件）──

  /**
   * 在视图中以语义文件名建立指向 object 的相对 symlink。
   * symlink 不可用（权限/平台）时退化为复制，保证视图始终可读。
   * 返回相对 root 的视图路径。
   */
  async link(viewRelPath: string, ref: ObjectRef): Promise<string> {
    const linkAbs = this.viewAbs(viewRelPath);
    await mkdir(dirname(linkAbs), { recursive: true });
    await unlink(linkAbs).catch(() => undefined);
    const target = relative(dirname(linkAbs), ref.absPath);
    try {
      await symlink(target, linkAbs);
    } catch {
      // 退化：直接复制（牺牲零拷贝，保住可读性）
      await copyFile(ref.absPath, linkAbs);
    }
    return relative(this.root, linkAbs).replace(/\\/g, "/");
  }

  /** 在视图中写入一个真文件（meta.json / markdown 等人读产物）。返回相对 root 路径。 */
  async writeView(viewRelPath: string, data: Buffer | string): Promise<string> {
    const abs = this.viewAbs(viewRelPath);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, data);
    return relative(this.root, abs).replace(/\\/g, "/");
  }

  // ── 清单 ──

  /** 追加一条内容记录到 manifest.jsonl（traceId 默认取当前 trace 帧）。 */
  async appendManifest(entry: ContentRecord): Promise<void> {
    await mkdir(this.root, { recursive: true });
    const withTrace: ContentRecord = {
      ...entry,
      traceId: entry.traceId ?? currentTraceFrame()?.traceId,
    };
    await appendFile(this.manifestPath, JSON.stringify(withTrace) + "\n", "utf-8");
    // 人读派生视图：失败不阻断采集（脊柱视图与 manifest 已落定）。
    try {
      await this.linkReadable(withTrace);
    } catch {
      /* by-name 仅为便利层，可由 rebuild-views 补建 */
    }
  }

  /**
   * 从一条 ContentRecord 在 by-name 视图下建立可读 symlink。
   * 目录形如：by-name/<创作者>/<kind>/<标题 [id]>/<资产名>
   * 资产字节仍在内容湖，这里只建相对 symlink（退化为复制）。
   */
  async linkReadable(record: ContentRecord): Promise<void> {
    const dir = readableViewDir(record);
    for (const asset of record.assets) {
      const objectAbs = join(this.root, asset.object);
      if (!(await fileExists(objectAbs))) continue;
      const linkAbs = this.viewAbs(`${dir}/${asset.name}`);
      await mkdir(dirname(linkAbs), { recursive: true });
      await unlink(linkAbs).catch(() => undefined);
      const target = relative(dirname(linkAbs), objectAbs);
      try {
        await symlink(target, linkAbs);
      } catch {
        await copyFile(objectAbs, linkAbs);
      }
    }
  }

  // ── 内部 ──

  private objectLocation(sha: string, ext: string): { objectPath: string; absPath: string } {
    const shard = sha.slice(0, 2);
    const objectPath = `objects/${shard}/${sha}${ext}`;
    return { objectPath, absPath: join(this.root, objectPath) };
  }
}

// ── 工具 ──

/**
 * 从 ContentRecord 计算人读派生视图目录（相对 views/）。
 * 形如：by-name/<创作者>/<kind 复数>/<标题 [id]>
 *   - 创作者：creator.name 优先；缺名退回 creator.id；皆缺则省略该层
 *   - 标题：safe(title) + " [id]" 稳定锚（标题易变 / 可重名，id 后缀保证唯一 + 可重建定位）
 *   - 标题缺失：退回纯 id
 */
export function readableViewDir(record: ContentRecord): string {
  const segs: string[] = ["by-name"];
  const creatorRaw = record.creator?.name?.trim() || record.creator?.id?.trim();
  if (creatorRaw && creatorRaw !== "_unknown") {
    segs.push(sanitizeSeg(creatorRaw, "_unknown"));
  }
  segs.push(kindFolder(record.kind));
  const title = record.title?.trim();
  const content = title
    ? `${sanitizeSeg(title, record.id)} [${sanitizeSeg(record.id, "id")}]`
    : sanitizeSeg(record.id, "content");
  segs.push(content);
  return segs.join("/");
}

const KIND_FOLDER: Record<string, string> = {
  video: "videos",
  article: "articles",
  comments: "comments",
  audio: "audios",
  image: "images",
};

function kindFolder(kind: string): string {
  return KIND_FOLDER[kind] ?? sanitizeSeg(kind || "misc", "misc");
}

/** 文件系统安全的单段名：剔除非法字符、压缩空白、限长。 */
function sanitizeSeg(input: string, fallback: string): string {
  const cleaned = input
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "") // 去掉前导点，避免隐藏目录
    .trim()
    .slice(0, 80)
    .trim();
  return cleaned || fallback;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function normalizeExt(ext: string): string {
  if (!ext) return "";
  const e = ext.startsWith(".") ? ext : `.${ext}`;
  return e.toLowerCase();
}

async function fileSize(path: string): Promise<number | null> {
  try {
    return (await stat(path)).size;
  } catch {
    return null;
  }
}

function sha256OfFile(path: string): Promise<string> {
  return new Promise((res, rej) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", rej);
    stream.on("end", () => res(hash.digest("hex")));
  });
}
