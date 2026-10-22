/**
 * PuppeteerSkill 模板方法 · 并发竞态 · RAII（docs/TESTING.md §3.2 后三行）。
 *
 * 这里测的是 `PuppeteerSkill.execute()` 那套 12 环节骨架——它是所有浏览器链路
 * skill 的公共地基，一处松动全仓受影响，而症状往往不体现在输出上：
 * teardown 没跑 → 监听器泄漏，长跑进程越来越慢；PageContext 复用 → 并发串数据，
 * 只在压测时偶发；租约没释放 → Page 越积越多，单次执行完全正常。
 * 所以本文件几乎不断言返回值，只断言**执行痕迹**（阶段次序、租约配对、请求归属）。
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "puppeteer-core";

import { PuppeteerSkill } from "@src/puppeteer/skill";
import type { BrowserSkillOptions } from "@src/puppeteer/interfaces";
import type { PageContext } from "@src/puppeteer/context";
import type { IPageHook } from "@src/puppeteer/hooks";
import { SKIP_STAGE, SKIP_PIPELINE, abortPipeline } from "@src/puppeteer/hooks";
import { RetryStage } from "@src/puppeteer/retry";
import { defineSlot } from "@src/puppeteer/slots";
import type { SkillParamSchema } from "@src/skill/interfaces";
import { SpiderError } from "@src/errors";

import { FakeUpstream } from "@src/testing/fake-upstream";
import { FakePage } from "@src/testing/fake-page";
import { FakeSessionProvider } from "@src/testing/fake-session-provider";
import { runSkillWithFixtures } from "@src/testing/run-skill";

const SITE = "https://example.invalid";

interface ProbeParams {
  keyword?: string;
  delayMs?: number;
}

/**
 * 记录阶段次序的探针 Skill。
 *
 * `trace` 是实例字段而非 Slot —— 这里就是要跨 execute 累积，用来验证次序；
 * 并发用例另用 Slot 验证隔离（见文末）。
 */
class ProbeSkill extends PuppeteerSkill<ProbeParams, { echo: string }> {
  readonly id = "probe-skill";
  readonly name = "阶段探针";
  readonly description = "记录生命周期阶段执行次序，仅测试用";
  readonly paramSchema: SkillParamSchema[] = [
    { name: "keyword", type: "string", required: false, description: "关键词" },
  ];

  protected readonly siteURL = SITE;
  readonly trace: string[] = [];

  constructor(private readonly probeHooks: IPageHook[] = []) {
    super({ sessionProvider: new FakeSessionProvider() });
  }

  protected get hooks(): IPageHook[] {
    return this.probeHooks;
  }

  protected getPath(params: ProbeParams): string {
    return `/search?q=${encodeURIComponent(params.keyword ?? "")}`;
  }

  protected async fetchData(
    page: Page,
    params: ProbeParams,
  ): Promise<{ echo: string }> {
    this.trace.push("fetchData");
    const res = await page.evaluate(async (q: string) => {
      const r = await fetch(`${"https://example.invalid"}/api?q=${q}`);
      return (await r.json()) as { echo: string };
    }, params.keyword ?? "");
    return res as { echo: string };
  }
}

/** 只记录自己被调到了哪些阶段的 Hook */
function tracingHook(name: string, trace: string[]): IPageHook {
  const rec = (stage: string) => () => {
    trace.push(`${name}:${stage}`);
  };
  return {
    name,
    setup: rec("setup"),
    ready: rec("ready"),
    interact: rec("interact"),
    extract: rec("extract"),
    transform: rec("transform"),
    persist: rec("persist"),
    teardown: rec("teardown"),
  };
}

function upstreamOk(echo = "ok"): FakeUpstream {
  return new FakeUpstream().route("/api", { body: { echo } });
}

// ============================================================================
// ① 阶段执行顺序
// ============================================================================

test("阶段次序：setup → navigate → ready → interact → fetchData → extract → transform → persist → teardown", async () => {
  const trace: string[] = [];
  const skill = new ProbeSkill([tracingHook("h", trace)]);
  const outcome = await runSkillWithFixtures(skill, { keyword: "测试" }, {
    upstream: upstreamOk(),
  });

  outcome.expectSuccess();

  // fetchData 由 skill 自己 push，Hook 各阶段由 tracingHook push，合并后即完整次序
  const merged = [...trace];
  const fetchIdx = merged.indexOf("h:interact") + 1;
  merged.splice(fetchIdx, 0, "fetchData");

  assert.deepEqual(merged, [
    "h:setup",
    "h:ready",
    "h:interact",
    "fetchData",
    "h:extract",
    "h:transform",
    "h:persist",
    "h:teardown",
  ]);

  // navigate 不是 Hook 阶段，但确实发生在 setup 之后 —— 用导航记录佐证
  assert.equal(outcome.page.navigations.length, 1);
  assert.match(outcome.page.navigations[0], /\/search\?q=/);
});

