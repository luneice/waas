/**
 * WS 会话客户端 —— 协议语义层
 *
 * 职责边界（三层分干净，便于未来上提 core 时按层切分）：
 *   传输层 `transport.ts`     —— 开/收/关，页面边界
 *   流抽象 `stream/reducer.ts` —— 无界事件流 → 有界结果（**跨协议通用**）
 *   协议层 **本文件**          —— TradingView 私有的会话语义
 *
 * 本文件**不实现任何循环/超时/终止逻辑** —— 那些全在 `runStream` 里。
 * 这里只负责：建连初始化、构造会话消息、定义各场景的 seed/reduce/until。
 *
 * ══════════════ 报价与 K 线的两种终止语义 ══════════════
 *
 * 报价：每个标的推完首批快照会发 `quote_completed`，全部到齐即收口。
 * K 线：每轮 `series_completed` 决定是否再翻页，直到上游给
 *       `data_completed:"end"`（数据边界）或覆盖到请求的起始时间。
 *
 * 两者的共同点是「终止由业务判断，且依赖入参」—— 正是 `until(acc, ev, ctx)`
 * 第三个参数存在的理由（详见 stream/reducer.ts 文件头的血的教训）。
 */

import { UpstreamShapeChangedError, NoResultsError } from "@spider/core";
import { runStream, type StreamStopReason } from "@spider/core";
import { TvOutbox, wsEventSource, type TvWsStreamEvent } from "@src/ws/stream-source";
import type { TvWsTransport } from "@src/ws/transport";
import { encodeMessage } from "@src/ws/frame";
import {
  chartCreateSession,
  createSeries,
  createStudy,
  encodeExtendedSymbol,
  makeSessionId,
  quoteAddSymbols,
  quoteCreateSession,
  quoteSetFields,
  requestMoreData,
  resolveSymbol,
  setAuthToken,
  setDataQuality,
  setLocale,
  switchTimezone,
  STUDY_SCRIPT_SHELL,
  STUDY_STRATEGY_SHELL,
  type StudyInputs,
  type StudyInputValue,
} from "@src/ws/messages";
import {
  TV_NA_SENTINEL,
  TV_LOCALE,
  TV_WS_AUTH_TOKEN,
  TV_WS_HOST,
  HISTORY_DEFAULT_ADJUSTMENT,
  WS_DRAIN_WAIT_MS,
  WS_ROUND_IDLE_MS,
} from "@src/constants";
import type {
  RawQsdPayload,
  RawSeriesUpdate,
  RawSymbolResolved,
  TvBar,
  TvSymbolMeta,
  TvWsDiagnostics,
} from "@src/types/ws.types";
import type { TvStudyPoint, RawStudyUpdate } from "@src/types/indicator.types";


export interface TvWsClientOptions {
  /** 抛错归属（skill id） */
  scope: string;
  /** 会话 ID 生成器，可注入以便快照测试复现 */
  rand?: () => number;
}

// ============================================================================
// 报价会话
// ============================================================================

export interface QuoteRequest {
  symbols: string[];
  fields: string[];
  timeoutMs: number;
}

export interface QuoteOutcome {
  /** 按标的合并后的完整快照 */
  quotes: Map<string, { status: "ok" | "error"; values: Record<string, unknown> }>;
  stopReason: StreamStopReason;
  truncated: boolean;
  diagnostics: TvWsDiagnostics;
}

// ============================================================================
// K 线会话
// ============================================================================

export interface HistoryRequest {
  ticker: string;
  resolution: string;
  /** 目标起始时间（Unix 秒）；null = 只取首批 */
  fromTs: number | null;
  bars: number;
  pageBars: number;
  maxRounds: number;
  timezone: string;
  timeoutMs: number;
  /**
   * 复权口径。传上游默认值（splits）时走裸 ticker，其余走扩展 symbol。
   * 生效口径不靠这里推断，以 `symbolMeta.adjustment` 的服务端回显为准。
   */
  adjustment?: string;
}

export interface HistoryOutcome {
  symbolMeta: TvSymbolMeta | null;
  bars: TvBar[];
  /** 已到该序列最早可用数据（数据边界，非采集失败） */
  dataCompleted: boolean;
  rounds: number;
  /** 因 maxRounds 上限提前停止，未覆盖到请求的 from */
  truncatedByMaxRounds: boolean;
  stopReason: StreamStopReason;
  diagnostics: TvWsDiagnostics;
}

