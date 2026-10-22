/**
 * Goal 元数据装配（docs/TESTING.md §2.1 第 4 项）。
 *
 * 装饰器 → `finalizeGoalMetadata` 这条链路全是反射，没有任何运行时 I/O，
 * 却决定了「请求打到哪个 URL、翻不翻页、聚合走哪个方法」。它出错的方式很毒：
 * 元数据错配不会抛异常，只会让请求悄悄打到另一个端点，而 `aggregate()` 回显的
 * 是实例字段，输出看起来完全正常。所以这里的用例全是"钉语义"，不是覆盖率。
 *
 * 两类语义被钉死：
 *   1. 已文档化的怪癖（重复 `@Aggregate` 静默取最后一个、装饰器书写顺序无关）——
 *      文档说是什么，测试就断言什么，改行为必须先改文档。
 *   2. 子类元数据隔离 —— 抽象基类挂 `@Aggregate` 是仓内既有写法
 *      （xhs `BaseDatesGoal` / `BaseGoodsTreeGoal`），曾因 store 沿原型链共享
 *      导致兄弟子类互相覆盖端点。这是回归护栏。
 */
import { test } from "vitest";
import assert from "node:assert/strict";

import {
  Goal,
  Endpoint,
  Paginated,
  Expanded,
  Aggregate,
  getGoalMetadata,
  finalizeGoalMetadata,
} from "@src/goal/decorators";
import { BaseGoal } from "@src/goal/base";
import type { GoalContext, GoalMetadataStore } from "@src/goal/interfaces";

const SITE = "https://example.invalid";

/** 取元数据并断言存在 —— 每个用例都要做，抽出来省掉重复的非空判断 */
function metaOf(ctor: unknown): GoalMetadataStore {
  const store = getGoalMetadata(ctor);
  assert.ok(store, "未取到 Goal 元数据 —— 类上是否漏了 @Goal / @Endpoint？");
  return store;
}

// ============================================================================
// @Goal / @Endpoint 基本装配
// ============================================================================

test("@Goal + @Endpoint：options 与 endpoints 落到构造函数上", () => {
  @Goal({
    id: "basic-goal",
    name: "基础目标",
    baseURL: SITE,
    defaults: { retry: { count: 2, delay: 50 }, interval: 10, concurrency: 4 },
  })
  class BasicGoal extends BaseGoal<string> {
    @Endpoint("/api/list", { method: "GET", dependencies: [] })
    fetchList(r: unknown): unknown {
      return r;
    }

    @Aggregate()
    aggregate(): string {
      return "ok";
    }
  }

  const store = metaOf(BasicGoal);
  assert.equal(store.options.id, "basic-goal");
  assert.equal(store.options.baseURL, SITE);
  assert.equal(store.options.defaults?.retry?.count, 2);
  assert.equal(store.aggregateMethod, "aggregate");

  const ep = store.endpoints.get("fetchList");
  assert.ok(ep, "fetchList 未注册为 endpoint");
  assert.equal(ep.url, "/api/list");
  assert.equal(ep.methodName, "fetchList", "methodName 必须回填，executor 靠它取投影函数");
  assert.equal(ep.options.method, "GET");

  // 元数据挂在构造函数上，不是原型 —— executor 里是 getGoalMetadata(goal.constructor)
  assert.equal(getGoalMetadata(BasicGoal.prototype), undefined);
});

// ============================================================================
// 装饰器书写顺序无关（CLAUDE.md §2.5 的承诺）
// ============================================================================

test("@Paginated 写在 @Endpoint 之前/之后，finalize 后结果一致", () => {
  const paginatedOpts = {
    pageSize: 20,
    maxPages: 3,
    params: (_ctx: GoalContext, page: number) => ({ page }),
  };

  // 装饰器自下而上求值：写在下面的先跑。
  // 形态 A —— @Paginated 在下，先于 @Endpoint 求值（走"临时 Symbol 暂存"分支）
  @Goal({ id: "order-a", name: "A", baseURL: SITE })
  class PaginatedFirst extends BaseGoal<unknown> {
    @Endpoint("/api/a", { method: "GET" })
    @Paginated(paginatedOpts)
    fetchPages(r: unknown): unknown[] {
      return [r];
    }

    @Aggregate()
    aggregate(): unknown {
      return null;
    }
  }

  // 形态 B —— @Endpoint 在下，先求值（@Paginated 直接写进已存在的 endpoint）
  @Goal({ id: "order-b", name: "B", baseURL: SITE })
  class EndpointFirst extends BaseGoal<unknown> {
    @Paginated(paginatedOpts)
    @Endpoint("/api/b", { method: "GET" })
    fetchPages(r: unknown): unknown[] {
      return [r];
    }

    @Aggregate()
    aggregate(): unknown {
      return null;
    }
  }

  const a = new PaginatedFirst();
  const b = new EndpointFirst();
  finalizeGoalMetadata(a);
  finalizeGoalMetadata(b);

  const epA = metaOf(PaginatedFirst).endpoints.get("fetchPages");
  const epB = metaOf(EndpointFirst).endpoints.get("fetchPages");

  assert.equal(epA?.paginated?.maxPages, 3, "@Paginated 先求值时配置丢失 —— 临时元数据未被 finalize 合并");
  assert.equal(epB?.paginated?.maxPages, 3);
  assert.equal(epA?.paginated?.pageSize, epB?.paginated?.pageSize);
});

