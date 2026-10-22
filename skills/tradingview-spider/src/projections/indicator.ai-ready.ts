/**
 * 指标数值序列 —— AI-Ready 信封
 *
 * ══════════════ 两个必须由投影层讲清的语义 ══════════════
 *
 * ① **plots 是解码键**：`points[].v` 是位置数组，不带字段名。丢了 plots
 *    就再也对不上「哪个数是哪根线」。因此 plots 必须原样回显，且 insights 里
 *    要把 line 型通道的末值直接算好（Agent 最常问的就是「现在 RSI 多少」）。
 *
 * ② **null 有两种来源但对外统一**：上游哨兵 `1e+100`（该根 K 线无值，如均线
 *    在头部若干根还没算出来）已在 client 层归一为 null。绝不能说成「数据缺失」。
 *
 * 与 history 一致：point 保持紧凑 `{t,v}`，不逐根附 ISO 时间串。
 */

import { fromUnixSec, isoTime, num, toDateStr } from "@src/projections/envelope";
import { ID_NAMESPACES, ID_NAMESPACE_INFO } from "@src/projections/id-namespace";
import type { TvStudyResult, TvStudySeries } from "@src/types/indicator.types";
import type {
  TvStudyItemProjected,
  TvStudyMeta,
  TvStudyProjected,
} from "@src/types/projected.types";

/**
 * 非数值通道类型 —— 用**排除法**而非白名单（CLAUDE.md §3.6）。
 *
 * 上游的 plot.type 是开放集合：HAR 只见过 4 种（line/colorer/shapes/
 * alertcondition），真机跑 K 线形态类指标时又出现了第 5 种 `bg_colorer`
 * （背景染色）。若用「白名单里的才算数值」，每出一个新染色类型就会被误当
 * 指标值报给用户；反过来用「已知的非数值类型才排除」，新增的绘图类型
 * 最坏只是多展示一列，不会造成错误结论。
 *
 * 判据：凡 `*colorer`（染色）与 `alertcondition`（提醒规则）都不是业务数值。
 */
function isValuePlot(type: string): boolean {
  return !type.endsWith("colorer") && type !== "alertcondition";
}

/**
 * 取每个数值型通道的最后一个非空值。
 *
 * 不能简单取最后一根 K 线 —— 部分指标末根尚未收敛（值为 null），
 * 往前找第一个有值的才是「当前值」。
 */
function computeLatest(series: TvStudySeries): TvStudyItemProjected["latest"] {
  const out: TvStudyItemProjected["latest"] = [];
  series.plots.forEach((plot, index) => {
    if (!isValuePlot(plot.type)) return;
    let value: number | null = null;
    for (let i = series.points.length - 1; i >= 0; i--) {
      const v = series.points[i].values[index];
      if (v !== null && v !== undefined) {
        value = v;
        break;
      }
    }
    out.push({ plotId: plot.id, title: plot.title, value });
  });
  return out;
}

function projectItem(
  series: TvStudySeries,
  includePoints: boolean,
): TvStudyItemProjected {
  const points = series.points;
  const item: TvStudyItemProjected = {
    ticker: series.ticker,
    pineId: series.pineId,
    pineVersion: series.pineVersion,
    resolution: series.resolution,
    status: series.status,
    studyMeta: series.studyMeta
      ? {
          name: series.studyMeta.name,
          shortName: series.studyMeta.shortName,
          isPriceStudy: series.studyMeta.isPriceStudy,
          historyMayRepaint: series.studyMeta.historyMayRepaint,
        }
      : null,
    symbolMeta: series.symbolMeta
      ? {
          description: series.symbolMeta.description,
          assetType: series.symbolMeta.assetType,
          timezone: series.symbolMeta.timezone,
          currency: series.symbolMeta.currency,
        }
      : null,
    plots: series.plots.map((p) => ({
      id: p.id,
      type: p.type,
      title: p.title,
      target: p.target,
    })),
    inputs: series.inputs.map((i) => ({
      id: i.id,
      name: i.name,
      type: i.type,
      value: i.value,
      defaultValue: i.defaultValue,
    })),
    range: {
      fromTime: points.length > 0 ? points[0].time : null,
      toTime: points.length > 0 ? points[points.length - 1].time : null,
      fromISO: points.length > 0 ? fromUnixSec(points[0].time) : null,
      toISO:
        points.length > 0 ? fromUnixSec(points[points.length - 1].time) : null,
    },
    pointCount: points.length,
    latest: computeLatest(series),
    errorReason: series.errorReason,
  };

  if (includePoints) {
    item.points = points.map((p) => ({ t: p.time, v: p.values }));
  }
  return item;
}