// ============================================================================
// 指标会话
// ============================================================================

export interface StudyRequest {
  ticker: string;
  resolution: string;
  bars: number;
  timezone: string;
  timeoutMs: number;
  /** 编译产物，原样透传给 inputs.text */
  ilTemplate: string;
  pineId: string;
  pineVersion: string;
  /** metaInfo 里 pineFeatures 的 defval（缺失则不传该键） */
  pineFeatures: string | null;
  /** 参数规格（顺序即 in_N 编号顺序），value 已合并用户覆盖 */
  inputs: Array<{ id: string; type: string; value: unknown }>;
  /** strategy 类走另一个外壳 */
  isStrategy?: boolean;
}

export interface StudyOutcome {
  symbolMeta: TvSymbolMeta | null;
  /** 指标在各根 K 线上的取值（按时间升序，已去重） */
  points: TvStudyPoint[];
  stopReason: StreamStopReason;
  diagnostics: TvWsDiagnostics;
}

/**
 * 构造 `create_study` 的 inputs 对象。
 *
 * ⚠️ **两种包装形态混用，不可统一**（HAR 逐字节核对，见 messages.ts 的
 * `StudyInputs` 注释）：`text`/`pineId`/`pineVersion` 是裸字符串，
 * 其余（`pineFeatures`/`in_N`/`__fast_calc`/`__profile`）是 `{v,f,t}` 三元组。
 *
 * `__fast_calc` / `__profile` 是框架统一注入的控制位，前端恒定携带
 * （都是 false），照抄即可，不暴露给用户。
 */
export function buildStudyInputs(req: StudyRequest): StudyInputs {
  const wrap = (v: unknown, t: string): StudyInputValue => ({ v, f: true, t });

  const inputs: StudyInputs = {
    text: req.ilTemplate,
    pineId: req.pineId,
    pineVersion: req.pineVersion,
  };

  if (req.pineFeatures !== null) {
    inputs.pineFeatures = wrap(req.pineFeatures, "text");
  }

  // in_N 按数组顺序编号 —— 上游的 inputs 顺序就是权威顺序
  req.inputs.forEach((input, index) => {
    inputs[`in_${index}`] = wrap(input.value, input.type);
  });

  inputs.__fast_calc = wrap(false, "bool");
  inputs.__profile = wrap(false, "bool");

  return inputs;
}

/**
 * 归一上游哨兵值。
 *
 * `1e+100` 表示「该通道在这根 K 线上无值」（NaN 的替代表示，实测约占全部
 * 数值的 20%），**必须转 null**：当成真实数值会把 min/max 统计全部污染成
 * 天文数字。这与 `volume: null`（该类标的无此概念）是两回事，但对外都是 null。
 */
function normalizeStudyValue(v: unknown): number | null {
  if (!Number.isFinite(v as number)) return null;
  const n = Number(v);
  return n === TV_NA_SENTINEL ? null : n;
}


/** 把上游 bar 数组转领域对象 */
function toBar(v: number[]): TvBar | null {
  if (!Array.isArray(v) || v.length < 5) return null;
  const [time, open, high, low, close] = v;
  if (!Number.isFinite(time)) return null;
  return {
    time,
    open,
    high,
    low,
    close,
    // volume 缺失表示该类标的无成交量概念（收益率/利率），与真实 0 语义不同
    volume: v.length >= 6 && Number.isFinite(v[5]) ? v[5] : null,
  };
}

function toSymbolMeta(ticker: string, raw: RawSymbolResolved): TvSymbolMeta {
  return {
    ticker,
    description: raw.description ?? raw.short_description ?? null,
    assetType: raw.type ?? null,
    typespecs: Array.isArray(raw.typespecs) ? raw.typespecs : [],
    timezone: raw.timezone ?? null,
    dataFrequency: raw.data_frequency ?? null,
    currency: raw.currency_code ?? null,
    priceScale: Number.isFinite(raw.pricescale) ? Number(raw.pricescale) : null,
    minMov: Number.isFinite(raw.minmov) ? Number(raw.minmov) : null,
    // 服务端回显的**生效**复权口径 —— 不从入参推断（请求与生效可能不一致：
    // allowed_adjustment="none" 的标的会忽略请求的口径）
    adjustment: typeof raw.adjustment === "string" ? raw.adjustment : null,
    allowedAdjustment:
      typeof raw.allowed_adjustment === "string" ? raw.allowed_adjustment : null,
  };
}

