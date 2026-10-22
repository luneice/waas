// ============================================================================
// CLI: content subcommand — 内容可观测查询面（与 obs 对偶）
// ============================================================================
//
// obs 回答「怎么发生的」（traces/bodies）；content 回答「得到了什么」（manifest/objects/views）。
// 两者共享 traceId，可互相 join：content lineage <id> → 拿到 traceId → obs trace <traceId>。
//
// 内容数据是「就近项目」存储：<storageRoot>/<platform>/{objects,manifest.jsonl,views}
// ============================================================================

import { existsSync, readdirSync, statSync, createReadStream } from "fs";
import { mkdir, symlink, unlink, writeFile, rm } from "fs/promises";
import { join, dirname, relative } from "path";
import { createInterface } from "readline";
import type { ContentRecord } from "../storage/content-store";
import { readableViewDir } from "../storage/content-store";

function out(obj: unknown): void {
  process.stdout.write(JSON.stringify(obj, null, 2) + "\n");
}

/** 扫描 storageRoot 下所有平台的 manifest.jsonl。 */
function listManifests(storageRoot: string, platform?: string): { platform: string; path: string }[] {
  if (!existsSync(storageRoot)) return [];
  const out: { platform: string; path: string }[] = [];
  for (const name of readdirSync(storageRoot)) {
    if (platform && name !== platform) continue;
    const dir = join(storageRoot, name);
    try {
      if (!statSync(dir).isDirectory()) continue;
    } catch {
      continue;
    }
    const manifest = join(dir, "manifest.jsonl");
    if (existsSync(manifest)) out.push({ platform: name, path: manifest });
  }
  return out;
}

async function readRecords(manifestPath: string): Promise<ContentRecord[]> {
  const records: ContentRecord[] = [];
  const rl = createInterface({ input: createReadStream(manifestPath, { encoding: "utf-8" }) });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line) as ContentRecord);
    } catch {
      /* skip malformed */
    }
  }
  return records;
}

/** 同一 id 多次采集只保留最后一条（最新覆盖）。 */
function dedupeLatest(records: ContentRecord[]): ContentRecord[] {
  const byId = new Map<string, ContentRecord>();
  for (const r of records) byId.set(`${r.platform}:${r.kind}:${r.id}`, r);
  return [...byId.values()];
}

async function loadAll(storageRoot: string, platform?: string): Promise<ContentRecord[]> {
  const all: ContentRecord[] = [];
  for (const m of listManifests(storageRoot, platform)) {
    all.push(...(await readRecords(m.path)));
  }
  return all;
}

async function cmdLs(
  storageRoot: string,
  opts: { platform?: string; creator?: string; kind?: string; limit: number },
): Promise<number> {
  let records = dedupeLatest(await loadAll(storageRoot, opts.platform));
  if (opts.creator) records = records.filter((r) => r.creator?.id === opts.creator);
  if (opts.kind) records = records.filter((r) => r.kind === opts.kind);
  records.sort((a, b) => (b.collectedAt ?? "").localeCompare(a.collectedAt ?? ""));
  const rows = records.slice(0, opts.limit).map((r) => ({
    kind: r.kind,
    id: r.id,
    title: r.title,
    creator: r.creator ? `${r.creator.id}${r.creator.name ? ` (${r.creator.name})` : ""}` : null,
    assets: r.assets.length,
    view: r.view,
    readablePath: `views/${readableViewDir(r)}`,
    collectedAt: r.collectedAt,
    traceId: r.traceId,
  }));
  out({ total: records.length, shown: rows.length, items: rows });
  return 0;
}

async function cmdShow(storageRoot: string, id: string): Promise<number> {
  const records = await loadAll(storageRoot);
  const matches = records.filter((r) => r.id === id);
  if (matches.length === 0) {
    process.stderr.write(`content: 未找到 id=${id}\n`);
    return 1;
  }
  out(matches[matches.length - 1]);
  return 0;
}

async function cmdLineage(storageRoot: string, id: string): Promise<number> {
  const records = await loadAll(storageRoot);
  const matches = records.filter((r) => r.id === id);
  if (matches.length === 0) {
    process.stderr.write(`content: 未找到 id=${id}\n`);
    return 1;
  }
  const rec = matches[matches.length - 1];
  out({
    id: rec.id,
    kind: rec.kind,
    title: rec.title,
    collectedAt: rec.collectedAt,
    traceId: rec.traceId,
    hint: rec.traceId
      ? `查看这次采集的完整调用链：obs trace ${rec.traceId} --full`
      : "该记录无 traceId（可能为迁移产生或在 trace 外采集）",
    assets: rec.assets.map((a) => ({ name: a.name, role: a.role, sha256: a.sha256, object: a.object })),
  });
  return 0;
}

