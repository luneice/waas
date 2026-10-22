/**
 * GoalExecutor 模块测试（docs/TESTING.md §3.2 第一行）。
 *
 * 这一层是「HTTP 编排引擎」的行为契约：翻页何时停、展开并发多少、依赖按什么序
 * 解析、重试重几次、错误 kind 怎么传出去。全部经 FakePage + FakeUpstream 驱动，
 * 无浏览器、无网络。
 *
 * 一条贯穿始终的判据：**能用 upstream.calls 断言的，就不去断言返回值**。
 * 请求次数 / 次序 / URL 才是编排行为的直接证据；返回值只能证明"聚合没写错"。
 */
import { test } from "vitest";
import assert from "node:assert/strict";

import {
  Goal,
  Endpoint,
  Paginated,
  Expanded,
  Aggregate,
} from "@src/goal/decorators";
import { BaseGoal } from "@src/goal/base";
import { GoalExecutor } from "@src/goal/executor";
import type { GoalContext } from "@src/goal/interfaces";
import { runWithRuntime } from "@src/runtime";
import { SpiderError } from "@src/errors";
import type { Page } from "puppeteer-core";

import { FakeUpstream } from "@src/testing/fake-upstream";
import { FakePage } from "@src/testing/fake-page";
import { createTestRuntime } from "@src/testing/runtime";

const SITE = "https://example.invalid";

/** 跑一个 Goal —— 所有用例的统一入口 */
async function runGoal<T>(
  goal: BaseGoal<T>,
  upstream: FakeUpstream,
  params: Record<string, unknown> = {},
): Promise<T> {
  const page = new FakePage({ upstream });
  const { runtime } = createTestRuntime();
  return runWithRuntime(runtime, () =>
    new GoalExecutor().execute(goal, page as unknown as Page, params),
  );
}

/** 断言抛出的是 SpiderError 且 kind 符合预期，同时把 error 返回供进一步断言 */
async function expectKind(
  fn: () => Promise<unknown>,
  kind: string,
): Promise<SpiderError> {
  try {
    await fn();
  } catch (err) {
    assert.ok(
      err instanceof SpiderError,
      `期望 SpiderError，实际 ${(err as Error)?.constructor?.name}: ${String(err)}`,
    );
    assert.equal(err.kind, kind, `错误 kind 不符：${err.message}`);
    return err;
  }
  throw new assert.AssertionError({ message: `期望抛出 kind=${kind}，但成功返回了` });
}

// ============================================================================
// ① @Paginated 终止条件：maxPages / stopWhen
// ============================================================================

test("@Paginated：maxPages 封顶 —— 上游还有数据也必须停", async () => {
  // 上游永远回满页（末位 reply 用尽后持续复用），只有 maxPages 能让它停
  const upstream = new FakeUpstream().route("/api/list", {
    body: { list: [{ id: 1 }, { id: 2 }] },
  });

  @Goal({ id: "max-pages", name: "翻页封顶", baseURL: SITE, defaults: { interval: 0 } })
  class MaxPagesGoal extends BaseGoal<unknown[]> {
    @Endpoint("/api/list", { method: "GET" })
    @Paginated({ pageSize: 2, maxPages: 3, params: (_c, page) => ({ page }) })
    fetchList(res: { list: unknown[] }): unknown[] {
      return res.list;
    }

    @Aggregate()
    aggregate(ctx: GoalContext): unknown[] {
      return ctx.get<unknown[]>("fetchList");
    }
  }

  const items = await runGoal(new MaxPagesGoal(), upstream);

  assert.equal(upstream.calls.length, 3, "maxPages=3 必须恰好请求 3 次");
  assert.equal(items.length, 6, "三页各 2 条应累积成 6 条");
  // 页码确实在递增，而不是三次都打第 1 页
  assert.deepEqual(
    upstream.calls.map((c) => new URL(c.url).searchParams.get("page")),
    ["1", "2", "3"],
  );
});