export class TvWsClient {
  private connected = false;
  private sessionId: string | null = null;
  private malformedFrames = 0;
  /** 是否成功注入了页面的登录 token（token 本体永不到 Node，这里只记成败） */
  private authInjected = false;

  constructor(
    private readonly transport: TvWsTransport,
    private readonly options: TvWsClientOptions,
  ) {}

  /**
   * 建连并完成初始化三件套。
   *
   * `requireAuth` 为 true 时，页面侧会把 `set_auth_token` 里的占位串换成页面
   * 自身的登录 token（技术指标必需）。凭据不出页面，Node 侧只从
   * `hasAuth` 得知是否注入成功。
   */
  async connect(openTimeoutMs: number, requireAuth = false): Promise<void> {
    /**
     * ⚠️ `type=chart` 决定服务端是否允许在本连接上挂载技术指标。
     *
     * 实测（A/B 对照）：缺这个参数时 `create_study` 恒被拒
     * `Study not allowed in this connection` —— 错误信息里的
     * 「this connection」就是字面意思，**授权按连接类型判定，与登录态无关**
     * （已登录 + 有 token 也一样被拒）。单加 `type=chart` 即通过，
     * 而只改 `from=chart/` 无效，可见起作用的只有 `type`。
     *
     * 报价与 K 线不受影响，所以本参数**恒定携带**（无副作用，
     * 且避免为两种链路维护两套 URL 形态）。
     */
    const url =
      `${TV_WS_HOST}?from=chart%2F&type=chart` +
      `&date=${encodeURIComponent(new Date().toISOString())}` +
      `&auth=sessionid`;

    const frames = [
      setDataQuality(),
      setAuthToken(),
      setLocale(TV_LOCALE),
    ].map(encodeMessage);

    const opened = await this.transport.open({
      url,
      frames,
      openTimeoutMs,
      // 占位串就是默认的字面量 token —— 页面侧按它定位并替换
      authTokenPlaceholder: requireAuth ? TV_WS_AUTH_TOKEN : undefined,
    });
    this.connected = true;
    this.authInjected = opened.authInjected;

    // hello 帧不是 {m,p} 形状，单独解析；session_id 只留在诊断里，不进信封
    if (opened.hello) {
      try {
        const parsed = JSON.parse(opened.hello) as { session_id?: string };
        this.sessionId = parsed.session_id ?? null;
      } catch {
        /* hello 解析失败不阻断：它只用于诊断 */
      }
    }
  }

  /** 建连时是否成功带上了页面的登录态 */
  get hasAuth(): boolean {
    return this.authInjected;
  }

  async close(): Promise<void> {
    if (!this.connected) return;
    this.connected = false;
    await this.transport.close();
  }

  private diagnostics(rounds: number, dropped: number, unknown: Set<string>): TvWsDiagnostics {
    return {
      rounds,
      drainCalls: rounds,
      droppedFrames: dropped,
      unknownMessageKinds: [...unknown],
      sessionId: this.sessionId,
    };
  }

