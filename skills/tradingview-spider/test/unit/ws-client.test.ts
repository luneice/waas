/**
 * WS 会话客户端单测 —— 协议语义层
 *
 * 用 FakeTvTransport 全程驱动，不需要浏览器、不需要 WebSocket 全局。
 * 重点守护两处**结果上看不出来**的错误：
 *   ① qsd 增量合并漏字段（只取最后一条）
 *   ② 翻页请求多发/少发（多发浪费+风控风险，少发停在半路却像正常结束）
 */
import { test, describe } from "vitest";
import assert from "node:assert/strict";
import { SpiderError } from "@spider/core";
import { TvWsClient } from "@src/ws/client";
import { FakeTvTransport, batch } from "../fixtures/fake-transport";

const OPTS = { scope: "test" };

/** 从 ~m~len~m~payload 帧里取出消息 */
function parseFrame(f: string): { m: string; p: unknown[] } {
  const idx = f.indexOf("~m~", 3);
  return JSON.parse(idx === -1 ? f : f.slice(idx + 3));
}

/** 固定随机源，让会话 ID 可复现 */
const fixedRand = () => 0.5;

async function connected(t: FakeTvTransport): Promise<TvWsClient> {
  const c = new TvWsClient(t, { ...OPTS, rand: fixedRand });
  await c.connect(5000);
  return c;
}

describe("connect —— 初始化三件套", () => {
  test("建连后发出 data_quality / auth_token / locale", async () => {
    const t = new FakeTvTransport([]);
    await connected(t);
    // 初始化三件套随 open 的 frames 参数一起发出（建连即生效），不走 send
    const names = t.openedFrames.map((f) => parseFrame(f).m);
    assert.deepEqual(names, ["set_data_quality", "set_auth_token", "set_locale"]);
  });

  test("鉴权传的是固定字面量而非 JWT（实测：登录页自身就这么发）", async () => {
    const t = new FakeTvTransport([]);
    await connected(t);
    const auth = t.openedFrames.map(parseFrame).find((m) => m.m === "set_auth_token");
    assert.equal(auth?.p[0], "unauthorized_user_token");
  });

  test("close 幂等，未建连时不报错", async () => {
    const t = new FakeTvTransport([]);
    const c = new TvWsClient(t, OPTS);
    await c.close();
    assert.equal(t.closed, false, "未建连不该触发 transport.close");
    await c.connect(5000);
    await c.close();
    await c.close();
    assert.equal(t.closed, true);
  });
});

