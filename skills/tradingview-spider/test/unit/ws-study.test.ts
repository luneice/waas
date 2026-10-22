/**
 * 指标（study）协议单测
 *
 * 重点守护三处**结果上看不出来 / 只在真机暴露**的错误：
 *   ① `inputs` 的两种包装形态混用（裸串 vs {v,f,t}）—— 包错上游直接拒绝
 *   ② `1e+100` 哨兵未归一 —— 会把 min/max 统计污染成天文数字
 *   ③ `du` 取错数据键（`s` vs `st`）—— 静默丢全部数据，表现为"指标算不出来"
 */
import { test, describe } from "vitest";
import assert from "node:assert/strict";
import { SpiderError } from "@spider/core";
import { TvWsClient, buildStudyInputs, type StudyRequest } from "@src/ws/client";
import { STUDY_SCRIPT_SHELL, makeSessionId } from "@src/ws/messages";
import { FakeTvTransport, batch } from "../fixtures/fake-transport";

const OPTS = { scope: "test" };
const fixedRand = () => 0.5;

function parseFrame(f: string): { m: string; p: unknown[] } {
  const idx = f.indexOf("~m~", 3);
  return JSON.parse(idx === -1 ? f : f.slice(idx + 3));
}

/**
 * 固定随机源下 `makeSessionId` 产出的 studyId。
 *
 * 刻意不硬编码字面量：那是实现细节（字母表 + 取整方式），改一处就会让
 * 所有解码用例集体失败且原因难查。这里从同一个生成器算出来。
 */
const STUDY_ID = makeSessionId("st", fixedRand);

async function connected(t: FakeTvTransport): Promise<TvWsClient> {
  const c = new TvWsClient(t, { ...OPTS, rand: fixedRand });
  await c.connect(5000);
  return c;
}

const baseReq: StudyRequest = {
  ticker: "NASDAQ:AAPL",
  resolution: "1D",
  bars: 300,
  timezone: "Etc/UTC",
  timeoutMs: 5000,
  ilTemplate: "COMPILED_SCRIPT_BLOB",
  pineId: "STD;Aroon_Oscillator",
  pineVersion: "1.0",
  pineFeatures: '{"indicator":1}',
  inputs: [
    { id: "in_0", type: "integer", value: 14 },
    { id: "in_1", type: "resolution", value: "" },
  ],
};

describe("buildStudyInputs —— 两种包装形态不可混用", () => {
  test("text / pineId / pineVersion 是裸字符串（包成三元组会被上游拒绝）", () => {
    const inputs = buildStudyInputs(baseReq);
    assert.equal(inputs.text, "COMPILED_SCRIPT_BLOB", "★ 必须是裸串");
    assert.equal(inputs.pineId, "STD;Aroon_Oscillator", "★ 必须是裸串");
    assert.equal(inputs.pineVersion, "1.0", "★ 必须是裸串");
  });

  test("pineFeatures / in_N / 控制位是 {v,f,t} 三元组", () => {
    const inputs = buildStudyInputs(baseReq);
    assert.deepEqual(inputs.pineFeatures, {
      v: '{"indicator":1}',
      f: true,
      t: "text",
    });
    assert.deepEqual(inputs.in_0, { v: 14, f: true, t: "integer" });
    assert.deepEqual(inputs.in_1, { v: "", f: true, t: "resolution" });
    assert.deepEqual(inputs.__fast_calc, { v: false, f: true, t: "bool" });
    assert.deepEqual(inputs.__profile, { v: false, f: true, t: "bool" });
  });

  test("in_N 按数组顺序编号（不是按 id 字符串排序）", () => {
    const inputs = buildStudyInputs({
      ...baseReq,
      // 故意给乱序 id，验证编号只认位置
      inputs: [
        { id: "zzz", type: "float", value: 1.5 },
        { id: "aaa", type: "bool", value: true },
      ],
    });
    assert.deepEqual(inputs.in_0, { v: 1.5, f: true, t: "float" });
    assert.deepEqual(inputs.in_1, { v: true, f: true, t: "bool" });
  });

  test("pineFeatures 缺失时不写该键（而非写 null）", () => {
    const inputs = buildStudyInputs({ ...baseReq, pineFeatures: null });
    assert.equal("pineFeatures" in inputs, false);
  });
});

