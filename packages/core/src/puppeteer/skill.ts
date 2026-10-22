import type { Page, PuppeteerLifeCycleEvent } from "puppeteer-core";
import { BaseSkill } from "../skill/base";
import type { SkillResult } from "../skill/interfaces";
import type { BrowserSkillOptions, PuppeteerSkillDeps } from "./interfaces";
import type { PageSession } from "../browser/interfaces";
import type { Artifact } from "../storage/interfaces";
import { PageContext } from "./context";
import type { IPageHook } from "./hooks";
import {
  getClassHooks,
  getScreenshotOptions,
  buildSelfHook,
} from "./decorators";
import type { StageName } from "./decorators";
import { ArtifactPersistHook } from "./artifact-persist";
import { defaultLifecycle, teardownStage } from "./lifecycle";
import { ArtifactsSlot } from "./slots";
import { getNavigationRetry, getStageRetries } from "./retry";
import {
  type ProjectionContext,
  type ProjectionPipeline,
  runProjectionPipeline,
} from "./projection";
import { SpiderError, NavigationFailedError, toSpiderError } from "../errors";
import { currentRuntime } from "../runtime";

/** 将外部传入的 Page 包装为 PageSession（release 为空操作） */
function wrapExternalPage(page: Page): PageSession {
  return { page, async release() {} };
}

/**
 * Puppeteer Skill 抽象基类 — Template Method 模式。
 *
 * execute() 漏斗流程：
 *   normalize → validate → acquire session →
 *   [ setup → navigate → (waitForSelector) → ready → interact →
 *     fetchData → extract → transform → persist ] →
 *   runProjectionPipeline(this.pipeline) → buildSuccess
 *   finally → teardown
 *
 * 全流程（含 normalize/validate）都在同一个 try 内 —— execute() 对外只返回
 * SkillResult 判别联合，任何阶段的异常都由 buildFailure 包成失败信封。
 *
 * 投影只有 `pipeline` getter 一种承载形式 —— 基类不调用任何 project() 方法。
 *
 * Hook 合成顺序（同 Stage 内按此序执行）：
 *   1. 继承链上所有类装饰器注册的 Hook（基类 → 派生类）
 *   2. 实例 `hooks` getter 返回的 Hook 数组
 *   3. 方法级装饰器（@Setup/@Ready/...）聚合成的 self-hook
 *   4. 若提供了 artifactSink，自动挂 ArtifactPersistHook
 */
export abstract class PuppeteerSkill<
  TParams extends object,
  TResult,
  TProjected = TResult,
