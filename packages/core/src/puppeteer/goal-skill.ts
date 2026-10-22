import type { Page } from "puppeteer-core";
import type { BaseGoal } from "../goal/base";
import { PuppeteerSkill } from "./skill";
import type { BrowserSkillOptions, GoalSkillDeps } from "./interfaces";
import type { PageContext } from "./context";

/**
 * Goal 驱动的 Puppeteer Skill 中间层
 *
 * fetchData 的默认实现 = GoalExecutor.execute(createGoal(params))
 * 子类可覆写 fetchData 实现混合模式（Goal + 自定义逻辑）。
 *
 * 数据的实际获取由 Goal 类中的装饰器体系完成：
 *   @Endpoint  — HTTP 发起（method, url, body/query 构造）
 *   @Paginated — 翻页策略（pageSize, stopWhen, cursor）
 *   @Expanded  — 展开（source → 并发请求）
 *   @Aggregate — 聚合（最终结果组装）
 *   方法体     — 响应转化（字段映射、投影）
 *
 * 子类只需实现：
 *   - createGoal(params) — 根据参数创建 Goal 实例
 *   - siteURL / getPath  — 导航（继承自 PuppeteerSkill）
 *   - project / normalizeParams — 可选覆写
 */
export abstract class PuppeteerGoalSkill<
  TParams extends object,
  TResult,
  TProjected = TResult,
> extends PuppeteerSkill<TParams, TResult, TProjected> {
  declare protected readonly deps: GoalSkillDeps;

  constructor(deps: GoalSkillDeps) {
    super(deps);
  }

  /** 子类实现：根据归一化参数创建对应 Goal 实例 */
  protected abstract createGoal(params: TParams): BaseGoal<TResult>;

  /**
   * 默认实现：委托 GoalExecutor 执行 createGoal(params)。
   * 非密封 — 子类可覆写以实现混合模式（如 Goal + Hook 管道协作），
   * 也可通过 super.fetchData() 调用 Goal 路径。
   */
  protected async fetchData(
    page: Page,
    params: TParams,
    options?: BrowserSkillOptions,
    _ctx?: PageContext<TParams>,
  ): Promise<TResult> {
    return this.deps.goalExecutor.execute<TResult>(
      this.createGoal(params),
      page,
      params as unknown as Record<string, unknown>,
      { silent: options?.silent ?? false },
    );
  }
}
