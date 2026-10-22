// ============================================================================
// createSnapshotter — 极简 JSON 快照断言（node:test 配套，零依赖）
// ============================================================================
//
// 从 bilibili-spider 上移。快照测试在本仓的价值很具体：投影层是纯函数，
// 输出契约的**任何**变化（字段增删、spread 泄露、口径漂移）都会在 diff 里
// 现形，这是 §3.5「禁止 spread」纪律唯一的自动化守卫。
//
// 用法（每个包在 test/helpers/snapshot.ts 里包一行）：
//   export const { expectSnapshot } = createSnapshotter(__dirname + "/..");
//
// 传 baseDir 而不是自动推导：`__dirname` 在这个文件里指向 core 的 src，
// 推导只会把所有包的快照写到 core 下面。调用方给出自己的 test 根，语义明确。
// ============================================================================

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

/**
 * 递归归一的易变字段名 —— 值随运行时刻变化，进快照就是每次都 diff。
 * 它们的**正确透传**由用例里的显式断言单独覆盖（快照锁形状，断言锁语义）。
 */
export const DEFAULT_VOLATILE_KEYS = [
  "crawledAt",
  "fetchedAt",
  "collectedAt",
  "startedAt",
  "completedAt",
  "durationMs",
  "elapsed",
  "traceId",
  "spanId",
] as const;

export interface SnapshotterOptions {
  /** 快照目录名（相对 baseDir），默认 "__snapshots__" */
  dir?: string;
  /** 覆盖易变字段名集合（不传则用 DEFAULT_VOLATILE_KEYS） */
  volatileKeys?: readonly string[];
  /** 追加易变字段名（在默认集合之上叠加，比整体覆盖更常用） */
  extraVolatileKeys?: readonly string[];
}

export interface Snapshotter {
  expectSnapshot(name: string, actual: unknown): void;
  /** 快照文件的绝对路径（诊断 / 清理用） */
  snapshotPath(name: string): string;
}

export function createSnapshotter(
  baseDir: string,
  options: SnapshotterOptions = {},
): Snapshotter {
  const dir = options.dir ?? "__snapshots__";
  const volatile = new Set<string>([
    ...(options.volatileKeys ?? DEFAULT_VOLATILE_KEYS),
    ...(options.extraVolatileKeys ?? []),
  ]);

  const snapshotPath = (name: string): string =>
    join(baseDir, dir, `${name}.json`);

  return {
    snapshotPath,
    expectSnapshot(name: string, actual: unknown): void {
      const file = snapshotPath(name);
      const serialized =
        JSON.stringify(normalizeVolatile(actual, volatile), null, 2) + "\n";

      // 首跑自动生成；UPDATE_SNAPSHOTS=1 显式刷新（diff 必须过 review）
      if (process.env.UPDATE_SNAPSHOTS === "1" || !existsSync(file)) {
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, serialized, "utf8");
        return;
      }

      assert.equal(
        serialized,
        readFileSync(file, "utf8"),
        `快照不匹配：${name}（契约有意变更时用 UPDATE_SNAPSHOTS=1 刷新并 review diff）`,
      );
    },
  };
}

function normalizeVolatile(value: unknown, volatile: Set<string>): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => normalizeVolatile(v, volatile));
  }
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = volatile.has(k) ? "<volatile>" : normalizeVolatile(v, volatile);
    }
    return out;
  }
  return value;
}