test("@Expanded 同样与书写顺序无关", () => {
  const expandedOpts = {
    source: (ctx: GoalContext) => ctx.get<unknown[]>("fetchList"),
    params: (item: unknown) => ({ id: String(item) }),
    concurrency: 5,
  };

  @Goal({ id: "exp-a", name: "A", baseURL: SITE })
  class ExpandedFirst extends BaseGoal<unknown> {
    @Endpoint("/api/list", { method: "GET" })
    fetchList(r: unknown): unknown[] {
      return r as unknown[];
    }

    @Endpoint("/api/detail/:id", { method: "GET" })
    @Expanded(expandedOpts)
    fetchDetail(r: unknown): unknown {
      return r;
    }

    @Aggregate()
    aggregate(): unknown {
      return null;
    }
  }

  finalizeGoalMetadata(new ExpandedFirst());
  const ep = metaOf(ExpandedFirst).endpoints.get("fetchDetail");
  assert.equal(ep?.expanded?.concurrency, 5);
  assert.equal(typeof ep?.expanded?.source, "function");
});

// ============================================================================
// 已文档化的怪癖：重复 @Aggregate 静默取最后一个
// ============================================================================

test("重复 @Aggregate：静默取最后声明的那个（已文档化语义，不是 bug）", () => {
  @Goal({ id: "dup-agg", name: "重复聚合", baseURL: SITE })
  class DupAggregateGoal extends BaseGoal<string> {
    @Aggregate()
    aggregateFirst(): string {
      return "first";
    }

    @Aggregate()
    aggregateSecond(): string {
      return "second";
    }
  }

  // 装饰器按声明次序求值，后者覆盖前者，且不抛错、不告警
  assert.equal(
    metaOf(DupAggregateGoal).aggregateMethod,
    "aggregateSecond",
    "语义变更（比如改成抛错）必须同步 CLAUDE.md 与 docs/TESTING.md",
  );
});

test("缺 @Aggregate：元数据里就是 undefined，由 GoalExecutor 前置校验兜底", () => {
  @Goal({ id: "no-agg", name: "无聚合", baseURL: SITE })
  class NoAggregateGoal extends BaseGoal<unknown> {
    @Endpoint("/api/x", { method: "GET" })
    fetchX(r: unknown): unknown {
      return r;
    }
  }

  assert.equal(metaOf(NoAggregateGoal).aggregateMethod, undefined);
});

// ============================================================================
// 子类元数据隔离（回归护栏）
// ============================================================================

test("兄弟子类不共享元数据 —— 抽象基类挂 @Aggregate 时端点不得互相覆盖", () => {
  // 仓内既有写法：基类只放 @Aggregate，各子类自带 @Goal + 同名 @Endpoint。
  // 曾因 store 沿原型链回溯共享，导致 4 个子类塌缩成最后声明的那一个。
  abstract class DatesGoalBase extends BaseGoal<string> {
    protected abstract readonly endpoint: string;

    @Aggregate()
    aggregate(): string {
      return this.endpoint;
    }
  }

  @Goal({ id: "dates", name: "通用", baseURL: SITE })
  class CommonDatesGoal extends DatesGoalBase {
    protected readonly endpoint = "/Rank/GetDateList";

    @Endpoint("/Rank/GetDateList", { method: "GET" })
    fetchDates(r: unknown): unknown {
      return r;
    }
  }

  @Goal({ id: "dates", name: "爆文", baseURL: SITE })
  class HotNoteDatesGoal extends DatesGoalBase {
    protected readonly endpoint = "/Rank/GetHotNoteRankTime";

    @Endpoint("/Rank/GetHotNoteRankTime", { method: "GET" })
    fetchDates(r: unknown): unknown {
      return r;
    }
  }

  const common = metaOf(CommonDatesGoal);
  const hotNote = metaOf(HotNoteDatesGoal);

  assert.notEqual(common, hotNote, "两个子类拿到了同一个 store 对象");
  assert.equal(common.options.name, "通用", "子类 @Goal 被兄弟覆盖");
  assert.equal(hotNote.options.name, "爆文");
  assert.equal(
    common.endpoints.get("fetchDates")?.url,
    "/Rank/GetDateList",
    "端点 URL 被兄弟子类覆盖 —— 请求会打到错误的上游，而 aggregate() 读实例字段，回显看不出异常",
  );
  assert.equal(
    hotNote.endpoints.get("fetchDates")?.url,
    "/Rank/GetHotNoteRankTime",
  );

  // 基类的 @Aggregate 仍要被两个子类继承到
  assert.equal(common.aggregateMethod, "aggregate");
  assert.equal(hotNote.aggregateMethod, "aggregate");
});

