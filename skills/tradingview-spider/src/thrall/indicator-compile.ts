/**
 * 指标编译 Goal
 *
 * GET pine-facade/translate/{pineId}/{version} —— 把指标编译成可执行产物。
 *
 * ══════════════ 这一步为什么不能省 ══════════════
 *
 * WS 的 `create_study` 需要一段 `inputs.text`（编译后的脚本密文），
 * **客户端无法凭空生成**。历史上试过直接猜 `pineId` 传给 WS，一律被拒；
 * 真正的钥匙是这个端点返回的 `result.ilTemplate`（已逐字节验证：它与前端
 * 实际发给 WS 的 `inputs.text` 完全一致）。详见 docs §8.3。
 *
 * 顺带拿到的 `metaInfo` 同样关键：
 *   - `inputs[]`  → 构造 WS 侧 `in_N` 参数的唯一依据（顺序敏感）
 *   - `plots[]`   → 解码 `du.st[].v` 位置数组的唯一键
 * 两者都必须回显进结果，否则拿到一串裸数字再也对不上含义。
 *
 * ══════════════ 路径段编码 ══════════════
 *
 * `pineId` 含 `;`（`STD;RSI`）与 `%`（`24h%Volume`），必须 URL 编码
 * （`;`→`%3B`、`%`→`%25`）。框架的 `resolveUrl` 做路径段替换时**不代为编码**，
 * 因此这里在 `params` 里就地编码。
 */
import { BaseGoal, Goal, Endpoint, Expanded, Aggregate } from "@spider/core";
import { UpstreamShapeChangedError } from "@spider/core";
import type { GoalContext } from "@spider/core";
import { TV_PINE_FACADE_HOST } from "@src/constants";
import { TV_PINE_GOAL_DEFAULTS } from "@src/thrall/shared";
import type {
  RawPineInput,
  RawPineMetaInfo,
  RawPinePlot,
  RawTranslateResponse,
} from "@src/types/indicator.types";
import type { TvStudyInputSpec, TvStudyPlotSpec } from "@src/types/indicator.types";

/** `inputs[]` 里非用户参数的固定键（构造 in_N 时必须跳过） */
const RESERVED_INPUT_IDS = new Set([
  "text",
  "pineId",
  "pineVersion",
  "pineFeatures",
]);

/** 编译产物 —— Skill 层据此构造 WS 消息 */
export interface StudyCompileOutcome {
  pineId: string;
  version: string;
  /** ★ 原样喂给 WS create_study 的 inputs.text */
  ilTemplate: string;
  /** pineFeatures 的 defval（WS 侧需包成 {v,f,t} 透传） */
  pineFeatures: string | null;
  name: string | null;
  shortName: string | null
  isPriceStudy: boolean | null;
  historyMayRepaint: boolean | null;
  /** 用户可调参数（已剔除固定键），**顺序即 in_N 的编号顺序** */
  inputs: Array<{ id: string; name: string; type: string; defval: unknown }>;
  /** 输出通道规格（解码 v 数组的键） */
  plots: TvStudyPlotSpec[];
}

function toPlotSpec(
  raw: RawPinePlot,
  styles: RawPineMetaInfo["styles"],
  index: number,
): TvStudyPlotSpec {
  const id = typeof raw.id === "string" ? raw.id : `plot_${index}`;
  return {
    id,
    type: typeof raw.type === "string" ? raw.type : "line",
    title: styles?.[id]?.title?.trim() || null,
    target: typeof raw.target === "string" ? raw.target : null,
  };
}

/**
 * 提取用户可调参数。
 *
 * ⚠️ **顺序敏感**：WS 侧的 `in_0` / `in_1` … 按本数组下标编号，
 * 而非按 id 字符串排序。上游给的 inputs 数组顺序就是权威顺序。
 * （实测上游自身的 id 已是 `in_N` 形态，这里仍以位置为准并保留其 id，
 *  两者一致时无差别；万一上游改成别的 id 命名，位置仍然可靠。）
 */
function toInputSpecs(
  inputs: RawPineInput[] | undefined,
): Array<{ id: string; name: string; type: string; defval: unknown }> {
  if (!Array.isArray(inputs)) return [];
  const out: Array<{ id: string; name: string; type: string; defval: unknown }> = [];
  for (const raw of inputs) {
    const id = typeof raw.id === "string" ? raw.id : "";
    if (!id || RESERVED_INPUT_IDS.has(id)) continue;
    out.push({
      id,
      name: typeof raw.name === "string" ? raw.name : id,
      type: typeof raw.type === "string" ? raw.type : "text",
      defval: raw.defval,
    });
  }
  return out;
}

