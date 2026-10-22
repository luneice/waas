import {
  InvalidParamsError,
  ProjectionPipeline,
  type SkillParamSchema,
} from "@spider/core";
import { SearchSkillBase } from "@src/skills/search/_base";
import { BiliSearchGoal } from "@src/thrall/search/search";
import {
  canonicalSearchKind,
  normalizeSearchNumbers,
  SEARCH_KIND_CONFIG,
} from "@src/thrall/search/query";
import { generateQvId } from "@src/thrall/wbi";
import type {
  BiliSearchKind,
  BiliSearchParams,
  BiliSearchProjected,
  BiliSearchResult,
} from "@src/types/search.types";
import { projectBiliSearchAiReady } from "@src/projections/search.ai-ready";

const ALL_KINDS: readonly BiliSearchKind[] = [
  "video",
  "media_bangumi",
  "media_ft",
  "live",
  "article",
  "bili_user",
];

/** Bilibili 搜索 Skill — 薄壳：仅声明参数 + 归一化 + 投影，数据获取交给 BiliSearchGoal。 */
export class BiliSearchSkill extends SearchSkillBase<
  BiliSearchParams,
  BiliSearchResult,
  BiliSearchProjected
> {
  readonly id = "bili-search";
  readonly name = "Bilibili 搜索";
  readonly description =
    "基于 Bilibili PC 搜索页接口 `/x/web-interface/wbi/search/type` 按关键词搜索分类结果。" +
    "当前覆盖视频、番剧、影视、直播、专栏、用户；视频/直播/用户按 dynamic_offset=24 翻页并去重。";
  readonly paramSchema: SkillParamSchema[] = [
    {
      name: "keyword",
      type: "string",
      required: true,
      description: "搜索关键词",
    },
    {
      name: "kind",
      type: "string",
      required: false,
      default: "video",
      description:
        "搜索分类：video / media_bangumi(bangumi) / media_ft(pgc) / live / article / bili_user(upuser)",
    },
    {
      name: "page",
      type: "number",
      required: false,
      default: 1,
      description: "起始页码，从 1 开始",
    },
    {
      name: "maxPages",
      type: "number",
      required: false,
      default: 1,
      description: "连续抓取页数；动态偏移分类会按主键去重",
    },
    {
      name: "pageSize",
      type: "number",
      required: false,
      description:
        "覆盖接口 page_size；默认 video/live=42, bili_user=36, article=20, PGC=12",
    },
    {
      name: "order",
      type: "string",
      required: false,
      description:
        "排序值，按分类透传；视频 click/pubdate/dm/stow，专栏 totalrank/pubdate/click/attention/scores，用户 fans/level",
    },
    {
      name: "pubtimeBeginS",
      type: "number",
      required: false,
      default: 0,
      description: "发布时间起始秒级时间戳",
    },
    {
      name: "pubtimeEndS",
      type: "number",
      required: false,
      default: 0,
      description: "发布时间结束秒级时间戳",
    },
    {
      name: "duration",
      type: "string",
      required: false,
      description: "视频时长筛选：0/空=不限，1/2/3/4 对应不同区间",
    },
    {
      name: "tids",
      type: "string",
      required: false,
      description: "视频分区 ID",
    },
    {
      name: "categoryId",
      type: "number",
      required: false,
      default: 0,
      description: "专栏分区 ID，默认 0=全部分区",
    },
    {
      name: "orderSort",
      type: "number",
      required: false,
      default: 0,
      description: "用户排序方向：0=降序，1=升序",
    },
    {
      name: "userType",
      type: "number",
      required: false,
      default: 0,
      description: "用户类型：0=全部，1=UP 主，2=普通用户，3=认证用户",
    },
    {
      name: "offsetStep",
      type: "number",
      required: false,
      default: 24,
      description: "动态偏移分页步长，默认 24，与 PC 搜索页 HAR 一致",
    },
    {
      name: "qvId",
      type: "string",
      required: false,
      description: "搜索会话 ID；不传则自动生成并在连续翻页中复用",
    },
  ];

  protected createGoal(): BiliSearchGoal {
    return new BiliSearchGoal();
  }

  protected normalizeParams(params: BiliSearchParams): BiliSearchParams {
    const keyword = (params.keyword ?? "").trim();
    if (!keyword) {
      throw new InvalidParamsError("keyword 不能为空", { scope: this.id });
    }

    const kind = canonicalSearchKind(params.kind);
    if (!kind || !ALL_KINDS.includes(kind)) {
      throw new InvalidParamsError(`不支持的 kind: ${String(params.kind)}`, {
        scope: this.id,
      });
    }

    const qvId = (params.qvId ?? "").trim() || generateQvId();
    const normalized = normalizeSearchNumbers({ ...params, keyword }, kind, qvId);

    if (normalized.page < 1) {
      throw new InvalidParamsError("page 必须 >= 1", { scope: this.id });
    }
    if (normalized.maxPages < 1) {
      throw new InvalidParamsError("maxPages 必须 >= 1", { scope: this.id });
    }
    if (normalized.maxPages > 20) {
      throw new InvalidParamsError("maxPages 目前限制为 <= 20", {
        scope: this.id,
      });
    }
    if (normalized.pageSize < 1 || normalized.pageSize > 100) {
      throw new InvalidParamsError("pageSize 必须在 1-100 之间", {
        scope: this.id,
      });
    }
    if (normalized.offsetStep < 1) {
      throw new InvalidParamsError("offsetStep 必须 >= 1", { scope: this.id });
    }
    if (normalized.pubtimeBeginS < 0 || normalized.pubtimeEndS < 0) {
      throw new InvalidParamsError("pubtimeBeginS/pubtimeEndS 必须 >= 0", {
        scope: this.id,
      });
    }
    if (
      normalized.pubtimeBeginS > 0 &&
      normalized.pubtimeEndS > 0 &&
      normalized.pubtimeBeginS > normalized.pubtimeEndS
    ) {
      throw new InvalidParamsError("pubtimeBeginS 不能晚于 pubtimeEndS", {
        scope: this.id,
      });
    }

    const config = SEARCH_KIND_CONFIG[kind];
    return {
      keyword: normalized.keyword,
      kind: normalized.kind,
      page: normalized.page,
      maxPages: normalized.maxPages,
      pageSize: normalized.pageSize || config.pageSize,
      order: normalized.order,
      pubtimeBeginS: normalized.pubtimeBeginS,
      pubtimeEndS: normalized.pubtimeEndS,
      duration: normalized.duration,
      tids: normalized.tids,
      categoryId: normalized.categoryId,
      orderSort: normalized.orderSort,
      userType: normalized.userType,
      offsetStep: normalized.offsetStep,
      qvId: normalized.qvId,
    } as BiliSearchParams;
  }

  protected get pipeline(): ProjectionPipeline<
    BiliSearchParams,
    BiliSearchResult,
    BiliSearchResult,
    BiliSearchProjected
  > {
    return {
      envelope: (data) => projectBiliSearchAiReady(data),
    };
  }
}