describe("study —— 消息时序与 create_study 结构", () => {
  test("按 chart→timezone→resolve→series→study 顺序发出", async () => {
    const t = new FakeTvTransport([
      batch(
        { m: "timescale_update", p: ["cs", { sds_1: { s: [] } }] },
        { m: "du", p: ["cs", { [STUDY_ID]: { st: [{ i: 0, v: [1000, 42] }] } }] },
        { m: "study_completed", p: ["cs", STUDY_ID, "s1_st1"] },
      ),
    ]);
    const c = await connected(t);
    await c.study(baseReq);

    const names = t.sentFrames.map((f) => parseFrame(f).m);
    assert.deepEqual(names, [
      "chart_create_session",
      "switch_timezone",
      "resolve_symbol",
      "create_series",
      "create_study",
    ]);
  });

  test("create_study 的 6 个位置参数就位，外壳为 Script 而非 pineId", async () => {
    const t = new FakeTvTransport([
      batch(
        { m: "du", p: ["cs", { [STUDY_ID]: { st: [{ i: 0, v: [1000, 1] }] } }] },
        { m: "study_completed", p: ["cs", STUDY_ID, "s1_st1"] },
      ),
    ]);
    const c = await connected(t);
    await c.study(baseReq);

    const msg = t.sentFrames.map(parseFrame).find((m) => m.m === "create_study");
    assert.ok(msg, "必须发出 create_study");
    // [0]=会话 [1]=studyId [2]=位置标签 [3]=父series [4]=外壳 [5]=inputs
    assert.equal(msg!.p[2], "st1");
    assert.equal(msg!.p[3], "sds_1", "必须挂在 create_series 建的序列上");
    assert.equal(
      msg!.p[4],
      STUDY_SCRIPT_SHELL,
      "★ 第 5 个参数是固定外壳，真实指标身份在 inputs.pineId 里",
    );
    const inputs = msg!.p[5] as Record<string, unknown>;
    assert.equal(inputs.pineId, "STD;Aroon_Oscillator");
  });
});

describe("study —— 数值解码", () => {
  const studyKey = STUDY_ID;

  test("v[0] 是时间戳，v[1..] 按 plots 顺序落进 values", async () => {
    const t = new FakeTvTransport([
      batch(
        {
          m: "du",
          p: ["cs", { [studyKey]: { st: [
            { i: 0, v: [1000, 10, 20, 30] },
            { i: 1, v: [2000, 11, 21, 31] },
          ] } }],
        },
        { m: "study_completed", p: ["cs", studyKey, "s1_st1"] },
      ),
    ]);
    const c = await connected(t);
    const out = await c.study(baseReq);

    assert.equal(out.points.length, 2);
    assert.deepEqual(out.points[0], { time: 1000, values: [10, 20, 30] });
    assert.deepEqual(out.points[1], { time: 2000, values: [11, 21, 31] });
  });

  test("★ 1e+100 哨兵归一为 null（当真实值会污染统计）", async () => {
    const t = new FakeTvTransport([
      batch(
        {
          m: "du",
          p: ["cs", { [studyKey]: { st: [{ i: 0, v: [1000, 1e100, 42, 1e100] }] } }],
        },
        { m: "study_completed", p: ["cs", studyKey, "s1_st1"] },
      ),
    ]);
    const c = await connected(t);
    const out = await c.study(baseReq);
    assert.deepEqual(
      out.points[0].values,
      [null, 42, null],
      "★ 1e+100 是 NaN 的替代表示，不是天文数字",
    );
  });

  test("★ 只认 st 键，不误读父 series 的 s 键", async () => {
    const t = new FakeTvTransport([
      batch(
        // 同一条 du 同时带父 series（键 s）与 study（键 st）
        {
          m: "du",
          p: ["cs", {
            sds_1: { s: [{ i: 0, v: [1000, 9, 9, 9, 9] }] },
            [studyKey]: { st: [{ i: 0, v: [1000, 77] }] },
          }],
        },
        { m: "study_completed", p: ["cs", studyKey, "s1_st1"] },
      ),
    ]);
    const c = await connected(t);
    const out = await c.study(baseReq);
    assert.equal(out.points.length, 1);
    assert.deepEqual(
      out.points[0].values,
      [77],
      "★ 必须取 study 的 st，取错键会静默丢全部数据",
    );
  });

  test("按 time 去重（同 K 线的重复推送取后到的）", async () => {
    const t = new FakeTvTransport([
      batch({
        m: "du",
        p: ["cs", { [studyKey]: { st: [
          { i: 0, v: [1000, 1] },
          { i: 0, v: [1000, 2] },
        ] } }],
      }),
      batch(
        { m: "du", p: ["cs", { [studyKey]: { st: [{ i: 0, v: [1000, 3] }] } }] },
        { m: "study_completed", p: ["cs", studyKey, "s1_st1"] },
      ),
    ]);
    const c = await connected(t);
    const out = await c.study(baseReq);
    assert.equal(out.points.length, 1, "同一时间戳只保留一个点");
    assert.deepEqual(out.points[0].values, [3], "取最后到达的值");
  });

  test("points 按时间升序（上游可能乱序推）", async () => {
    const t = new FakeTvTransport([
      batch(
        {
          m: "du",
          p: ["cs", { [studyKey]: { st: [
            { i: 2, v: [3000, 3] },
            { i: 0, v: [1000, 1] },
            { i: 1, v: [2000, 2] },
          ] } }],
        },
        { m: "study_completed", p: ["cs", studyKey, "s1_st1"] },
      ),
    ]);
    const c = await connected(t);
    const out = await c.study(baseReq);
    assert.deepEqual(out.points.map((p) => p.time), [1000, 2000, 3000]);
  });
});