test("@Paginated：stopWhen 先于 maxPages 生效 —— 空页立即停", async () => {
  const upstream = new FakeUpstream().route(
    "/api/list",
    { body: { list: [{ id: 1 }] } },
    { body: { list: [{ id: 2 }] } },
    { body: { list: [] } }, // ← 第 3 页空，stopWhen 命中
  );

  @Goal({ id: "stop-when", name: "翻页停止", baseURL: SITE, defaults: { interval: 0 } })
  class StopWhenGoal extends BaseGoal<unknown[]> {
    @Endpoint("/api/list", { method: "GET" })
    @Paginated({
      pageSize: 1,
      maxPages: 10,
      params: (_c, page) => ({ page }),
      stopWhen: (res: { list: unknown[] }) => res.list.length === 0,
    })
    fetchList(res: { list: unknown[] }): unknown[] {
      return res.list;
    }

    @Aggregate()
    aggregate(ctx: GoalContext): unknown[] {
      return ctx.get<unknown[]>("fetchList");
    }
  }

  const items = await runGoal(new StopWhenGoal(), upstream);

  assert.equal(upstream.calls.length, 3, "命中 stopWhen 的那一页也会被请求，之后才停");
  assert.equal(items.length, 2, "空页不贡献条目");
});

test("@Paginated：cursor 游标返回空即终止", async () => {
  const upstream = new FakeUpstream().route(
    "/api/feed",
    { body: { items: [{ id: 1 }], next: "cur-2" } },
    { body: { items: [{ id: 2 }], next: null } }, // ← 游标断，终止
    { body: { items: [{ id: 3 }], next: "cur-4" } }, // 不该被请求到
  );

  @Goal({ id: "cursor", name: "游标翻页", baseURL: SITE, defaults: { interval: 0 } })
  class CursorGoal extends BaseGoal<unknown[]> {
    @Endpoint("/api/feed", { method: "GET" })
    @Paginated({
      pageSize: 1,
      maxPages: 10,
      params: (_c, _page, cursor) => (cursor ? { offset: cursor } : {}),
      cursor: { getNext: (res: { next: string | null }) => res.next },
    })
    fetchFeed(res: { items: unknown[] }): unknown[] {
      return res.items;
    }

    @Aggregate()
    aggregate(ctx: GoalContext): unknown[] {
      return ctx.get<unknown[]>("fetchFeed");
    }
  }

  const items = await runGoal(new CursorGoal(), upstream);

  assert.equal(upstream.calls.length, 2, "游标为 null 后不得继续翻页");
  assert.equal(items.length, 2);
  // 第 2 次请求带上了第 1 次返回的游标
  assert.equal(new URL(upstream.calls[1].url).searchParams.get("offset"), "cur-2");
});

// ============================================================================
// ② @Expanded concurrency / interval 三级回退
// ============================================================================

/** 记录并发交错的辅助 Goal 工厂：用 delayMs 制造重叠，观察实际并发度 */
function buildExpandedGoal(opts: {
  id: string;
  concurrency?: number;
  goalConcurrency?: number;
}) {
  @Goal({
    id: opts.id,
    name: "展开",
    baseURL: SITE,
    defaults: {
      interval: 0,
      ...(opts.goalConcurrency !== undefined
        ? { concurrency: opts.goalConcurrency }
        : {}),
    },
  })
  class ExpandGoal extends BaseGoal<unknown[]> {
    @Endpoint("/api/list", { method: "GET" })
    fetchList(res: { list: unknown[] }): unknown[] {
      return res.list;
    }

    @Endpoint("/api/detail", { method: "GET" })
    @Expanded({
      dependencies: ["fetchList"],
      source: (ctx: GoalContext) => ctx.get<Array<{ id: number }>>("fetchList"),
      params: (item: { id: number }) => ({ id: item.id }),
      interval: 0,
      ...(opts.concurrency !== undefined ? { concurrency: opts.concurrency } : {}),
    })
    fetchDetail(res: unknown): unknown {
      return res;
    }

    @Aggregate()
    aggregate(ctx: GoalContext): unknown[] {
      return ctx.get<unknown[]>("fetchDetail");
    }
  }
  return new ExpandGoal();
}

/** 6 个待展开条目 + 每个 detail 都有延迟 —— 延迟让同一批次的请求真正重叠 */
function expandedUpstream(): FakeUpstream {
  return new FakeUpstream()
    .route("/api/list", {
      body: { list: [1, 2, 3, 4, 5, 6].map((id) => ({ id })) },
    })
    .route("/api/detail", { body: { ok: true }, delayMs: 20 });
}

