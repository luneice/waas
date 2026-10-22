import { BILIBILI_SPACE } from "@src/constants";
import { BiliSkillBase } from "@src/skills/bili-skill-base";
import type { BiliCreatorMidParams } from "@src/types/creator.types";

/**
 * 创作者模块 Skill 基类 —— 锁定到 `https://space.bilibili.com`。
 *
 * 对齐 search/_base.ts：把共用的 siteURL 与页面导航收敛到基类。
 * 导航到 `space.bilibili.com/{mid}` 以携带登录态 Cookie 并满足接口 referer 预期。
 */
export abstract class CreatorSkillBase<
  TParams extends BiliCreatorMidParams = BiliCreatorMidParams,
  TData = unknown,
  TProjected = TData,
> extends BiliSkillBase<TParams, TData, TProjected> {
  protected readonly siteURL = BILIBILI_SPACE;

  protected getPath(params: TParams): string {
    const mid = String(params.mid ?? "").replace(/\D/g, "");
    return `/${mid}`;
  }
}