describe("鉴权注入 —— 真机踩坑的回归守护", () => {
  /**
   * 真机实测：未登录会话下 HTTP 编译能成功、但 WS create_study 被拒
   * （`Study not allowed in this connection`）。故指标链路必须带真实登录 token，
   * 且 token 只能在**页面内**取用（CLAUDE.md §4.6：凭据不出 Node）。
   */
  test("requireAuth=true 时把占位串交给页面侧替换", async () => {
    const t = new FakeTvTransport([]);
    const c = new TvWsClient(t, { ...OPTS, rand: fixedRand });
    await c.connect(5000, true);
    assert.equal(
      t.authTokenPlaceholder,
      "unauthorized_user_token",
      "★ 占位串必须传下去，页面侧据它定位并替换成真实 token",
    );
    assert.equal(c.hasAuth, true);
  });

  test("requireAuth=false（行情/K线）不启用替换", async () => {
    const t = new FakeTvTransport([]);
    const c = new TvWsClient(t, { ...OPTS, rand: fixedRand });
    await c.connect(5000);
    assert.equal(t.authTokenPlaceholder, undefined, "游客态够用，不必碰 token");
    assert.equal(c.hasAuth, false);
  });

  test("页面未登录时 hasAuth=false（供上层快速失败）", async () => {
    const t = new FakeTvTransport([], /* authInjected */ false);
    const c = new TvWsClient(t, { ...OPTS, rand: fixedRand });
    await c.connect(5000, true);
    assert.equal(c.hasAuth, false, "★ 上层据此给出「请先登录」而非逐个标的失败");
  });
});

describe("study —— 错误处置", () => {

  test("study_error 抛错并带出上游原因（不臆断成因）", async () => {
    const t = new FakeTvTransport([
      batch({
        m: "study_error",
        p: ["cs", "st_x", "s1_st1", "Study not allowed in this connection"],
      }),
    ]);
    const c = await connected(t);
    await assert.rejects(
      () => c.study(baseReq),
      (e: SpiderError) => {
        assert.match(e.message, /Study not allowed/, "上游原因要带出来");
        assert.match(e.message, /付费权限/, "要给出可执行的排查方向");
        return true;
      },
    );
  });

  test("symbol_error 抛错并指向 ticker/resolution", async () => {
    const t = new FakeTvTransport([
      batch({ m: "symbol_error", p: ["cs", "sym_1", "bad symbol"] }),
    ]);
    const c = await connected(t);
    await assert.rejects(
      () => c.study(baseReq),
      (e: SpiderError) => {
        assert.match(e.message, /NASDAQ:AAPL/);
        return true;
      },
    );
  });

  test("父 series 的噪声消息不计入 unknownMessageKinds", async () => {
    const t = new FakeTvTransport([
      batch(
        { m: "series_loading", p: ["cs", "sds_1"] },
        { m: "timescale_update", p: ["cs", { sds_1: { s: [] } }] },
        { m: "series_completed", p: ["cs", "sds_1", "s", "s1", {}] },
        { m: "study_loading", p: ["cs", STUDY_ID, "s1_st1"] },
        { m: "du", p: ["cs", { [STUDY_ID]: { st: [{ i: 0, v: [1000, 1] }] } }] },
        { m: "study_completed", p: ["cs", STUDY_ID, "s1_st1"] },
      ),
    ]);
    const c = await connected(t);
    const out = await c.study(baseReq);
    assert.deepEqual(
      out.diagnostics.unknownMessageKinds,
      [],
      "父 series 的消息是预期噪声，不该报为协议漂移",
    );
  });
});
