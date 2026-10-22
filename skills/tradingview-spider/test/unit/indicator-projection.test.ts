/**
 * 指标投影层单测 —— 纯函数，锁定对外信封契约
 *
 * 重点守护三条**面向 Agent 的语义**（错了不会崩，但会让 Agent 误读数据）：
 *   ① plots 必须回显 —— 它是 points[].v 位置数组的唯一解码键
 *   ② null 必须说成「该根无值」而非「数据缺失/采集失败」
 *   ③ 付费边界必须在 insights 里讲清 —— 否则 Agent 反复挑到付费指标
 */
import { test, describe } from "vitest";
import assert from "node:assert/strict";
import { projectStudyAiReady } from "@src/projections/indicator.ai-ready";
import { projectStudyCatalogAiReady } from "@src/projections/indicator-catalog.ai-ready";
import type { TvStudyResult, TvStudySeries } from "@src/types/indicator.types";
import type { TvStudyCatalogResult } from "@src/types/indicator.types";

const emptyDiag = {
  rounds: 1,
  drainCalls: 1,
  droppedFrames: 0,
  unknownMessageKinds: [],
  sessionId: "internal-only",
};

function series(over: Partial<TvStudySeries> = {}): TvStudySeries {
  return {
    ticker: "NASDAQ:AAPL",
    pineId: "STD;Aroon_Oscillator",
    pineVersion: "1.0",
    resolution: "1D",
    status: "ok",
    studyMeta: {
      name: "Aroon Oscillator",
      shortName: "Aroon Osc",
      isPriceStudy: false,
      historyMayRepaint: false,
    },
    symbolMeta: null,
    plots: [
      { id: "plot_0", type: "line", title: "Oscillator", target: null },
      { id: "plot_1", type: "colorer", title: null, target: "plot_0" },
    ],
    inputs: [
      { id: "in_0", name: "Length", type: "integer", value: 14, defaultValue: 14 },
    ],
    points: [
      { time: 1_700_000_000, values: [50, 0] },
      { time: 1_700_086_400, values: [60, 1] },
    ],
    errorReason: null,
    ...over,
  };
}

function result(over: Partial<TvStudyResult> = {}): TvStudyResult {
  return {
    query: {
      symbols: ["NASDAQ:AAPL"],
      pineId: "STD;Aroon_Oscillator",
      pineVersion: "1.0",
      resolution: "1D",
      bars: 300,
      timezone: "Etc/UTC",
      includePoints: true,
      inputOverrides: {},
    },
    series: [series()],
    diagnostics: emptyDiag,
    crawledAt: new Date("2026-07-30T00:00:00Z"),
    ...over,
  };
}

