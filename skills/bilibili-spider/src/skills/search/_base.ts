import { BILIBILI_SITE } from "@src/constants";
import { BiliSkillBase } from "@src/skills/bili-skill-base";
import { SEARCH_KIND_CONFIG } from "@src/thrall/search/query";
import type { BiliSearchKind, BiliSearchParams } from "@src/types/search.types";

/**
 * 搜索模块 Skill 基类 — 锁定到 PC 搜索站点 `https://search.bilibili.com`。
 *
 * 对齐 xhs-spider/src/skills/note-search/_base.ts：把共用的 siteURL 与
 * 页面导航（getPath）收敛到基类，具体 Skill 只关心 createGoal + 投影。
 * 导航到与搜索分类一致的页面以携带登录态 Cookie 并满足接口 referer 预期。
 */
export abstract class SearchSkillBase<
  TParams extends BiliSearchParams = BiliSearchParams,
  TData = unknown,
  TProjected = TData,
> extends BiliSkillBase<TParams, TData, TProjected> {
  protected readonly siteURL = BILIBILI_SITE;

  protected getPath(params: TParams): string {
    const kind = (params.kind ?? "video") as BiliSearchKind;
    const config = SEARCH_KIND_CONFIG[kind] ?? SEARCH_KIND_CONFIG.video;
    const query = new URLSearchParams();
    query.set("keyword", String(params.keyword ?? ""));
    if ((params.page ?? 1) > 1) query.set("page", String(params.page));
    if (params.order) query.set("order", String(params.order));
    if (kind === "bili_user" && params.orderSort === 1) {
      query.set("order_sort", "1");
    }
    return `/${config.pagePath}?${query.toString()}`;
  }
}
