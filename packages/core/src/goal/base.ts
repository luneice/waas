/**
 * BaseGoal — 所有 Goal 的抽象基类。
 *
 * `TResult`  : 聚合后的最终结果类型
 * `TParams`  : Skill 传入的参数形状；写到 GoalContext.params 上
 *
 * 子类无需在构造期指定 TParams 的运行时值，泛型仅用于类型推导：
 *
 * ```ts
 * class MyGoal extends BaseGoal<MyResult, MyParams> {
 *   @Endpoint("/api/x", {
 *     query: (ctx) => ({ keyword: ctx.params.keyword }) // ← strongly typed
 *   })
 *   fetchX(r: RawX): X { return ... }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export abstract class BaseGoal<
  TResult = unknown,
  TParams extends object = Record<string, unknown>,
> {
  /** 仅为类型携带，运行时不存在 */
  declare readonly __paramsType?: TParams;
  declare readonly __resultType?: TResult;
}
