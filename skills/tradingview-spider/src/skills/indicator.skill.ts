/**
 * tv-indicator —— 技术指标数值序列
 *
 * ══════════════ 本包唯一的「两段式」Skill ══════════════
 *
 * 指标数据必须跨两个上游服务才能拿到，且**顺序不可换**：
 *
 *   ① HTTP 编译（Goal）  pine-facade/translate → 拿 ilTemplate + plots + inputs
 *   ② WS 挂载（长连接）   create_study(inputs.text=ilTemplate) → du 推来数值
 *
 * 第 ① 步不可省：`inputs.text` 是服务端编译产物，客户端无法凭空生成。
 * 历史上试过跳过编译直接猜 pineId 传给 WS，一律被拒（详见 docs §8.1）。
 *
 * 第 ① 步还顺带给出**解码键**：`du.st[].v` 是位置数组，只有编译响应里的
 * `plots[]` 能说明哪个位置是哪根线。
 *
 * ══════════════ 为什么继承 WS 基类而不是 Goal 基类 ══════════════
 *
 * 主链路是长连接（数据来自 `du` 推送），HTTP 只是取"钥匙"的前置步骤。
 * 继承 `TvWsSkillBase` 能免费获得建连/释放的生命周期管理（@Ready/@Teardown），
 * 而编译那一步用 `PuppeteerSkillDeps.goalExecutor`（框架已声明为可选依赖）
 * 在 fetchData 里显式跑一次即可 —— 这正是 CLAUDE.md §3.1 所说的
 * 「同一包内按链路分别选模式」。
 *
 * ══════════════ 覆盖边界（如实声明，勿臆测）══════════════
 *
 * 本 Skill 只走**指标外壳**（`Script@tv-scripting-101!`）。抓包证据里
 * 策略类（`kind=strategy`）走的是另一个外壳（`StrategyScript@…`）且带 26 个
 * 参数（含回测资金/手续费等），其响应形态（是否除 `du` 外还推回测报告消息）
 * **本次未验证**，因此不在本 Skill 支持范围内 —— 传策略类 pineId 可能失败或
 * 只拿到部分数据。`STUDY_STRATEGY_SHELL` 已在 messages.ts 备好，
 * 待后续专项抓包验证后再接入。
 */

import {
  InvalidParamsError,
  MissingContextError,
  NotLoggedInError,
  type PageContext,
  type ProjectionPipeline,
  type SkillParamSchema,
} from "@spider/core";
import type { Page } from "puppeteer-core";
import { TvWsSkillBase, TvWsDiagnosticsSlot } from "@src/skills/tv-ws-skill-base";
import {
  HISTORY_DEFAULT_TIMEZONE,
  STUDY_DEFAULT_BARS,
  STUDY_DEFAULT_RESOLUTION,
  STUDY_DEFAULT_TIMEOUT_MS,
  STUDY_MAX_SYMBOLS,
} from "@src/constants";
import {
  StudyCompileGoal,
  mergeInputSpecs,
  type StudyCompileOutcome,
} from "@src/thrall/indicator-compile";
import { projectStudyAiReady } from "@src/projections/indicator.ai-ready";
import {
  ID_NAMESPACES,
  assertPineIdShape,
  assertTickerShape,
  nsTag,
} from "@src/projections/id-namespace";
import type { TvStudyResult, TvStudySeries } from "@src/types/indicator.types";
import type { TvStudyProjected } from "@src/types/projected.types";
import type { TvWsDiagnostics } from "@src/types/ws.types";

export interface TvIndicatorParams {
  symbols?: string[];
  pineId?: string;
  version?: string;
  resolution?: string;
  bars?: number;
  timezone?: string;
  inputs?: Record<string, unknown>;
  includePoints?: boolean;
}

export class TvIndicatorSkill extends TvWsSkillBase<
  TvIndicatorParams,
  TvStudyResult,
  TvStudyProjected