> extends BaseSkill<TParams, TResult, TProjected, BrowserSkillOptions> {
  constructor(protected readonly deps: PuppeteerSkillDeps) {
    super();
  }

  // ── Hook 声明 ──

  /** 实例级 Hook 列表 — 子类可覆写（按数组顺序执行） */
  protected get hooks(): IPageHook[] {
    return [];
  }

  // ── 导航后等待条件 ──

  protected get waitForSelector(): string | null {
    return null;
  }
  protected get waitForTimeout(): number {
    return 30_000;
  }

  // ── URL 组合: siteURL + getPath(params) ──

  protected abstract readonly siteURL: string;
  protected abstract getPath(params: TParams): string;

  // ── 核心数据获取 ──

  protected abstract fetchData(
    page: Page,
    params: TParams,
    options?: BrowserSkillOptions,
    ctx?: PageContext<TParams>,
  ): Promise<TResult>;

  // ── Template Method ──

  async execute(
    params: TParams,
    options?: BrowserSkillOptions,
  ): Promise<SkillResult<TProjected>> {
    const startedAt = new Date();

    // normalized 先兜底为原始入参：normalizeParams 自己抛错时，
    // catch 里的 buildFailure 至少还能把用户实际传了什么回显给 Agent。
    let normalized = params;
    let ctx: PageContext<TParams> | undefined;
    let session: PageSession | undefined;
    let allHooks: IPageHook[] = [];

    try {
      // ── Normalize & Validate ──
      // 必须在 try 内：这两步会抛 SpiderError（missing-context / invalid-params），
      // 而 execute() 的铁律是「绝不向调用者抛异常，一律 buildFailure 包装」。
      // 放在 try 外，参数类错误就会穿透成崩溃 —— CLI 尚有自己的 catch 兜底
      // （信封会退化、丢 skillId/params/durationMs），非 CLI 调用方则直接拿到异常，
      // 与 SkillResult 判别联合的契约不符。
      normalized = this.normalizeParams(params);
      this.validateWithSchema(normalized);

      ctx = new PageContext<TParams>(normalized, options);

      // ── Acquire Session ──
      if (options?.page) {
        session = wrapExternalPage(options.page);
      } else {
        const site = this.extractSiteHost();
        session = await this.deps.sessionProvider.acquire({
          ...options,
          site: options?.site ?? site,
        });
      }
      const page = session.page;

      // ── 合成 Hook 链 ──
      allHooks = this.composeHooks();

      // ── Page Control ──
      await this.runStage("setup", allHooks, page, ctx);

      await this.navigateWithRetry(page, normalized, ctx);

      const selector = this.waitForSelector;
      if (selector) {
        await page.waitForSelector(selector, { timeout: this.waitForTimeout });
      }

      await this.runStage("ready", allHooks, page, ctx);
      await this.runStage("interact", allHooks, page, ctx);

      // ── Data Pipeline (extract→transform→persist) ──
      const rawData = await this.fetchData(page, normalized, options, ctx);

      const pipelineResult = await defaultLifecycle.runDataPipeline(
        allHooks,
        page,
        ctx,
      );

      // ── 运行 ProjectionPipeline（子类覆写 `pipeline` getter、默认 identity）──
      const projCtx: ProjectionContext<TParams> = {
        params: normalized,
        pageContext: ctx,
        artifacts: (ctx.get(ArtifactsSlot) ?? []) as readonly Artifact[],
        warnings: this.peekWarnings(),
        runtime: currentRuntime(),
        addWarning: (w) => this.addWarning(w),
      };
      const projected = (await runProjectionPipeline(
        this.pipeline,
        rawData,
        projCtx,
        options?.projectionMode === "raw" ? "raw" : "normal",
      )) as TProjected;

      // 若 pipeline 中途被 skipPipeline 终止，也视为正常返回（Hook 主动决策）
      void pipelineResult;

      const result = this.buildSuccess(projected, normalized, startedAt);
      const artifacts = ctx.get(ArtifactsSlot);
      if (artifacts && artifacts.length > 0) {
        result.artifacts = artifacts;
      }
      return result;
    } catch (err) {
      if (session) {
        try {
          await this.tryScreenshot(session.page);
        } catch (screenshotErr) {
          currentRuntime().events.emitError({
            errorKind: "skill.error-screenshot",
            category: "artifact",
            phase: "error-screenshot",
            scope: `skill.${this.id}`,
            skillId: this.id,
            message: "Failed to capture error screenshot",
            error: screenshotErr,
          });
        }
      }
      const spider = this.toSpider(err);
      return this.buildFailure(spider, normalized, startedAt);
    } finally {
      if (session) {
        // ctx 必然已赋值（它先于 acquire 创建），这里的判断只为满足类型收窄
        if (allHooks.length > 0 && ctx) {
          try {
            await teardownStage.run(allHooks, session.page, ctx);
          } catch (err) {
            currentRuntime().events.emitError({
              errorKind: "skill.teardown",
              category: "lifecycle",
              phase: "teardown",
              scope: `skill.${this.id}`,
              skillId: this.id,
              message: "Teardown stage failed",
              error: err,
            });
          }
        }
        try {
          await session.release();
        } catch (err) {
          currentRuntime().events.emitError({
            errorKind: "skill.session-release",
            category: "browser",
            phase: "release",
            scope: `skill.${this.id}`,
            skillId: this.id,
            message: "Failed to release browser session",
            error: err,
          });
        }
      }
    }
  }

  /** 子类可覆写：默认 siteURL + getPath 拼接后 page.goto() */
  protected async navigate(
    page: Page,
    params: TParams,
    _ctx?: PageContext<TParams>,
  ): Promise<void> {
    const path = this.getPath(params);
    if (!path) return;
    const targetURL =
      this.siteURL.replace(/\/$/, "") +
      (path.startsWith("/") ? "" : "/") +
      path;
    await currentRuntime().tracer.span("navigate", {}, async ({ spanId, parentSpanId }) => {
      const startedAt = Date.now();
      currentRuntime().events.emit({
        kind: "navigate.start",
        spanId,
        parentSpanId,
        skillId: this.id,
        url: targetURL,
      });
      try {
        await page.goto(targetURL, {
          waitUntil: this.navigateWaitUntil,
          timeout: this.navigateTimeout,
        });
        currentRuntime().events.emit({
          kind: "navigate.end",
          spanId,
          parentSpanId,
          skillId: this.id,
          url: targetURL,
          durationMs: Date.now() - startedAt,
          status: "success",
        });
      } catch (err) {
        const msg = (err as Error).message;
        currentRuntime().events.emit({
          kind: "navigate.end",
          spanId,
          parentSpanId,
          skillId: this.id,
          url: targetURL,
          durationMs: Date.now() - startedAt,
          status: "failure",
          errorMessage: msg,
        });
        throw new NavigationFailedError(
          `Navigation to "${targetURL}" failed: ${msg}`,
          { scope: this.id, cause: err as Error, details: { url: targetURL } },
        );
      }
    });
  }

  // ── 重试包装 ──

  private async navigateWithRetry(
    page: Page,
    params: TParams,
    ctx: PageContext<TParams>,
  ): Promise<void> {
    const policy = getNavigationRetry(this.constructor);
    if (!policy) return this.navigate(page, params, ctx);
    return policy.run(() => this.navigate(page, params, ctx), {
      scope: `skill.${this.id}.navigate`,
      skillId: this.id,
      phase: "navigate",
    });
  }

  private async runStage(
    stage: StageName,
    hooks: IPageHook[],
    page: Page,
    ctx: PageContext<TParams>,
  ): Promise<void> {
    const policies = getStageRetries(this.constructor);
    const policy = (
      policies as Map<string, ReturnType<typeof getNavigationRetry>>
    ).get(stage);
    return currentRuntime().tracer.span("stage", { stage }, async ({ spanId, parentSpanId }) => {
      const startedAt = Date.now();
      currentRuntime().events.emit({
        kind: "stage.start",
        spanId,
        parentSpanId,
        skillId: this.id,
        stage,
        hookCount: hooks.length,
      });
      const op = () => defaultLifecycle.run(stage, hooks, page, ctx);
      try {
        if (policy) {
          await policy.run(op, {
            scope: `skill.${this.id}.stage.${stage}`,
            skillId: this.id,
            phase: stage,
          });
        } else {
          await op();
        }
        currentRuntime().events.emit({
          kind: "stage.end",
          spanId,
          parentSpanId,
          skillId: this.id,
          stage,
          durationMs: Date.now() - startedAt,
          status: "success",
        });
      } catch (err) {
        currentRuntime().events.emit({
          kind: "stage.end",
          spanId,
          parentSpanId,
          skillId: this.id,
          stage,
          durationMs: Date.now() - startedAt,
          status: "failure",
        });
        throw err;
      }
    });
  }

  protected get navigateWaitUntil(): PuppeteerLifeCycleEvent {
    return "networkidle2";
  }
  protected get navigateTimeout(): number {
    return 30_000;
  }

  /**
   * 子类可选覆写：ProjectionPipeline。默认空管道（TRaw === TProjected）。
   *
   * 覆写组件：
   *   - normalize : 通用去噪 / 命名归一化（如 stripNoise）
   *   - project   : 业务字段抽取、重重命名
   *   - envelope  : 打包为 AI-ready envelope
   *   - emit      : 副作用产出（如落盘 markdown）
   */
  protected get pipeline(): ProjectionPipeline<
    TParams,
    TResult,
    TResult,
    TProjected
  > {
    return {};
  }

  // ── 内部 ──

  private composeHooks(): IPageHook[] {
    const hooks: IPageHook[] = [
      ...getClassHooks(this.constructor),
      ...this.hooks,
    ];
    const self = buildSelfHook(this);
    if (self) hooks.push(self);
    if (this.deps.artifactSink) {
      hooks.push(new ArtifactPersistHook(this.deps.artifactSink));
    }
    return hooks;
  }

  private extractSiteHost(): string | undefined {
    try {
      return new URL(this.siteURL).hostname;
    } catch {
      return undefined;
    }
  }

  private toSpider(err: unknown): SpiderError {
    if (err instanceof SpiderError) return err;
    return toSpiderError(err, "pipeline-error", { scope: this.id });
  }

  private async tryScreenshot(page: Page): Promise<void> {
    const opts = getScreenshotOptions(this.constructor);
    if (!opts || opts.on !== "error") return;
    const sink = this.deps.artifactSink;
    if (!sink) return;
    const template = opts.path ?? "debug/{skillId}-{timestamp}.png";
    const key = template
      .replace("{skillId}", this.id)
      .replace("{timestamp}", String(Date.now()));
    const buf = (await page.screenshot({
      fullPage: opts.fullPage ?? true,
      type: "png",
    })) as Buffer;
    await sink.write(key, buf, {
      role: "error-screenshot",
      contentType: "image/png",
    });
  }
}