test("多个 Hook：同一阶段内按 hooks 数组顺序执行", async () => {
  const trace: string[] = [];
  const skill = new ProbeSkill([
    tracingHook("first", trace),
    tracingHook("second", trace),
  ]);
  await runSkillWithFixtures(skill, {}, { upstream: upstreamOk() });

  const setups = trace.filter((t) => t.endsWith(":setup"));
  assert.deepEqual(setups, ["first:setup", "second:setup"]);
});

test("shouldActivate=false 的 Hook 被跳过，但 teardown 仍然执行", async () => {
  const trace: string[] = [];
  const base = tracingHook("inactive", trace);
  const skill = new ProbeSkill([{ ...base, shouldActivate: () => false }]);

  await runSkillWithFixtures(skill, {}, { upstream: upstreamOk() });

  assert.equal(
    trace.some((t) => t === "inactive:setup"),
    false,
    "shouldActivate=false 时业务阶段不该执行",
  );
  assert.equal(
    trace.includes("inactive:teardown"),
    true,
    "teardown 忽略 shouldActivate —— setup 挂的资源必须有机会清理",
  );
});

// ============================================================================
// ② Hook 三个短路信号
// ============================================================================

test("SKIP_STAGE：跳过本阶段剩余 Hook，其它阶段照常", async () => {
  const trace: string[] = [];
  const stopper: IPageHook = {
    name: "stopper",
    setup: () => {
      trace.push("stopper:setup");
      return SKIP_STAGE;
    },
    ready: () => {
      trace.push("stopper:ready");
    },
  };
  const skill = new ProbeSkill([stopper, tracingHook("after", trace)]);

  const outcome = await runSkillWithFixtures(skill, {}, { upstream: upstreamOk() });
  outcome.expectSuccess();

  assert.equal(
    trace.includes("after:setup"),
    false,
    "SKIP_STAGE 应阻断同阶段的后续 Hook",
  );
  assert.equal(
    trace.includes("after:ready"),
    true,
    "SKIP_STAGE 只作用于当前阶段，ready 阶段必须恢复正常",
  );
  assert.equal(trace.includes("stopper:ready"), true);
});

test("SKIP_PIPELINE：终止 extract/transform/persist，但仍产出成功结果", async () => {
  const trace: string[] = [];
  const halter: IPageHook = {
    name: "halter",
    extract: () => {
      trace.push("halter:extract");
      return SKIP_PIPELINE;
    },
  };
  const skill = new ProbeSkill([halter, tracingHook("after", trace)]);

  const outcome = await runSkillWithFixtures(skill, {}, { upstream: upstreamOk() });

  // 受控信号 ≠ 错误：投影照跑，结果仍是 success
  assert.deepEqual(outcome.expectSuccess(), { echo: "ok" });
  assert.equal(trace.includes("after:extract"), false, "同阶段后续 Hook 应被跳过");
  assert.equal(trace.includes("after:transform"), false, "后续 Data Pipeline 阶段应被跳过");
  assert.equal(trace.includes("after:persist"), false);
  assert.equal(trace.includes("after:teardown"), true, "teardown 不受 skipPipeline 影响");
});

test("abortPipeline：转为 failure，kind 取信号里指定的值", async () => {
  const trace: string[] = [];
  const aborter: IPageHook = {
    name: "aborter",
    ready: () => abortPipeline("检测到风控拦截页", "risk-control"),
  };
  const skill = new ProbeSkill([aborter, tracingHook("after", trace)]);

  const outcome = await runSkillWithFixtures(skill, {}, { upstream: upstreamOk() });

  assert.equal(outcome.expectFailureKind(), "risk-control");
  assert.equal(outcome.result.error, "检测到风控拦截页");
  assert.equal(trace.includes("after:extract"), false, "abort 后不该继续跑数据管道");
  assert.equal(trace.includes("after:teardown"), true, "abort 路径同样要 teardown");
  outcome.provider.assertBalanced();
});