describe("quoteSnapshot —— 报价会话", () => {
  test("★ qsd 增量合并：分多条推送的字段必须累积", async () => {
    const t = new FakeTvTransport([
      batch({ m: "qsd", p: ["qs", { n: "NASDAQ:AAPL", s: "ok", v: { lp: 100 } }] }),
      batch({ m: "qsd", p: ["qs", { n: "NASDAQ:AAPL", s: "ok", v: { volume: 500 } }] }),
      batch(
        { m: "qsd", p: ["qs", { n: "NASDAQ:AAPL", s: "ok", v: { lp: 101 } }] },
        { m: "quote_completed", p: ["qs", "NASDAQ:AAPL"] },
      ),
    ]);
    const c = await connected(t);
    const r = await c.quoteSnapshot({
      symbols: ["NASDAQ:AAPL"],
      fields: ["lp", "volume"],
      timeoutMs: 5000,
    });

    const q = r.quotes.get("NASDAQ:AAPL");
    assert.deepEqual(
      q?.values,
      { lp: 101, volume: 500 },
      "★ 后到的 lp 覆盖，volume 保留 —— 只取最后一条会丢 volume",
    );
    assert.equal(q?.status, "ok");
    assert.equal(r.stopReason, "until", "全部标的到齐应正常收口");
    assert.equal(r.truncated, false);
  });

  test("多标的：全部 quote_completed 到齐才收口", async () => {
    const t = new FakeTvTransport([
      batch(
        { m: "qsd", p: ["qs", { n: "A", s: "ok", v: { lp: 1 } }] },
        { m: "quote_completed", p: ["qs", "A"] },
      ),
      // A 已完成但 B 未完成，不该提前收口
      batch(
        { m: "qsd", p: ["qs", { n: "B", s: "ok", v: { lp: 2 } }] },
        { m: "quote_completed", p: ["qs", "B"] },
      ),
    ]);
    const c = await connected(t);
    const r = await c.quoteSnapshot({
      symbols: ["A", "B"],
      fields: ["lp"],
      timeoutMs: 5000,
    });
    assert.equal(r.quotes.size, 2);
    assert.equal(t.drainCalls, 2, "★ 首批只有 A 完成时不该停");
  });

  test("上游报错的标的保留 error 状态，不因后续增量翻回 ok", async () => {
    const t = new FakeTvTransport([
      batch({ m: "qsd", p: ["qs", { n: "BAD", s: "error", v: {} }] }),
      batch(
        { m: "qsd", p: ["qs", { n: "BAD", s: "ok", v: { lp: 1 } }] },
        { m: "quote_completed", p: ["qs", "BAD"] },
      ),
    ]);
    const c = await connected(t);
    const r = await c.quoteSnapshot({ symbols: ["BAD"], fields: ["lp"], timeoutMs: 5000 });
    assert.equal(r.quotes.get("BAD")?.status, "error", "错误状态是粘性的");
  });

  test("零结果抛 no-results（可判定信号，不返回空集）", async () => {
    const t = new FakeTvTransport([{ closed: true }]);
    const c = await connected(t);
    await assert.rejects(
      c.quoteSnapshot({ symbols: ["X"], fields: ["lp"], timeoutMs: 5000 }),
      (err: SpiderError) => {
        assert.equal(err.kind, "no-results");
        assert.match(err.message, /tv-search/, "应引导用户去确认 ticker");
        return true;
      },
    );
  });

  test("session_id 只进诊断，不外泄（避免暴露上游拓扑）", async () => {
    const t = new FakeTvTransport([
      batch({ m: "qsd", p: ["qs", { n: "A", s: "ok", v: { lp: 1 } }] },
            { m: "quote_completed", p: ["qs", "A"] }),
    ]);
    const c = await connected(t);
    const r = await c.quoteSnapshot({ symbols: ["A"], fields: ["lp"], timeoutMs: 5000 });
    assert.equal(r.diagnostics.sessionId, "fake", "诊断里保留供排查");
  });
});

