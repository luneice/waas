/**
 * 流式累积/终止语义单测
 *
 * 重点守护两件事：
 *   ① until 能读到 ctx —— 这是本抽象存在的直接动因（见 reducer.ts 文件头）
 *   ② 终止原因可区分「正常收口」与「被迫中断」，且 truncated 标志正确
 */
import { test, describe } from "vitest";
import assert from "node:assert/strict";
import { runStream, isTruncated } from "../../src/stream/reducer";

async function* from<T>(items: T[]): AsyncIterable<T> {
  for (const it of items) yield it;
}

/** 带时刻标记的事件源：配合假时钟测超时 */
async function* timed<T>(
  items: Array<{ at: number; value: T }>,
  clock: { t: number },
): AsyncIterable<T> {
  for (const it of items) {
    clock.t = it.at;
    yield it.value;
  }
}

describe("基本累积", () => {
  test("seed → reduce → 收口", async () => {
    const r = await runStream(
      from([1, 2, 3]),
      { seed: () => ({ sum: 0 }), reduce: (acc, n: number) => ({ sum: acc.sum + n }) },
      {},
    );
    assert.equal(r.acc.sum, 6);
    assert.equal(r.eventCount, 3);
    assert.equal(r.stopReason, "closed", "上游自然结束应为 closed");
    assert.equal(r.truncated, false);
  });

  test("空流不报错，返回 seed 初值", async () => {
    const r = await runStream(
      from<number>([]),
      { seed: () => ({ sum: 0 }), reduce: (a) => a },
      {},
    );
    assert.equal(r.acc.sum, 0);
    assert.equal(r.eventCount, 0);
  });

  test("seed 每次执行都新建，不跨次串数据", async () => {
    const opts = {
      seed: () => ({ items: [] as number[] }),
      reduce: (acc: { items: number[] }, n: number) => {
        acc.items.push(n);
        return acc;
      },
    };
    const a = await runStream(from([1, 2]), opts, {});
    const b = await runStream(from([3]), opts, {});
    assert.deepEqual(a.acc.items, [1, 2]);
    assert.deepEqual(b.acc.items, [3], "第二次不该看到第一次的数据");
  });
});

describe("★ until 必须能读到 ctx —— 本抽象的直接动因", () => {
  test("终止条件依赖入参（@Paginated.stopWhen 做不到的事）", async () => {
    const ctx = { params: { limit: 3 } };
    const r = await runStream(
      from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
      {
        seed: () => ({ items: [] as number[] }),
        reduce: (acc, n: number) => {
          acc.items.push(n);
          return acc;
        },
        until: (acc, _ev, c: typeof ctx) => acc.items.length >= c.params.limit,
      },
      ctx,
    );
    assert.deepEqual(r.acc.items, [1, 2, 3]);
    assert.equal(r.eventCount, 3, "★ 只消费 3 个事件，不是全部 10 个");
    assert.equal(r.stopReason, "until");
    assert.equal(r.truncated, false, "until 满足是正常收口");
  });

  test("until 也能基于事件内容终止（如遇到 done 事件）", async () => {
    const r = await runStream(
      from(["a", "b", "done", "c"]),
      {
        seed: () => ({ seen: [] as string[] }),
        reduce: (acc, s: string) => {
          acc.seen.push(s);
          return acc;
        },
        until: (_acc, ev: string) => ev === "done",
      },
      {},
    );
    assert.deepEqual(r.acc.seen, ["a", "b", "done"]);
  });

  test("until 永不满足且上游结束 → closed（不是错误）", async () => {
    const r = await runStream(
      from([1, 2]),
      { seed: () => 0, reduce: (a) => a, until: () => false },
      {},
    );
    assert.equal(r.stopReason, "closed");
    assert.equal(r.truncated, false);
  });
});

