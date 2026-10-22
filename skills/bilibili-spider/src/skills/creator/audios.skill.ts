import { type ProjectionPipeline, InvalidParamsError, type SkillParamSchema } from "@spider/core";
import { CreatorSkillBase } from "@src/skills/creator/_base";
import { BiliCreatorAudiosGoal } from "@src/thrall/creator/audios";
import { normalizeMid } from "@src/thrall/creator/shared";
import type {
  BiliCreatorAudiosParams,
  BiliCreatorAudiosProjected,
  BiliCreatorAudiosResult,
} from "@src/types/creator.types";
import { projectBiliCreatorAudiosAiReady } from "@src/projections/creator.ai-ready";

/**
 * Bilibili 创作者音频 Skill —— `/audio/music-service/web/song/upper`。
 *
 * UP 主投稿音频列表，按 page..page+maxPages-1 连续抓取并按 auid 去重。无 WBI。
 */
export class BiliCreatorAudiosSkill extends CreatorSkillBase<
  BiliCreatorAudiosParams,
  BiliCreatorAudiosResult,
  BiliCreatorAudiosProjected
> {
  readonly id = "bili-creator-audios";
  readonly name = "Bilibili 创作者音频";
  readonly description =
    "根据 mid 获取 UP 主投稿音频列表（song/upper）。按页连续抓取并按 auid 去重，" +
    "含播放/收藏/评论/分享等统计。";
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
      description: "连续抓取页数，按 auid 去重",
    },
    {
      name: "pageSize",
      type: "number",
      required: false,
      default: 42,
      description: "每页条数（ps，默认 42）",
    },
  ];

  protected createGoal(): BiliCreatorAudiosGoal {
    return new BiliCreatorAudiosGoal();
  }

  protected normalizeParams(params: BiliCreatorAudiosParams): BiliCreatorAudiosParams {
    const mid = normalizeMid(params.mid, this.id);
    const page = Number(params.page ?? 1);
    const maxPages = Number(params.maxPages ?? 1);
    const pageSize = Number(params.pageSize ?? 42);
    if (page < 1) {
      throw new InvalidParamsError("page 必须 >= 1", { scope: this.id });
    }
    if (maxPages < 1 || maxPages > 20) {
      throw new InvalidParamsError("maxPages 必须在 1-20 之间", {
        scope: this.id,
      });
    }
    if (pageSize < 1 || pageSize > 100) {
      throw new InvalidParamsError("pageSize 必须在 1-100 之间", {
        scope: this.id,
      });
    }
    return { mid, page, maxPages, pageSize };
  }

  protected get pipeline(): ProjectionPipeline<
    BiliCreatorAudiosParams,
    BiliCreatorAudiosResult,
    BiliCreatorAudiosResult,
    BiliCreatorAudiosProjected
  > {
    return {
      envelope: (data) => projectBiliCreatorAudiosAiReady(data),
    };
  }
}
