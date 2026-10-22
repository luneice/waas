// CLI: obs subcommand — JSONL-only trace browser.

import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  createReadStream,
} from "fs";
import { join } from "path";
import { createInterface } from "readline";
import { getObsConfig } from "../observability/config";
import type { ObsEvent } from "../observability";

type AnyRec = Record<string, unknown>;
const asRec = (e: ObsEvent): AnyRec => e as unknown as AnyRec;

function out(obj: unknown): void {
  process.stdout.write(JSON.stringify(obj, null, 2) + "\n");
}

function tracesDir(): string {
  return join(getObsConfig().dir, "traces");
}

function listTraceFiles(): string[] {
  const dir = tracesDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => ({ f, m: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m)
    .map((x) => join(dir, x.f));
}

async function streamEvents(
  visitor: (e: ObsEvent) => boolean | void,
): Promise<void> {
  for (const file of listTraceFiles()) {
    const lines: string[] = [];
    const rl = createInterface({
      input: createReadStream(file, { encoding: "utf-8" }),
    });
    for await (const line of rl) {
      if (line) lines.push(line);
    }
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const ev = JSON.parse(lines[i]) as ObsEvent;
        if (visitor(ev) === false) return;
      } catch {
        /* */
      }
    }
  }
}

async function collectTrace(traceId: string): Promise<ObsEvent[]> {
  const events: ObsEvent[] = [];
  for (const file of listTraceFiles()) {
    const rl = createInterface({
      input: createReadStream(file, { encoding: "utf-8" }),
    });
    for await (const line of rl) {
      if (!line || !line.includes(traceId)) continue;
      try {
        const ev = JSON.parse(line) as ObsEvent;
        if (ev.traceId === traceId) events.push(ev);
      } catch {
        /* */
      }
    }
  }
  events.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
  return events;
}

interface TraceSummary {
  traceId: string;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  status?: string;
  caller?: string;
  rationale?: string;
  argv?: string[];
  skillCount: number;
  httpCount: number;
  errorCount: number;
}

async function cmdRecent(limit: number): Promise<number> {
  const tasks = new Map<string, Partial<TraceSummary>>();
  const counts = new Map<string, { skill: number; http: number; error: number }>();
  await streamEvents((e) => {
    const r = asRec(e);
    const tid = e.traceId;
    if (!tasks.has(tid)) {
      tasks.set(tid, { traceId: tid });
      counts.set(tid, { skill: 0, http: 0, error: 0 });
    }
    const t = tasks.get(tid)!;
    const c = counts.get(tid)!;
    if (e.kind === "task.start") {
      t.startedAt = e.ts;
      t.caller = r.caller as string | undefined;
      t.rationale = r.rationale as string | undefined;
      t.argv = r.argv as string[] | undefined;
    }
    if (e.kind === "task.end") {
      t.endedAt = e.ts;
      t.durationMs = r.durationMs as number | undefined;
      t.status = r.status as string | undefined;
    }
    if (e.kind === "skill.start") c.skill++;
    if (e.kind === "endpoint.request") c.http++;
    if (e.kind === "error") c.error++;
  });
  const list: TraceSummary[] = [];
  for (const [tid, partial] of tasks) {
    const c = counts.get(tid)!;
    list.push({
      traceId: tid,
      startedAt: partial.startedAt ?? "",
      endedAt: partial.endedAt,
      durationMs: partial.durationMs,
      status: partial.status,
      caller: partial.caller,
      rationale: partial.rationale,
      argv: partial.argv,
      skillCount: c.skill,
      httpCount: c.http,
      errorCount: c.error,
    });
  }
  list.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  out(list.slice(0, limit));
  return 0;
}

const SCALAR_KEYS = [
  "skillId", "skillName", "stage", "hookName", "goalId", "methodName",
  "method", "url", "attempt", "status", "httpStatus", "durationMs",
  "errorKind", "errorMessage", "caller", "rationale", "slot", "role",
  "path", "bytes", "mime", "signal",
  "mode", "page", "itemIndex", "hasProjection",
];
const REF_KEYS = [
  "paramsRef", "resultRef", "requestRef", "responseRef", "bodyRef",
  "projectionRef",
];

