/**
 * tv-indicator-list —— 技术指标目录检索
 *
 * 指标链路的入口 Skill：`tv-indicator` 的 `pineId` 入参只能来自这里的
 * `items[].pineId`（同 tv-search 之于其它三个 Skill）。
 *
 * ⚠️ **上游没有关键词搜索能力**：`pine-facade/list` 只认分组（`filter`），
 * 前端的「搜指标」是把整个分组拉到本地过滤。因此本 Skill 的 `keyword`
 * 也是**本地过滤**（在 Goal 的 aggregate 里做），不是服务端检索。
 * 这不是实现取巧，是上游能力的边界（见 docs §8.2）。
 */

import {
  InvalidParamsError,
  type BaseGoal,
  type ProjectionPipeline,
  type SkillParamSchema,
} from "@spider/core";
import { TvSkillBase } from "@src/skills/tv-skill-base";
import {
  STUDY_CATEGORY_NAMES,
  STUDY_DEFAULT_CATEGORIES,
  STUDY_LIST_DEFAULT_LIMIT,
  STUDY_LIST_MAX_LIMIT,
} from "@src/constants";
import { StudyCatalogGoal } from "@src/thrall/indicator-catalog";
import { projectStudyCatalogAiReady } from "@src/projections/indicator-catalog.ai-ready";
import { ID_NAMESPACES, nsTag } from "@src/projections/id-namespace";
import type { TvStudyCatalogResult } from "@src/types/indicator.types";
import type { TvStudyCatalogProjected } from "@src/types/projected.types";

export interface TvIndicatorListParams {
  categories?: string[];
  keyword?: string;
  access?: string;
  kind?: string;
  limit?: number;
  /**
   * 由 normalizeParams 填充，供 Goal 层消费。
   *
   * 与入参 `access` 同义但显式改名：Goal 侧的领域对象也有 `access` 字段
   * （单个指标的权限），同名会让 aggregate 里的过滤逻辑难读。
   */
  accessFilter?: string | null;
}

/** access 入参的合法取值 —— 这是**我方定义**的枚举，可以拦截（§3.6） */
const ACCESS_VALUES = new Set(["free", "restricted", "unknown"]);

export class TvIndicatorListSkill extends TvSkillBase<
  TvIndicatorListParams,
  TvStudyCatalogResult,
  TvStudyCatalogProjected
> {
  readonly id = "tv-indicator-list";
  readonly name = "技术指标目录";
  readonly description =
    "列出可用的技术指标并产出 pineId，供 tv-indicator 取具体数值。" +
    "覆盖常规技术指标库（MA/RSI/MACD/布林带/ATR/Aroon 等 145 条）、K 线形态识别（45 条）、" +
    "财务科目类（1442 条，需付费权限）。支持按关键词过滤与免费/付费筛选。" +
    "这是指标链路的入口 —— tv-indicator 的 pineId 必须来自这里的 items[].pineId，不要自行拼写。";

  readonly paramSchema: SkillParamSchema[] = [
    {
      name: "categories",
      type: "array",
      required: false,
      default: [...STUDY_DEFAULT_CATEGORIES],
      description:
        `${nsTag(ID_NAMESPACES.STUDY_CATEGORY)} 要拉取的目录分组，已验证可用：${STUDY_CATEGORY_NAMES.join(" / ")}。` +
        `默认 ${STUDY_DEFAULT_CATEGORIES.join("+")}（常规技术指标 + K 线形态，均免费）。` +
        "standard=常规技术指标库；candlestick=K 线形态识别；" +
        "fundamental=财务科目当指标用（**实测全部需付费权限**，免费账号取不到数据）；" +
        "saved=当前账号自建脚本（需登录态）。取值不做白名单拦截。",
    },
    {
      name: "keyword",
      type: "string",
      required: false,
      description:
        "关键词过滤（**本地过滤**，上游无搜索接口）。匹配指标名、简称、pineId 与标签，不区分大小写。" +
        "指标名多为英文，建议传英文短词：`RSI` / `MACD` / `moving average` / `bollinger` / `aroon`。" +
        "留空则返回该分组全量（受 limit 限制）。",
    },
    {
      name: "access",
      type: "string",
      required: false,
      description:
        "按权限筛选：free=免费可直接用 / restricted=需付费权限 / unknown=上游给了未知取值。" +
        "**建议传 free** —— 付费指标能否取到数据未经验证。留空则不筛。",
    },
    {
      name: "kind",
      type: "string",
      required: false,
      description:
        "按类型筛选：study=指标 / strategy=策略。留空则不筛（两者都返回）。",
    },
    {
      name: "limit",
      type: "number",
      required: false,
      default: STUDY_LIST_DEFAULT_LIMIT,
      description:
        `返回条数上限，默认 ${STUDY_LIST_DEFAULT_LIMIT}，最大 ${STUDY_LIST_MAX_LIMIT}。` +
        "免费指标优先排前。被截断时 meta.truncatedCount 会告知还剩多少条。",
    },
  ];

  protected normalizeParams(
    params: TvIndicatorListParams,
  ): TvIndicatorListParams {
    const raw = Array.isArray(params.categories) ? params.categories : [];
    const categories = [
      ...new Set(raw.map((x) => String(x).trim()).filter(Boolean)),
    ];

    const access = params.access?.trim() || null;
    if (access !== null && !ACCESS_VALUES.has(access)) {
      throw new InvalidParamsError(
        `access="${access}" 不是合法取值，应为 free / restricted / unknown 之一（或留空不筛）。`,
        { scope: this.id, details: { access } },
      );
    }

    const limit = Math.min(
      Math.max(1, Math.floor(Number(params.limit ?? STUDY_LIST_DEFAULT_LIMIT) || STUDY_LIST_DEFAULT_LIMIT)),
      STUDY_LIST_MAX_LIMIT,
    );

    return {
      categories: categories.length > 0 ? categories : [...STUDY_DEFAULT_CATEGORIES],
      keyword: params.keyword?.trim() || null,
      access,
      // Goal 层消费这个键（改名原因见 TvIndicatorListParams.accessFilter 注释）
      accessFilter: access,
      kind: params.kind?.trim() || null,
      limit,
    } as TvIndicatorListParams;
  }

  protected createGoal(): BaseGoal<TvStudyCatalogResult> {
    return new StudyCatalogGoal();
  }

  protected get pipeline(): ProjectionPipeline<
    TvIndicatorListParams,
    TvStudyCatalogResult,
    TvStudyCatalogResult,
    TvStudyCatalogProjected
  > {
    return {
      envelope: (data) => projectStudyCatalogAiReady(data),
    };
  }
}
