/**
 * tv-quote / tv-history 模块测试
 *
 * 全程用 FakeTvTransport 驱动：不需要浏览器、不需要 WebSocket 全局。
 * 这正是把测试缝提到 transport 接口之上的收益 —— core 的 FakePage 沙箱
 * 没有 WebSocket，标准 harness 走不通。
 *
 * ⚠️ 这些用例覆盖的是**协议语义与投影契约**，不能替代真机验收
 * （真机需 data.tradingview.com 可达）。
 */
import { test, describe } from "vitest";
import assert from "node:assert/strict";
import { SpiderError, testing } from "@spider/core";
import { TvQuoteSnapshotSkill } from "@src/skills/quote.skill";
import { TvHistorySeriesSkill } from "@src/skills/history.skill";
import { FakeTvTransport, batch, type ScriptedBatch } from "../fixtures/fake-transport";

/** 用假 transport 构造 skill；sessionProvider 由 runSkillWithFixtures 注入 */
function quoteSkill(batches: ScriptedBatch[]) {
  const t = new FakeTvTransport(batches);
  const skill = new TvQuoteSnapshotSkill({
    sessionProvider: null as never,
    wsTransportFactory: () => t,
  });
  return { skill, transport: t };
}

function historySkill(batches: ScriptedBatch[]) {
  const t = new FakeTvTransport(batches);
  const skill = new TvHistorySeriesSkill({
    sessionProvider: null as never,
    wsTransportFactory: () => t,
  });
  return { skill, transport: t };
}

async function run<T>(skill: unknown, params: object) {
  return testing.runSkillWithFixtures<T>(
    skill as never,
    params,
    { upstream: new testing.FakeUpstream() },
  );
}

describe("tv-quote 参数归一", () => {
  test("symbols 缺失 → invalid-params，并引导用 tv-search", () => {
    const { skill } = quoteSkill([]);
    assert.throws(
      () => testing.invokeNormalize(skill as never, {}),
      (e: SpiderError) => {
        assert.equal(e.kind, "invalid-params");
        assert.match(e.message, /tv-search/, "错误信息要给出可执行的下一步");
        return true;
      },
    );
  });

  test("ticker 形状非法被拦截（缺交易所前缀）", () => {
    const { skill } = quoteSkill([]);
    assert.throws(
      () => testing.invokeNormalize(skill as never, { symbols: ["AAPL"] }),
      (e: SpiderError) => {
        assert.equal(e.kind, "invalid-params");
        assert.match(e.message, /tv-search/);
        return true;
      },
    );
  });

  test("超过上限被拦截并提示分批", () => {
    const { skill } = quoteSkill([]);
    const many = Array.from({ length: 51 }, (_, i) => `X:S${i}`);
    assert.throws(
      () => testing.invokeNormalize(skill as never, { symbols: many }),
      (e: SpiderError) => {
        assert.match(e.message, /分批/);
        return true;
      },
    );
  });

  test("默认字段集与超时被填充；symbols 去重", () => {
    const { skill } = quoteSkill([]);
    const p = testing.invokeNormalize(skill as never, {
      symbols: ["NASDAQ:AAPL", "NASDAQ:AAPL"],
    }) as { symbols: string[]; fields: string[]; timeoutMs: number };
    assert.deepEqual(p.symbols, ["NASDAQ:AAPL"], "重复标的应去重");
    assert.ok(p.fields.length > 10, "应填充默认字段集");
    assert.equal(p.timeoutMs, 15_000);
  });
});

