import { type ProjectionPipeline, BaseGoal, InvalidParamsError, type SkillParamSchema } from "@spider/core";
import { BILIBILI_SPACE } from "@src/constants";
import { BiliSkillBase } from "@src/skills/bili-skill-base";
import { normalizeMid } from "@src/thrall/creator/shared";
import { BiliChannelSeasonGoal } from "@src/thrall/channel/season";
import { BiliChannelSeriesGoal } from "@src/thrall/channel/series";
import type {
  BiliChannelParams,
  BiliChannelProjected,
  BiliChannelResult,
} from "@src/types/channel.types";
import { projectBiliChannelAiReady } from "@src/projections/channel.ai-ready";

const DETAIL_PATH: Record<BiliChannelParams["kind"], string> = {
  season: "collectiondetail",
  series: "seriesdetail",
};

/**
 * Bilibili 合集/系列详情 Skill —— 单个 season/series 的全量稿件。
 *
 * 与 bili-creator-channels（目录 + 预览）正交：本 Skill 按 season_id/series_id 拉取
 * 单个合集或系列内的全量稿件并翻页。kind=season 走 seasons_archives_list，
 * kind=series 走 x/series/archives，均无 WBI。先用 bili-creator-channels 获取
 * kind 与 id，再用本 Skill 取全量。
 */
export class BiliChannelSkill extends BiliSkillBase<
  BiliChannelParams,
  BiliChannelResult,
  BiliChannelProjected
> {
  protected readonly siteURL = BILIBILI_SPACE;

  readonly id = "bili-channel";
  readonly name = "Bilibili 合集/系列详情";
  readonly description =
    "根据 mid + kind(season/series) + id 拉取单个合集或系列内的全量稿件（按页连续抓取并按 aid 去重）。" +
    "kind 与 id 可由 bili-creator-channels 获取；season 含合集名/封面/简介，series 仅返回稿件列表。";
  readonly paramSchema: SkillParamSchema[] = [
    {
      name: "kind",
      type: "string",
      required: true,
      description: "season(合集) 或 series(系列)",
    },
    {
      name: "id",
      type: "string",
      required: true,
      description: "season_id 或 series_id（合集/系列详情页 ?sid= 的值）",
    },
    {
      name: "mid",
      type: "string",
      required: true,
      description: "UP 主 mid、主页 URL 或 space.bilibili.com/{mid}",
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
      default: 30,
      description: "每页条数（默认 30）",
    },
  ];

  protected getPath(params: BiliChannelParams): string {
    const mid = String(params.mid ?? "").replace(/\D/g, "");
    const sid = String(params.id ?? "").replace(/\D/g, "");
    return `/${mid}/channel/${DETAIL_PATH[params.kind]}?sid=${sid}`;
  }

  protected createGoal(params: BiliChannelParams): BaseGoal<BiliChannelResult> {
    return params.kind === "season"
      ? new BiliChannelSeasonGoal()
      : new BiliChannelSeriesGoal();
  }

  protected normalizeParams(params: BiliChannelParams): BiliChannelParams {
    const kind = params.kind;
    if (kind !== "season" && kind !== "series") {
      throw new InvalidParamsError("kind 必须为 season 或 series", {
        scope: this.id,
      });
    }
    const id = String(params.id ?? "").replace(/\D/g, "");
    if (!id) {
      throw new InvalidParamsError("需要传入 id（season_id/series_id）", {
        scope: this.id,
      });
    }
    const mid = normalizeMid(params.mid, this.id);
    const page = Number(params.page ?? 1);
    const maxPages = Number(params.maxPages ?? 1);
    const pageSize = Number(params.pageSize ?? 30);
    if (page < 1) {
      throw new InvalidParamsError("page 必须 >= 1", { scope: this.id });
    }
    if (maxPages < 1 || maxPages > 50) {
      throw new InvalidParamsError("maxPages 必须在 1-50 之间", {
        scope: this.id,
      });
    }
    if (pageSize < 1 || pageSize > 50) {
      throw new InvalidParamsError("pageSize 必须在 1-50 之间", {
        scope: this.id,
      });
    }
    return { kind, id, mid, page, maxPages, pageSize };
  }

  protected get pipeline(): ProjectionPipeline<
    BiliChannelParams,
    BiliChannelResult,
    BiliChannelResult,
    BiliChannelProjected
  > {
    return {
      envelope: (data) => projectBiliChannelAiReady(data),
    };
  }
}
