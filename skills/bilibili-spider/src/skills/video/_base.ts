import { BILIBILI_WWW } from "@src/constants";
import { BiliSkillBase } from "@src/skills/bili-skill-base";

/**
 * 视频模块 Skill 基类 — 站点 `https://www.bilibili.com`。
 *
 * 视频下载的导航目标依赖 direct(BV/av) vs search(keyword) 两种入口，
 * 由具体 Skill 覆写 navigate() 决定，因此 getPath 返回空串（基类 navigate 直接跳过）。
 */
export abstract class VideoSkillBase<
  TParams extends object = Record<string, unknown>,
  TData = unknown,
  TProjected = TData,
> extends BiliSkillBase<TParams, TData, TProjected> {
  protected readonly siteURL = BILIBILI_WWW;

  protected getPath(): string {
    return "";
  }
}