test("子类改写不回流污染基类", () => {
  abstract class SharedBase extends BaseGoal<unknown> {
    @Aggregate()
    aggregate(): unknown {
      return null;
    }
  }

  @Goal({ id: "child", name: "子类", baseURL: SITE })
  class ChildGoal extends SharedBase {
    @Endpoint("/api/child", { method: "GET" })
    fetchChild(r: unknown): unknown {
      return r;
    }
  }

  const base = metaOf(SharedBase);
  assert.equal(base.options.id, "", "基类的 options 被子类 @Goal 改写了");
  assert.equal(
    base.endpoints.has("fetchChild"),
    false,
    "子类端点漏进了基类 store —— 后续兄弟子类会继承到不属于自己的端点",
  );
  assert.equal(metaOf(ChildGoal).endpoints.has("fetchChild"), true);
});

test("继承来的端点被逐条拷贝：子类 finalize 不改写基类的 EndpointMetadata", () => {
  // 基类带端点、子类只补 @Paginated 的形态：finalize 会就地写 endpoint.paginated，
  // 若两边共享同一个 EndpointMetadata 对象，基类和其它子类会被连带改掉。
  abstract class ListBase extends BaseGoal<unknown> {
    @Endpoint("/api/list", { method: "GET" })
    fetchList(r: unknown): unknown[] {
      return [r];
    }

    @Aggregate()
    aggregate(): unknown {
      return null;
    }
  }

  @Goal({ id: "paged-child", name: "翻页子类", baseURL: SITE })
  class PagedChild extends ListBase {
    @Paginated({ pageSize: 10, maxPages: 2, params: (_c, page) => ({ page }) })
    @Endpoint("/api/list", { method: "GET" })
    fetchList(r: unknown): unknown[] {
      return [r];
    }
  }

  finalizeGoalMetadata(new PagedChild());

  assert.equal(metaOf(PagedChild).endpoints.get("fetchList")?.paginated?.maxPages, 2);
  assert.equal(
    metaOf(ListBase).endpoints.get("fetchList")?.paginated,
    undefined,
    "基类的 endpoint 对象被子类就地改写了 —— endpoints 必须逐条浅拷贝",
  );
});

// ============================================================================
// finalizeGoalMetadata 的幂等性与边界
// ============================================================================

test("finalizeGoalMetadata 幂等：重复调用不改变结果", () => {
  @Goal({ id: "idem", name: "幂等", baseURL: SITE })
  class IdempotentGoal extends BaseGoal<unknown> {
    @Endpoint("/api/p", { method: "GET" })
    @Paginated({ pageSize: 10, maxPages: 5, params: (_c, page) => ({ page }) })
    fetchPages(r: unknown): unknown[] {
      return [r];
    }

    @Aggregate()
    aggregate(): unknown {
      return null;
    }
  }

  const goal = new IdempotentGoal();
  finalizeGoalMetadata(goal);
  const first = metaOf(IdempotentGoal).endpoints.get("fetchPages")?.paginated;
  finalizeGoalMetadata(goal);
  finalizeGoalMetadata(goal);
  const third = metaOf(IdempotentGoal).endpoints.get("fetchPages")?.paginated;

  assert.equal(first, third, "多次 finalize 后 paginated 配置发生了替换");
  assert.equal(third?.maxPages, 5);
});

test("finalizeGoalMetadata 对无元数据的对象静默返回，不抛错", () => {
  class PlainGoal extends BaseGoal<unknown> {}
  assert.doesNotThrow(() => finalizeGoalMetadata(new PlainGoal()));
});