describe("tv-quote 端到端（假 transport）", () => {
  test("成功信封：增量字段已合并，meta/insights 完整", async () => {
    const { skill } = quoteSkill([
      batch({ m: "qsd", p: ["qs", { n: "NASDAQ:AAPL", s: "ok", v: { lp: 100, description: "Apple" } }] }),
      batch(
        { m: "qsd", p: ["qs", { n: "NASDAQ:AAPL", s: "ok", v: { chp: 2.5, volume: 1000, update_mode: "streaming" } }] },
        { m: "quote_completed", p: ["qs", "NASDAQ:AAPL"] },
      ),
    ]);

    const out = await run(skill, { symbols: ["NASDAQ:AAPL"] });
    const data = out.expectSuccess() as {
      meta: Record<string, unknown>;
      insights: string[];
      items: Array<Record<string, unknown>>;
    };

    assert.equal(data.meta.skill, "tv-quote");
    assert.ok(String(data.meta.semantics).length > 0, "semantics 必填");
    const it = data.items[0];
    assert.equal(it.ticker, "NASDAQ:AAPL");
    assert.equal(it.price, 100, "首批的 lp 应保留");
    assert.equal(it.volume, 1000, "★ 后批的 volume 应合并进来");
    assert.equal(it.changePercent, 2.5, "百分比保留原值，不除以 100");
    assert.equal(it.description, "Apple");
  });

  test("★ 1e+100 哨兵在报价链路也要归一（真机实测 FRED:SOFR 的 volume）", async () => {
    /**
     * 回归守护：哨兵值**跨链路存在**，不是指标独有。真机实测
     * `FRED:SOFR` 的 volume 就是 1e+100（表示"利率类标的无成交量概念"）。
     * 若不归一会直接把 1e+100 透给用户，被当成天文成交量。
     */
    const { skill } = quoteSkill([
      batch(
        { m: "qsd", p: ["qs", { n: "FRED:SOFR", s: "ok", v: { lp: 3.65, volume: 1e100 } }] },
        { m: "quote_completed", p: ["qs", "FRED:SOFR"] },
      ),
    ]);
    const out = await run(skill, { symbols: ["FRED:SOFR"] });
    const data = out.expectSuccess() as { items: Array<{ price: number; volume: number | null }> };
    assert.equal(data.items[0].price, 3.65, "正常字段不受影响");
    assert.equal(data.items[0].volume, null, "★ 1e+100 必须归一为 null");
  });

  test("非 streaming 模式在 insights 中告警（勿当实时价用）", async () => {
    const { skill } = quoteSkill([
      batch(
        { m: "qsd", p: ["qs", { n: "X:A", s: "ok", v: { lp: 1, update_mode: "delayed" } }] },
        { m: "quote_completed", p: ["qs", "X:A"] },
      ),
    ]);
    const out = await run(skill, { symbols: ["X:A"] });
    const data = out.expectSuccess() as { insights: string[] };
    assert.ok(
      data.insights.some((i) => i.includes("非实时推送")),
      "延迟行情必须提示，否则会被当成实时价",
    );
  });

  test("零结果 → no-results（可判定信号）", async () => {
    const { skill } = quoteSkill([{ closed: true }]);
    const out = await run(skill, { symbols: ["X:NOPE"] });
    assert.equal(out.expectFailureKind(), "no-results");
  });
});

describe("tv-history 参数归一", () => {
  test("from 支持 YYYY-MM-DD 与 Unix 秒", () => {
    const { skill } = historySkill([]);
    const a = testing.invokeNormalize(skill as never, {
      symbols: ["X:A"], from: "2014-01-01",
    }) as unknown as { from: number };
    assert.equal(a.from, Math.floor(Date.parse("2014-01-01") / 1000));

    const b = testing.invokeNormalize(skill as never, {
      symbols: ["X:A"], from: 1388534400,
    }) as unknown as { from: number };
    assert.equal(b.from, 1388534400);
  });

  test("from 无法解析 → invalid-params，给出格式示例", () => {
    const { skill } = historySkill([]);
    assert.throws(
      () => testing.invokeNormalize(skill as never, { symbols: ["X:A"], from: "去年" }),
      (e: SpiderError) => {
        assert.equal(e.kind, "invalid-params");
        assert.match(e.message, /YYYY-MM-DD/);
        return true;
      },
    );
  });

  test("from > to 被拦截", () => {
    const { skill } = historySkill([]);
    assert.throws(
      () => testing.invokeNormalize(skill as never, {
        symbols: ["X:A"], from: "2020-01-01", to: "2019-01-01",
      }),
      (e: SpiderError) => {
        assert.match(e.message, /不能晚于/);
        return true;
      },
    );
  });

  test("数值参数被 clamp 到安全区间", () => {
    const { skill } = historySkill([]);
    const p = testing.invokeNormalize(skill as never, {
      symbols: ["X:A"], bars: -5, pageBars: 999_999, maxRounds: 500,
    }) as { bars: number; pageBars: number; maxRounds: number };
    assert.equal(p.bars, 1, "下限");
    assert.equal(p.pageBars, 50_000, "上限");
    assert.equal(p.maxRounds, 50, "上限");
  });
});