function buildStudyInsights(
  items: TvStudyItemProjected[],
  result: TvStudyResult,
): string[] {
  const out: string[] = [];
  const ok = items.filter((i) => i.status === "ok" && i.pointCount > 0);
  const q = result.query;

  if (ok.length === 0) {
    out.push(
      `指标 ${q.pineId} 未在任何标的上取到数据（请求 ${q.symbols.length} 个标的）。` +
        `排查顺序：① 用 tv-indicator-list 确认 pineId 存在且 access=free；` +
        `② 用 tv-search 确认 ticker 正确；③ 确认 resolution 受该标的支持。`,
    );
    const reasons = items.map((i) => i.errorReason).filter(Boolean);
    if (reasons.length > 0) out.push(`上游返回的失败原因：${reasons.join("；")}`);
    return out;
  }

  const label = ok[0].studyMeta?.name || q.pineId;
  out.push(
    `指标「${label}」在 ${ok.length}/${q.symbols.length} 个标的上计算成功，` +
      `${q.resolution} 周期，共 ${ok.reduce((s, i) => s + i.pointCount, 0)} 个数据点。`,
  );

  // 参数回显 —— Agent 常需据此判断「是不是默认参数」并二次调整
  const inputs = ok[0].inputs;
  if (inputs.length > 0) {
    const desc = inputs
      .map((i) => {
        const changed = JSON.stringify(i.value) !== JSON.stringify(i.defaultValue);
        return `${i.name}=${String(i.value)}${changed ? "（已自定义）" : ""}`;
      })
      .join("，");
    out.push(`生效参数：${desc}。用 inputs 入参可覆盖（键名传 in_0 / in_1 …）。`);
  }

  for (const it of ok) {
    const parts: string[] = [
      `${it.ticker}：${it.pointCount} 点，覆盖 ${toDateStr(it.range.fromTime)} ~ ${toDateStr(it.range.toTime)}`,
    ];
    // 末值是 Agent 最常问的（「现在 RSI 多少」）
    const vals = it.latest.filter((l) => l.value !== null);
    if (vals.length > 0) {
      parts.push(
        `最新值 ${vals.map((l) => `${l.title || l.plotId}=${num(l.value)}`).join(" / ")}`,
      );
    }
    out.push(parts.join("，") + "。");
  }

  // plots 是解码键，必须说清怎么读
  const plots = ok[0].plots;
  if (plots.length > 1) {
    out.push(
      `points[].v 是位置数组，与 plots 按下标对应：` +
        plots
          .map((p, i) => `v[${i}]=${p.title || p.id}${p.type !== "line" ? `(${p.type})` : ""}`)
          .join("，") +
        `。其中 *colorer 型是调色板/背景色索引、alertcondition 型仅供提醒规则，均非业务数值。`,
    );
  }

  // null 语义：绝不能被读成「数据缺失」
  out.push(
    `v 中的 null 表示该通道在这根 K 线上无值（如均线在序列头部尚未形成），**不是数据缺失或采集失败**。`,
  );

  // repaint 警告：做回测的场景会被坑
  if (ok.some((i) => i.studyMeta?.historyMayRepaint)) {
    out.push(
      `⚠️ 该指标的历史值可能随数据增补被上游重算（repaint 类），` +
        `不同时间取到的同一根 K 线的值可能不同，做回测/复现时需留意。`,
    );
  }

  const failed = items.filter((i) => i.status !== "ok" || i.pointCount === 0);
  if (failed.length > 0) {
    out.push(
      `未取到数据的标的：${failed
        .map((i) => `${i.ticker}${i.errorReason ? `（${i.errorReason}）` : ""}`)
        .join("、")}。`,
    );
  }

  if (!q.includePoints) {
    out.push(`本次未返回 points 明细（includePoints=false），仅给末值与元信息。`);
  }

  return out;
}

export function projectStudyAiReady(result: TvStudyResult): TvStudyProjected {
  const includePoints = result.query.includePoints;
  const items = result.series.map((s) => projectItem(s, includePoints));
  const ok = items.filter((i) => i.status === "ok" && i.pointCount > 0).length;
  const totalPoints = items.reduce((s, i) => s + i.pointCount, 0);

  const meta: TvStudyMeta & {
    skill: string;
    semantics: string;
    crawledAt: string;
  } = {
    skill: "tv-indicator",
    semantics:
      `技术指标数值序列：${result.query.resolution} 周期，时间为 Unix 秒级 UTC 时间戳；` +
      `v 为各输出通道取值（与 plots 按下标对应），null 表示该根 K 线上该通道无值`,
    crawledAt: isoTime(result.crawledAt),
    pineId: result.query.pineId,
    pineVersion: result.query.pineVersion ?? "last",
    resolution: result.query.resolution,
    requestedCount: result.query.symbols.length,
    returnedCount: items.length,
    okCount: ok,
    failedCount: items.length - ok,
    totalPoints,
    pointSchema:
      "t=Unix秒(UTC) v=各输出通道值数组（顺序对应 items[].plots，null=该根无值）",
    includePoints,
    units: {
      t: "Unix 秒（UTC）",
      v: "指标计算值；null = 该根 K 线上该通道无值（非缺失）",
    },
    transport: {
      rounds: result.diagnostics.rounds,
      drainCalls: result.diagnostics.drainCalls,
      droppedFrames: result.diagnostics.droppedFrames,
      unknownMessageKinds: result.diagnostics.unknownMessageKinds,
    },
    idNamespace: ID_NAMESPACES.STUDY_PINE_ID,
    idConsumers: ID_NAMESPACE_INFO[ID_NAMESPACES.STUDY_PINE_ID].consumedBy,
  };

  return { meta, insights: buildStudyInsights(items, result), items };
}
