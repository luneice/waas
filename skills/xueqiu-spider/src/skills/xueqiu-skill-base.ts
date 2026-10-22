/**
 * 站点级基类 —— 只钉 siteURL，不承载业务逻辑
 */
import { PuppeteerGoalSkill } from "@spider/core";
import { XUEQIU_SITE } from "@src/constants";

export abstract class XueqiuSkillBase<
  TParams extends object = Record<string, unknown>,
  TData extends object = object,
  TProjected = TData,
> extends PuppeteerGoalSkill<TParams, TData, TProjected> {
  protected readonly siteURL = XUEQIU_SITE;
}
