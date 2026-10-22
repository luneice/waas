/**
 * ★ 跨协议验证：WS 复用 SSE 场景下设计的 runStream
 *
 * 这组测试的目的**不是**测 WS 功能，而是回答一个架构问题：
 * 「无界事件流 → 有界结果」这个抽象，是不是只对 SSE 成立？
 *
 * 判据：如果 WS 能原样复用 `runStream`（不改其契约），只在外面补一层薄桥接，
 * 就说明抽象跨协议成立，可以上提 core。反之说明还差东西。
 *
 * 同时覆盖 WS 特有、而 SSE 没有的能力：**双向往返**（收到数据后回发消息）。
 */
import { test, describe } from "vitest";
import assert from "node:assert/strict";
import { runStream } from "@spider/core";
import { TvOutbox, wsEventSource } from "@src/ws/stream-source";
import type { TvWsStreamEvent } from "@src/ws/stream-source";
import { FakeTvTransport, batch } from "../fixtures/fake-transport";

const DRAIN_WAIT = 50;

describe("WS 复用 runStream —— 抽象跨协议成立的证据", () => {
  test("基本累积：多批次事件汇总成一个结果", async () => {
    const t = new FakeTvTransport([
      batch({ m: "qsd", p: ["s1", { n: "A", v: { lp: 1 } }] }),
      batch({ m: "qsd", p: ["s1", { n: "B", v: { lp: 2 } }] }),
      { messages: [{ m: "quote_completed", p: ["s1", "A"] }], closed: true },
    ]);
    const outbox = new TvOutbox();

    const r = await runStream(
      wsEventSource(t, { drainWaitMs: DRAIN_WAIT, outbox }),
      {
        seed: () => ({ names: [] as string[] }),
        reduce: (acc, ev: TvWsStreamEvent) => {
          if (ev.message.m === "qsd") {
            const payload = ev.message.p[1] as { n?: string };
            if (payload?.n) acc.names.push(payload.n);
          }
          return acc;
        },
      },
      {},
    );

    assert.deepEqual(r.acc.names, ["A", "B"]);
    assert.equal(r.stopReason, "closed", "上游关闭应记为 closed");
    assert.equal(r.truncated, false);
  });

  test("★ until 读 ctx —— 与 SSE 场景同一套语义", async () => {
    const t = new FakeTvTransport([
      batch(
        { m: "qsd", p: ["s1", { n: "A" }] },
        { m: "qsd", p: ["s1", { n: "B" }] },
        { m: "qsd", p: ["s1", { n: "C" }] },
      ),
      batch({ m: "qsd", p: ["s1", { n: "D" }] }),
    ]);
    const ctx = { params: { limit: 2 } };

    const r = await runStream(
      wsEventSource(t, { drainWaitMs: DRAIN_WAIT, outbox: new TvOutbox() }),
      {
        seed: () => ({ got: [] as string[] }),
        reduce: (acc, ev: TvWsStreamEvent) => {
          const p = ev.message.p[1] as { n?: string };
          if (p?.n) acc.got.push(p.n);
          return acc;
        },
        until: (acc, _ev, c: typeof ctx) => acc.got.length >= c.params.limit,
      },
      ctx,
    );

    assert.deepEqual(r.acc.got, ["A", "B"], "应恰好在入参指定条数停止");
    assert.equal(r.stopReason, "until");
    assert.equal(t.drainCalls, 1, "★ 首批就满足条件，不该再 drain");
  });

  test("增量合并：同一标的分多条推送需按 key 合并（qsd 的核心语义）", async () => {
    const t = new FakeTvTransport([
      batch({ m: "qsd", p: ["s1", { n: "AAPL", v: { lp: 100 } }] }),
      batch({ m: "qsd", p: ["s1", { n: "AAPL", v: { volume: 500 } }] }),
      { messages: [{ m: "qsd", p: ["s1", { n: "AAPL", v: { lp: 101 } }] }], closed: true },
    ]);

    const r = await runStream(
      wsEventSource(t, { drainWaitMs: DRAIN_WAIT, outbox: new TvOutbox() }),
      {
        seed: () => ({ merged: {} as Record<string, Record<string, unknown>> }),
        reduce: (acc, ev: TvWsStreamEvent) => {
          const p = ev.message.p[1] as { n?: string; v?: Record<string, unknown> };
          if (p?.n) {
            acc.merged[p.n] = { ...(acc.merged[p.n] ?? {}), ...(p.v ?? {}) };
          }
          return acc;
        },
      },
      {},
    );

    assert.deepEqual(
      r.acc.merged.AAPL,
      { lp: 101, volume: 500 },
      "★ 后到的 lp 覆盖先到的，volume 保留 —— 只取最后一条会丢 volume",
    );
  });
});

