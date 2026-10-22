/**
 * list-extract 模块测试（L2，docs/TESTING.md §3.3 标准三件）。
 *
 * ListExtractSkill 是 PuppeteerSkill 子类，但 fetchData 完全在 DOM 上操作——
 * `runSkillWithFixtures(skill, params, {upstream, html})` 里的 upstream 一次
 * 都不会被调用（skill 从不发 fetch），只是 harness 的必填字段。
 *
 * 依赖面极窄：只需 sessionProvider（harness 注入）+ Configuration。
 *
 * 断言纪律（§8 红线）：只锁 kind 不锁 message；每个用例尾部
 * `provider.assertBalanced()`。
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { testing } from "@spider/core";

import { ListExtractSkill } from "@src/skill/list-extract.skill";
import { Configuration } from "@src/config";

import { expectSnapshot } from "../helpers/snapshot";
import {
  standardListHtml,
  singleArticleFallbackHtml,
  noMatchHtml,
  customSelectorsHtml,
  noSubStructureHtml,
} from "../fixtures/list-page.fixture";

const { FakeUpstream, runSkillWithFixtures } = testing;

const deps = () => ({
  sessionProvider: undefined as never, // harness 注入
  config: new Configuration(),
});

/** 本 skill 从不发请求，空 upstream 即可满足 harness 必填约束。 */
const noopUpstream = () => new FakeUpstream();

// ============================================================================
// ① 成功信封
// ============================================================================

test("成功信封：自动探测 article 候选，提取标题/链接/时间/摘要", async () => {
  const outcome = await runSkillWithFixtures(
    new ListExtractSkill(deps()),
    { url: "https://example.invalid/list" },
    { upstream: noopUpstream(), html: standardListHtml },
  );

  expectSnapshot("list-extract-envelope", outcome.result);

  const data = outcome.expectSuccess() as unknown as {
    title: string;
    link: string;
    description: string;
    items: Array<{ title: string; link: string; pubDate: string; description: string }>;
  };
  assert.equal(data.link, "https://example.invalid/list");
  assert.equal(data.items.length, 2);
  assert.equal(data.items[0].title, "测试标题甲");
  assert.equal(data.items[0].link, "https://example.invalid/post/1");
  assert.equal(data.items[0].pubDate, "2026-01-01T10:00:00Z");
  assert.equal(data.items[0].description, "测试摘要甲");
  outcome.provider.assertBalanced();
});

test("成功信封：自定义 selectors 精确提取（不要求 >= 2 个元素）", async () => {
  const outcome = await runSkillWithFixtures(
    new ListExtractSkill(deps()),
    {
      url: "https://example.invalid/custom",
      selectors: { item: ".custom-row", title: ".ttl", link: ".lnk", time: ".pub-time", summary: ".brief" },
    },
    { upstream: noopUpstream(), html: customSelectorsHtml },
  );

  const data = outcome.expectSuccess() as unknown as {
    items: Array<{ title: string; link: string; pubDate: string; description: string }>;
  };
  assert.equal(data.items.length, 2);
  assert.equal(data.items[0].title, "自定义标题甲");
  assert.equal(data.items[0].link, "https://example.invalid/custom/1");
  assert.equal(data.items[0].pubDate, "2026-02-01");
  assert.equal(data.items[0].description, "自定义摘要甲");
  outcome.provider.assertBalanced();
});

// ============================================================================
// ② 自动探测候选选择器优先级
// ============================================================================

test("探测优先级：单个 article 不满足 >=2 阈值，降级命中 [class*=item]", async () => {
  const outcome = await runSkillWithFixtures(
    new ListExtractSkill(deps()),
    { url: "https://example.invalid/fallback" },
    { upstream: noopUpstream(), html: singleArticleFallbackHtml },
  );

  const data = outcome.expectSuccess() as unknown as { items: Array<{ title: string }> };
  // 命中 [class*="item"]（2 个 .feed-item），而不是唯一的那个 article
  assert.equal(data.items.length, 2);
  assert.equal(data.items[0].title, "测试标题乙");
  assert.equal(data.items[1].title, "测试标题丙");
  outcome.provider.assertBalanced();
});