describe("tv-history 端到端（假 transport）", () => {
  const bar = (t: number, c: number) => ({ i: 0, v: [t, c, c, c, c] });

  test("成功信封：bars/stats/range 正确，barSchema 声明布局", async () => {
    const { skill } = historySkill([
      batch(
        { m: "symbol_resolved", p: ["cs", "sym_1", { description: "Test", type: "bond", data_frequency: "D" }] },
        { m: "timescale_update", p: ["cs", { sds_1: { s: [bar(1000, 10), bar(2000, 12)] } }] },
        { m: "series_completed", p: ["cs", "sds_1", "s", "s1", { data_completed: "end" }] },
      ),
    ]);

    const out = await run(skill, { symbols: ["FRED:X"] });
    const data = out.expectSuccess() as {
      meta: Record<string, unknown>;
      insights: string[];
      items: Array<Record<string, unknown>>;
    };

    assert.equal(data.meta.skill, "tv-history");
    assert.ok(String(data.meta.barSchema).includes("Unix"), "必须声明 bar 布局");
    const it = data.items[0] as {
      barCount: number; dataCompleted: boolean;
      stats: { first: number; last: number; changePercent: number };
      bars: Array<{ t: number; c: number; v: number | null }>;
      range: { fromISO: string };
    };
    assert.equal(it.barCount, 2);
    assert.equal(it.dataCompleted, true);
    assert.equal(it.stats.first, 10);
    assert.equal(it.stats.last, 12);
    assert.equal(it.stats.changePercent, 20, "(12-10)/10*100");
    assert.equal(it.bars[0].v, null, "★ 无成交量标的应为 null 而非 0");
    assert.ok(it.range.fromISO.startsWith("1970"), "range 提供人读锚点");
  });

  test("数据边界在 insights 中说清「非采集失败」", async () => {
    const { skill } = historySkill([
      batch(
        { m: "timescale_update", p: ["cs", { sds_1: { s: [bar(1000, 1)] } }] },
        { m: "series_completed", p: ["cs", "sds_1", "s", "s1", { data_completed: "end" }] },
      ),
    ]);
    const out = await run(skill, { symbols: ["FRED:X"], from: "1970-01-01" });
    const data = out.expectSuccess() as { insights: string[] };
    assert.ok(
      data.insights.some((i) => i.includes("最早可用数据") && i.includes("非采集失败")),
      "★ 数据边界必须与采集失败区分，否则 Agent 会以为数据不全",
    );
  });

  test("maxRounds 截断时明确告知未覆盖到 from", async () => {
    const { skill } = historySkill([
      batch(
        { m: "timescale_update", p: ["cs", { sds_1: { s: [bar(9_000_000, 1)] } }] },
        { m: "series_completed", p: ["cs", "sds_1", "s", "s1", {}] },
      ),
      batch(
        { m: "timescale_update", p: ["cs", { sds_1: { s: [bar(8_000_000, 1)] } }] },
        { m: "series_completed", p: ["cs", "sds_1", "s", "s1", {}] },
      ),
    ]);
    const out = await run(skill, { symbols: ["X:A"], from: 1000, maxRounds: 2 });
    const data = out.expectSuccess() as {
      insights: string[];
      items: Array<{ truncatedByMaxRounds: boolean }>;
    };
    assert.equal(data.items[0].truncatedByMaxRounds, true);
    assert.ok(
      data.insights.some((i) => i.includes("未覆盖到请求的起始时间")),
      "★ 截断必须显式告知，否则用户以为拿到了完整区间",
    );
  });

  test("单标的失败不拖垮整批（部分成功优于全盘失败）", async () => {
    // 第一个标的触发 symbol_error，第二个正常
    const { skill } = historySkill([
      batch({ m: "symbol_error", p: ["cs", "sym_1", "bad"] }),
      batch(
        { m: "timescale_update", p: ["cs", { sds_1: { s: [bar(1000, 5)] } }] },
        { m: "series_completed", p: ["cs", "sds_1", "s", "s1", { data_completed: "end" }] },
      ),
    ]);
    const out = await run(skill, { symbols: ["X:BAD", "X:GOOD"] });
    const data = out.expectSuccess() as {
      items: Array<{ ticker: string; status: string; errorReason: string | null }>;
    };
    assert.equal(data.items.length, 2);
    assert.equal(data.items[0].status, "error");
    assert.ok(data.items[0].errorReason, "失败原因要落到条目上");
    assert.equal(data.items[1].status, "ok", "★ 后续标的不该被前一个的失败影响");
  });

  test("includeBars=false 时省略明细但保留统计", async () => {
    const { skill } = historySkill([
      batch(
        { m: "timescale_update", p: ["cs", { sds_1: { s: [bar(1000, 1), bar(2000, 2)] } }] },
        { m: "series_completed", p: ["cs", "sds_1", "s", "s1", { data_completed: "end" }] },
      ),
    ]);
    const out = await run(skill, { symbols: ["X:A"], includeBars: false });
    const data = out.expectSuccess() as {
      items: Array<{ bars?: unknown[]; barCount: number; stats: { last: number } }>;
    };
    assert.equal(data.items[0].bars, undefined, "不该返回明细");
    assert.equal(data.items[0].barCount, 2, "但计数与统计要保留");
    assert.equal(data.items[0].stats.last, 2);
  });
});