describe("tv-indicator 信封", () => {
  test("meta 必填字段齐全，semantics 说清口径", () => {
    const out = projectStudyAiReady(result());
    assert.equal(out.meta.skill, "tv-indicator");
    assert.ok(out.meta.semantics.length > 0, "semantics 必填（Agent 回写只许用这个口径）");
    assert.match(out.meta.pointSchema, /t=Unix秒/, "必须声明 point 布局");
    assert.equal(out.meta.okCount, 1);
    assert.equal(out.meta.totalPoints, 2);
  });

  test("★ plots 原样回显（v 数组的唯一解码键）", () => {
    const out = projectStudyAiReady(result());
    assert.deepEqual(out.items[0].plots, [
      { id: "plot_0", type: "line", title: "Oscillator", target: null },
      { id: "plot_1", type: "colorer", title: null, target: "plot_0" },
    ]);
  });

  test("★ 诊断不泄露 sessionId（上游集群拓扑）", () => {
    const out = projectStudyAiReady(result());
    const json = JSON.stringify(out);
    assert.equal(json.includes("internal-only"), false, "sessionId 绝不进对外信封");
  });

  test("points 紧凑为 {t,v}，不逐根附 ISO 串", () => {
    const out = projectStudyAiReady(result());
    assert.deepEqual(out.items[0].points, [
      { t: 1_700_000_000, v: [50, 0] },
      { t: 1_700_086_400, v: [60, 1] },
    ]);
    // 人读锚点由 range 提供
    assert.ok(out.items[0].range.fromISO?.startsWith("2023-"));
  });

  test("includePoints=false 省略明细但保留末值与计数", () => {
    const r = result();
    r.query.includePoints = false;
    const out = projectStudyAiReady(r);
    assert.equal(out.items[0].points, undefined);
    assert.equal(out.items[0].pointCount, 2, "计数要保留");
    assert.ok(out.items[0].latest.length > 0, "末值要保留");
  });

  test("★ bg_colorer 等新增染色类型也被排除（真机发现的第 5 种 type）", () => {
    /**
     * 回归守护：HAR 只见过 4 种 plot.type（line/colorer/shapes/alertcondition），
     * 真机跑 K 线形态类指标时冒出了 `bg_colorer`（背景染色）。
     * 用白名单会把它误当指标值报给用户，故改为排除法
     * （凡 *colorer / alertcondition 都不是业务数值）。
     */
    const out = projectStudyAiReady(
      result({
        series: [
          series({
            plots: [
              { id: "plot_0", type: "alertcondition", title: "New pattern", target: null },
              { id: "plot_1", type: "bg_colorer", title: "Background Color", target: null },
              { id: "plot_2", type: "line", title: "真数值", target: null },
            ],
            points: [{ time: 1000, values: [0, null, 7] }],
          }),
        ],
      }),
    );
    const ids = out.items[0].latest.map((l) => l.plotId);
    assert.deepEqual(
      ids,
      ["plot_2"],
      "★ 只有 line 是数值；bg_colorer 与 alertcondition 都要排除",
    );
  });

  test("latest 只取数值型通道，且跳过末尾的 null", () => {
    const out = projectStudyAiReady(
      result({
        series: [
          series({
            points: [
              { time: 1000, values: [42, 0] },
              // 末根未收敛（常见于均线/背离类），应往前找
              { time: 2000, values: [null, 1] },
            ],
          }),
        ],
      }),
    );
    const latest = out.items[0].latest;
    assert.equal(latest.length, 1, "★ colorer 是调色板索引，不该当业务数值展示");
    assert.equal(latest[0].plotId, "plot_0");
    assert.equal(latest[0].value, 42, "★ 末根为 null 时要回溯到最近的有值点");
  });

  test("★ insights 把 null 说成「该根无值」而非数据缺失", () => {
    const out = projectStudyAiReady(result());
    const joined = out.insights.join("\n");
    assert.match(joined, /null 表示该通道在这根 K 线上无值/);
    assert.match(joined, /不是数据缺失或采集失败/, "★ 必须与采集失败区分");
  });

  test("insights 给出 v 数组的逐位含义（多通道时）", () => {
    const out = projectStudyAiReady(result());
    const joined = out.insights.join("\n");
    assert.match(joined, /v\[0\]=Oscillator/, "要说明每个下标对应哪根线");
    assert.match(joined, /colorer/, "要提醒 colorer 非业务数值");
  });

  test("repaint 类指标在 insights 中告警", () => {
    const out = projectStudyAiReady(
      result({
        series: [
          series({
            studyMeta: {
              name: "X", shortName: null, isPriceStudy: false,
              historyMayRepaint: true,
            },
          }),
        ],
      }),
    );
    assert.ok(
      out.insights.some((i) => i.includes("repaint")),
      "历史值会被重算的指标必须告警，否则回测结果无法复现",
    );
  });

  test("全部失败时给出分步排查引导", () => {
    const out = projectStudyAiReady(
      result({
        series: [series({ status: "error", points: [], errorReason: "boom" })],
      }),
    );
    const joined = out.insights.join("\n");
    assert.match(joined, /tv-indicator-list/, "要引导核对 pineId");
    assert.match(joined, /tv-search/, "要引导核对 ticker");
    assert.match(joined, /boom/, "上游原因要带出");
  });

  test("参数被自定义时在 insights 中标注", () => {
    const out = projectStudyAiReady(
      result({
        series: [
          series({
            inputs: [
              { id: "in_0", name: "Length", type: "integer", value: 21, defaultValue: 14 },
            ],
          }),
        ],
      }),
    );
    assert.ok(
      out.insights.some((i) => i.includes("已自定义")),
      "让 Agent 知道当前用的不是默认参数",
    );
  });
});