/** 反查某条内容的人读视图目录（by-name 派生路径，便于直接打开）。 */
async function cmdOpen(storageRoot: string, id: string): Promise<number> {
  const records = await loadAll(storageRoot);
  const matches = records.filter((r) => r.id === id);
  if (matches.length === 0) {
    process.stderr.write(`content: 未找到 id=${id}\n`);
    return 1;
  }
  const rec = matches[matches.length - 1];
  const manifest = listManifests(storageRoot, rec.platform)[0];
  const platformRoot = manifest ? dirname(manifest.path) : join(storageRoot, rec.platform);
  const readableRel = `views/${readableViewDir(rec)}`;
  out({
    id: rec.id,
    title: rec.title,
    spinePath: join(platformRoot, "views", rec.view),
    readablePath: join(platformRoot, readableRel),
    assets: rec.assets.map((a) => a.name),
    hint: "readablePath 为人读视图（by-name）；若不存在请先运行 content rebuild-views",
  });
  return 0;
}

/** 从 manifest 重建派生视图：by-date（时间）+ by-name（人读）。先清空再生成，证明「视图可重建、无孤儿」。 */
async function cmdRebuildViews(storageRoot: string, platform?: string): Promise<number> {
  let rebuilt = 0;
  for (const m of listManifests(storageRoot, platform)) {
    const root = dirname(m.path);
    const records = dedupeLatest(await readRecords(m.path));
    // 整树清空派生视图：by-name 纯派生、by-date 可重建，删后重生成天然无孤儿。
    await rm(join(root, "views", "by-name"), { recursive: true, force: true });
    await rm(join(root, "views", "by-date"), { recursive: true, force: true });
    for (const rec of records) {
      const dateDir = rec.publishedAt ? rec.publishedAt.slice(0, 7).replace("-", "/") : null;
      const nameDir = readableViewDir(rec);
      for (const a of rec.assets) {
        const objectAbs = join(root, a.object);
        if (!existsSync(objectAbs)) continue;
        // by-date 视图：views/by-date/YYYY/MM/<id>/<asset>
        if (dateDir) {
          rebuilt += (await linkOrTouch(
            join(root, "views", "by-date", dateDir, rec.id, a.name),
            objectAbs,
          ))
            ? 1
            : 0;
        }
        // by-name 视图：views/by-name/<创作者>/<kind>/<标题 [id]>/<asset>
        rebuilt += (await linkOrTouch(
          join(root, "views", nameDir, a.name),
          objectAbs,
        ))
          ? 1
          : 0;
      }
    }
  }
  out({ rebuilt, hint: "已从 manifest 重建 by-date + by-name 派生视图（脊柱 by-creator/by-subject 由采集时写入）" });
  return 0;
}

/** 在 linkAbs 建立指向 objectAbs 的相对 symlink；失败退化为占位写入。返回是否成功建立链接。 */
async function linkOrTouch(linkAbs: string, objectAbs: string): Promise<boolean> {
  await mkdir(dirname(linkAbs), { recursive: true });
  await unlink(linkAbs).catch(() => undefined);
  const target = relative(dirname(linkAbs), objectAbs);
  try {
    await symlink(target, linkAbs);
    return true;
  } catch {
    await writeFile(linkAbs, "").catch(() => undefined);
    return false;
  }
}

export async function runContentCLI(argv: string[], storageRoot: string): Promise<number> {
  const sub = argv[0];
  const rest = argv.slice(1);
  const flag = (name: string): string | undefined => {
    const i = rest.indexOf(name);
    return i >= 0 ? rest[i + 1] : undefined;
  };

  if (!sub || sub === "--help" || sub === "help") {
    out({
      usage: "content <ls|show|lineage|open|rebuild-views>",
      storageRoot,
      commands: {
        ls: "content ls [--platform p] [--creator id] [--kind video|article|comments] [--limit N]",
        show: "content show <id>            # 打印某条内容的完整清单记录",
        lineage: "content lineage <id>     # 反查采集血缘（→ obs trace <traceId>）",
        open: "content open <id>           # 给出人读视图（by-name）与脊柱目录绝对路径",
        "rebuild-views": "content rebuild-views [--platform p]  # 从 manifest 重建 by-date + by-name 派生视图",
      },
    });
    return 0;
  }

  switch (sub) {
    case "ls":
      return cmdLs(storageRoot, {
        platform: flag("--platform"),
        creator: flag("--creator"),
        kind: flag("--kind"),
        limit: Number(flag("--limit") ?? 30),
      });
    case "show":
      if (!rest[0] || rest[0].startsWith("--")) {
        process.stderr.write("Usage: content show <id>\n");
        return 1;
      }
      return cmdShow(storageRoot, rest[0]);
    case "lineage":
      if (!rest[0] || rest[0].startsWith("--")) {
        process.stderr.write("Usage: content lineage <id>\n");
        return 1;
      }
      return cmdLineage(storageRoot, rest[0]);
    case "open":
      if (!rest[0] || rest[0].startsWith("--")) {
        process.stderr.write("Usage: content open <id>\n");
        return 1;
      }
      return cmdOpen(storageRoot, rest[0]);
    case "rebuild-views":
      return cmdRebuildViews(storageRoot, flag("--platform"));
    default:
      process.stderr.write(`Unknown content subcommand: ${sub}\n`);
      return 1;
  }
}