test("abortPipeline 不指定 kind 时落到 hook-abort", async () => {
  const skill = new ProbeSkill([
    { name: "aborter", ready: () => abortPipeline("说不清的原因") },
  ]);
  const outcome = await runSkillWithFixtures(skill, {}, { upstream: upstreamOk() });
  assert.equal(outcome.expectFailureKind(), "hook-abort");
});

// ============================================================================
// ③ teardown 必然执行且吞异常
// ============================================================================

test("teardown 在异常路径必然执行", async () => {
  const trace: string[] = [];
  const exploder: IPageHook = {
    name: "exploder",
    interact: () => {
      throw new SpiderError({
        kind: "navigation-failed",
        message: "页面结构不对",
        scope: "probe-skill",
      });
    },
  };
  const skill = new ProbeSkill([exploder, tracingHook("cleaner", trace)]);

  const outcome = await runSkillWithFixtures(skill, {}, { upstream: upstreamOk() });

  assert.equal(outcome.expectFailureKind(), "navigation-failed");
  assert.equal(trace.includes("cleaner:teardown"), true);
  outcome.provider.assertBalanced();
});

test("teardown 自身抛错被吞掉，不影响已产出的成功结果", async () => {
  const badCleaner: IPageHook = {
    name: "bad-cleaner",
    teardown: () => {
      throw new Error("清理时炸了");
    },
  };
  const trace: string[] = [];
  const skill = new ProbeSkill([badCleaner, tracingHook("next", trace)]);

  const outcome = await runSkillWithFixtures(skill, {}, { upstream: upstreamOk() });

  assert.deepEqual(outcome.expectSuccess(), { echo: "ok" }, "teardown 异常不得翻转结果");
  assert.equal(
    trace.includes("next:teardown"),
    true,
    "一个 teardown 抛错不该阻断后续 Hook 的清理",
  );
  outcome.provider.assertBalanced();
});

test("teardown 抛错时租约仍被释放", async () => {
  const skill = new ProbeSkill([
    {
      name: "bad-cleaner",
      teardown: () => {
        throw new Error("清理时炸了");
      },
    },
  ]);
  const outcome = await runSkillWithFixtures(skill, {}, { upstream: upstreamOk() });

  outcome.provider.assertBalanced();
  assert.equal(outcome.provider.acquisitions[0].releaseCount, 1);
});

// ============================================================================
// ④ @RetryStage 仅对 setup / ready / interact 生效
// ============================================================================

test("@RetryStage('ready')：Hook 抛可重试错误时整个阶段被重跑", async () => {
  let attempts = 0;
  const flaky: IPageHook = {
    name: "flaky",
    ready: () => {
      attempts++;
      if (attempts < 3) {
        throw new SpiderError({
          kind: "navigation-failed", // browser 类，retryable
          message: "页面还没就绪",
          scope: "retry-skill",
        });
      }
    },
  };

  @RetryStage("ready", { times: 3, delayMs: 1, backoff: "constant" })
  class RetryReadySkill extends ProbeSkill {}

  const skill = new RetryReadySkill([flaky]);
  const outcome = await runSkillWithFixtures(skill, {}, { upstream: upstreamOk() });

  outcome.expectSuccess();
  assert.equal(attempts, 3, "首次 + 2 次重试后成功");
});

test("@RetryStage：不可重试的错误不触发重试", async () => {
  let attempts = 0;
  const bad: IPageHook = {
    name: "bad",
    ready: () => {
      attempts++;
      throw new SpiderError({
        kind: "invalid-params", // params 类，不可重试
        message: "参数不对",
        scope: "retry-skill",
      });
    },
  };

  @RetryStage("ready", { times: 5, delayMs: 1, backoff: "constant" })
  class NoRetrySkill extends ProbeSkill {}

  const outcome = await runSkillWithFixtures(new NoRetrySkill([bad]), {}, {
    upstream: upstreamOk(),
  });

  assert.equal(outcome.expectFailureKind(), "invalid-params");
  assert.equal(attempts, 1, "不可重试的 kind 必须一次就抛出");
});