test("@Expanded：装饰器 concurrency 优先于 @Goal.defaults", async () => {
  const upstream = expandedUpstream();
  const started = await runExpandedAndMeasure(
    buildExpandedGoal({ id: "conc-decorator", concurrency: 2, goalConcurrency: 5 }),
    upstream,
  );
  // 装饰器 2 生效 → 6 条分 3 批，每批 2 条
  assert.deepEqual(started, [2, 2, 2]);
});

test("@Expanded：装饰器缺省时回退到 @Goal.defaults.concurrency", async () => {
  const upstream = expandedUpstream();
  const started = await runExpandedAndMeasure(
    buildExpandedGoal({ id: "conc-defaults", goalConcurrency: 6 }),
    upstream,
  );
  assert.deepEqual(started, [6], "defaults.concurrency=6 → 6 条一批打完");
});

test("@Expanded：两级都缺省时回退到框架内置 3", async () => {
  const upstream = expandedUpstream();
  const started = await runExpandedAndMeasure(
    buildExpandedGoal({ id: "conc-builtin" }),
    upstream,
  );
  assert.deepEqual(started, [3, 3], "框架内置 concurrency=3 → 6 条分 2 批");
});

/**
 * 跑一次展开，返回「每批实际并发起飞的请求数」。
 *
 * 判据：executeExpanded 用 Promise.all 分块串行，同批次的 fetch 会在
 * 上一批全部 settle 之后才发出。detail 带 20ms 延迟，于是按 detail 请求的
 * 发起时刻聚类即可还原批次大小 —— 比断言"耗时 ≈ N×20ms"稳得多。
 */
async function runExpandedAndMeasure(
  goal: BaseGoal<unknown[]>,
  upstream: FakeUpstream,
): Promise<number[]> {
  const page = new FakePage({ upstream });
  const { runtime } = createTestRuntime();

  // 包一层，记录每个 detail 请求发起时该批次的序号
  const batches: number[] = [];
  let inFlight = 0;
  let batchIdx = -1;
  const originalResolve = upstream.resolve.bind(upstream);
  upstream.resolve = async (url: string, init?: RequestInit) => {
    const isDetail = url.includes("/api/detail");
    if (isDetail) {
      if (inFlight === 0) {
        batchIdx++;
        batches[batchIdx] = 0;
      }
      inFlight++;
      batches[batchIdx]++;
    }
    try {
      return await originalResolve(url, init);
    } finally {
      if (isDetail) inFlight--;
    }
  };

  await runWithRuntime(runtime, () =>
    new GoalExecutor().execute(goal, page as unknown as Page, {}),
  );
  return batches;
}

// ============================================================================
// ③ dependencies 解析与 ctx.get 缺依赖报错
// ============================================================================

test("dependencies：被依赖端点先执行，次序由拓扑排序决定", async () => {
  const upstream = new FakeUpstream()
    .route("/api/a", { body: { v: "a" } })
    .route("/api/b", { body: { v: "b" } })
    .route("/api/c", { body: { v: "c" } });

  // 声明次序 c → b → a，依赖链 c←b←a，执行次序必须反过来
  @Goal({ id: "deps", name: "依赖", baseURL: SITE, defaults: { interval: 0 } })
  class DepsGoal extends BaseGoal<string> {
    @Endpoint("/api/c", { method: "GET", dependencies: ["fetchB"] })
    fetchC(r: { v: string }): string {
      return r.v;
    }

    @Endpoint("/api/b", { method: "GET", dependencies: ["fetchA"] })
    fetchB(r: { v: string }): string {
      return r.v;
    }

    @Endpoint("/api/a", { method: "GET" })
    fetchA(r: { v: string }): string {
      return r.v;
    }

    @Aggregate()
    aggregate(ctx: GoalContext): string {
      return [ctx.get("fetchA"), ctx.get("fetchB"), ctx.get("fetchC")].join("");
    }
  }

  const result = await runGoal(new DepsGoal(), upstream);

  assert.deepEqual(
    upstream.calls.map((c) => new URL(c.url).pathname),
    ["/api/a", "/api/b", "/api/c"],
    "拓扑序应为 a → b → c，与声明次序无关",
  );
  assert.equal(result, "abc");
});