  /**
   * 取一批标的的实时报价快照。
   *
   * `qsd` 是**增量推送**：同一标的会分多条推来不同字段子集，必须按标的合并。
   * 只取最后一条会丢字段 —— 这是本协议最容易踩的坑。
   */
  async quoteSnapshot(req: QuoteRequest): Promise<QuoteOutcome> {
    const qs = makeSessionId("qs", this.options.rand);
    const outbox = new TvOutbox();

    await this.transport.send(
      [
        quoteCreateSession(qs),
        quoteSetFields(qs, req.fields),
        quoteAddSymbols(qs, req.symbols),
      ].map(encodeMessage),
    );

    const pending = new Set(req.symbols);
    const unknown = new Set<string>();
    let dropped = 0;

    const result = await runStream(
      wsEventSource(this.transport, {
        drainWaitMs: WS_DRAIN_WAIT_MS,
        outbox,
        onMalformed: (c) => { this.malformedFrames += c; },
      }),
      {
        seed: () => ({
          quotes: new Map<string, { status: "ok" | "error"; values: Record<string, unknown> }>(),
        }),
        reduce: (acc, ev: TvWsStreamEvent) => {
          dropped = Math.max(dropped, ev.droppedFrames);
          const { m, p } = ev.message;

          if (m === "qsd") {
            const payload = p[1] as RawQsdPayload;
            const name = payload?.n;
            if (name) {
              const prev = acc.quotes.get(name);
              acc.quotes.set(name, {
                // 上游报错的标的保留 error 状态，不因后续增量翻回 ok
                status: payload.s === "error" || prev?.status === "error" ? "error" : "ok",
                // ★ 增量合并：新字段覆盖同名旧字段，未提及的字段保留
                values: { ...(prev?.values ?? {}), ...(payload.v ?? {}) },
              });
            }
          } else if (m === "quote_completed") {
            const name = p[1] as string;
            pending.delete(name);
          } else if (m !== "quote_error") {
            unknown.add(m);
          }
          return acc;
        },
        // 全部标的的首批快照到齐即收口
        until: () => pending.size === 0,
        idleTimeout: WS_ROUND_IDLE_MS,
        maxDuration: req.timeoutMs,
      },
      {},
    );

    if (result.acc.quotes.size === 0) {
      throw new NoResultsError(
        `未取到任何标的的报价（请求 ${req.symbols.length} 个）。` +
          `请先用 tv-search 确认 ticker 是否正确。`,
        { scope: this.options.scope, details: { symbols: req.symbols } },
      );
    }

    return {
      quotes: result.acc.quotes,
      stopReason: result.stopReason,
      truncated: result.truncated,
      diagnostics: this.diagnostics(result.eventCount, dropped, unknown),
    };
  }