export interface StudyCompileGoalParams extends Record<string, unknown> {
  pineId: string;
  /** 版本号；null 表示用上游的 last */
  version: string | null;
}

@Goal({
  id: "tv-indicator-compile",
  name: "指标编译",
  baseURL: TV_PINE_FACADE_HOST,
  defaults: TV_PINE_GOAL_DEFAULTS,
})
export class StudyCompileGoal extends BaseGoal<
  StudyCompileOutcome,
  StudyCompileGoalParams
> {
  /**
   * 单元素 `@Expanded` —— 只为让 `:pineId` / `:version` 两个路径段参与
   * `resolveUrl` 替换（非分页端点走的是空参数对象，不做替换，见 tv-scan 的同款注释）。
   */
  @Endpoint("/pine-facade/translate/:pineId/:version", { method: "GET" })
  @Expanded<string, RawTranslateResponse>({
    source: (ctx) => [(ctx.params as StudyCompileGoalParams).pineId],
    params: (pineId, _index, ctx) => {
      const p = ctx.params as StudyCompileGoalParams;
      return {
        // 路径段需就地编码：pineId 含 ; 与 %，框架不代为编码
        pineId: encodeURIComponent(pineId),
        version: p.version ?? "last",
      };
    },
    concurrency: 1,
  })
  fetchTranslate(response: RawTranslateResponse): RawTranslateResponse {
    return response;
  }

  @Aggregate()
  aggregate(ctx: GoalContext<StudyCompileGoalParams>): StudyCompileOutcome {
    const p = ctx.params;
    const responses = ctx.get<RawTranslateResponse[]>("fetchTranslate") ?? [];
    const resp = responses[0];

    const result = resp?.result;
    const ilTemplate = result?.ilTemplate;

    /**
     * 编译失败的两种形态都在这里收口：
     *   - `success:false` / `result:null` —— 上游明确拒绝
     *   - 缺 `ilTemplate`               —— 拿不到可执行产物，后续 WS 必然失败
     *
     * 付费指标是否会走到这个分支**未经验证**（抓包样本响应体被工具丢失，
     * 见 docs §8.5），因此错误信息里不断言「因为付费」，只如实说明现象 +
     * 给出可执行的下一步。
     */
    if (resp?.success === false || !result || typeof ilTemplate !== "string" || !ilTemplate) {
      throw new UpstreamShapeChangedError(
        `指标 "${p.pineId}" 未能取到可执行产物（上游未返回编译结果）。` +
          `常见原因：① 该指标需要付费权限（用 tv-indicator-list 看 access 字段确认）；` +
          `② pineId 或 version 不存在（用 tv-indicator-list 核对，勿自行拼写）。`,
        {
          scope: "tv-indicator",
          details: {
            pineId: p.pineId,
            version: p.version ?? "last",
            success: resp?.success ?? null,
            reason: resp?.reason ?? null,
          },
        },
      );
    }

    const meta = result.metaInfo ?? {};
    const rawInputs = Array.isArray(meta.inputs) ? meta.inputs : [];
    const featuresRaw = rawInputs.find((i) => i.id === "pineFeatures")?.defval;

    const plots = (Array.isArray(meta.plots) ? meta.plots : []).map((raw, i) =>
      toPlotSpec(raw, meta.styles, i),
    );

    return {
      pineId: p.pineId,
      version: p.version ?? "last",
      ilTemplate,
      pineFeatures: typeof featuresRaw === "string" ? featuresRaw : null,
      name: meta.description ?? null,
      shortName: meta.shortDescription ?? null,
      isPriceStudy:
        typeof meta.is_price_study === "boolean" ? meta.is_price_study : null,
      historyMayRepaint:
        typeof meta.historyCalculationMayChange === "boolean"
          ? meta.historyCalculationMayChange
          : null,
      inputs: toInputSpecs(rawInputs),
      plots,
    };
  }
}

/** 把编译产物的 inputs 与用户覆盖值合并成对外回显的规格 */
export function mergeInputSpecs(
  compiled: StudyCompileOutcome["inputs"],
  overrides: Record<string, unknown>,
): TvStudyInputSpec[] {
  return compiled.map((input) => ({
    id: input.id,
    name: input.name,
    type: input.type,
    value: Object.prototype.hasOwnProperty.call(overrides, input.id)
      ? overrides[input.id]
      : input.defval,
    defaultValue: input.defval,
  }));
}