test("ctx.get 取未声明依赖的端点 → pipeline-error，且错误消息带可用端点清单", async () => {
  const upstream = new FakeUpstream().route("/api/a", { body: { v: "a" } });

  @Goal({ id: "missing-dep", name: "缺依赖", baseURL: SITE, defaults: { interval: 0 } })
  class MissingDepGoal extends BaseGoal<unknown> {
    @Endpoint("/api/a", { method: "GET" })
    fetchA(r: unknown): unknown {
      return r;
    }

    @Aggregate()
    aggregate(ctx: GoalContext): unknown {
      return ctx.get("fetchTypoed"); // ← 端点根本不存在
    }
  }

  const err = await expectKind(
    () => runGoal(new MissingDepGoal(), upstream),
    "pipeline-error",
  );
  assert.match(err.message, /fetchTypoed/);
  assert.match(err.message, /fetchA/, "错误消息必须列出可用端点，否则排查只能靠猜");
});

test("dependencies 指向不存在的端点 → 执行前就报错，一个请求都不发", async () => {
  const upstream = new FakeUpstream().route("/api/a", { body: {} });

  @Goal({ id: "bad-dep", name: "坏依赖", baseURL: SITE, defaults: { interval: 0 } })
  class BadDepGoal extends BaseGoal<unknown> {
    @Endpoint("/api/a", { method: "GET", dependencies: ["nonExistent"] })
    fetchA(r: unknown): unknown {
      return r;
    }

    @Aggregate()
    aggregate(): unknown {
      return null;
    }
  }

  const err = await expectKind(() => runGoal(new BadDepGoal(), upstream), "pipeline-error");
  assert.match(err.message, /nonExistent/);
  assert.equal(upstream.calls.length, 0, "依赖校验必须前置，不能先打了请求再失败");
});

test("循环依赖 → pipeline-error", async () => {
  const upstream = new FakeUpstream().route("/api", { body: {} });

  @Goal({ id: "cycle", name: "环", baseURL: SITE, defaults: { interval: 0 } })
  class CycleGoal extends BaseGoal<unknown> {
    @Endpoint("/api/x", { method: "GET", dependencies: ["fetchY"] })
    fetchX(r: unknown): unknown {
      return r;
    }

    @Endpoint("/api/y", { method: "GET", dependencies: ["fetchX"] })
    fetchY(r: unknown): unknown {
      return r;
    }

    @Aggregate()
    aggregate(): unknown {
      return null;
    }
  }

  const err = await expectKind(() => runGoal(new CycleGoal(), upstream), "pipeline-error");
  assert.match(err.message, /Circular dependency/i);
});

// ============================================================================
// ④ @Aggregate 缺失前置校验
// ============================================================================

test("缺 @Aggregate → 执行前抛 pipeline-error，一个请求都不发", async () => {
  const upstream = new FakeUpstream().route("/api/a", { body: {} });

  @Goal({ id: "no-aggregate", name: "无聚合", baseURL: SITE })
  class NoAggregateGoal extends BaseGoal<unknown> {
    @Endpoint("/api/a", { method: "GET" })
    fetchA(r: unknown): unknown {
      return r;
    }
  }

  const err = await expectKind(
    () => runGoal(new NoAggregateGoal(), upstream),
    "pipeline-error",
  );
  assert.match(err.message, /@Aggregate/);
  assert.equal(upstream.calls.length, 0, "前置校验必须在任何 HTTP 之前");
});

test("未加 @Goal 的类 → pipeline-error 提示补装饰器", async () => {
  const upstream = new FakeUpstream();
  class UndecoratedGoal extends BaseGoal<unknown> {}

  const err = await expectKind(
    () => runGoal(new UndecoratedGoal(), upstream),
    "pipeline-error",
  );
  assert.match(err.message, /@Goal/);
});

// ============================================================================
// ⑤ retry.count 的实际重试次数
// ============================================================================

test("retry：可重试错误按 count 重试，总请求数 = count + 1", async () => {
  // 503 → endpoint-http（可重试）；始终失败，把重试跑满
  const upstream = new FakeUpstream().route("/api/flaky", {
    status: 503,
    body: { error: "unavailable" },
  });

  @Goal({
    id: "retry-exhaust",
    name: "重试耗尽",
    baseURL: SITE,
    defaults: { retry: { count: 2, delay: 1 }, interval: 0 },
  })
  class RetryGoal extends BaseGoal<unknown> {
    @Endpoint("/api/flaky", { method: "GET" })
    fetchFlaky(r: unknown): unknown {
      return r;
    }

    @Aggregate()
    aggregate(ctx: GoalContext): unknown {
      return ctx.get("fetchFlaky");
    }
  }

  const err = await expectKind(
    () => runGoal(new RetryGoal(), upstream),
    "retry-exhausted",
  );

  assert.equal(upstream.calls.length, 3, "count=2 意味着 1 次首发 + 2 次重试");
  // 原始失败保留在 cause 上，排查时能看到真正的 503
  assert.equal((err.cause as SpiderError)?.kind, "endpoint-http");
  assert.equal(err.details?.attempts, 3);
});