test("Data Pipeline 阶段（extract）抛错不受 @RetryStage 保护 —— 它不经 runStage", async () => {
  // RetryStageEntry.stage 类型上就限定了 setup/ready/interact，这里用运行时
  // 反射旁路验证「即使绕过类型也不生效」，钉住 retry.ts 里那段注释的实际行为。
  let attempts = 0;
  const flakyExtract: IPageHook = {
    name: "flaky-extract",
    extract: () => {
      attempts++;
      throw new SpiderError({
        kind: "navigation-failed",
        message: "抽取失败",
        scope: "probe-skill",
      });
    },
  };

  const RetryAnyStage = RetryStage as unknown as (
    stage: string,
    opts: Record<string, unknown>,
  ) => ClassDecorator;

  @RetryAnyStage("extract", { times: 5, delayMs: 1, backoff: "constant" })
  class ExtractRetrySkill extends ProbeSkill {}

  const outcome = await runSkillWithFixtures(new ExtractRetrySkill([flakyExtract]), {}, {
    upstream: upstreamOk(),
  });

  assert.equal(outcome.expectFailureKind(), "navigation-failed");
  assert.equal(
    attempts,
    1,
    "对 extract 声明 @RetryStage 是静默死配置 —— 只有 setup/ready/interact 经 runStage",
  );
});

// ============================================================================
// ⑤ 并发竞态：同一 skill 实例并发 execute，结果不得互相污染
// ============================================================================

const ConcurrencySlot = defineSlot<string>("probe-concurrency-marker");

/**
 * 并发探针：在 setup 阶段往 Slot 写入自己的 keyword，在 fetchData 里读回来。
 *
 * 若 PageContext 被复用（而非每次 execute 新建），两路并发会读到对方的值——
 * 这正是「每次 execute 新建 PageContext」承诺要防的事，快照测不出来。
 */
class ConcurrentSkill extends PuppeteerSkill<
  ProbeParams,
  { echo: string; marker: string }
> {
  readonly id = "concurrent-skill";
  readonly name = "并发探针";
  readonly description = "验证并发 execute 之间上下文隔离，仅测试用";
  readonly paramSchema: SkillParamSchema[] = [];
  protected readonly siteURL = SITE;

  constructor() {
    super({ sessionProvider: new FakeSessionProvider() });
  }

  protected get hooks(): IPageHook[] {
    return [
      {
        name: "marker",
        setup: (_page, ctx: PageContext<object>) => {
          const p = ctx.params as ProbeParams;
          ctx.set(ConcurrencySlot, p.keyword ?? "<空>");
        },
      },
    ];
  }

  protected getPath(params: ProbeParams): string {
    return `/search?q=${encodeURIComponent(params.keyword ?? "")}`;
  }

  protected async fetchData(
    page: Page,
    params: ProbeParams,
    _options?: BrowserSkillOptions,
    ctx?: PageContext<ProbeParams>,
  ): Promise<{ echo: string; marker: string }> {
    const res = (await page.evaluate(
      async (input: { q: string; delay: number }) => {
        const r = await fetch(
          `https://example.invalid/api?q=${input.q}&delay=${input.delay}`,
        );
        return (await r.json()) as { echo: string };
      },
      { q: params.keyword ?? "", delay: params.delayMs ?? 0 },
    )) as { echo: string };

    return {
      echo: res.echo,
      marker: ctx?.get(ConcurrencySlot) ?? "<slot 丢失>",
    };
  }
}

test("并发竞态：同一实例两路并发 execute，参数 / Slot / 结果三者互不串", async () => {
  // 上游按 q 回显，并让 A 比 B 慢 —— 制造真正的交错窗口
  const upstream = new FakeUpstream()
    .route(/q=alpha/, { body: { echo: "alpha" }, delayMs: 40 })
    .route(/q=beta/, { body: { echo: "beta" }, delayMs: 5 });

  const skill = new ConcurrentSkill();
  // 两路各自的 provider/page —— 生产上也是每次 execute 单独 acquire
  const [a, b] = await Promise.all([
    runSkillWithFixtures<{ echo: string; marker: string }>(
      skill,
      { keyword: "alpha", delayMs: 40 },
      { upstream },
    ),
    runSkillWithFixtures<{ echo: string; marker: string }>(
      skill,
      { keyword: "beta", delayMs: 5 },
      { upstream },
    ),
  ]);

  assert.deepEqual(a.expectSuccess(), { echo: "alpha", marker: "alpha" });
  assert.deepEqual(b.expectSuccess(), { echo: "beta", marker: "beta" });

  // metadata 回显的入参也不能串
  assert.equal((a.result.metadata.params as ProbeParams).keyword, "alpha");
  assert.equal((b.result.metadata.params as ProbeParams).keyword, "beta");
});