  /**
   * 取单个标的的历史 K 线。
   *
   * 翻页靠 `request_more_data`（`create_series` 的 bar_count 锚点实测无效，
   * 见 messages.ts）。终止条件三选一：
   *   ① 上游给 `data_completed:"end"` —— 数据边界
   *   ② 最早 bar 已早于请求的 fromTs —— 覆盖到目标区间
   *   ③ 达到 maxRounds 上限 —— 安全阀，需在结果里显式告知未覆盖完
   */
  async history(req: HistoryRequest): Promise<HistoryOutcome> {
    const cs = makeSessionId("cs", this.options.rand);
    const seriesId = "sds_1";
    const symbolSlot = "sym_1";
    const outbox = new TvOutbox();

    await this.transport.send(
      [
        chartCreateSession(cs),
        switchTimezone(cs, req.timezone),
        resolveSymbol(
          cs,
          symbolSlot,
          encodeExtendedSymbol(req.ticker, {
            // 默认口径不写进报文 —— 见 encodeExtendedSymbol 注释
            adjustment:
              req.adjustment && req.adjustment !== HISTORY_DEFAULT_ADJUSTMENT
                ? req.adjustment
                : undefined,
          }),
        ),
        createSeries(cs, seriesId, symbolSlot, req.resolution, req.bars),
      ].map(encodeMessage),
    );

    const unknown = new Set<string>();
    let dropped = 0;

    const result = await runStream(
      wsEventSource(this.transport, {
        drainWaitMs: WS_DRAIN_WAIT_MS,
        outbox,
        onMalformed: (c) => { this.malformedFrames += c; },
      }),
      {
        seed: () => ({
          /** 按 time 去重 —— 翻页后上游的 i 会变负且是相对量，time 才是稳定标识 */
          bars: new Map<number, TvBar>(),
          symbolMeta: null as TvSymbolMeta | null,
          dataCompleted: false,
          rounds: 0,
          hitMaxRounds: false,
        }),
        reduce: (acc, ev: TvWsStreamEvent) => {
          dropped = Math.max(dropped, ev.droppedFrames);
          const { m, p } = ev.message;

          if (m === "symbol_resolved") {
            acc.symbolMeta = toSymbolMeta(req.ticker, p[2] as RawSymbolResolved);
          } else if (m === "timescale_update") {
            const payload = p[1] as Record<string, RawSeriesUpdate>;
            const series = payload?.[seriesId];
            for (const item of series?.s ?? []) {
              const bar = toBar(item?.v ?? []);
              if (bar) acc.bars.set(bar.time, bar);
            }
          } else if (m === "series_completed") {
            acc.rounds += 1;
            const opts = p[4] as { data_completed?: string } | undefined;
            if (opts?.data_completed === "end") {
              acc.dataCompleted = true;
              return acc;
            }
            // 判断是否需要继续向前翻页
            const oldest = acc.bars.size > 0 ? Math.min(...acc.bars.keys()) : null;
            const covered =
              req.fromTs !== null && oldest !== null && oldest <= req.fromTs;
            if (!covered && req.fromTs !== null) {
              if (acc.rounds >= req.maxRounds) {
                acc.hitMaxRounds = true;
              } else {
                outbox.push(requestMoreData(cs, seriesId, req.pageBars));
              }
            }
          } else if (m === "symbol_error" || m === "series_error") {
            throw new UpstreamShapeChangedError(
              `标的 ${req.ticker} 取数失败（${m}）。` +
                `请确认 ticker 与 resolution 是否受支持。`,
              {
                scope: this.options.scope,
                details: { ticker: req.ticker, resolution: req.resolution, kind: m },
              },
            );
          } else if (m !== "series_loading") {
            unknown.add(m);
          }
          return acc;
        },
        /**
         * ⚠️ 终止判定**只在轮次边界（series_completed）求值**。
         *
         * 曾经写成「每个事件后都判」，结果：第二批的 timescale_update 先于该批的
         * series_completed 到达，此时最早 bar 已覆盖到 fromTs，until 立刻返回 true，
         * 于是那条 series_completed 永远不会被消费 —— `rounds` 少计一轮。
         * 数据是对的（bars 完整、翻页请求次数也对），但 rounds 会进 meta 给 Agent 看，
         * 少一轮就是错的。所以这里用 `atRoundBoundary` 把判定钉在轮次边界上。
         */
        until: (acc, ev: TvWsStreamEvent) => {
          const atRoundBoundary = ev.message.m === "series_completed";
          if (!atRoundBoundary) return false;

          if (acc.dataCompleted || acc.hitMaxRounds) return true;
          // 不需要翻页（只取首批）：收到一轮完成即收口
          if (req.fromTs === null) return true;
          // 已覆盖到目标起始时间
          if (acc.bars.size > 0) {
            const oldest = Math.min(...acc.bars.keys());
            if (oldest <= req.fromTs) return true;
          }
          return false;
        },
        idleTimeout: WS_ROUND_IDLE_MS,
        maxDuration: req.timeoutMs,
      },
      {},
    );

    const bars = [...result.acc.bars.values()].sort((a, b) => a.time - b.time);

    return {
      symbolMeta: result.acc.symbolMeta,
      bars,
      dataCompleted: result.acc.dataCompleted,
      rounds: result.acc.rounds,
      truncatedByMaxRounds: result.acc.hitMaxRounds,
      stopReason: result.stopReason,
      diagnostics: this.diagnostics(result.eventCount, dropped, unknown),
    };
  }