test("retry：中途成功即停止重试", async () => {
  const upstream = new FakeUpstream().route(
    "/api/flaky",
    { status: 503, body: {} },
    { body: { ok: true } }, // 第 2 次成功
  );

  @Goal({
    id: "retry-recover",
    name: "重试恢复",
    baseURL: SITE,
    defaults: { retry: { count: 5, delay: 1 }, interval: 0 },
  })
  class RecoverGoal extends BaseGoal<unknown> {
    @Endpoint("/api/flaky", { method: "GET" })
    fetchFlaky(r: unknown): unknown {
      return r;
    }

    @Aggregate()
    aggregate(ctx: GoalContext): unknown {
      return ctx.get("fetchFlaky");
    }
  }

  const result = await runGoal(new RecoverGoal(), upstream);
  assert.deepEqual(result, { ok: true });
  assert.equal(upstream.calls.length, 2, "成功后不得继续用完 count");
});

test("retry：端点级 retry 覆盖 @Goal.defaults", async () => {
  const upstream = new FakeUpstream().route("/api/flaky", { status: 503, body: {} });

  @Goal({
    id: "retry-override",
    name: "重试覆盖",
    baseURL: SITE,
    defaults: { retry: { count: 5, delay: 1 }, interval: 0 },
  })
  class OverrideGoal extends BaseGoal<unknown> {
    @Endpoint("/api/flaky", { method: "GET", retry: { count: 1, delay: 1 } })
    fetchFlaky(r: unknown): unknown {
      return r;
    }

    @Aggregate()
    aggregate(ctx: GoalContext): unknown {
      return ctx.get("fetchFlaky");
    }
  }

  await expectKind(() => runGoal(new OverrideGoal(), upstream), "retry-exhausted");
  assert.equal(upstream.calls.length, 2, "端点级 count=1 应覆盖 defaults 的 5");
});

test("retry：不可重试的错误立即抛出，不消耗 count", async () => {
  // 404 也是 endpoint-http（可重试），所以用网络层错误无法造不可重试；
  // 改用投影函数抛不可重试 kind —— 见下一组用例的语义说明。
  const upstream = new FakeUpstream().route("/api/x", { body: { code: 53013 } });

  @Goal({
    id: "no-retry",
    name: "不重试",
    baseURL: SITE,
    defaults: { retry: { count: 5, delay: 1 }, interval: 0 },
  })
  class NoRetryGoal extends BaseGoal<unknown> {
    @Endpoint("/api/x", { method: "GET" })
    fetchX(res: { code: number }): unknown {
      if (res.code === 53013) {
        throw new SpiderError({
          kind: "no-results",
          message: "该筛选下无公开数据",
          scope: "no-retry",
        });
      }
      return res;
    }

    @Aggregate()
    aggregate(ctx: GoalContext): unknown {
      return ctx.get("fetchX");
    }
  }

  await expectKind(() => runGoal(new NoRetryGoal(), upstream), "no-results");
  assert.equal(upstream.calls.length, 1, "业务软失败不该触发 HTTP 重试");
});

test("超时：AbortSignal 真正生效 → endpoint-timeout（可重试）", async () => {
  const upstream = new FakeUpstream().route("/api/slow", {
    body: { ok: true },
    delayMs: 200, // 远超下面的 timeout
  });

  @Goal({
    id: "timeout",
    name: "超时",
    baseURL: SITE,
    defaults: { retry: { count: 1, delay: 1 }, interval: 0, timeout: 20 },
  })
  class TimeoutGoal extends BaseGoal<unknown> {
    @Endpoint("/api/slow", { method: "GET" })
    fetchSlow(r: unknown): unknown {
      return r;
    }

    @Aggregate()
    aggregate(ctx: GoalContext): unknown {
      return ctx.get("fetchSlow");
    }
  }

  const err = await expectKind(
    () => runGoal(new TimeoutGoal(), upstream),
    "retry-exhausted",
  );
  assert.equal(
    (err.cause as SpiderError)?.kind,
    "endpoint-timeout",
    "超时必须落在 endpoint-timeout 而不是被当成通用网络错误",
  );
});