test("并发竞态：20 路并发全部自洽（连跑用例，抓间歇性串数据）", async () => {
  const upstream = new FakeUpstream().route(/\/api\?q=/, { body: {} });
  // 按请求 URL 回显 —— 用 resolve 包装实现"参数决定响应"
  const original = upstream.resolve.bind(upstream);
  upstream.resolve = async (url: string, init?: RequestInit) => {
    const q = new URL(url).searchParams.get("q") ?? "";
    const delay = Number(new URL(url).searchParams.get("delay") ?? 0);
    const reply = await original(url, init);
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    return { ...reply, text: JSON.stringify({ echo: q }) };
  };

  const skill = new ConcurrentSkill();
  const outcomes = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      runSkillWithFixtures<{ echo: string; marker: string }>(
        skill,
        { keyword: `kw-${i}`, delayMs: (i % 5) * 3 },
        { upstream },
      ),
    ),
  );

  outcomes.forEach((o, i) => {
    assert.deepEqual(
      o.expectSuccess(),
      { echo: `kw-${i}`, marker: `kw-${i}` },
      `第 ${i} 路并发的结果被污染`,
    );
    o.provider.assertBalanced();
  });
});

// ============================================================================
// ⑥ RAII 租约平衡
// ============================================================================

test("RAII：正常路径 acquire/release 配对", async () => {
  const skill = new ProbeSkill();
  const outcome = await runSkillWithFixtures(skill, {}, { upstream: upstreamOk() });

  outcome.expectSuccess();
  assert.equal(outcome.provider.acquireCount, 1);
  assert.equal(outcome.provider.acquisitions[0].releaseCount, 1);
  outcome.provider.assertBalanced();
});

test("RAII：fetchData 抛错时租约仍被释放", async () => {
  class ThrowingSkill extends ProbeSkill {
    protected async fetchData(): Promise<{ echo: string }> {
      throw new SpiderError({
        kind: "upstream-shape-changed",
        message: "响应结构变了",
        scope: "probe-skill",
      });
    }
  }

  const outcome = await runSkillWithFixtures(new ThrowingSkill(), {}, {
    upstream: upstreamOk(),
  });

  assert.equal(outcome.expectFailureKind(), "upstream-shape-changed");
  outcome.provider.assertBalanced();
});

test("RAII：导航失败时租约仍被释放，且 kind 为 navigation-failed", async () => {
  const upstream = upstreamOk();
  const page = new FakePage({ upstream, gotoError: "net::ERR_CONNECTION_REFUSED" });
  const provider = new FakeSessionProvider(page);

  const outcome = await runSkillWithFixtures(new ProbeSkill(), {}, {
    upstream,
    page,
    provider,
  });

  assert.equal(outcome.expectFailureKind(), "navigation-failed");
  provider.assertBalanced();
});

test("RAII：acquire 本身失败时不产生悬空租约，结果是可判定的 failure", async () => {
  const upstream = upstreamOk();
  const provider = new FakeSessionProvider(new FakePage({ upstream }));
  provider.acquireError = () =>
    new SpiderError({
      kind: "browser-unavailable",
      message: "连不上调试端口",
      scope: "probe-skill",
    });

  const outcome = await runSkillWithFixtures(new ProbeSkill(), {}, {
    upstream,
    provider,
  });

  assert.equal(outcome.expectFailureKind(), "browser-unavailable");
  assert.equal(provider.acquireCount, 0, "acquire 失败不该留下记录");
  provider.assertBalanced();
});

test("RAII：release 幂等 —— 重复调用不抛错", async () => {
  const provider = new FakeSessionProvider(new FakePage({ upstream: upstreamOk() }));
  const session = await provider.acquire();
  await session.release();
  await assert.doesNotReject(() => session.release());
  assert.equal(provider.acquisitions[0].releaseCount, 2, "多余的 release 单独计数");
  provider.assertBalanced();
});

// ============================================================================
// ⑦ FakePage.evaluate 的序列化边界（自证：闭包引用必须 ReferenceError）
// ============================================================================

test("evaluate 闭包引用外部变量 → ReferenceError（与真机同步失败）", async () => {
  const page = new FakePage({ upstream: upstreamOk() });
  const outsideValue = "Node 侧的闭包变量";

  await assert.rejects(
    () => page.evaluate(() => outsideValue),
    (err: Error) => {
      assert.ok(
        err instanceof ReferenceError,
        `期望 ReferenceError，实际 ${err.constructor.name}: ${err.message}`,
      );
      assert.match(err.message, /outsideValue/);
      return true;
    },
    "替身若允许闭包引用，测试会全绿而真机上炸 —— 这正是本仓构建红线踩过的坑",
  );
});

