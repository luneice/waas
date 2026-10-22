/**
 * 站点级 Skill 基类 —— 只承载「坐标」（站点 URL、导航策略），不承载业务逻辑。
 *
 * 本包所有 Skill 都必须先导航到站点同源页面，因为：
 *   - 页内 fetch 要继承 Origin/Referer（检索接口缺 Origin 直接 403）
 *   - 页内 WebSocket 同样要求 Origin，否则握手被拒
 * 这是选「浏览器链路」而非纯 Node 直连的根本原因（CLAUDE.md §4.6）。
 *
 * HTTP 取数走框架的 Goal 引擎（`@Endpoint` → `GoalExecutor` → 页内 fetch），
 * 不自己写 fetch —— 凭证模式、重试、观测、错误归类框架都已处理。
 */

import {
  PuppeteerGoalSkill,
  BlockResource,
  type GoalSkillDeps,
} from "@spider/core";
import type { PuppeteerLifeCycleEvent } from "puppeteer-core";
import { TV_SITE } from "@src/constants";
import type { TvWsTransportFactory } from "@src/ws/transport";

export interface TvSkillDeps extends GoalSkillDeps {
  /**
   * WS 传输层工厂 —— 生产走 `createPageWsTransport`，测试注入 FakeTvTransport。
   *
   * 走构造函数注入而非全局：core 的 `runSkillWithFixtures` 只覆盖
   * `sessionProvider` / `artifactSink`，构造期注入的工厂能原样存活，
   * 这正是 WS 链路可测的关键缝。
   */
  wsTransportFactory?: TvWsTransportFactory;
}

/**
 * 屏蔽重资源 —— 本包只借页面当「同源发请求的壳」，不需要渲染。
 *
 * 不屏蔽 `script`：站点自身的 JS 与我们的取数无冲突，而屏蔽脚本可能触发
 * 站点的降级逻辑（未实测），收益（省一点带宽）远小于风险。
 */
@BlockResource({ types: ["image", "media", "font", "stylesheet"] })
export abstract class TvSkillBase<
  TParams extends object,
  TResult,
  TProjected = TResult,
> extends PuppeteerGoalSkill<TParams, TResult, TProjected> {
  constructor(protected readonly tvDeps: TvSkillDeps) {
    super(tvDeps);
  }

  protected readonly siteURL = TV_SITE;

  /** 落在站点首页即可 —— 只取其同源上下文，不解析页面内容 */
  protected getPath(): string {
    return "/";
  }

  /**
   * 不等 networkidle：站点首页有常驻 WS 与轮询，`networkidle2` 会一直等不到静默，
   * 白白耗掉 30s 超时。我们只需要 document 就绪即可发请求。
   */
  protected get navigateWaitUntil(): PuppeteerLifeCycleEvent {
    return "domcontentloaded";
  }
}