/** 期望 JSON 却拿到别的东西时的最小 Goal —— 两条分流用例共用 */
@Goal({
  id: "non-json",
  name: "非 JSON 响应",
  baseURL: SITE,
  defaults: { retry: { count: 3, delay: 1 }, interval: 0 },
})
class NonJsonGoal extends BaseGoal<unknown> {
  @Endpoint("/api/x", { method: "GET" })
  fetchX(r: unknown): unknown {
    return r;
  }

  @Aggregate()
  aggregate(ctx: GoalContext): unknown {
    return ctx.get("fetchX");
  }
}

test("HTTP 200 但响应体是 HTML 拦截页 → risk-control，且一次都不重试", async () => {
  // 这是真机上最常见的风控形态：接口路径不变、状态码仍是 200，
  // 只是 body 被验证页顶替。若归到 endpoint-http（可重试），框架就会
  // 朝着正在拦截你的服务器连打 count+1 次，只会加剧封禁 ——
  // 所以 kind-meta 把「下载到 HTML 拦截页」写进了 risk-control 的 trigger。
  const upstream = new FakeUpstream().route("/api/x", {
    body: "<html><body>请完成安全验证</body></html>",
  });

  const err = await expectKind(
    () => runGoal(new NonJsonGoal(), upstream),
    "risk-control",
  );
  assert.match(
    String(err.details?.bodyHead ?? ""),
    /安全验证/,
    "details 要带响应体开头片段，否则维护者无从判断拦截页类型",
  );
  assert.equal(upstream.calls.length, 1, "risk-control 不可重试");
});

test("HTTP 200 但响应体为空 → endpoint-http（可重试），与拦截页分流", async () => {
  // 同为「解析不出 JSON」，空壳是上游对超大响应的偶发故障，重试有意义；
  // 有内容才是风控。二者处置相反，不能笼统归一类。
  const upstream = new FakeUpstream().route("/api/x", { body: "" });

  const err = await expectKind(
    () => runGoal(new NonJsonGoal(), upstream),
    "retry-exhausted",
  );
  assert.equal((err.cause as SpiderError)?.kind, "endpoint-http");
  assert.equal(upstream.calls.length, 4, "空壳响应应走满 count+1 次重试");
});

// ============================================================================
// ⑥ 端点方法体抛错不经 HTTP retry、kind 直达信封（本轮反复确认的语义，钉死）
// ============================================================================

test("端点方法体抛 SpiderError：不触发 HTTP 重试，kind 原样向上传播", async () => {
  const upstream = new FakeUpstream().route("/api/shape", {
    body: { unexpected: "上游改版了" },
  });

  @Goal({
    id: "projection-throw",
    name: "投影抛错",
    baseURL: SITE,
    // count=5 是陷阱：如果实现把投影错误当成 HTTP 错误重试，calls 会变成 6
    defaults: { retry: { count: 5, delay: 1 }, interval: 0 },
  })
  class ProjectionThrowGoal extends BaseGoal<unknown> {
    @Endpoint("/api/shape", { method: "GET" })
    fetchShape(res: { list?: unknown[] }): unknown[] {
      if (!Array.isArray(res.list)) {
        throw new SpiderError({
          kind: "upstream-shape-changed",
          message: "响应缺少 list 字段",
          scope: "projection-throw",
          details: { got: Object.keys(res) },
        });
      }
      return res.list;
    }

    @Aggregate()
    aggregate(ctx: GoalContext): unknown {
      return ctx.get("fetchShape");
    }
  }

  const err = await expectKind(
    () => runGoal(new ProjectionThrowGoal(), upstream),
    "upstream-shape-changed",
  );

  assert.equal(
    upstream.calls.length,
    1,
    "投影发生在 HTTP 成功之后，重试它只会把同一份坏数据再投一遍",
  );
  assert.deepEqual(err.details?.got, ["unexpected"], "details 必须原样到达，供维护者定位");
  assert.equal(err.kind, "upstream-shape-changed", "kind 不得被包装成 retry-exhausted");
});