test("evaluate 抛出的错误属于宿主 realm —— instanceof Error 必须成立", async () => {
  // vm 引擎内部生成的错误挂的是该 context 自己的 Error.prototype，
  // 不搬回宿主 realm 的话 `err instanceof Error` 恒 false，
  // 于是 toSpiderError 会走 String(err) 分支 —— 与真机 puppeteer 行为不符。
  const page = new FakePage({ upstream: upstreamOk() });

  await assert.rejects(
    () => page.evaluate(() => (undefined as unknown as { a: number }).a),
    (err: unknown) => {
      assert.ok(err instanceof Error, "vm realm 的错误未搬回宿主 realm");
      assert.ok(err instanceof TypeError, `期望 TypeError，实际 ${err.name}`);
      return true;
    },
  );

  // 回调自己 new 出来的错误本就是宿主 realm（sandbox 注入的是宿主构造器），原样透出
  await assert.rejects(
    () =>
      page.evaluate(() => {
        throw new Error("业务侧主动抛错");
      }),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.equal((err as Error).message, "业务侧主动抛错");
      return true;
    },
  );
});

test("evaluate 显式传参可以跨边界，闭包不行", async () => {
  const page = new FakePage({ upstream: upstreamOk() });
  const value = "显式传参";
  const result = await page.evaluate((v: string) => `收到：${v}`, value);
  assert.equal(result, "收到：显式传参");
});

test("evaluate 参数经 JSON round-trip：Date 被抹平成字符串（与真机一致）", async () => {
  const page = new FakePage({ upstream: upstreamOk() });
  const result = await page.evaluate(
    (v: { when: string }) => typeof v.when,
    { when: new Date(0) },
  );
  assert.equal(result, "string", "真机 CDP 传参同样会把 Date 序列化成字符串");
});

// ============================================================================
// ⑧ 铁律：execute() 绝不向调用者抛异常（CLAUDE.md §2.4）
// ============================================================================

/** normalizeParams 直接抛错的探针 —— 模拟各 skill 的语义校验 */
class RejectingSkill extends PuppeteerSkill<ProbeParams, { echo: string }> {
  readonly id = "rejecting-skill";
  readonly name = "参数拒收探针";
  readonly description = "normalizeParams 必抛错，仅测试用";
  readonly paramSchema: SkillParamSchema[] = [
    { name: "keyword", type: "string", required: false, description: "关键词" },
  ];

  protected readonly siteURL = SITE;

  constructor(private readonly provider = new FakeSessionProvider()) {
    super({ sessionProvider: provider });
  }

  protected normalizeParams(params: ProbeParams): ProbeParams {
    throw new SpiderError({
      kind: "missing-context",
      message: "keyword 必填",
      scope: this.id,
    });
    return params; // eslint-disable-line no-unreachable
  }

  protected getPath(): string {
    return "/search";
  }

  protected async fetchData(): Promise<{ echo: string }> {
    throw new Error("不该走到这里");
  }
}

test("normalizeParams 抛错 → 失败信封而非异常穿透，且一次会话都没取", async () => {
  // 这两步曾经写在 try 外，参数类错误会直接穿透 execute()。
  // CLI 自己的 catch 能兜住 stdout 不崩，但信封会退化（丢 skillId/params/durationMs），
  // 非 CLI 调用方则拿到异常而非 SkillResult —— 与判别联合的契约不符。
  const provider = new FakeSessionProvider();
  const skill = new RejectingSkill(provider);

  const result = await skill.execute({});

  assert.equal(result.success, false, "execute() 必须返回失败信封，不得抛出");
  assert.equal(result.metadata.errorInfo?.kind, "missing-context");
  assert.equal(result.metadata.skillId, "rejecting-skill", "信封元数据不得退化");
  assert.ok(
    typeof result.metadata.durationMs === "number",
    "失败信封同样要带耗时",
  );
  assert.equal(provider.acquireCount, 0, "参数校验必须早于 acquire");
  provider.assertBalanced();
});

test("validateWithSchema 抛错（缺必填）→ 失败信封，params 回显原始入参", async () => {
  class RequiredSkill extends ProbeSkill {
    readonly paramSchema: SkillParamSchema[] = [
      { name: "keyword", type: "string", required: true, description: "关键词" },
    ];
  }
  const skill = new RequiredSkill();

  const result = await skill.execute({});

  assert.equal(result.success, false);
  assert.equal(result.metadata.errorInfo?.kind, "missing-context");
  // normalizeParams 抛错时 normalized 尚未赋值，回显要退回原始入参
  assert.deepEqual(result.metadata.params, {});
});
