import { PuppeteerSkill } from "@spider/core";
import { BILIBILI_WWW } from "@src/constants";

/**
 * 专栏模块 Skill 基类（站点 `https://www.bilibili.com`）。
 *
 * 专栏正文是详情页 SSR 内联状态，没有可声明的 HTTP 端点，所以**刻意不继承
 * `BiliSkillBase`**（那条链是 `PuppeteerGoalSkill`，会强制实现 createGoal）。
 * 直接继承 `PuppeteerSkill`，由具体 Skill 覆写 fetchData/navigate 自取；
 * getPath 返回空串，导航由 navigate() 决定。
 */
export abstract class ArticleSkillBase<
  TParams extends object = Record<string, unknown>,
  TData = unknown,
  TProjected = TData,
> extends PuppeteerSkill<TParams, TData, TProjected> {
  protected readonly siteURL = BILIBILI_WWW;

  protected getPath(): string {
    return "";
  }
}