test("端点方法体抛裸 Error：同样不重试，原样向上抛给 Skill 层归一", async () => {
  const upstream = new FakeUpstream().route("/api/boom", { body: { a: 1 } });

  @Goal({
    id: "bare-throw",
    name: "裸抛",
    baseURL: SITE,
    defaults: { retry: { count: 3, delay: 1 }, interval: 0 },
  })
  class BareThrowGoal extends BaseGoal<unknown> {
    @Endpoint("/api/boom", { method: "GET" })
    fetchBoom(res: { a: number }): unknown {
      return (res as unknown as { missing: { deep: number } }).missing.deep;
    }

    @Aggregate()
    aggregate(ctx: GoalContext): unknown {
      return ctx.get("fetchBoom");
    }
  }

  // Goal 层不做 kind 归一 —— 裸 Error 原样穿出，由 BaseSkill.buildFailure
  // 兜底成 pipeline-error（见 test/unit/errors.test.ts）。这里只钉"不重试"。
  await assert.rejects(
    () => runGoal(new BareThrowGoal(), upstream),
    (err: Error) => {
      assert.ok(err instanceof TypeError, `期望 TypeError，实际 ${err.constructor.name}`);
      assert.equal(
        err instanceof SpiderError,
        false,
        "Goal 层不该把裸 Error 猜成某个 kind —— 归一是 Skill 层的职责",
      );
      return true;
    },
  );
  assert.equal(upstream.calls.length, 1, "TypeError 也不该被当作可重试的上游故障");
});

test("aggregate 抛错：kind 原样传播，不被 goal.end 事件吞掉", async () => {
  const upstream = new FakeUpstream().route("/api/a", { body: { list: [] } });

  @Goal({ id: "agg-throw", name: "聚合抛错", baseURL: SITE, defaults: { interval: 0 } })
  class AggThrowGoal extends BaseGoal<unknown> {
    @Endpoint("/api/a", { method: "GET" })
    fetchA(r: { list: unknown[] }): unknown[] {
      return r.list;
    }

    @Aggregate()
    aggregate(ctx: GoalContext): unknown {
      const list = ctx.get<unknown[]>("fetchA");
      if (list.length === 0) {
        throw new SpiderError({
          kind: "no-results",
          message: "该筛选下无公开数据",
          scope: "agg-throw",
        });
      }
      return list;
    }
  }

  await expectKind(() => runGoal(new AggThrowGoal(), upstream), "no-results");
});

// ============================================================================
// 请求构造：query / body / 路径参数
// ============================================================================

test("GET：query 函数的返回值进 querystring；null/undefined 被剔除", async () => {
  const upstream = new FakeUpstream().route("/api/search", { body: { ok: true } });

  @Goal({ id: "query", name: "查询", baseURL: SITE, defaults: { interval: 0 } })
  class QueryGoal extends BaseGoal<unknown> {
    @Endpoint("/api/search", {
      method: "GET",
      query: (ctx) => ({
        keyword: ctx.params.keyword,
        page: 1,
        empty: undefined,
        nothing: null,
      }),
    })
    search(r: unknown): unknown {
      return r;
    }

    @Aggregate()
    aggregate(ctx: GoalContext): unknown {
      return ctx.get("search");
    }
  }

  await runGoal(new QueryGoal(), upstream, { keyword: "测试关键词" });

  const url = new URL(upstream.calls[0].url);
  assert.equal(url.searchParams.get("keyword"), "测试关键词");
  assert.equal(url.searchParams.get("page"), "1");
  assert.equal(url.searchParams.has("empty"), false, "undefined 不该出现在 querystring");
  assert.equal(url.searchParams.has("nothing"), false, "null 不该出现在 querystring");
});

test("POST：对象 body 序列化为 JSON 并带上 Content-Type", async () => {
  const upstream = new FakeUpstream().route("/api/submit", { body: { ok: true } });

  @Goal({ id: "post", name: "提交", baseURL: SITE, defaults: { interval: 0 } })
  class PostGoal extends BaseGoal<unknown> {
    @Endpoint("/api/submit", {
      method: "POST",
      // ctx 必须显式标注：EndpointOptions.body 的联合里含 unknown，会把函数分支
      // 吸收掉、丢失上下文类型（query/headers 用 Record 故无此问题）。
      // 全仓 body 回调都是这个写法。
      body: (ctx: GoalContext) => ({ id: ctx.params.id, flag: true }),
    })
    submit(r: unknown): unknown {
      return r;
    }

    @Aggregate()
    aggregate(ctx: GoalContext): unknown {
      return ctx.get("submit");
    }
  }

  await runGoal(new PostGoal(), upstream, { id: 42 });

  const call = upstream.calls[0];
  assert.equal(call.method, "POST");
  assert.deepEqual(JSON.parse(call.body!), { id: 42, flag: true });
  const ct = Object.entries(call.headers).find(
    ([k]) => k.toLowerCase() === "content-type",
  )?.[1];
  assert.match(ct ?? "", /application\/json/);
});

