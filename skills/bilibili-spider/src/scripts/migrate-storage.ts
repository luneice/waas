// ============================================================================
// 历史存储 → 内容可观测层 迁移（best-effort）
// ============================================================================
//
// 把旧版 <root>/bilibili 下「按内容形态铺平」的目录（articles/ comments/ videos/…）
// 迁入新的三层结构：objects/（内容湖）+ manifest.jsonl（清单）+ views/（语义视图）。
//
//   - 字节按内容寻址入湖（天然去重），旧文件**复制**进湖（不破坏原数据）
//   - 依据旧 meta.json 重建 by-creator / by-subject 视图 + 语义文件名
//   - 处理完的旧目录整体移动到 <root>/_legacy/（可回滚、可人工核对）
//   - 视频旧目录通常无 meta.json：尽力按目录名猜 bvid，入湖 + 建视图，标注 warning
//
// 用法：
//   tsx src/scripts/migrate-storage.ts [root] [--dry-run]
//   默认 root = <cwd>/.spider/bilibili
// ============================================================================

import { mkdir, readdir, readFile, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { ContentStore, type ContentAsset, type ContentRecord } from "@spider/core";
import {
  articleViewDir,
  commentTypeName,
  commentsViewDir,
  imageAssetName,
  videoAssetName,
  videoViewDir,
} from "@src/services/files";

interface Args {
  root: string;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  const positional = argv.filter((a) => !a.startsWith("--"));
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const root = positional[0]
    ? resolve(positional[0])
    : resolve(process.cwd(), ".spider/bilibili");
  return { root, dryRun: flags.has("--dry-run") };
}

const MEDIA_EXT = new Set([".mp4", ".m4s", ".flv", ".mkv"]);
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"]);
const RESERVED = new Set(["objects", "views", "_legacy"]);

interface Stats {
  records: number;
  objects: number;
  reused: number;
  skipped: number;
  warnings: string[];
}

async function readJson(path: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await readFile(path, "utf-8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** 把旧文件复制进内容湖（不删源，迁移保守）。 */
async function ingestCopy(
  store: ContentStore,
  srcAbs: string,
): Promise<{ ref: Awaited<ReturnType<ContentStore["ingestBuffer"]>>; }> {
  const data = await readFile(srcAbs);
  const ref = await store.ingestBuffer(data, extname(srcAbs));
  return { ref };
}

function get<T = unknown>(obj: Record<string, unknown> | null, path: string): T | undefined {
  if (!obj) return undefined;
  let cur: unknown = obj;
  for (const seg of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur as T;
}

async function listDir(dir: string): Promise<{ files: string[]; dirs: string[] }> {
  const entries = await readdir(dir, { withFileTypes: true });
  return {
    files: entries.filter((e) => e.isFile()).map((e) => e.name),
    dirs: entries.filter((e) => e.isDirectory()).map((e) => e.name),
  };
}

/** 收集一个目录（递归）中的图片文件，按文件名排序保证稳定顺序。 */
async function collectImages(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const walk = async (d: string): Promise<void> => {
    const { files, dirs } = await listDir(d);
    for (const f of files.sort()) {
      if (IMAGE_EXT.has(extname(f).toLowerCase())) out.push(join(d, f));
    }
    for (const sub of dirs.sort()) await walk(join(d, sub));
  };
  await walk(dir);
  return out;
}

// ── 文章迁移 ──────────────────────────────────────────────────────────────

async function migrateArticle(
  store: ContentStore,
  dir: string,
  meta: Record<string, unknown>,
  stats: Stats,
): Promise<void> {
  const opusId = (get<string>(meta, "opusId") ?? get<string>(meta, "details.opusId")) || null;
  const cvId = (get<string>(meta, "cvId") ?? get<string>(meta, "details.cvId")) || null;
  const mid = get<string | number>(meta, "author.mid") ?? get<string | number>(meta, "details.author.mid") ?? null;
  const title = get<string>(meta, "title") ?? null;
  const view = articleViewDir({ mid, opusId, cvId });

  const assets: ContentAsset[] = [];
  const images = await collectImages(join(dir, "images"));
  let idx = 0;
  for (const imgAbs of images) {
    const { ref } = await ingestCopy(store, imgAbs);
    stats.objects += ref.reused ? 0 : 1;
    stats.reused += ref.reused ? 1 : 0;
    idx += 1;
    const name = imageAssetName(idx, ref.ext);
    await store.link(`${view}/assets/${name}`, ref);
    assets.push({ name, role: "image", sha256: ref.sha256, object: ref.objectPath, sizeBytes: ref.sizeBytes });
  }

  // 复制 markdown / meta 为视图真文件
  const mdSrc = join(dir, "article.md");
  if (existsSync(mdSrc)) await store.writeView(`${view}/article.md`, await readFile(mdSrc));

  const record: ContentRecord = {
    kind: "article",
    platform: "bilibili",
    id: opusId ?? cvId ?? basename(dir),
    creator: mid != null ? { id: String(mid), name: get<string>(meta, "author.name") ?? null } : undefined,
    title,
    url: opusId ? `https://www.bilibili.com/opus/${opusId}` : cvId ? `https://www.bilibili.com/read/cv${cvId}` : null,
    publishedAt: null,
    collectedAt: new Date().toISOString(),
    view,
    assets,
  };
  await store.writeView(`${view}/meta.json`, JSON.stringify({ ...record, details: meta, migratedFrom: basename(dir) }, null, 2));
  await store.appendManifest(record);
  stats.records += 1;
}

// ── 评论迁移 ──────────────────────────────────────────────────────────────

async function migrateComments(
  store: ContentStore,
  dir: string,
  meta: Record<string, unknown>,
  stats: Stats,
): Promise<void> {
  const oid = String(get<string | number>(meta, "source.oid") ?? get<string | number>(meta, "details.source.oid") ?? "");
  const type = Number(get<number>(meta, "source.type") ?? get<number>(meta, "details.source.type") ?? 0);
  if (!oid || !type) {
    stats.warnings.push(`评论目录缺少 oid/type，跳过：${dir}`);
    stats.skipped += 1;
    return;
  }
  const view = commentsViewDir({ type, oid });

  const assets: ContentAsset[] = [];
  const images = await collectImages(join(dir, "images"));
  let idx = 0;
  for (const imgAbs of images) {
    const { ref } = await ingestCopy(store, imgAbs);
    stats.objects += ref.reused ? 0 : 1;
    stats.reused += ref.reused ? 1 : 0;
    idx += 1;
    const name = imageAssetName(idx, ref.ext);
    await store.link(`${view}/assets/${name}`, ref);
    assets.push({ name, role: "image", sha256: ref.sha256, object: ref.objectPath, sizeBytes: ref.sizeBytes });
  }

  const mdSrc = join(dir, "comments.md");
  if (existsSync(mdSrc)) await store.writeView(`${view}/comments.md`, await readFile(mdSrc));

  const record: ContentRecord = {
    kind: "comments",
    platform: "bilibili",
    id: `${type}-${oid}`,
    title: `评论区 ${commentTypeName(type)}-${oid}`,
    url: null,
    publishedAt: null,
    collectedAt: new Date().toISOString(),
    view,
    assets,
  };
  await store.writeView(`${view}/meta.json`, JSON.stringify({ ...record, details: meta, migratedFrom: basename(dir) }, null, 2));
  await store.appendManifest(record);
  stats.records += 1;
}

// ── 视频迁移（无 meta.json，尽力而为）──────────────────────────────────────

async function migrateVideo(store: ContentStore, dir: string, stats: Stats): Promise<void> {
  const { files } = await listDir(dir);
  const media = files.filter((f) => MEDIA_EXT.has(extname(f).toLowerCase()));
  if (media.length === 0) return;

  // 目录名约定：<bvid>-<title> 或 <bvid>
  const name = basename(dir);
  const bvMatch = name.match(/(BV[0-9A-Za-z]{8,})/);
  const bvid = bvMatch ? bvMatch[1] : name;
  const title = bvMatch ? name.slice(name.indexOf(bvMatch[1]) + bvMatch[1].length).replace(/^[-_]/, "") || null : null;
  const view = videoViewDir({ mid: null, bvid });

  const assets: ContentAsset[] = [];
  let page = 0;
  for (const f of media.sort()) {
    const { ref } = await ingestCopy(store, join(dir, f));
    stats.objects += ref.reused ? 0 : 1;
    stats.reused += ref.reused ? 1 : 0;
    page += 1;
    const ext = extname(f).toLowerCase();
    const role: "merged" | "video" | "audio" = ext === ".mp4" ? "merged" : f.includes("audio") ? "audio" : "video";
    const assetName = videoAssetName({ page, part: "正片", role });
    await store.link(`${view}/${assetName}`, ref);
    assets.push({ name: assetName, role, sha256: ref.sha256, object: ref.objectPath, sizeBytes: ref.sizeBytes });
  }

  const record: ContentRecord = {
    kind: "video",
    platform: "bilibili",
    id: bvid,
    title,
    url: `https://www.bilibili.com/video/${bvid}`,
    publishedAt: null,
    collectedAt: new Date().toISOString(),
    view,
    assets,
  };
  await store.writeView(`${view}/meta.json`, JSON.stringify({ ...record, migratedFrom: name, note: "旧视频目录无 meta.json，字段为目录名推断" }, null, 2));
  await store.appendManifest(record);
  stats.records += 1;
  stats.warnings.push(`视频按目录名推断迁移（建议重新下载以获得完整 meta）：${name} → ${bvid}`);
}

// ── 主流程 ─────────────────────────────────────────────────────────────────

/** 递归找到所有 meta.json（排除 objects/views/_legacy），返回其所在目录。 */
async function findLegacyMetaDirs(root: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    const { files, dirs } = await listDir(dir);
    if (files.includes("meta.json")) {
      out.push(dir);
      return; // 不再深入：该目录即一个内容单元
    }
    for (const sub of dirs) {
      if (dir === root && RESERVED.has(sub)) continue;
      await walk(join(dir, sub));
    }
  };
  await walk(root);
  return out;
}

/** 找到疑似视频目录（含媒体文件、无 meta.json）。 */
async function findLegacyVideoDirs(root: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    const { files, dirs } = await listDir(dir);
    if (files.includes("meta.json")) return;
    if (files.some((f) => MEDIA_EXT.has(extname(f).toLowerCase()))) {
      out.push(dir);
      return;
    }
    for (const sub of dirs) {
      if (dir === root && RESERVED.has(sub)) continue;
      await walk(join(dir, sub));
    }
  };
  await walk(root);
  return out;
}

/** 把旧目录移动到 _legacy/，保留相对结构。 */
async function moveToLegacy(root: string, dir: string, dryRun: boolean): Promise<void> {
  const rel = dir.slice(root.length + 1);
  const dest = join(root, "_legacy", rel);
  if (dryRun) {
    console.log(`  [dry-run] mv ${rel} → _legacy/${rel}`);
    return;
  }
  await mkdir(join(dest, ".."), { recursive: true });
  await rename(dir, dest);
}

async function main(): Promise<void> {
  const { root, dryRun } = parseArgs(process.argv.slice(2));
  if (!existsSync(root)) {
    console.error(`存储根不存在：${root}`);
    process.exit(1);
  }
  const store = new ContentStore(root);
  const stats: Stats = { records: 0, objects: 0, reused: 0, skipped: 0, warnings: [] };

  console.log(`迁移存储：${root}${dryRun ? "  (dry-run)" : ""}`);

  const metaDirs = await findLegacyMetaDirs(root);
  for (const dir of metaDirs) {
    const meta = await readJson(join(dir, "meta.json"));
    if (!meta) {
      stats.warnings.push(`meta.json 解析失败，跳过：${dir}`);
      stats.skipped += 1;
      continue;
    }
    // 已是新版记录（带 view 字段且 assets 指向 objects）则跳过
    if (typeof meta.view === "string" && Array.isArray(meta.assets) && get(meta, "details") !== undefined) {
      stats.skipped += 1;
      continue;
    }
    const skill = String(meta.skill ?? "");
    const isComments = skill.includes("comment") || get(meta, "source.oid") !== undefined || get(meta, "source.type") !== undefined;
    try {
      if (dryRun) {
        console.log(`  [dry-run] ${isComments ? "comments" : "article"}: ${dir.slice(root.length + 1)}`);
      } else if (isComments) {
        await migrateComments(store, dir, meta, stats);
      } else {
        await migrateArticle(store, dir, meta, stats);
      }
      await moveToLegacy(root, dir, dryRun);
    } catch (err) {
      stats.warnings.push(`迁移失败 ${dir}: ${err instanceof Error ? err.message : String(err)}`);
      stats.skipped += 1;
    }
  }

  const videoDirs = await findLegacyVideoDirs(root);
  for (const dir of videoDirs) {
    try {
      if (dryRun) {
        console.log(`  [dry-run] video: ${dir.slice(root.length + 1)}`);
      } else {
        await migrateVideo(store, dir, stats);
      }
      await moveToLegacy(root, dir, dryRun);
    } catch (err) {
      stats.warnings.push(`视频迁移失败 ${dir}: ${err instanceof Error ? err.message : String(err)}`);
      stats.skipped += 1;
    }
  }

  console.log("\n迁移完成：");
  console.log(`  记录: ${stats.records}  入湖对象: ${stats.objects}  去重命中: ${stats.reused}  跳过: ${stats.skipped}`);
  if (stats.warnings.length > 0) {
    console.log(`  警告 (${stats.warnings.length}):`);
    for (const w of stats.warnings) console.log(`    - ${w}`);
  }
  if (dryRun) console.log("\n（dry-run：未写入任何文件，去掉 --dry-run 实际执行）");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