test("兜底：title/link/summary 均取不到时，title 回退元素文本前 100 字、link 为空串", async () => {
  const outcome = await runSkillWithFixtures(
    new ListExtractSkill(deps()),
    { url: "https://example.invalid/no-substructure" },
    { upstream: noopUpstream(), html: noSubStructureHtml },
  );

  const data = outcome.expectSuccess() as unknown as {
    items: Array<{ title: string; link: string; description: string }>;
  };
  assert.equal(data.items.length, 2);
  assert.ok(data.items[0].title.length <= 100);
  assert.equal(data.items[0].link, "");
  assert.equal(data.items[0].description, "");
  outcome.provider.assertBalanced();
});

// ============================================================================
// ③ 错误 kind 矩阵
// ============================================================================

test("矩阵·非法参数：url 缺失 → missing-context，不导航", async () => {
  const outcome = await runSkillWithFixtures(
    new ListExtractSkill(deps()),
    {} as { url: string },
    { upstream: noopUpstream(), html: standardListHtml },
  );

  assert.equal(outcome.expectFailureKind(), "missing-context");
  assert.equal(outcome.page.navigations.length, 0, "参数校验必须早于导航");
  outcome.provider.assertBalanced();
});

test("矩阵·导航失败：page.goto 抛错 → pipeline-error（navigate 被覆写，绕过 navigation-failed 包装，如实记录现状）", async () => {
  const { FakePage, FakeSessionProvider } = testing;
  const page = new FakePage({ upstream: noopUpstream(), gotoError: "net::ERR_CONNECTION_REFUSED" });
  const provider = new FakeSessionProvider(page);
  const outcome = await runSkillWithFixtures(
    new ListExtractSkill(deps()),
    { url: "https://example.invalid/unreachable" },
    { upstream: noopUpstream(), page, provider },
  );

  assert.equal(outcome.expectFailureKind(), "pipeline-error");
  outcome.provider.assertBalanced();
});

test("矩阵·DOM 缺失：未传 html 导致 document 未定义 → pipeline-error", async () => {
  const outcome = await runSkillWithFixtures(
    new ListExtractSkill(deps()),
    { url: "https://example.invalid/no-html" },
    { upstream: noopUpstream() },
  );

  assert.equal(outcome.expectFailureKind(), "pipeline-error");
  outcome.provider.assertBalanced();
});

// ============================================================================
// ④ 正常空集
// ============================================================================

test("正常空集：无任何候选选择器命中 → success + items:[]，不报错", async () => {
  const outcome = await runSkillWithFixtures(
    new ListExtractSkill(deps()),
    { url: "https://example.invalid/empty" },
    { upstream: noopUpstream(), html: noMatchHtml },
  );

  const data = outcome.expectSuccess() as unknown as { items: unknown[] };
  // ⚠ items 直接来自 page.evaluate（vm.runInContext），其 Array 挂的是 vm
  // realm 的 Array.prototype，与宿主 realm 的 [] 不 reference-equal——
  // list-extract 没有 envelope 投影阶段把它搬回宿主 realm（不同于 bilibili
  // 那些走了 Node 侧投影的模块），故用 .length 断言而非 assert.deepEqual。
  assert.equal(data.items.length, 0);
  outcome.provider.assertBalanced();
});

// ============================================================================
// ⑤ RAII —— 失败路径同样要还租约
// ============================================================================

test("RAII：无论成功失败，页面租约都被释放", async () => {
  for (const [label, html] of [
    ["成功", standardListHtml],
    ["失败（无 DOM）", undefined],
  ] as const) {
    const outcome = await runSkillWithFixtures(
      new ListExtractSkill(deps()),
      { url: "https://example.invalid/raii" },
      { upstream: noopUpstream(), html },
    );
    outcome.provider.assertBalanced();
    assert.equal(outcome.provider.acquireCount, 1, `${label}路径应只取一次会话`);
    assert.equal(
      outcome.provider.acquisitions[0].releaseCount,
      1,
      `${label}路径的 release 次数应恰好 1`,
    );
  }
});