test("路径参数 :id 被替换且不重复出现在 querystring", async () => {
  const upstream = new FakeUpstream()
    .route("/api/list", { body: { list: [{ id: 7 }] } })
    .route("/api/item/", { body: { ok: true } });

  @Goal({ id: "path-param", name: "路径参数", baseURL: SITE, defaults: { interval: 0 } })
  class PathParamGoal extends BaseGoal<unknown> {
    @Endpoint("/api/list", { method: "GET" })
    fetchList(r: { list: unknown[] }): unknown[] {
      return r.list;
    }

    @Endpoint("/api/item/:id", { method: "GET" })
    @Expanded({
      dependencies: ["fetchList"],
      source: (ctx: GoalContext) => ctx.get<Array<{ id: number }>>("fetchList"),
      params: (item: { id: number }) => ({ id: item.id }),
      interval: 0,
    })
    fetchItem(r: unknown): unknown {
      return r;
    }

    @Aggregate()
    aggregate(ctx: GoalContext): unknown {
      return ctx.get("fetchItem");
    }
  }

  await runGoal(new PathParamGoal(), upstream);

  const itemCall = upstream.calls.find((c) => c.url.includes("/api/item/"))!;
  assert.match(itemCall.url, /\/api\/item\/7$/, "路径参数应被替换，且不该再拼进 query");
});

// ============================================================================
// 可观测性：事件链路完整
// ============================================================================

test("事件链路：goal.start / endpoint.request / endpoint.response / goal.end 齐全", async () => {
  const upstream = new FakeUpstream().route("/api/a", { body: { v: 1 } });

  @Goal({ id: "obs", name: "观测", baseURL: SITE, defaults: { interval: 0 } })
  class ObsGoal extends BaseGoal<unknown> {
    @Endpoint("/api/a", { method: "GET" })
    fetchA(r: unknown): unknown {
      return r;
    }

    @Aggregate()
    aggregate(ctx: GoalContext): unknown {
      return ctx.get("fetchA");
    }
  }

  const page = new FakePage({ upstream });
  const { runtime, events } = createTestRuntime();
  await runWithRuntime(runtime, () =>
    new GoalExecutor().execute(new ObsGoal(), page as unknown as Page, {}),
  );

  const kinds = events.map((e) => e.kind);
  assert.deepEqual(kinds, [
    "goal.start",
    "endpoint.request",
    "endpoint.response",
    "endpoint.projection",
    "goal.end",
  ]);

  const end = events.find((e) => e.kind === "goal.end") as { status: string };
  assert.equal(end.status, "success");
});

test("事件链路：失败时 goal.end 状态为 failure，且重试有 error 事件", async () => {
  const upstream = new FakeUpstream().route("/api/a", { status: 500, body: {} });

  @Goal({
    id: "obs-fail",
    name: "观测失败",
    baseURL: SITE,
    defaults: { retry: { count: 1, delay: 1 }, interval: 0 },
  })
  class ObsFailGoal extends BaseGoal<unknown> {
    @Endpoint("/api/a", { method: "GET" })
    fetchA(r: unknown): unknown {
      return r;
    }

    @Aggregate()
    aggregate(ctx: GoalContext): unknown {
      return ctx.get("fetchA");
    }
  }

  const page = new FakePage({ upstream });
  const { runtime, events } = createTestRuntime();
  await assert.rejects(() =>
    runWithRuntime(runtime, () =>
      new GoalExecutor().execute(new ObsFailGoal(), page as unknown as Page, {}),
    ),
  );

  const retryEvents = events.filter(
    (e) => e.kind === "error" && (e as { errorKind?: string }).errorKind === "endpoint-retry",
  );
  assert.equal(retryEvents.length, 1, "count=1 应产生恰好 1 条重试事件");

  const end = events.find((e) => e.kind === "goal.end") as { status: string };
  assert.equal(end.status, "failure");
});