describe("tv-history 复权口径 —— 价格字段的前提", () => {
  const bar = (t: number, c: number) => ({ i: 0, v: [t, c, c, c, c] });

  type AdjItem = {
    ticker: string;
    adjustment: {
      requested: string;
      effective: string | null;
      allowed: string | null;
      semantics: string;
      ignored: boolean;
    };
  };

  /** 造一批带 symbol_resolved 的正常序列 */
  function seriesBatch(resolved: object) {
    return batch(
      { m: "symbol_resolved", p: ["cs", "sym_1", resolved] },
      { m: "timescale_update", p: ["cs", { sds_1: { s: [bar(1000, 10), bar(2000, 12)] } }] },
      { m: "series_completed", p: ["cs", "sds_1", "s", "s1", { data_completed: "end" }] },
    );
  }

  test("默认口径是上游的 splits，且 meta 显式回显", async () => {
    const { skill } = historySkill([
      seriesBatch({ description: "X", adjustment: "splits", allowed_adjustment: "any" }),
    ]);
    const out = await run(skill, { symbols: ["SSE:601398"] });
    const data = out.expectSuccess() as {
      meta: { adjustment: string; semantics: string };
      items: AdjItem[];
    };
    assert.equal(data.meta.adjustment, "splits");
    assert.equal(data.items[0].adjustment.effective, "splits");
    assert.equal(data.items[0].adjustment.ignored, false);
  });

  test("★ splits 的语义必须点明不含分红（最易被误读成 A 股的前复权）", async () => {
    const { skill } = historySkill([
      seriesBatch({ description: "X", adjustment: "splits", allowed_adjustment: "any" }),
    ]);
    const out = await run(skill, { symbols: ["SSE:601398"] });
    const data = out.expectSuccess() as {
      meta: { semantics: string };
      insights: string[];
      items: AdjItem[];
    };
    assert.match(data.items[0].adjustment.semantics, /不含现金分红/);
    assert.match(data.meta.semantics, /不含现金分红/);
    assert.ok(
      data.insights.some((s) => /不含现金分红/.test(s)),
      "insights 是 Agent 优先读的位置，口径必须出现在这里",
    );
  });

  test("dividends 口径透传并回显生效值", async () => {
    const { skill } = historySkill([
      seriesBatch({ description: "X", adjustment: "dividends", allowed_adjustment: "any" }),
    ]);
    const out = await run(skill, {
      symbols: ["SSE:601398"],
      adjustment: "dividends",
    });
    const data = out.expectSuccess() as { items: AdjItem[]; insights: string[] };
    assert.equal(data.items[0].adjustment.effective, "dividends");
    assert.equal(data.items[0].adjustment.ignored, false);
    assert.match(data.items[0].adjustment.semantics, /含现金分红/);
  });

  test("★ 无复权概念的标的：请求被忽略必须显式告知，不能假装复权了", async () => {
    const { skill } = historySkill([
      seriesBatch({ description: "上证综指", allowed_adjustment: "none" }),
    ]);
    const out = await run(skill, {
      symbols: ["SSE:000001"],
      adjustment: "dividends",
    });
    const data = out.expectSuccess() as { items: AdjItem[]; insights: string[] };
    assert.equal(data.items[0].adjustment.ignored, true);
    assert.match(
      data.items[0].adjustment.semantics,
      /无复权概念/,
      "★ 被忽略时 semantics 不能报请求口径的语义 —— 会与实际价格矛盾",
    );
    assert.ok(
      !/含现金分红/.test(data.items[0].adjustment.semantics),
      "★ 未复权的价格不得被描述成含分红复权",
    );
    assert.ok(
      data.insights.some((s) => /未采纳/.test(s)),
      "被忽略必须进 insights —— 否则 Agent 会按请求口径解释价格",
    );
  });

  test("上游未回显时不判定为忽略（未回显 ≠ 被忽略，宁可不报也不误报）", async () => {
    const { skill } = historySkill([seriesBatch({ description: "X" })]);
    const out = await run(skill, { symbols: ["X:A"], adjustment: "dividends" });
    const data = out.expectSuccess() as { items: AdjItem[] };
    assert.equal(data.items[0].adjustment.effective, null);
    assert.equal(data.items[0].adjustment.ignored, false);
  });

  test("上游给未登记的口径时不编造语义", async () => {
    const { skill } = historySkill([
      seriesBatch({ description: "X", adjustment: "some_new_mode", allowed_adjustment: "any" }),
    ]);
    const out = await run(skill, { symbols: ["X:A"] });
    const data = out.expectSuccess() as { items: AdjItem[] };
    assert.match(data.items[0].adjustment.semantics, /未登记/);
  });

  test("adjustment 只校验形状不做白名单 —— 未列出的取值放行给上游判定", () => {
    const { skill } = historySkill([]);
    const p = testing.invokeNormalize(skill as never, {
      symbols: ["X:A"],
      adjustment: "some_future_mode",
    }) as { adjustment: string };
    assert.equal(
      p.adjustment,
      "some_future_mode",
      "★ 枚举归上游定义（CLAUDE.md §3.6）——不得退化成白名单拦截",
    );
  });

  test("形状非法（含注入字符）被拦截", () => {
    const { skill } = historySkill([]);
    assert.throws(
      () =>
        testing.invokeNormalize(skill as never, {
          symbols: ["X:A"],
          adjustment: '"},{"x":1',
        }),
      (e: SpiderError) => {
        assert.equal(e.kind, "invalid-params");
        return true;
      },
    );
  });
});

