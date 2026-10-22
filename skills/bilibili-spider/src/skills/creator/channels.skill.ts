import { type ProjectionPipeline, InvalidParamsError, type SkillParamSchema } from "@spider/core";
import { CreatorSkillBase } from "@src/skills/creator/_base";
import { BiliCreatorChannelsGoal } from "@src/thrall/creator/channels";
import { normalizeMid } from "@src/thrall/creator/shared";
import type {
  BiliCreatorChannelsParams,
  BiliCreatorChannelsProjected,
  BiliCreatorChannelsResult,
} from "@src/types/creator.types";
import { projectBiliCreatorChannelsAiReady } from "@src/projections/creator.ai-ready";

/**
 * Bilibili 创作者合集与系列 Skill —— `/x/polymer/web-space/seasons_series_list`。
 *
 * 合并合集(season)与系列(series)，每项附预览级稿件；按 page..page+maxPages-1
 * 连续抓取并按 kind:id 去重。无 WBI。
 */
export class BiliCreatorChannelsSkill extends CreatorSkillBase<
  BiliCreatorChannelsParams,
  BiliCreatorChannelsResult,
  BiliCreatorChannelsProjected
> {
  readonly id = "bili-creator-channels";
  readonly name = "Bilibili 创作者合集与系列";
  readonly description =
    "根据 mid 获取 UP 主合集(season)与系列(series)列表（seasons_series_list）。" +
    "每项含预览稿件，按页连续抓取并去重；全量稿件需用 bili-channel 按 id 二次抓取。";
  readonly paramSchema: SkillParamSchema[] = [
    {
      name: "mid",
      type: "string",
      required: true,
      description: "用户 mid、主页 URL 或 space.bilibili.com/{mid}",
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
      description: "连续抓取页数，按 kind:id 去重",
    },
    {
      name: "pageSize",
      type: "number",
      required: false,
      default: 20,
      description: "每页条数（page_size，默认 20）",
    },
  ];

  protected createGoal(): BiliCreatorChannelsGoal {
    return new BiliCreatorChannelsGoal();
  }

  protected normalizeParams(
    params: BiliCreatorChannelsParams,
  ): BiliCreatorChannelsParams {
    const mid = normalizeMid(params.mid, this.id);
    const page = Number(params.page ?? 1);
    const maxPages = Number(params.maxPages ?? 1);
    const pageSize = Number(params.pageSize ?? 20);
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
    return { mid, page, maxPages, pageSize };
  }

  protected get pipeline(): ProjectionPipeline<
    BiliCreatorChannelsParams,
    BiliCreatorChannelsResult,
    BiliCreatorChannelsResult,
    BiliCreatorChannelsProjected
  > {
    return {
      envelope: (data) => projectBiliCreatorChannelsAiReady(data),
    };
  }
}
