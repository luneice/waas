import { type ProjectionPipeline, type SkillParamSchema } from "@spider/core";
import { CreatorSkillBase } from "@src/skills/creator/_base";
import { BiliCreatorFeedGoal } from "@src/thrall/creator/feed";
import { normalizeMid } from "@src/thrall/creator/shared";
import type {
  BiliCreatorFeedParams,
  BiliCreatorFeedProjected,
  BiliCreatorFeedResult,
} from "@src/types/creator.types";
import { projectBiliCreatorFeedAiReady } from "@src/projections/creator.ai-ready";

/**
 * Bilibili 创作者动态 Skill —— `/x/polymer/web-dynamic/v1/feed/space`（WBI）。
 *
 * offset 游标续取：单次抓一页，结果含 nextOffset/hasMore，调用方携带 offset 续取。
 * 混合时间线（视频/图文/转发/纯文本均含），每项以 kind 标注大类。
 */
export class BiliCreatorFeedSkill extends CreatorSkillBase<
  BiliCreatorFeedParams,
  BiliCreatorFeedResult,
  BiliCreatorFeedProjected
> {
  readonly id = "bili-creator-feed";
  readonly name = "Bilibili 创作者动态";
  readonly description =
    "根据 mid 获取 UP 主动态时间线（feed/space，WBI 签名）。按 offset 游标翻页，" +
    "单次返回一页并给出 nextOffset/hasMore 供续取；混合时间线，每项以 kind 标注" +
    "（archive/opus/forward/word）。";
  readonly paramSchema: SkillParamSchema[] = [
    {
      name: "mid",
      type: "string",
      required: true,
      description: "用户 mid、主页 URL 或 space.bilibili.com/{mid}",
    },
    {
      name: "offset",
      type: "string",
      required: false,
      description: "翻页游标，首页留空；续取传上一次返回的 nextOffset",
    },
  ];

  protected createGoal(): BiliCreatorFeedGoal {
    return new BiliCreatorFeedGoal();
  }

  protected normalizeParams(
    params: BiliCreatorFeedParams,
  ): BiliCreatorFeedParams {
    return {
      mid: normalizeMid(params.mid, this.id),
      offset: (params.offset ?? "").trim(),
    };
  }

  protected get pipeline(): ProjectionPipeline<
    BiliCreatorFeedParams,
    BiliCreatorFeedResult,
    BiliCreatorFeedResult,
    BiliCreatorFeedProjected
  > {
    return {
      envelope: (data) => projectBiliCreatorFeedAiReady(data),
    };
  }
}
