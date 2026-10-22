/**
 * 错误层不变量（docs/TESTING.md §2.1-2）。
 *
 * 错误分类是本仓对 Agent 的**核心承诺**：kind 是可判定信号，category /
 * retryable / handling 全部由 kind 派生。这些不变量不测，新增一个 kind 时
 * 三张表就会各说各话——而症状要等到某个定时任务对 risk-control 无脑重试、
 * 把账号跑封了才暴露。这里的用例全部是"漏一个就报警"的形态，不是抽样。
 */
import { test } from "vitest";
import assert from "node:assert/strict";

import {
  KIND_META,
  categoryOf,
  handlingOf,
  isRetryable,
  parseLegacyKind,
  toSpiderError,
  SpiderError,
  MissingContextError,
  RiskControlError,
  type FailureHandling,
  type SkillFailureKind,
} from "@src/errors";
import { BaseSkill } from "@src/skill/base";
import type { SkillParamSchema, SkillResult } from "@src/skill/interfaces";

/**
 * 全部 kind 的清单。
 *
 * 从 KIND_META 取键而非手写字面量数组：KIND_META 的类型是
 * `Record<SkillFailureKind, KindMeta>`，少写一个键**编译期**就报错，
 * 所以它天然是全集。手写数组只会退化成"我记得有这些"。
 */
const ALL_KINDS = Object.keys(KIND_META) as SkillFailureKind[];

/** 与 kinds.ts 分组一一对应的期望映射（这里必须手写——否则就是拿实现测实现） */
const EXPECTED_CATEGORY: Record<SkillFailureKind, string> = {
  "browser-unavailable": "browser",
  "browser-acquire-timeout": "browser",
  "navigation-failed": "browser",
  "not-logged-in": "auth",
  "access-denied": "auth",
  "risk-control": "auth",
  "missing-context": "params",
  "invalid-params": "params",
  "upstream-shape-changed": "upstream",
  "endpoint-http": "upstream",
  "endpoint-timeout": "upstream",
  "retry-exhausted": "upstream",
  "hook-abort": "pipeline",
  "pipeline-error": "pipeline",
  "no-results": "business",
  unsupported: "business",
};

// ============================================================================
// KIND_META 完整性
// ============================================================================

test("KIND_META：每个 kind 的 trigger / action / handling 都非空", () => {
  assert.equal(ALL_KINDS.length, 16, "kind 总数变化时同步更新 docs/TESTING.md");

  const HANDLINGS: readonly FailureHandling[] = [
    "backoff-retry",
    "human",
    "fix-params",
    "report-maintainer",
    "accept-empty",
    "fix-code",
  ];

  for (const kind of ALL_KINDS) {
    const meta = KIND_META[kind];
    assert.ok(
      meta.trigger && meta.trigger.trim().length > 0,
      `kind "${kind}" 的 trigger 为空 —— 抛错方无从对号入座`,
    );
    assert.ok(
      meta.action && meta.action.trim().length > 0,
      `kind "${kind}" 的 action 为空 —— 生成的 Agent 错误表会留白`,
    );
    assert.ok(
      HANDLINGS.includes(meta.handling),
      `kind "${kind}" 的 handling "${meta.handling}" 不在闭合枚举内`,
    );
  }
});

// ============================================================================
// 三个派生函数的一致性
// ============================================================================

test("派生一致性：handlingOf(k) === 'backoff-retry' ⟺ isRetryable(k)", () => {
  for (const kind of ALL_KINDS) {
    assert.equal(
      handlingOf(kind) === "backoff-retry",
      isRetryable(kind),
      `kind "${kind}" 两张表打架：handling=${handlingOf(kind)} retryable=${isRetryable(kind)}。` +
        `新增 kind 时 kinds.ts 的 isRetryable 与 kind-meta.ts 的 handling 必须同步。`,
    );
  }
});

test("派生一致性：categoryOf 与 kinds.ts 的分组声明一致", () => {
  for (const kind of ALL_KINDS) {
    assert.equal(categoryOf(kind), EXPECTED_CATEGORY[kind], `kind "${kind}"`);
  }
});

test("risk-control 永不可重试 —— 自动重试会加剧封禁", () => {
  assert.equal(isRetryable("risk-control"), false);
  assert.equal(handlingOf("risk-control"), "human");
  assert.equal(new RiskControlError("触发滑块").isRetryable(), false);
});

test("no-results 是 accept-empty，不是错误处置", () => {
  assert.equal(handlingOf("no-results"), "accept-empty");
  assert.equal(isRetryable("no-results"), false);
});

test("SpiderError.category / isRetryable() 与自由函数同源", () => {
  for (const kind of ALL_KINDS) {
    const err = new SpiderError({ kind, message: "x" });
    assert.equal(err.category, categoryOf(kind), `kind "${kind}" 的 category`);
    assert.equal(err.isRetryable(), isRetryable(kind), `kind "${kind}" 的 retryable`);
  }
});

// ============================================================================
// toErrorInfo / toSpiderError 归一化
// ============================================================================