describe("history —— K 线会话与翻页", () => {
  const baseReq = {
    ticker: "FRED:X",
    resolution: "1D",
    bars: 300,
    pageBars: 5000,
    maxRounds: 10,
    timezone: "Etc/UTC",
    timeoutMs: 10_000,
  };

  test("建立会话的四条消息顺序正确", async () => {
    const t = new FakeTvTransport([
      batch({ m: "series_completed", p: ["cs", "sds_1", "s", "s1", { data_completed: "end" }] }),
    ]);
    const c = await connected(t);
    await c.history({ ...baseReq, fromTs: null });
    const names = t.sentMessages().map((m) => m.m);
    assert.deepEqual(names, [
      "chart_create_session",
      "switch_timezone",
      "resolve_symbol",
      "create_series",
    ]);
  });

  test("bar 解析：5 元素无成交量 → volume 为 null（不是 0）", async () => {
    const t = new FakeTvTransport([
      batch(
        { m: "timescale_update", p: ["cs", { sds_1: { s: [{ i: 0, v: [1000, 1, 2, 0.5, 1.5] }] } }] },
        { m: "series_completed", p: ["cs", "sds_1", "s", "s1", { data_completed: "end" }] },
      ),
    ]);
    const c = await connected(t);
    const r = await c.history({ ...baseReq, fromTs: null });
    assert.equal(r.bars.length, 1);
    assert.equal(
      r.bars[0].volume,
      null,
      "★ null=该类标的无成交量概念，与真实 0 语义不同",
    );
  });

  test("bar 解析：6 元素带成交量，且 0 被保留为 0", async () => {
    const t = new FakeTvTransport([
      batch(
        { m: "timescale_update", p: ["cs", { sds_1: { s: [{ i: 0, v: [1000, 1, 2, 0.5, 1.5, 0] }] } }] },
        { m: "series_completed", p: ["cs", "sds_1", "s", "s1", { data_completed: "end" }] },
      ),
    ]);
    const c = await connected(t);
    const r = await c.history({ ...baseReq, fromTs: null });
    assert.equal(r.bars[0].volume, 0, "真实成交量 0 必须保留为 0");
  });

  test("bar 按 time 去重且升序（翻页后 i 会变负，不能用 i 当主键）", async () => {
    const t = new FakeTvTransport([
      batch({ m: "timescale_update", p: ["cs", { sds_1: { s: [
        { i: 0, v: [3000, 3, 3, 3, 3] },
        { i: 1, v: [1000, 1, 1, 1, 1] },
      ] } }] }),
      batch(
        // 翻页批次：i 变负，且 time=1000 与上一批重复
        { m: "timescale_update", p: ["cs", { sds_1: { s: [
          { i: -5, v: [1000, 9, 9, 9, 9] },
          { i: -4, v: [2000, 2, 2, 2, 2] },
        ] } }] },
        { m: "series_completed", p: ["cs", "sds_1", "s", "s1", { data_completed: "end" }] },
      ),
    ]);
    const c = await connected(t);
    const r = await c.history({ ...baseReq, fromTs: null });
    assert.deepEqual(r.bars.map((b) => b.time), [1000, 2000, 3000], "应升序且去重");
    assert.equal(r.bars[0].open, 9, "同 time 的后到数据覆盖先到");
  });

  test("负时间戳（1970 前）不被当空值丢弃", async () => {
    const t = new FakeTvTransport([
      batch(
        { m: "timescale_update", p: ["cs", { sds_1: { s: [{ i: 0, v: [-1817078400, 3.5, 3.5, 3.5, 3.5] }] } }] },
        { m: "series_completed", p: ["cs", "sds_1", "s", "s1", { data_completed: "end" }] },
      ),
    ]);
    const c = await connected(t);
    const r = await c.history({ ...baseReq, fromTs: null });
    assert.equal(r.bars.length, 1, "★ 负时间戳是合法历史数据");
    assert.equal(r.bars[0].time, -1817078400);
  });

  test("★ 翻页：未覆盖到 fromTs 时继续请求，恰好一次一轮", async () => {
    const t = new FakeTvTransport([
      batch(
        { m: "timescale_update", p: ["cs", { sds_1: { s: [{ i: 0, v: [5000, 1, 1, 1, 1] }] } }] },
        { m: "series_completed", p: ["cs", "sds_1", "s", "s1", {}] },
      ),
      batch(
        { m: "timescale_update", p: ["cs", { sds_1: { s: [{ i: -1, v: [1000, 1, 1, 1, 1] }] } }] },
        { m: "series_completed", p: ["cs", "sds_1", "s", "s1", {}] },
      ),
    ]);
    const c = await connected(t);
    const r = await c.history({ ...baseReq, fromTs: 2000 });
    assert.equal(
      t.countSent("request_more_data"),
      1,
      "★ 首轮未覆盖 → 发一次；第二轮已覆盖 → 不再发",
    );
    assert.equal(r.rounds, 2);
    assert.equal(r.truncatedByMaxRounds, false);
  });

  test("★ data_completed:end 立即停止，不再翻页（数据边界）", async () => {
    const t = new FakeTvTransport([
      batch(
        { m: "timescale_update", p: ["cs", { sds_1: { s: [{ i: 0, v: [9000, 1, 1, 1, 1] }] } }] },
        // 虽然远未覆盖 fromTs=1，但上游说到底了
        { m: "series_completed", p: ["cs", "sds_1", "s", "s1", { data_completed: "end" }] },
      ),
    ]);
    const c = await connected(t);
    const r = await c.history({ ...baseReq, fromTs: 1 });
    assert.equal(r.dataCompleted, true);
    assert.equal(t.countSent("request_more_data"), 0, "★ 到边界后不该再请求");
    assert.equal(r.truncatedByMaxRounds, false, "到达数据边界不算被截断");
  });

  test("★ maxRounds 上限提前停止，并显式标记未覆盖完", async () => {
    const t = new FakeTvTransport([
      batch(
        { m: "timescale_update", p: ["cs", { sds_1: { s: [{ i: 0, v: [9000, 1, 1, 1, 1] }] } }] },
        { m: "series_completed", p: ["cs", "sds_1", "s", "s1", {}] },
      ),
      batch(
        { m: "timescale_update", p: ["cs", { sds_1: { s: [{ i: -1, v: [8000, 1, 1, 1, 1] }] } }] },
        { m: "series_completed", p: ["cs", "sds_1", "s", "s1", {}] },
      ),
    ]);
    const c = await connected(t);
    const r = await c.history({ ...baseReq, fromTs: 1, maxRounds: 2 });
    assert.equal(r.truncatedByMaxRounds, true, "★ 必须显式告知未覆盖到请求区间");
    assert.equal(r.dataCompleted, false, "这不是数据边界，是被上限截断");
    assert.equal(t.countSent("request_more_data"), 1, "第 2 轮到上限不再发");
  });

  test("fromTs=null 只取首批，不翻页", async () => {
    const t = new FakeTvTransport([
      batch(
        { m: "timescale_update", p: ["cs", { sds_1: { s: [{ i: 0, v: [5000, 1, 1, 1, 1] }] } }] },
        { m: "series_completed", p: ["cs", "sds_1", "s", "s1", {}] },
      ),
    ]);
    const c = await connected(t);
    const r = await c.history({ ...baseReq, fromTs: null });
    assert.equal(t.countSent("request_more_data"), 0);
    assert.equal(r.rounds, 1);
  });

  test("symbol_resolved 的元信息被采集", async () => {
    const t = new FakeTvTransport([
      batch(
        { m: "symbol_resolved", p: ["cs", "sym_1", {
          description: "United States 10 Year",
          type: "bond",
          typespecs: ["government", "yield"],
          timezone: "America/New_York",
          data_frequency: "D",
          pricescale: 1000,
          minmov: 1,
        }] },
        { m: "series_completed", p: ["cs", "sds_1", "s", "s1", { data_completed: "end" }] },
      ),
    ]);
    const c = await connected(t);
    const r = await c.history({ ...baseReq, fromTs: null });
    assert.equal(r.symbolMeta?.description, "United States 10 Year");
    assert.equal(r.symbolMeta?.dataFrequency, "D", "原始发布频率，用于解释阶梯状重复值");
    assert.equal(r.symbolMeta?.priceScale, 1000);
  });

  test("symbol_error 抛 upstream-shape-changed 并带引导", async () => {
    const t = new FakeTvTransport([
      batch({ m: "symbol_error", p: ["cs", "sym_1", "unknown symbol"] }),
    ]);
    const c = await connected(t);
    await assert.rejects(
      c.history({ ...baseReq, fromTs: null }),
      (err: SpiderError) => {
        assert.equal(err.kind, "upstream-shape-changed");
        assert.match(err.message, /ticker 与 resolution/);
        return true;
      },
    );
  });

  test("未识别的消息名记入诊断而非报错（协议漂移早期信号）", async () => {
    const t = new FakeTvTransport([
      batch(
        { m: "some_new_message", p: [] },
        { m: "series_completed", p: ["cs", "sds_1", "s", "s1", { data_completed: "end" }] },
      ),
    ]);
    const c = await connected(t);
    const r = await c.history({ ...baseReq, fromTs: null });
    assert.ok(
      r.diagnostics.unknownMessageKinds.includes("some_new_message"),
      "未知消息应被记录，供发现上游改版",
    );
  });
});

