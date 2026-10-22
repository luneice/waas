import { Page } from "puppeteer-core";
import type { GoalContext } from "./interfaces";
import { PipelineError } from "../errors/spider-error";

/**
 * GoalContext 实现 — 提供 Endpoint 间的数据共享与运行时校验。
 */
export class GoalContextImpl<
  TParams extends object = Record<string, unknown>,
> implements GoalContext<TParams> {
  private results: Map<string, unknown> = new Map();
  private knownEndpoints?: Set<string>;

  constructor(
    public readonly page: Page,
    public readonly goalId: string,
    public readonly params: TParams = {} as TParams,
  ) {}

  registerKnownEndpoints(names: Iterable<string>): void {
    this.knownEndpoints = new Set(names);
  }

  get<T>(methodName: string): T {
    if (this.knownEndpoints && !this.knownEndpoints.has(methodName)) {
      const available = Array.from(this.knownEndpoints).join(", ");
      throw new PipelineError(
        `Endpoint "${methodName}" does not exist in Goal "${this.goalId}". ` +
          `Available endpoints: [${available}]. Check for typos in the method name.`,
        {
          scope: this.goalId,
          phase: "fetchData",
          details: { methodName, available: Array.from(this.knownEndpoints) },
        },
      );
    }
    if (!this.results.has(methodName)) {
      throw new PipelineError(
        `Endpoint "${methodName}" has not been executed yet. ` +
          `Make sure it is listed in dependencies.`,
        { scope: this.goalId, phase: "fetchData", details: { methodName } },
      );
    }
    return this.results.get(methodName) as T;
  }

  has(methodName: string): boolean {
    return this.results.has(methodName);
  }

  setResult(methodName: string, result: unknown): void {
    this.results.set(methodName, result);
  }

  getExecutedEndpoints(): string[] {
    return Array.from(this.results.keys());
  }

  clear(): void {
    this.results.clear();
  }
}