test("toErrorInfo：details 与 cause 都进入 AI 可消费结构", () => {
  const cause = new TypeError("底层炸了");
  const info = new SpiderError({
    kind: "endpoint-http",
    message: "上游 503",
    phase: "endpoint",
    scope: "my-skill",
    details: { status: 503, endpoint: "/api/list" },
    cause,
  }).toErrorInfo();

  assert.equal(info.kind, "endpoint-http");
  assert.equal(info.category, "upstream");
  assert.equal(info.phase, "endpoint");
  assert.equal(info.scope, "my-skill");
  assert.deepEqual(info.details, { status: 503, endpoint: "/api/list" });
  // cause 只取 name+message：原样塞 Error 会带上循环引用与巨大 stack
  assert.deepEqual(info.cause, { name: "TypeError", message: "底层炸了" });
});

test("toSpiderError：SpiderError 原样返回，裸 Error 包成 fallback kind 且保留 cause", () => {
  const original = new MissingContextError("缺 keyword");
  assert.equal(toSpiderError(original), original, "已是 SpiderError 不应被重新包装");

  const bare = new Error("随手抛的");
  const wrapped = toSpiderError(bare, "pipeline-error", { scope: "s" });
  assert.equal(wrapped.kind, "pipeline-error");
  assert.equal(wrapped.message, "随手抛的");
  assert.equal(wrapped.scope, "s");
  assert.equal(wrapped.cause, bare);

  const str = toSpiderError("字符串错误");
  assert.equal(str.kind, "pipeline-error");
  assert.equal(str.message, "字符串错误");
});

test("parseLegacyKind：识别 '[kind] msg' 前缀，无前缀返回 undefined", () => {
  assert.equal(parseLegacyKind("[no-results] 空集"), "no-results");
  assert.equal(parseLegacyKind("[endpoint-http] 503"), "endpoint-http");
  assert.equal(parseLegacyKind("没有前缀"), undefined);
  assert.equal(parseLegacyKind("[中文前缀] x"), undefined, "非 \\w- 字符不该被当成 kind");
});

// ============================================================================
// buildFailure 三种输入的归一化（§2.1-2 第三条）
// ============================================================================

/** 只为暴露 buildFailure/buildSuccess 的最小 skill（BaseSkill.execute 是 abstract） */
class ProbeSkill extends BaseSkill<{ q?: string }, string> {
  readonly id = "probe-skill";
  readonly name = "探针";
  readonly description = "仅用于测试 BaseSkill 的结果构建";
  readonly paramSchema: SkillParamSchema[] = [];

  async execute(): Promise<SkillResult<string>> {
    return this.buildSuccess("ok", {}, new Date());
  }

  fail(error: unknown): SkillResult<string> {
    return this.buildFailure(error, { q: "kw" }, new Date());
  }
  warn(): void {
    this.addWarning({ code: "schema-drift", message: "字段缺失，已降级" });
  }
}

test("buildFailure：SpiderError 输入 —— kind/phase/scope/details 全量透传", () => {
  const res = new ProbeSkill().fail(
    new RiskControlError("下载到 HTML 拦截页", {
      scope: "probe-skill",
      phase: "extract",
      details: { contentType: "text/html" },
    }),
  );

  assert.equal(res.success, false);
  assert.equal(res.error, "下载到 HTML 拦截页");
  const info = res.metadata.errorInfo;
  assert.equal(info?.kind, "risk-control");
  assert.equal(info?.category, "auth");
  assert.equal(info?.phase, "extract");
  assert.deepEqual(info?.details, { contentType: "text/html" });
  // 入参回显不因失败而丢
  assert.deepEqual(res.metadata.params, { q: "kw" });
});

test("buildFailure：裸 Error 输入 —— 兜底 pipeline-error 并挂 scope", () => {
  const res = new ProbeSkill().fail(new Error("undefined is not a function"));
  const info = res.metadata.errorInfo;
  assert.equal(info?.kind, "pipeline-error");
  assert.equal(info?.category, "pipeline");
  assert.equal(info?.scope, "probe-skill");
});

test("buildFailure：字符串输入 —— 解析 '[kind] msg' 前缀并剥掉前缀", () => {
  const res = new ProbeSkill().fail("[no-results] 该筛选下无公开数据");
  const info = res.metadata.errorInfo;
  assert.equal(info?.kind, "no-results");
  assert.equal(info?.category, "business");
  assert.equal(res.error, "该筛选下无公开数据", "前缀应从 message 中剥离");

  const plain = new ProbeSkill().fail("没有前缀的字符串");
  assert.equal(plain.metadata.errorInfo?.kind, "pipeline-error");
  assert.equal(plain.error, "没有前缀的字符串");
});

test("失败结果永远带 errorInfo —— Agent 的判定入口不允许为空", () => {
  const skill = new ProbeSkill();
  for (const input of [
    new MissingContextError("缺参"),
    new Error("裸"),
    "字符串",
    undefined,
    null,
    { weird: true },
  ]) {
    const res = skill.fail(input);
    assert.equal(res.success, false);
    assert.ok(
      res.metadata.errorInfo?.kind,
      `输入 ${String(input)} 归一化后 errorInfo.kind 缺失`,
    );
  }
});

test("软告警：写入 metadata.warnings 后清空，不串到下一次结果", async () => {
  const skill = new ProbeSkill();
  skill.warn();

  const first = await skill.execute();
  assert.equal(first.metadata.warnings?.length, 1);
  assert.equal(first.metadata.warnings?.[0].code, "schema-drift");

  const second = await skill.execute();
  assert.equal(second.metadata.warnings, undefined, "告警不应跨 execute 累积");
});