describe("WS 特有：双向往返（SSE 没有这个能力）", () => {
  test("reduce 里排队的消息会在下一轮 drain 前发出", async () => {
    const t = new FakeTvTransport([
      batch({ m: "series_completed", p: ["cs", "sds", { data_completed: "" }] }),
      batch({ m: "series_completed", p: ["cs", "sds", { data_completed: "end" }] }),
    ]);
    const outbox = new TvOutbox();

    const r = await runStream(
      wsEventSource(t, { drainWaitMs: DRAIN_WAIT, outbox }),
      {
        seed: () => ({ rounds: 0 }),
        reduce: (acc, ev: TvWsStreamEvent) => {
          if (ev.message.m === "series_completed") {
            acc.rounds += 1;
            const opts = ev.message.p[2] as { data_completed?: string };
            // 未到数据边界 → 排队一条翻页请求
            if (opts?.data_completed !== "end") {
              outbox.push({ m: "request_more_data", p: ["cs", "sds", 5000] });
            }
          }
          return acc;
        },
        until: (_acc, ev: TvWsStreamEvent) => {
          const opts = ev.message.p[2] as { data_completed?: string };
          return ev.message.m === "series_completed" && opts?.data_completed === "end";
        },
      },
      {},
    );

    assert.equal(r.acc.rounds, 2);
    assert.equal(r.stopReason, "until");
    assert.equal(
      t.countSent("request_more_data"),
      1,
      "★ 翻页请求恰好发一次 —— 多发会重复取数，少发会停在半路",
    );
  });

  test("outbox 为空时不产生多余的 send 调用", async () => {
    const t = new FakeTvTransport([{ messages: [{ m: "x", p: [] }], closed: true }]);
    await runStream(
      wsEventSource(t, { drainWaitMs: DRAIN_WAIT, outbox: new TvOutbox() }),
      { seed: () => 0, reduce: (a) => a },
      {},
    );
    assert.equal(t.sentFrames.length, 0, "没有排队消息就不该发");
  });
});

describe("边界与健壮性", () => {
  test("连接关闭前的最后一批数据不丢", async () => {
    const t = new FakeTvTransport([
      { messages: [{ m: "qsd", p: ["s1", { n: "LAST" }] }], closed: true },
    ]);
    const r = await runStream(
      wsEventSource(t, { drainWaitMs: DRAIN_WAIT, outbox: new TvOutbox() }),
      {
        seed: () => ({ n: 0 }),
        reduce: (acc) => ({ n: acc.n + 1 }),
      },
      {},
    );
    assert.equal(r.acc.n, 1, "★ closed 标志与数据同批时，数据必须先被消费");
  });

  test("空批次不产出事件但推进循环（静默流能被判超时的前提）", async () => {
    const t = new FakeTvTransport([
      {},                                    // 空批次
      {},                                    // 空批次
      { messages: [{ m: "x", p: [] }], closed: true },
    ]);
    const r = await runStream(
      wsEventSource(t, { drainWaitMs: DRAIN_WAIT, outbox: new TvOutbox() }),
      { seed: () => ({ n: 0 }), reduce: (acc) => ({ n: acc.n + 1 }) },
      {},
    );
    assert.equal(r.eventCount, 1, "空批次不该产出事件");
    assert.equal(t.drainCalls, 3, "但循环要推进，否则静默流会挂死");
  });

  test("畸形帧被计数而非中断整条流（协议漂移的早期信号）", async () => {
    const t = new FakeTvTransport([
      { rawPayloads: ["@@@not-json@@@"], },
      { messages: [{ m: "qsd", p: ["s1", { n: "OK" }] }], closed: true },
    ]);
    let malformed = 0;
    const r = await runStream(
      wsEventSource(t, {
        drainWaitMs: DRAIN_WAIT,
        outbox: new TvOutbox(),
        onMalformed: (c) => { malformed += c; },
      }),
      {
        seed: () => ({ names: [] as string[] }),
        reduce: (acc, ev: TvWsStreamEvent) => {
          const p = ev.message.p[1] as { n?: string };
          if (p?.n) acc.names.push(p.n);
          return acc;
        },
      },
      {},
    );
    assert.equal(malformed, 1, "畸形帧应被计数");
    assert.deepEqual(r.acc.names, ["OK"], "★ 但不该中断，后续正常帧仍要消费");
  });

  test("丢帧数随事件透出，供上层告警", async () => {
    const t = new FakeTvTransport([
      { messages: [{ m: "x", p: [] }], dropped: 7, closed: true },
    ]);
    let seen = -1;
    await runStream(
      wsEventSource(t, { drainWaitMs: DRAIN_WAIT, outbox: new TvOutbox() }),
      {
        seed: () => 0,
        reduce: (acc, ev: TvWsStreamEvent) => {
          seen = ev.droppedFrames;
          return acc;
        },
      },
      {},
    );
    assert.equal(seen, 7, "丢帧说明消费跟不上推送，必须能被上层看到");
  });
});
