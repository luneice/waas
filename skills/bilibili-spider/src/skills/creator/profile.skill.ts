import { type ProjectionPipeline, type SkillParamSchema } from "@spider/core";
import { CreatorSkillBase } from "@src/skills/creator/_base";
import { BiliCreatorProfileGoal } from "@src/thrall/creator/profile";
import { normalizeMid } from "@src/thrall/creator/shared";
import type {
  BiliCreatorProfileParams,
  BiliCreatorProfileProjected,
  BiliCreatorProfileResult,
} from "@src/types/creator.types";
import { projectBiliCreatorProfileAiReady } from "@src/projections/creator.ai-ready";

/**
 * Bilibili 创作者名片 Skill —— UP 主名片。
 *
 * 聚合 acc/info(WBI) + relation/stat + upstat + navnum + notice + masterpiece，
 * 一次给出资料卡 + 各模块条目数 + 代表作。navnum 可作为后续列表 Skill 的目录依据。
 */
export class BiliCreatorSkill extends CreatorSkillBase<
  BiliCreatorProfileParams,
  BiliCreatorProfileResult,
  BiliCreatorProfileProjected
> {
  readonly id = "bili-creator";
  readonly name = "Bilibili 创作者名片";
  readonly description =
    "根据 mid（或主页 URL）获取 UP 主名片：基础资料、认证/大会员、关注粉丝、" +
    "累计播放获赞、各模块条目数（navnum）、空间公告与代表作。";
  readonly paramSchema: SkillParamSchema[] = [
    {
      name: "mid",
      type: "string",
      required: true,
      description: "用户 mid、主页 URL 或 space.bilibili.com/{mid}",
    },
  ];

  protected createGoal(): BiliCreatorProfileGoal {
    return new BiliCreatorProfileGoal();
  }

  protected normalizeParams(
    params: BiliCreatorProfileParams,
  ): BiliCreatorProfileParams {
    return { mid: normalizeMid(params.mid, this.id) };
  }

  protected get pipeline(): ProjectionPipeline<
    BiliCreatorProfileParams,
    BiliCreatorProfileResult,
    BiliCreatorProfileResult,
    BiliCreatorProfileProjected
  > {
    return {
      envelope: (data) => projectBiliCreatorProfileAiReady(data),
    };
  }
}
