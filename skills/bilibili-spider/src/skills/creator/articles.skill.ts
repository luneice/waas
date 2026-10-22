import { type ProjectionPipeline, type SkillParamSchema } from "@spider/core";
import { CreatorSkillBase } from "@src/skills/creator/_base";
import { BiliCreatorArticlesGoal } from "@src/thrall/creator/articles";
import { normalizeMid } from "@src/thrall/creator/shared";
import type {
  BiliCreatorArticlesParams,
  BiliCreatorArticlesProjected,
  BiliCreatorArticlesResult,
} from "@src/types/creator.types";
import { projectBiliCreatorArticlesAiReady } from "@src/projections/creator.ai-ready";

/**
 * Bilibili 创作者图文 Skill —— `/x/polymer/web-dynamic/v1/opus/feed/space`（WBI）。
 *
 * offset 游标续取：单次抓一页，结果含 nextOffset/hasMore。
 */
export class BiliCreatorArticlesSkill extends CreatorSkillBase<
  BiliCreatorArticlesParams,
  BiliCreatorArticlesResult,
  BiliCreatorArticlesProjected
> {
  readonly id = "bili-creator-articles";
  readonly name = "Bilibili 创作者图文";
  readonly description =
    "根据 mid 获取 UP 主图文/专栏动态（opus/feed/space，WBI 签名）。按 offset" +
    "游标翻页，单次返回一页并给出 nextOffset/hasMore 供续取。";
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

  protected createGoal(): BiliCreatorArticlesGoal {
    return new BiliCreatorArticlesGoal();
  }

  protected normalizeParams(params: BiliCreatorArticlesParams): BiliCreatorArticlesParams {
    return {
      mid: normalizeMid(params.mid, this.id),
      offset: (params.offset ?? "").trim(),
    };
  }

  protected get pipeline(): ProjectionPipeline<
    BiliCreatorArticlesParams,
    BiliCreatorArticlesResult,
    BiliCreatorArticlesResult,
    BiliCreatorArticlesProjected
  > {
    return {
      envelope: (data) => projectBiliCreatorArticlesAiReady(data),
    };
  }
}