describe("生命周期阶段 —— 真机踩坑的回归守护", () => {  /**
   * 回归守护：建连一度挂在 `@Setup`，而框架阶段顺序是
   * `setup → navigate → ready → fetchData` —— setup 跑在导航**之前**，
   * 页面还是 about:blank，没有 Origin，WS 握手被上游直接拒绝。
   *
   * 真机表现为 `WebSocket error event` 重试三次全败；单测抓不到
   * （假 transport 不关心页面 URL）。因此这里改为断言**装饰器注册的阶段名**。
   */
  test("建连必须注册在 ready 阶段（不是 setup）", async () => {
    const { getMethodHooks } = await import("@spider/core");
    const hooks = getMethodHooks(TvQuoteSnapshotSkill);
    const open = hooks.find((h) => h.method === "openWsChannel");
    const close = hooks.find((h) => h.method === "closeWsChannel");

    assert.ok(open, "openWsChannel 必须注册为生命周期 hook");
    assert.equal(
      open?.stage,
      "ready",
      "★ 必须是 ready —— setup 跑在导航前，页面还是 about:blank，WS 握手会被拒",
    );
    assert.equal(close?.stage, "teardown", "释放必须在 teardown，保证必然执行");
  });

  test("两个 WS Skill 都遵循同一阶段约定", async () => {
    const { getMethodHooks } = await import("@spider/core");
    for (const ctor of [TvQuoteSnapshotSkill, TvHistorySeriesSkill]) {
      const stages = getMethodHooks(ctor).map((h) => `${String(h.method)}:${h.stage}`);
      assert.ok(stages.includes("openWsChannel:ready"), `${ctor.name} 建连阶段错误`);
      assert.ok(stages.includes("closeWsChannel:teardown"), `${ctor.name} 释放阶段错误`);
    }
  });
});