  /**
   * 取单个标的上某个技术指标的计算序列。
   *
   * ══════════════ 消息时序（HAR 逐帧核对）══════════════
   *
   *   create_series（先建 K 线序列，指标要挂在它上面）
   *     → create_study
   *     → study_loading          服务端开始计算
   *     → du                     ★ 数值批量推来（一次给全 833 根，非逐根）
   *     → study_completed        计算完成，收口
   *
   * 与 K 线不同，指标**不需要翻页**：`du` 一次就把父 series 覆盖范围内的全部
   * 取值推完。想要更长的指标序列，办法是把 `bars` 调大（父序列更长，
   * 指标自然算得更长），而不是发 `request_more_data`。
   *
   * `du.st[].v` 是位置数组：`v[0]` 时间戳，`v[1..]` 与编译响应的 plots[] 对应。
   */
  async study(req: StudyRequest): Promise<StudyOutcome> {
    const cs = makeSessionId("cs", this.options.rand);
    const seriesId = "sds_1";
    const symbolSlot = "sym_1";
    const studyId = makeSessionId("st", this.options.rand);
    const outbox = new TvOutbox();

    const shell = req.isStrategy ? STUDY_STRATEGY_SHELL : STUDY_SCRIPT_SHELL;

    await this.transport.send(
      [
        chartCreateSession(cs),
        switchTimezone(cs, req.timezone),
        resolveSymbol(cs, symbolSlot, req.ticker),
        createSeries(cs, seriesId, symbolSlot, req.resolution, req.bars),
        createStudy(cs, studyId, seriesId, shell, buildStudyInputs(req)),
      ].map(encodeMessage),
    );

    const unknown = new Set<string>();
    let dropped = 0;

    const result = await runStream(
      wsEventSource(this.transport, {
        drainWaitMs: WS_DRAIN_WAIT_MS,
        outbox,
        onMalformed: (c) => { this.malformedFrames += c; },
      }),
      {
        seed: () => ({
          /** 按 time 去重 —— 同 K 线，服务端序号 i 是相对量，time 才稳定 */
          points: new Map<number, Array<number | null>>(),
          symbolMeta: null as TvSymbolMeta | null,
          studyDone: false,
        }),
        reduce: (acc, ev: TvWsStreamEvent) => {
          dropped = Math.max(dropped, ev.droppedFrames);
          const { m, p } = ev.message;

          if (m === "symbol_resolved") {
            acc.symbolMeta = toSymbolMeta(req.ticker, p[2] as RawSymbolResolved);
          } else if (m === "du") {
            // du 的载荷按 studyId 索引；同一连接里可能混有其它 study 的数据。
            // 注意 study 的数据键是 st（不是 series 的 s），见 RawStudyUpdate 注释
            const payload = p[1] as Record<string, RawStudyUpdate>;
            const own = payload?.[studyId];
            for (const item of own?.st ?? []) {
              const v = item?.v;
              if (!Array.isArray(v) || v.length < 2) continue;
              const time = v[0];
              if (!Number.isFinite(time)) continue;
              acc.points.set(
                Number(time),
                v.slice(1).map(normalizeStudyValue),
              );
            }
          } else if (m === "study_completed") {
            acc.studyDone = true;
          } else if (m === "study_error") {
            /**
             * 指标层面的失败。上游 study_error 的 p[3] 常带原因串
             * （历史上见过 "Study not allowed in this connection"）。
             * 原样带出，但不臆断成因（是否付费导致未经验证，见 docs §8.5）。
             */
            const reason = typeof p[3] === "string" ? p[3] : "";
            throw new UpstreamShapeChangedError(
              `指标 "${req.pineId}" 在标的 ${req.ticker} 上计算失败` +
                `${reason ? `（上游原因：${reason}）` : ""}。` +
                `请确认该指标是否需要付费权限（tv-indicator-list 的 access 字段），` +
                `以及参数取值是否在允许范围内。`,
              {
                scope: this.options.scope,
                details: { ticker: req.ticker, pineId: req.pineId, reason },
              },
            );
          } else if (m === "symbol_error" || m === "series_error") {
            throw new UpstreamShapeChangedError(
              `标的 ${req.ticker} 取数失败（${m}）。` +
                `请确认 ticker 与 resolution 是否受支持。`,
              {
                scope: this.options.scope,
                details: { ticker: req.ticker, resolution: req.resolution, kind: m },
              },
            );
          } else if (
            m !== "series_loading" &&
            m !== "series_completed" &&
            m !== "study_loading" &&
            m !== "timescale_update"
          ) {
            // 父 series 的 timescale_update 是预期噪声（我们只要 study 的 du）
            unknown.add(m);
          }
          return acc;
        },
        /**
         * 收口条件：`study_completed` 到达且已收到至少一批数值。
         *
         * 两个条件都要：只判 completed 会在「completed 先于 du 到达」时丢数据；
         * 只判有数据会在多批 du 时提前收口。实测顺序是 du → completed，
         * 但不依赖这个顺序更稳。
         */
        until: (acc) => acc.studyDone && acc.points.size > 0,
        idleTimeout: WS_ROUND_IDLE_MS,
        maxDuration: req.timeoutMs,
      },
      {},
    );

    const points: TvStudyPoint[] = [...result.acc.points.entries()]
      .map(([time, values]) => ({ time, values }))
      .sort((a, b) => a.time - b.time);

    return {
      symbolMeta: result.acc.symbolMeta,
      points,
      stopReason: result.stopReason,
      diagnostics: this.diagnostics(result.eventCount, dropped, unknown),
    };
  }
}