async function cmdTrace(traceId: string, full: boolean): Promise<number> {
  const events = await collectTrace(traceId);
  if (events.length === 0) {
    process.stderr.write(`Trace not found: ${traceId}\n`);
    return 1;
  }
  if (full) {
    out({ traceId, count: events.length, events });
    return 0;
  }
  const compact = events.map((e) => {
    const r = asRec(e);
    const base: AnyRec = {
      ts: e.ts, kind: e.kind, spanId: e.spanId, parentSpanId: e.parentSpanId,
    };
    for (const k of SCALAR_KEYS) {
      if (r[k] !== undefined) base[k] = r[k];
    }
    for (const k of REF_KEYS) {
      const v = r[k];
      if (v && typeof v === "object") {
        const ref = v as AnyRec;
        base[k] = {
          bytes: ref.bytes,
          mime: ref.mime,
          path: ref.path,
          preview: typeof ref.preview === "string"
            ? (ref.preview as string).slice(0, 120)
            : undefined,
        };
      }
    }
    return base;
  });
  out({ traceId, count: events.length, events: compact });
  return 0;
}

async function cmdHttp(urlPattern: string | undefined, limit: number): Promise<number> {
  const rows: unknown[] = [];
  await streamEvents((e) => {
    if (e.kind !== "endpoint.response") return;
    const r = asRec(e);
    const url = r.url as string;
    if (urlPattern && !url.includes(urlPattern)) return;
    const ref = r.responseRef as AnyRec | undefined;
    rows.push({
      ts: e.ts, traceId: e.traceId,
      goalId: r.goalId, methodName: r.methodName, method: r.method, url,
      status: r.status, httpStatus: r.httpStatus, durationMs: r.durationMs,
      attempt: r.attempt,
      bodyPath: ref?.path, bodyBytes: ref?.bytes, bodyPreview: ref?.preview,
    });
    if (rows.length >= limit) return false;
  });
  out(rows);
  return 0;
}

async function cmdProjections(
  filters: { url?: string; method?: string; goal?: string },
  limit: number,
): Promise<number> {
  const rows: unknown[] = [];
  await streamEvents((e) => {
    if (e.kind !== "endpoint.projection") return;
    const r = asRec(e);
    const url = r.url as string;
    if (filters.url && !url.includes(filters.url)) return;
    if (filters.method && r.methodName !== filters.method) return;
    if (filters.goal && r.goalId !== filters.goal) return;
    const ref = r.projectionRef as AnyRec | undefined;
    rows.push({
      ts: e.ts, traceId: e.traceId,
      goalId: r.goalId, methodName: r.methodName, url,
      mode: r.mode, page: r.page, itemIndex: r.itemIndex,
      status: r.status, durationMs: r.durationMs,
      hasProjection: r.hasProjection,
      bodyPath: ref?.path, bodyBytes: ref?.bytes, bodyPreview: ref?.preview,
      errorMessage: r.errorMessage,
    });
    if (rows.length >= limit) return false;
  });
  out(rows);
  return 0;
}

async function cmdSlow(threshold: number, limit: number): Promise<number> {
  const rows: AnyRec[] = [];
  await streamEvents((e) => {
    const r = asRec(e);
    const d = r.durationMs;
    if (typeof d !== "number" || d < threshold) return;
    rows.push({
      ts: e.ts, traceId: e.traceId, kind: e.kind, spanId: e.spanId,
      durationMs: d, skillId: r.skillId, url: r.url, status: r.status,
    });
  });
  rows.sort((a, b) => ((b.durationMs as number) ?? 0) - ((a.durationMs as number) ?? 0));
  out(rows.slice(0, limit));
  return 0;
}

async function cmdErrors(limit: number): Promise<number> {
  const rows: unknown[] = [];
  await streamEvents((e) => {
    const r = asRec(e);
    const isFail =
      e.kind === "error" ||
      ((e.kind === "skill.end" || e.kind === "endpoint.response" ||
        e.kind === "navigate.end" || e.kind === "stage.end") &&
        r.status === "failure");
    if (!isFail) return;
    rows.push(e);
    if (rows.length >= limit) return false;
  });
  out(rows);
  return 0;
}