// ============================================================================

function catalogResult(over: Partial<TvStudyCatalogResult> = {}): TvStudyCatalogResult {
  return {
    query: {
      categories: ["standard"],
      keyword: null,
      accessFilter: null,
      kind: null,
      limit: 60,
    },
    items: [
      {
        pineId: "STD;RSI", name: "Relative Strength Index", shortName: "RSI",
        version: "30.0", access: "free", accessRaw: "open_no_auth",
        kind: "study", isPriceStudy: false, plotCount: 1, category: "standard",
        fundamentalCategory: null, financialPeriod: null, tags: [],
      },
      {
        pineId: "STD;Auto_Key_Levels", name: "Auto Key Levels", shortName: null,
        version: "1.0", access: "restricted", accessRaw: "closed_no_auth",
        kind: "study", isPriceStudy: true, plotCount: 2, category: "standard",
        fundamentalCategory: null, financialPeriod: null, tags: [],
      },
    ],
    categoryCounts: { standard: 145 },
    totalBeforeFilter: 145,
    truncatedCount: 0,
    crawledAt: new Date("2026-07-30T00:00:00Z"),
    ...over,
  };
}

describe("tv-indicator-list 信封", () => {
  test("meta 统计免费/付费分布，并标注 ID 命名空间", () => {
    const out = projectStudyCatalogAiReady(catalogResult());
    assert.equal(out.meta.freeCount, 1);
    assert.equal(out.meta.restrictedCount, 1);
    assert.equal(out.meta.idNamespace, "tv-study-pine-id");
    assert.ok(out.meta.idConsumers.includes("tv-indicator.pineId"), "要指明下游消费点");
  });

  test("★ insights 讲清付费边界并建议优先选免费", () => {
    const out = projectStudyCatalogAiReady(catalogResult());
    const joined = out.insights.join("\n");
    assert.match(joined, /需付费权限/);
    assert.match(joined, /优先选 free/, "★ 否则 Agent 会反复挑到付费指标然后失败");
  });

  test("insights 直接列出可用的 pineId → 名称（Agent 常直接从这挑）", () => {
    const out = projectStudyCatalogAiReady(catalogResult());
    assert.ok(
      out.insights.some((i) => i.includes("STD;RSI") && i.includes("Relative Strength Index")),
    );
  });

  test("fundamental 分组的全付费事实单独强调", () => {
    const r = catalogResult();
    r.query.categories = ["fundamental"];
    const out = projectStudyCatalogAiReady(r);
    assert.ok(
      out.insights.some((i) => i.includes("全部需要付费权限")),
      "1442 条全付费，不说清会让用户白跑",
    );
  });

  test("零命中时给出可执行的补救建议", () => {
    const out = projectStudyCatalogAiReady(
      catalogResult({ items: [], query: {
        categories: ["standard"], keyword: "zzz", accessFilter: null, kind: null, limit: 60,
      } }),
    );
    const joined = out.insights.join("\n");
    assert.match(joined, /zzz/, "要回显用户的关键词");
    assert.match(joined, /RSI|MACD/, "要给关键词示例");
  });

  test("截断时告知还剩多少条", () => {
    const out = projectStudyCatalogAiReady(catalogResult({ truncatedCount: 80 }));
    assert.ok(out.insights.some((i) => i.includes("80") && i.includes("limit")));
  });
});