> {
  readonly id = "tv-indicator";
  readonly name = "技术指标数值";
  readonly description =
    "取某个技术指标（MA/RSI/MACD/布林带/ATR/Aroon 等）在指定标的上的计算结果时间序列。" +
    "覆盖全球市场全资产：股票、加密货币、期货、外汇、债券收益率、宏观指标。" +
    "支持自定义指标参数（周期长度、数据源等）。" +
    "pineId 必须来自 tv-indicator-list 的 items[].pineId（那是指标标识，不是显示名）。" +
    "只要 K 线本身不含指标请用 tv-history。";

  readonly paramSchema: SkillParamSchema[] = [
    {
      name: "symbols",
      type: "array",
      required: true,
      description:
        `${nsTag(ID_NAMESPACES.TICKER)} 标的清单（EXCHANGE:CODE），来自 tv-search 的 items[].ticker。` +
        `1-${STUDY_MAX_SYMBOLS} 个，共用一条连接。` +
        '例：["NASDAQ:AAPL","BINANCE:BTCUSDT"]。',
    },
    {
      name: "pineId",
      type: "string",
      required: true,
      description:
        `${nsTag(ID_NAMESPACES.STUDY_PINE_ID)} 指标标识，来自 tv-indicator-list 的 items[].pineId。` +
        "形如 `STD;RSI` / `STD;Aroon_Oscillator`（分号分隔，空格转义为 %1）。" +
        "⚠️ **这不是指标显示名** —— 传「RSI 背离」这类中文名或英文全称都会失败，" +
        "必须先用 tv-indicator-list 查到确切的 pineId。",
    },
    {
      name: "version",
      type: "string",
      required: false,
      description:
        "指标版本号，来自 tv-indicator-list 的 items[].version（如 `1.0` / `30.0`）。" +
        "留空则用上游最新版。版本与指标绑定，勿跨指标复用。",
    },
    {
      name: "resolution",
      type: "string",
      required: false,
      default: STUDY_DEFAULT_RESOLUTION,
      description:
        "K 线周期，指标基于此周期计算。实测可用：1D（日线）/ 1W（周线）/ 1M（月线）；" +
        "分钟线按上游惯例传纯数字（1 / 60 / 240）。",
    },
    {
      name: "bars",
      type: "number",
      required: false,
      default: STUDY_DEFAULT_BARS,
      description:
        `父 K 线序列的取数根数，默认 ${STUDY_DEFAULT_BARS}，指标在这个范围内计算。` +
        "**想要更长的指标序列就调大它**（指标不支持像 tv-history 那样翻页）。" +
        "注意长周期指标（如 200 日均线）需要足够的前置数据才能算出值，" +
        "bars 太小会导致序列头部大量 null。",
    },
    {
      name: "timezone",
      type: "string",
      required: false,
      default: HISTORY_DEFAULT_TIMEZONE,
      description: `K 线时区，默认 ${HISTORY_DEFAULT_TIMEZONE}（避免跨市场时区换算歧义）。`,
    },
    {
      name: "inputs",
      type: "object",
      required: false,
      description:
        "覆盖指标参数，键名用 `in_0` / `in_1` …（编号与 tv-indicator-list 返回顺序一致，" +
        "也可先不传跑一次、从返回的 items[].inputs 看每个参数的含义与默认值再调）。" +
        '例：{"in_0":21} 把默认 14 周期改成 21。' +
        "不传则全部用上游默认值。",
    },
    {
      name: "includePoints",
      type: "boolean",
      required: false,
      default: true,
      description:
        "是否返回逐根明细。设为 false 时只回各通道末值与元信息，省 Agent 上下文。",
    },
  ];

  /**
   * 技术指标**必须**有真实登录态。
   *
   * 实测（真机）：未登录会话下 HTTP 编译步骤能正常返回 ilTemplate，
   * 但 WS `create_study` 会被拒（`Study not allowed in this connection`）——
   * 即失败点在第二段而非第一段，很容易误判成协议实现错误。
   * token 只在页面内取用，Node 侧看不到（见 tv-ws-skill-base 的 requiresAuth）。
   */
  protected get requiresAuth(): boolean {
    return true;
  }

  protected normalizeParams(params: TvIndicatorParams): TvIndicatorParams {
    const raw = Array.isArray(params.symbols) ? params.symbols : [];
    const symbols = [...new Set(raw.map((x) => String(x).trim()).filter(Boolean))];

    if (symbols.length === 0) {
      throw new InvalidParamsError(
        "symbols 必填且不能为空 —— 请传标的清单（EXCHANGE:CODE），" +
          "来自 tv-search 的 items[].ticker，不要自行拼写。",
        { scope: this.id },
      );
    }
    if (symbols.length > STUDY_MAX_SYMBOLS) {
      throw new InvalidParamsError(
        `symbols 最多 ${STUDY_MAX_SYMBOLS} 个（收到 ${symbols.length} 个）。` +
          "每个标的都要单独建会话并等上游算完指标，请分批调用。",
        { scope: this.id, details: { count: symbols.length } },
      );
    }
    for (const t of symbols) assertTickerShape(t, this.id);

    const pineId = params.pineId?.trim();
    if (!pineId) {
      throw new MissingContextError(
        "pineId 必填 —— 请先用 tv-indicator-list 检索指标，取 items[].pineId 传入" +
          "（如 STD;RSI）。注意它不是指标的显示名。",
        { scope: this.id },
      );
    }
    assertPineIdShape(pineId, this.id);

    // 只接受 in_N 形态的键：其余键传给上游只会被忽略，提前拦截并给出引导
    const overrides: Record<string, unknown> = {};
    const bad: string[] = [];
    for (const [k, v] of Object.entries(params.inputs ?? {})) {
      if (/^in_\d+$/.test(k)) overrides[k] = v;
      else bad.push(k);
    }
    if (bad.length > 0) {
      throw new InvalidParamsError(
        `inputs 的键名必须是 in_0 / in_1 … 形态（收到：${bad.join("、")}）。` +
          "先不传 inputs 跑一次，从返回的 items[].inputs 看每个参数的编号与含义，再按编号覆盖。",
        { scope: this.id, details: { invalidKeys: bad } },
      );
    }

    const bars = Math.min(
      Math.max(1, Math.floor(Number(params.bars ?? STUDY_DEFAULT_BARS) || STUDY_DEFAULT_BARS)),
      20_000,
    );

    return {
      symbols,
      pineId,
      version: params.version?.trim() || null,
      resolution: params.resolution?.trim() || STUDY_DEFAULT_RESOLUTION,
      bars,
      timezone: params.timezone?.trim() || HISTORY_DEFAULT_TIMEZONE,
      inputs: overrides,
      includePoints: params.includePoints ?? true,
    } as TvIndicatorParams;
  }

  /**
   * 两段式取数：先 HTTP 编译一次，再对每个标的走 WS 挂载。
   *
   * 编译只做一次（同一指标对所有标的通用），这是把它放在循环外的原因。
   */
  protected async fetchData(
    page: Page,
    params: TvIndicatorParams,
    _options?: unknown,
    ctx?: PageContext<TvIndicatorParams>,
  ): Promise<TvStudyResult> {
    const pageCtx = ctx as PageContext<TvIndicatorParams>;
    const client = this.requireWsClient(pageCtx);
    const symbols = params.symbols as string[];
    const pineId = params.pineId as string;
    const resolution = params.resolution as string;
    const overrides = (params.inputs ?? {}) as Record<string, unknown>;

    /**
     * 登录态前置检查 —— 快速失败优于逐个标的失败。
     *
     * 未登录时上游会在每个标的的 `create_study` 上都回
     * `Study not allowed in this connection`，Agent 只能看到 N 条同样的
     * 失败原因，很难定位到「其实是没登录」。这里一次说清。
     */
    if (!client.hasAuth) {
      throw new NotLoggedInError(
        "技术指标需要已登录的会话 —— 当前调试浏览器未登录目标站点，" +
          "上游会拒绝指标计算请求（行情与 K 线不受影响，游客态即可）。" +
          "请在 127.0.0.1:4444 的浏览器窗口内完成登录后重试。",
        { scope: this.id, phase: "fetch" },
      );
    }

    // ── ① HTTP 编译：拿 ilTemplate（WS 的钥匙）+ plots（解码键）+ inputs ──
    const compiled = await this.compileStudy(page, params);

    const inputSpecs = mergeInputSpecs(compiled.inputs, overrides);
    // 传给 WS 的参数：顺序即 in_N 编号顺序（编译产物的顺序就是权威顺序）
    const wsInputs = compiled.inputs.map((input, index) => ({
      id: `in_${index}`,
      type: input.type,
      value: Object.prototype.hasOwnProperty.call(overrides, `in_${index}`)
        ? overrides[`in_${index}`]
        : input.defval,
    }));

    const series: TvStudySeries[] = [];
    const agg: TvWsDiagnostics = {
      rounds: 0,
      drainCalls: 0,
      droppedFrames: 0,
      unknownMessageKinds: [],
      sessionId: null,
    };
    const unknownSet = new Set<string>();

    // ── ② WS 挂载：逐标的建会话（共用一条连接）──
    for (const ticker of symbols) {
      try {
        const outcome = await client.study({
          ticker,
          resolution,
          bars: params.bars as number,
          timezone: params.timezone as string,
          timeoutMs: STUDY_DEFAULT_TIMEOUT_MS,
          ilTemplate: compiled.ilTemplate,
          pineId,
          pineVersion: compiled.version,
          pineFeatures: compiled.pineFeatures,
          inputs: wsInputs,
        });

        series.push({
          ticker,
          pineId,
          pineVersion: compiled.version,
          resolution,
          status: "ok",
          studyMeta: {
            name: compiled.name,
            shortName: compiled.shortName,
            isPriceStudy: compiled.isPriceStudy,
            historyMayRepaint: compiled.historyMayRepaint,
          },
          symbolMeta: outcome.symbolMeta,
          plots: compiled.plots,
          inputs: inputSpecs,
          points: outcome.points,
          errorReason: null,
        });

        agg.rounds += outcome.diagnostics.rounds;
        agg.drainCalls += outcome.diagnostics.drainCalls;
        agg.droppedFrames += outcome.diagnostics.droppedFrames;
        for (const k of outcome.diagnostics.unknownMessageKinds) unknownSet.add(k);
        agg.sessionId ??= outcome.diagnostics.sessionId;
      } catch (err) {
        // 单标的失败不拖垮整批（同 tv-history：部分成功优于全盘失败）
        const message = err instanceof Error ? err.message : String(err);
        this.addWarning({
          code: "indicator-symbol-failed",
          message: `标的 ${ticker} 的指标计算失败`,
          details: { ticker, pineId, error: message },
        });
        series.push({
          ticker,
          pineId,
          pineVersion: compiled.version,
          resolution,
          status: "error",
          studyMeta: {
            name: compiled.name,
            shortName: compiled.shortName,
            isPriceStudy: compiled.isPriceStudy,
            historyMayRepaint: compiled.historyMayRepaint,
          },
          symbolMeta: null,
          plots: compiled.plots,
          inputs: inputSpecs,
          points: [],
          errorReason: message,
        });
      }
    }

    agg.unknownMessageKinds = [...unknownSet];
    pageCtx?.set(TvWsDiagnosticsSlot, agg);

    return {
      query: {
        symbols,
        pineId,
        pineVersion: compiled.version,
        resolution,
        bars: params.bars as number,
        timezone: params.timezone as string,
        includePoints: params.includePoints as boolean,
        inputOverrides: overrides,
      },
      series,
      diagnostics: agg,
      crawledAt: new Date(),
    };
  }

  /**
   * 跑一次编译 Goal。
   *
   * `goalExecutor` 在 `PuppeteerSkillDeps` 里是**可选**依赖（WS 链路通常不需要），
   * 但本 Skill 的编译步骤必须有它 —— 缺失属于组装错误（registry 没注入），
   * 归为 pipeline 级问题而非用户参数问题，所以给的是维护者视角的提示。
   */
  private async compileStudy(
    page: Page,
    params: TvIndicatorParams,
  ): Promise<StudyCompileOutcome> {
    const executor = this.tvDeps.goalExecutor;
    if (!executor) {
      throw new MissingContextError(
        "指标编译需要 goalExecutor，但注册表未注入 —— 这是包内组装缺陷，请报告维护者。",
        { scope: this.id },
      );
    }

    return executor.execute<StudyCompileOutcome>(
      new StudyCompileGoal(),
      page,
      {
        pineId: params.pineId as string,
        version: (params.version as string | null) ?? null,
      },
      { silent: true },
    );
  }

  protected get pipeline(): ProjectionPipeline<
    TvIndicatorParams,
    TvStudyResult,
    TvStudyResult,
    TvStudyProjected
  > {
    return {
      envelope: (data) => projectStudyAiReady(data),
    };
  }
}