function cmdBody(hash: string): number {
  const cfg = getObsConfig();
  const root = join(cfg.dir, "bodies");
  if (!existsSync(root)) {
    process.stderr.write(`No bodies dir: ${root}\n`);
    return 1;
  }
  const sub = hash.slice(0, 2);
  const dir = join(root, sub);
  if (!existsSync(dir)) {
    process.stderr.write(`Hash prefix not found: ${sub}\n`);
    return 1;
  }
  const matches = readdirSync(dir).filter((f) => f.startsWith(hash));
  if (matches.length === 0) {
    process.stderr.write(`Body not found: ${hash}\n`);
    return 1;
  }
  const file = join(dir, matches[0]);
  const stats = statSync(file);
  process.stderr.write(`# ${file} (${stats.size} bytes)\n`);
  process.stdout.write(readFileSync(file));
  process.stdout.write("\n");
  return 0;
}

function cmdLs(): number {
  const cfg = getObsConfig();
  const traces = tracesDir();
  const bodies = join(cfg.dir, "bodies");
  const traceFiles = existsSync(traces) ? readdirSync(traces) : [];
  let bodyCount = 0;
  let bodyBytes = 0;
  if (existsSync(bodies)) {
    for (const sub of readdirSync(bodies)) {
      const subPath = join(bodies, sub);
      try {
        if (!statSync(subPath).isDirectory()) continue;
      } catch { continue; }
      for (const f of readdirSync(subPath)) {
        bodyCount++;
        try { bodyBytes += statSync(join(subPath, f)).size; } catch { /* */ }
      }
    }
  }
  out({
    obsDir: cfg.dir,
    tracesDir: traces,
    bodiesDir: bodies,
    traceFiles,
    bodyCount,
    bodyBytes,
    hint: "查看：obs recent | obs trace <id> | obs body <hash>",
  });
  return 0;
}

function cmdHelp(): void {
  const cfg = getObsConfig();
  out({
    usage: "spider obs <subcommand> [flags]",
    subcommands: {
      ls: "列出存储路径与统计",
      "recent [--limit N]": "最近 trace 概览（含 caller / rationale）",
      "trace <traceId> [--full]": "trace 全部事件（默认紧凑视图，--full 含完整原文）",
      "http [--url PATTERN] [--limit N]": "HTTP 调用（含原始 response body 文件路径）",
      "projections [--url PATTERN] [--method NAME] [--goal ID] [--limit N]":
        "投影后的数据快照（每页 / 每 item / 每 single 一条；含 projectionRef 路径）",
      "slow [--threshold MS] [--limit N]": "慢 span（默认 ≥5000ms）",
      "errors [--limit N]": "失败事件",
      "body <hash>": "dump body 原文（hash = *Ref.path 文件名）",
    },
    storageDir: cfg.dir,
    sinks: cfg.sinks,
    hint: `所有数据存放在 ${cfg.dir}（修改：SPIDER_OBS_DIR）。body 文件以 sha256 命名，可直接 cat/jq/open。`,
  });
}

export async function runObsCLI(argv: string[]): Promise<number> {
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "help") {
    cmdHelp();
    return 0;
  }
  const sub = argv[0];
  const rest = argv.slice(1);
  const flag = (name: string): string | undefined => {
    const i = rest.indexOf(name);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  const has = (name: string) => rest.includes(name);

  switch (sub) {
    case "recent":
      return cmdRecent(Number(flag("--limit") ?? 20));
    case "trace":
      if (!rest[0] || rest[0].startsWith("--")) {
        process.stderr.write("Usage: obs trace <traceId> [--full]\n");
        return 1;
      }
      return cmdTrace(rest[0], has("--full"));
    case "http":
      return cmdHttp(flag("--url"), Number(flag("--limit") ?? 50));
    case "projections":
      return cmdProjections(
        {
          url: flag("--url"),
          method: flag("--method"),
          goal: flag("--goal"),
        },
        Number(flag("--limit") ?? 50),
      );
    case "slow":
      return cmdSlow(Number(flag("--threshold") ?? 5000), Number(flag("--limit") ?? 50));
    case "errors":
      return cmdErrors(Number(flag("--limit") ?? 100));
    case "body":
      if (!rest[0]) {
        process.stderr.write("Usage: obs body <hash>\n");
        return 1;
      }
      return cmdBody(rest[0]);
    case "ls":
      return cmdLs();
    default:
      process.stderr.write(`Unknown obs subcommand: ${sub}\n`);
      cmdHelp();
      return 1;
  }
}
