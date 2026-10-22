import { type ProjectionPipeline, InvalidParamsError, type SkillParamSchema } from "@spider/core";
import { CreatorSkillBase } from "@src/skills/creator/_base";
import { BiliCreatorVideosGoal } from "@src/thrall/creator/videos";
import { normalizeMid } from "@src/thrall/creator/shared";
import type {
  BiliCreatorVideosOrder,
  BiliCreatorVideosParams,
  BiliCreatorVideosProjected,
  BiliCreatorVideosResult,
} from "@src/types/creator.types";
import { projectBiliCreatorVideosAiReady } from "@src/projections/creator.ai-ready";

const VIDEO_ORDERS: readonly BiliCreatorVideosOrder[] = [
  "pubdate",
  "click",
  "stow",
];

/**
 * Bilibili 创作者投稿视频 Skill —— `/x/space/wbi/arc/search`（WBI）。
 *
 * 按 page..page+maxPages-1 连续抓取并按 aid 去重；支持 order/tid/空间内 keyword。
 * total 取 page.count，partitions 取 list.tlist。
 */
export class BiliCreatorVideosSkill extends CreatorSkillBase<
  BiliCreatorVideosParams,
  BiliCreatorVideosResult,
  BiliCreatorVideosProjected
> {
  readonly id = "bili-creator-videos";
  readonly name = "Bilibili 创作者投稿视频";
  readonly description =
    "根据 mid 获取 UP 主投稿视频列表（arc/search，WBI 签名）。支持排序" +
    "（pubdate/click/stow）、分区 tid 过滤、空间内关键词检索，按页连续抓取并去重。";
  readonly paramSchema: SkillParamSchema[] = [
    {
      name: "mid",
      type: "string",
      required: true,
      description: "用户 mid、主页 URL 或 space.bilibili.com/{mid}",
    },
    {
      name: "order",
      type: "string",
      required: false,
      default: "pubdate",
      description: "排序：pubdate(最新) / click(最多播放) / stow(最多收藏)",
    },
    {
      name: "tid",
      type: "number",
      required: false,
      default: 0,
      description: "分区筛选 tid，0=全部",
    },
    {
      name: "keyword",
      type: "string",
      required: false,
      description: "在该 UP 稿件内检索的关键词",
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
      description: "连续抓取页数，按 aid 去重",
    },
    {
      name: "pageSize",
      type: "number",
      required: false,
      default: 25,
      description: "每页条数（接口 ps，默认 25）",
    },
  ];

  protected createGoal(): BiliCreatorVideosGoal {
    return new BiliCreatorVideosGoal();
  }

  protected normalizeParams(params: BiliCreatorVideosParams): BiliCreatorVideosParams {
    const mid = normalizeMid(params.mid, this.id);
    const order = (params.order ?? "pubdate") as BiliCreatorVideosOrder;
    if (!VIDEO_ORDERS.includes(order)) {
      throw new InvalidParamsError(`不支持的 order: ${String(params.order)}`, {
        scope: this.id,
      });
    }
    const page = Number(params.page ?? 1);
    const maxPages = Number(params.maxPages ?? 1);
    const pageSize = Number(params.pageSize ?? 25);
    if (page < 1) {
      throw new InvalidParamsError("page 必须 >= 1", { scope: this.id });
    }
    if (maxPages < 1 || maxPages > 20) {
      throw new InvalidParamsError("maxPages 必须在 1-20 之间", {
        scope: this.id,
      });
    }
    if (pageSize < 1 || pageSize > 50) {
      throw new InvalidParamsError("pageSize 必须在 1-50 之间", {
        scope: this.id,
      });
    }
    return {
      mid,
      order,
      tid: Number(params.tid ?? 0),
      keyword: (params.keyword ?? "").trim(),
      page,
      maxPages,
      pageSize,
    };
  }

  protected get pipeline(): ProjectionPipeline<
    BiliCreatorVideosParams,
    BiliCreatorVideosResult,
    BiliCreatorVideosResult,
    BiliCreatorVideosProjected
  > {
    return {
      envelope: (data) => projectBiliCreatorVideosAiReady(data),
    };
  }
}
