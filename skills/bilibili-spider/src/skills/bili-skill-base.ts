import { PuppeteerGoalSkill } from "@spider/core";
import { BILIBILI_WWW } from "@src/constants";

/**
 * Bilibili Skill 基类
 *
 * 继承 `PuppeteerGoalSkill`：子类只需实现 `createGoal(params)` 返回声明式 Goal，
 * 数据获取（@Endpoint/@Expanded/@Aggregate）与翻页全部由 Goal 装饰器体系完成。
 * 默认站点为 www；搜索模块在自己的 _base 里收窄为 search 站点。
 */
export abstract class BiliSkillBase<
  TParams extends object = Record<string, unknown>,
  TData = unknown,
  TProjected = TData,
> extends PuppeteerGoalSkill<TParams, TData, TProjected> {
  protected readonly siteURL: string = BILIBILI_WWW;
}