describe("history —— 复权口径", () => {
  const baseReq = {
    ticker: "SSE:601398",
    resolution: "1D",
    bars: 300,
    pageBars: 5000,
    maxRounds: 10,
    timezone: "Etc/UTC",
    timeoutMs: 10_000,
    fromTs: null,
  };

  const endBatch = () =>
    batch({ m: "series_completed", p: ["cs", "sds_1", "s", "s1", { data_completed: "end" }] });

  function resolvedSymbolArg(t: FakeTvTransport): string {
    const msg = t.sentMessages().find((m) => m.m === "resolve_symbol");
    return msg?.p[2] as string;
  }

  test("默认口径走裸 ticker —— 不为「显式」无谓改变线上报文形态", async () => {
    const t = new FakeTvTransport([endBatch()]);
    const c = await connected(t);
    await c.history({ ...baseReq, adjustment: "splits" });
    assert.equal(resolvedSymbolArg(t), "SSE:601398");
  });

  test("不传 adjustment 时也走裸 ticker（与既有行为一致）", async () => {
    const t = new FakeTvTransport([endBatch()]);
    const c = await connected(t);
    await c.history({ ...baseReq });
    assert.equal(resolvedSymbolArg(t), "SSE:601398");
  });

  test("非默认口径走扩展 symbol，键按字典序（服务端拿它当缓存键）", async () => {
    const t = new FakeTvTransport([endBatch()]);
    const c = await connected(t);
    await c.history({ ...baseReq, adjustment: "dividends" });
    assert.equal(
      resolvedSymbolArg(t),
      '={"adjustment":"dividends","symbol":"SSE:601398"}',
      "★ adjustment 在 symbol 之前 —— 乱序会命中不同的服务端缓存键",
    );
  });

  test("none 口径同样走扩展 symbol（不被空值过滤误吞）", async () => {
    const t = new FakeTvTransport([endBatch()]);
    const c = await connected(t);
    await c.history({ ...baseReq, adjustment: "none" });
    assert.equal(
      resolvedSymbolArg(t),
      '={"adjustment":"none","symbol":"SSE:601398"}',
    );
  });

  test("生效口径取服务端回显，不回显请求值", async () => {
    const t = new FakeTvTransport([
      batch(
        { m: "symbol_resolved", p: ["cs", "sym_1", {
          description: "工商银行",
          adjustment: "dividends",
          allowed_adjustment: "any",
        }] },
        { m: "series_completed", p: ["cs", "sds_1", "s", "s1", { data_completed: "end" }] },
      ),
    ]);
    const c = await connected(t);
    const r = await c.history({ ...baseReq, adjustment: "dividends" });
    assert.equal(r.symbolMeta?.adjustment, "dividends");
    assert.equal(r.symbolMeta?.allowedAdjustment, "any");
  });

  test("上游未回显 adjustment 时为 null，不用请求值兜底冒充", async () => {
    const t = new FakeTvTransport([
      batch(
        { m: "symbol_resolved", p: ["cs", "sym_1", { description: "X" }] },
        { m: "series_completed", p: ["cs", "sds_1", "s", "s1", { data_completed: "end" }] },
      ),
    ]);
    const c = await connected(t);
    const r = await c.history({ ...baseReq, adjustment: "dividends" });
    assert.equal(
      r.symbolMeta?.adjustment,
      null,
      "★ null=上游没说，不能拿请求值假装生效了",
    );
  });
});
