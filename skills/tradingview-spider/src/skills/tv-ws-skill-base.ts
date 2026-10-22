/**
 * WS 链路 Skill 的模块级基类
 *
 * ══════════════ 为什么刻意不继承 TvSkillBase ══════════════
 *
 * `TvSkillBase` 那条链是 `PuppeteerGoalSkill`，会**强制实现 `createGoal()`**。
 * 但 WS 链路根本没有可声明的 HTTP 端点 —— 数据来自长连接推送，
 * 不是「发请求→拿响应」。硬套 Goal 只能造一个空壳 Goal 骗过类型系统。
 *
 * 所以这里直接继承 `PuppeteerSkill`，自己实现 `fetchData`。
 * （同 bilibili-spider 的 `ArticleSkillBase` —— 专栏正文是 SSR 内联状态，
 *   同样没有端点可声明，本仓已有此先例。）
 *
 * ══════════════ 连接生命周期交给框架 ══════════════
 *
 *   `@Ready`    建连（**导航之后**、fetchData 之前）
 *   `@Teardown` 释放（在 `finally` 里跑，忽略激活条件、逐 hook 吞异常）
 *
 * ⚠️ **必须是 `@Ready` 而不是 `@Setup`**：框架的阶段顺序是
 * `setup → navigate → ready → interact → fetchData`，`@Setup` 跑在导航**之前**，
 * 此时页面还是 `about:blank` —— 没有 Origin，WS 握手会被上游直接拒绝
 * （真机表现为 `WebSocket error event`，重试三次全败）。
 * 这个错单测抓不到（假 transport 不关心页面 URL），只在真机暴露。
 *
 * 这正是框架为「建连 → 用 → 必然释放」提供的机制，不再自建 withXxx 包装器
 * ——那既绕过框架的阶段观测，也多一份要维护的代码。
 *
 * 连接句柄走 **Slot** 在阶段间传递，不用实例字段：每次 `execute()` 新建
 * `PageContext` 正是为了杜绝并发串数据（CLAUDE.md §2.6 / §3.2）。
 *
 * 建连重试复用框架的 `RetryPolicy`（按 `SpiderError.isRetryable()` 决策，
 * 建连失败抛的 `endpoint-timeout` / `endpoint-http` 都在可重试集合内），
 * 不自己写退避循环。
 */

import {
  BlockResource,
  PuppeteerSkill,
  Ready,
  RetryPolicy,
  Teardown,
  defineSlot,
  type PuppeteerSkillDeps,
} from "@spider/core";
import type { Page, PuppeteerLifeCycleEvent } from "puppeteer-core";
import type { PageContext, SlotKey } from "@spider/core";
import { TV_SITE, WS_OPEN_TIMEOUT_MS } from "@src/constants";
import { createPageWsTransport, type TvWsTransportFactory } from "@src/ws/transport";
import { TvWsClient } from "@src/ws/client";
import type { TvWsDiagnostics } from "@src/types/ws.types";

export interface TvWsSkillDeps extends PuppeteerSkillDeps {
  /**
   * WS 传输层工厂 —— 生产走 `createPageWsTransport`，测试注入 FakeTvTransport。
   *
   * 走构造函数注入而非全局：core 的 `runSkillWithFixtures` 只覆盖
   * `sessionProvider` / `artifactSink`，构造期注入的工厂能原样存活，
   * 这正是 WS 链路可测的关键缝（core 的 FakePage 沙箱没有 WebSocket 全局）。
   */
  wsTransportFactory?: TvWsTransportFactory;
}

/** 已建连的 WS 客户端（setup 写入，fetchData 读取，teardown 释放） */
export const TvWsClientSlot: SlotKey<TvWsClient> = defineSlot("tv.wsClient");

/** 传输诊断（fetchData 写入，投影阶段读取） */
export const TvWsDiagnosticsSlot: SlotKey<TvWsDiagnostics> =
  defineSlot("tv.wsDiagnostics");

/** 建连重试：握手失败多为瞬时网络抖动，退避两次足够 */
const CONNECT_RETRY = new RetryPolicy({
  times: 2,
  delayMs: 1000,
  backoff: "exponential",
  label: "tv-ws-connect",
});

/**
 * 屏蔽重资源 —— 本包只借页面当「同源建连的壳」，不需要渲染。
 *
 * 不屏蔽 `script`：站点自身 JS 与取数无冲突，屏蔽反而可能触发站点降级逻辑
 * （未实测），收益远小于风险。
 */
@BlockResource({ types: ["image", "media", "font", "stylesheet"] })
export abstract class TvWsSkillBase<
  TParams extends object,
  TResult,
  TProjected = TResult,
> extends PuppeteerSkill<TParams, TResult, TProjected> {
  constructor(protected readonly tvDeps: TvWsSkillDeps) {
    super(tvDeps);
  }

  protected readonly siteURL = TV_SITE;

  /** 落在站点首页即可 —— 只取其同源上下文（WS 握手要求 Origin） */
  protected getPath(): string {
    return "/";
  }

  /**
   * WS 建连只依赖 document 的 origin，与站点脚本无关，故不等 networkidle
   * （站点首页有常驻 WS 与轮询，等 networkidle 会白耗满超时）。
   */
  protected get navigateWaitUntil(): PuppeteerLifeCycleEvent {
    return "domcontentloaded";
  }

  /**
   * 该 Skill 是否需要页面的登录态。
   *
   * 默认 false —— 行情与 K 线用游客态即可（本包不做任何 token 提取，
   * 天然满足「凭据不出页面」）。技术指标必须覆写为 true：上游要求真实登录
   * token，否则 `create_study` 直接被拒（`Study not allowed in this connection`）。
   *
   * 注意即使为 true，token 也只在**页面内**取用，Node 侧永远看不到它。
   */
  protected get requiresAuth(): boolean {
    return false;
  }

  @Ready()
  protected async openWsChannel(
    page: Page,
    ctx: PageContext<TParams>,
  ): Promise<void> {
    const factory = this.tvDeps.wsTransportFactory ?? createPageWsTransport;

    const client = await CONNECT_RETRY.run(
      async () => {
        const transport = factory(page, this.id);
        const c = new TvWsClient(transport, { scope: this.id });
        await c.connect(WS_OPEN_TIMEOUT_MS, this.requiresAuth);
        return c;
      },
      { scope: this.id, skillId: this.id, phase: "ready" },
    );

    ctx.set(TvWsClientSlot, client);
  }

  /**
   * 释放连接。
   *
   * 内部自行 try/catch：`buildSelfHook` 把同一 Stage 的多个方法串在一个无
   * try/catch 的循环里，本方法抛错会**跳过同类后续的 @Teardown 方法**。
   * 框架只在 hook 之间隔离异常，不在同一 hook 内的方法之间隔离。
   */
  @Teardown()
  protected async closeWsChannel(
    _page: Page,
    ctx: PageContext<TParams>,
  ): Promise<void> {
    try {
      const client = ctx.get(TvWsClientSlot);
      if (client) await client.close();
    } catch {
      /* 清理阶段不抛错：页面可能已崩溃，连接也已随之失效 */
    } finally {
      ctx.delete(TvWsClientSlot);
    }
  }

  /** fetchData 里取已建连的客户端（缺失说明 setup 没跑，属框架级异常） */
  protected requireWsClient(ctx: PageContext<TParams>): TvWsClient {
    return ctx.require(TvWsClientSlot);
  }
}
