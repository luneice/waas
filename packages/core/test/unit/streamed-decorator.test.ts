/**
 * @Streamed 装饰器单测
 *
 * 守护「增量改动不破坏存量」：新增的流式分支必须与 @Paginated / @Expanded
 * 完全隔离，存量端点的 streamed 恒为 undefined，永远走不进新分支。
 */
import { test, describe } from "vitest";
import assert from "node:assert/strict";
import {
  Aggregate,
  BaseGoal,
  Endpoint,
  Expanded,
  Paginated,
  Streamed,
  getGoalMetadata,
  finalizeGoalMetadata,
} from "../../src";
import type { GoalContext } from "../../src";


class StreamGoal extends BaseGoal<unknown> {
  @Endpoint("/events", { method: "GET" })
  @Streamed<{ data: string }, { items: string[] }>({
    decode: "sse",
    seed: () => ({ items: [] }),
    reduce: (acc, ev) => {
      acc.items.push(ev.data);
      return acc;
    },
    until: (acc) => acc.items.length >= 3,
    idleTimeout: 5000,
  })
  fetchEvents(acc: { items: string[] }): string[] {
    return acc.items;
  }

  @Aggregate()
  aggregate(ctx: GoalContext): unknown {
    return ctx.get("fetchEvents");
  }
}

class LegacyGoal extends BaseGoal<unknown> {
  @Endpoint("/list", { method: "GET" })
  @Paginated<{ items: unknown[] }, unknown>({
    pageSize: 20,
    params: () => ({}),
    stopWhen: (r) => r.items.length === 0,
  })
  fetchList(r: { items: unknown[] }): unknown[] {
    return r.items;
  }

  @Endpoint("/detail/:id", { method: "GET" })
  @Expanded<{ id: number }, unknown>({
    source: () => [{ id: 1 }],
    params: (it) => ({ id: it.id }),
  })
  fetchDetail(r: unknown): unknown {
    return r;
  }

  @Endpoint("/plain", { method: "GET" })
  fetchPlain(r: unknown): unknown {
    return r;
  }

  @Aggregate()
  aggregate(): unknown {
    return null;
  }
}

describe("@Streamed 元数据注册", () => {
  test("与 @Endpoint 合并后挂在 streamed 字段上", () => {
    const g = new StreamGoal();
    finalizeGoalMetadata(g);
    const ep = getGoalMetadata(StreamGoal)!.endpoints.get("fetchEvents")!;
    assert.ok(ep.streamed, "streamed 配置必须被合并");
    assert.equal(ep.streamed!.decode, "sse");
    assert.equal(ep.streamed!.idleTimeout, 5000);
    assert.ok(typeof ep.streamed!.until === "function");
  });

  test("★ 存量端点的 streamed 恒为 undefined —— 走不进新分支", () => {
    const g = new LegacyGoal();
    finalizeGoalMetadata(g);
    const eps = getGoalMetadata(LegacyGoal)!.endpoints;
    for (const name of ["fetchList", "fetchDetail", "fetchPlain"]) {
      assert.equal(
        eps.get(name)!.streamed,
        undefined,
        `${name} 不该被流式分支影响`,
      );
    }
  });

  test("三种修饰符互不干扰：各自只挂自己的字段", () => {
    const g = new LegacyGoal();
    finalizeGoalMetadata(g);
    const eps = getGoalMetadata(LegacyGoal)!.endpoints;
    assert.ok(eps.get("fetchList")!.paginated, "@Paginated 仍生效");
    assert.equal(eps.get("fetchList")!.expanded, undefined);
    assert.ok(eps.get("fetchDetail")!.expanded, "@Expanded 仍生效");
    assert.equal(eps.get("fetchDetail")!.paginated, undefined);
    assert.equal(eps.get("fetchPlain")!.paginated, undefined);
    assert.equal(eps.get("fetchPlain")!.expanded, undefined);
  });

  test("流式 Goal 与存量 Goal 的元数据互不污染", () => {
    finalizeGoalMetadata(new StreamGoal());
    finalizeGoalMetadata(new LegacyGoal());
    assert.equal(
      getGoalMetadata(StreamGoal)!.endpoints.has("fetchList"),
      false,
      "流式 Goal 不该看到存量 Goal 的端点",
    );
    assert.equal(
      getGoalMetadata(LegacyGoal)!.endpoints.has("fetchEvents"),
      false,
    );
  });
});