describe("双超时与硬上限 —— 流没有协议级『完成』，必须有兜底", () => {
  test("idleTimeout：事件间隔过久判定断流", async () => {
    const clock = { t: 0 };
    const r = await runStream(
      timed([{ at: 10, value: 1 }, { at: 20, value: 2 }, { at: 500, value: 3 }], clock),
      { seed: () => ({ n: 0 }), reduce: (acc) => ({ n: acc.n + 1 }), idleTimeout: 100 },
      {},
      { now: () => clock.t },
    );
    assert.equal(r.stopReason, "idle-timeout");
    assert.equal(r.acc.n, 2, "迟到的第 3 个事件不该被消费");
    assert.equal(r.truncated, true, "★ 断流必须标记为数据可能不完整");
  });

  test("maxDuration：总时长超限即停，与事件间隔无关", async () => {
    const clock = { t: 0 };
    const r = await runStream(
      timed([{ at: 100, value: 1 }, { at: 200, value: 2 }, { at: 1200, value: 3 }], clock),
      {
        seed: () => ({ n: 0 }),
        reduce: (acc) => ({ n: acc.n + 1 }),
        idleTimeout: 5000,
        maxDuration: 1000,
      },
      {},
      { now: () => clock.t },
    );
    assert.equal(r.stopReason, "max-duration");
    assert.equal(r.truncated, true);
  });

  test("idleTimeout 与 maxDuration 是两回事：慢但活着的流不该被误杀", async () => {
    const clock = { t: 0 };
    const r = await runStream(
      timed([{ at: 90, value: 1 }, { at: 180, value: 2 }, { at: 270, value: 3 }], clock),
      { seed: () => ({ n: 0 }), reduce: (acc) => ({ n: acc.n + 1 }), idleTimeout: 100 },
      {},
      { now: () => clock.t },
    );
    assert.equal(r.stopReason, "closed", "慢流不该被判为断流");
    assert.equal(r.acc.n, 3);
  });

  test("maxEvents：防御上游疯狂推送打爆内存", async () => {
    const r = await runStream(
      from(Array.from({ length: 1000 }, (_, i) => i)),
      { seed: () => ({ n: 0 }), reduce: (acc) => ({ n: acc.n + 1 }), maxEvents: 5 },
      {},
    );
    assert.equal(r.eventCount, 5);
    assert.equal(r.stopReason, "max-events");
    assert.equal(r.truncated, true);
  });

  test("until 优先于 maxEvents（正常收口不应被误报为截断）", async () => {
    const r = await runStream(
      from([1, 2, 3, 4, 5]),
      {
        seed: () => ({ n: 0 }),
        reduce: (acc) => ({ n: acc.n + 1 }),
        until: (acc) => acc.n >= 3,
        maxEvents: 3,
      },
      {},
    );
    assert.equal(r.stopReason, "until", "同时满足时应报 until");
    assert.equal(r.truncated, false);
  });
});

describe("truncated 语义", () => {
  test("只有 until / closed 算完整，其余都是截断", () => {
    assert.equal(isTruncated("until"), false);
    assert.equal(isTruncated("closed"), false);
    assert.equal(isTruncated("idle-timeout"), true);
    assert.equal(isTruncated("max-duration"), true);
    assert.equal(isTruncated("max-events"), true);
  });
});

describe("错误传播", () => {
  test("reduce 抛错中止整条流并向上传播（不静默吞掉）", async () => {
    await assert.rejects(
      runStream(
        from([1, 2, 3]),
        {
          seed: () => 0,
          reduce: (_acc, n: number) => {
            if (n === 2) throw new Error("boom");
            return n;
          },
        },
        {},
      ),
      /boom/,
    );
  });

  test("事件源自身抛错也向上传播", async () => {
    async function* bad(): AsyncIterable<number> {
      yield 1;
      throw new Error("source failed");
    }
    await assert.rejects(
      runStream(bad(), { seed: () => 0, reduce: (a) => a }, {}),
      /source failed/,
    );
  });
});
