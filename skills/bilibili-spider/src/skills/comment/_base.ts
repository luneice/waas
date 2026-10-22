import { BiliSkillBase } from "@src/skills/bili-skill-base";

/**
 * 评论模块 Skill 基类（站点 `https://www.bilibili.com`）。
 *
 * 评论区按 (oid,type) 定位、与内容形态解耦，导航到 www 首页携带登录态 Cookie 即可，
 * 接口请求由 Goal 的 @Endpoint 体系发起（reply/wbi/main，WBI 签名）。getPath 返回
 * 空串：评论 Skill 自行编排多页抓取（覆写 fetchData），无需按入口拼接路径。
 */
export abstract class CommentSkillBase<
  TParams extends object = Record<string, unknown>,
  TData = unknown,
  TProjected = TData,
> extends BiliSkillBase<TParams, TData, TProjected> {
  protected getPath(): string {
    return "";
  }
}
