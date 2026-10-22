/**
 * tv-indicator-list / tv-indicator 模块测试
 *
 * tv-indicator 是本包唯一的两段式 Skill（HTTP 编译 + WS 挂载），
 * 测试要同时喂假 transport 与假上游响应 —— 这也是这类混合链路的
 * 测试成本所在，但比只测一半更有价值。
 */
import { test, describe } from "vitest";
import assert from "node:assert/strict";
import { SpiderError, testing } from "@spider/core";
import { TvIndicatorListSkill } from "@src/skills/indicator-list.skill";
import { TvIndicatorSkill } from "@src/skills/indicator.skill";
import { FakeTvTransport, type ScriptedBatch } from "../fixtures/fake-transport";

function listSkill() {
  return new TvIndicatorListSkill({
    sessionProvider: null as never,
    goalExecutor: null as never,
  });
}

function indicatorSkill(batches: ScriptedBatch[]) {
  const t = new FakeTvTransport(batches);
  const skill = new TvIndicatorSkill({
    sessionProvider: null as never,
    wsTransportFactory: () => t,
  });
  return { skill, transport: t };
}

describe("tv-indicator-list 参数归一", () => {
  test("默认拉取 standard + candlestick（均为免费分组）", () => {
    const p = testing.invokeNormalize(listSkill() as never, {}) as {
      categories: string[];
      limit: number;
    };
    assert.deepEqual(p.categories, ["standard", "candlestick"]);
    assert.equal(p.limit, 60);
  });

  test("categories 去重且空数组回落默认值", () => {
    const p = testing.invokeNormalize(listSkill() as never, {
      categories: ["standard", "standard"],
    }) as { categories: string[] };
    assert.deepEqual(p.categories, ["standard"]);

    const p2 = testing.invokeNormalize(listSkill() as never, {
      categories: [],
    }) as { categories: string[] };
    assert.deepEqual(p2.categories, ["standard", "candlestick"], "空数组应回落默认");
  });

  test("access 是我方定义的枚举 → 非法值被拦截", () => {
    assert.throws(
      () => testing.invokeNormalize(listSkill() as never, { access: "vip" }),
      (e: SpiderError) => {
        assert.equal(e.kind, "invalid-params");
        assert.match(e.message, /free/, "错误信息要列出合法取值");
        return true;
      },
    );
  });

  test("categories 是上游枚举 → 未知取值放行（不做白名单拦截）", () => {
    const p = testing.invokeNormalize(listSkill() as never, {
      categories: ["some_new_group"],
    }) as { categories: string[] };
    assert.deepEqual(
      p.categories,
      ["some_new_group"],
      "★ 上游枚举只透传，由上游判定 —— 白名单拦截会造成功能阉割",
    );
  });

  test("limit 被 clamp 到安全区间", () => {
    const lo = testing.invokeNormalize(listSkill() as never, { limit: -3 }) as { limit: number };
    assert.equal(lo.limit, 1);
    const hi = testing.invokeNormalize(listSkill() as never, { limit: 99_999 }) as { limit: number };
    assert.equal(hi.limit, 500);
  });

  test("access 同时落到 accessFilter（Goal 层消费的键）", () => {
    const p = testing.invokeNormalize(listSkill() as never, { access: "free" }) as {
      access: string;
      accessFilter: string;
    };
    assert.equal(p.access, "free");
    assert.equal(p.accessFilter, "free", "★ Goal 读的是 accessFilter，漏填会导致筛选静默失效");
  });
});

describe("tv-indicator 参数归一", () => {
  test("pineId 缺失 → missing-context，并引导用 tv-indicator-list", () => {
    const { skill } = indicatorSkill([]);
    assert.throws(
      () => testing.invokeNormalize(skill as never, { symbols: ["NASDAQ:AAPL"] }),
      (e: SpiderError) => {
        assert.equal(e.kind, "missing-context");
        assert.match(e.message, /tv-indicator-list/);
        return true;
      },
    );
  });

  test("★ 传显示名而非 pineId 被拦截（最常犯的错）", () => {
    const { skill } = indicatorSkill([]);
    for (const bad of ["RSI 背离", "Aroon Oscillator", "moving average"]) {
      assert.throws(
        () => testing.invokeNormalize(skill as never, {
          symbols: ["NASDAQ:AAPL"], pineId: bad,
        }),
        (e: SpiderError) => {
          assert.equal(e.kind, "invalid-params");
          assert.match(e.message, /显示名/, "要点明是显示名 vs pineId 的混淆");
          assert.match(e.message, /tv-indicator-list/, "要给出可执行的下一步");
          return true;
        },
        `"${bad}" 应被拦截`,
      );
    }
  });

  test("合法 pineId 通过（含 %1 转义与 PUB 命名空间）", () => {
    const { skill } = indicatorSkill([]);
    for (const ok of ["STD;RSI", "STD;Aroon_Oscillator", "STD;Bars%1Up%1Dn%1Strategy", "PUB;6daafb2cabe6419d98ae25229d2327f8"]) {
      const p = testing.invokeNormalize(skill as never, {
        symbols: ["NASDAQ:AAPL"], pineId: ok,
      }) as { pineId: string };
      assert.equal(p.pineId, ok);
    }
  });

  test("inputs 键名必须是 in_N 形态，其余拦截并给出引导", () => {
    const { skill } = indicatorSkill([]);
    assert.throws(
      () => testing.invokeNormalize(skill as never, {
        symbols: ["NASDAQ:AAPL"], pineId: "STD;RSI",
        inputs: { length: 21 },
      }),
      (e: SpiderError) => {
        assert.equal(e.kind, "invalid-params");
        assert.match(e.message, /in_0/, "要说明正确形态");
        return true;
      },
    );

    const ok = testing.invokeNormalize(skill as never, {
      symbols: ["NASDAQ:AAPL"], pineId: "STD;RSI",
      inputs: { in_0: 21 },
    }) as { inputs: Record<string, unknown> };
    assert.deepEqual(ok.inputs, { in_0: 21 });
  });

  test("symbols 超上限被拦截并提示分批", () => {
    const { skill } = indicatorSkill([]);
    const many = Array.from({ length: 6 }, (_, i) => `X:S${i}`);
    assert.throws(
      () => testing.invokeNormalize(skill as never, { symbols: many, pineId: "STD;RSI" }),
      (e: SpiderError) => {
        assert.match(e.message, /分批/);
        return true;
      },
    );
  });

  test("ticker 形状仍被校验（复用 tv-history 的同一守卫）", () => {
    const { skill } = indicatorSkill([]);
    assert.throws(
      () => testing.invokeNormalize(skill as never, { symbols: ["AAPL"], pineId: "STD;RSI" }),
      (e: SpiderError) => {
        assert.match(e.message, /tv-search/);
        return true;
      },
    );
  });
});

describe("tv-indicator 缺 goalExecutor 时的诊断", () => {
  /**
   * 编译步骤依赖 goalExecutor（`PuppeteerSkillDeps` 的可选依赖）。
   * registry 忘注入时要给**维护者视角**的提示，而不是让 Agent 误以为是参数问题。
   */
  test("报错指向包内组装缺陷而非用户入参", async () => {
    const { skill } = indicatorSkill([]);
    const out = await testing.runSkillWithFixtures(
      skill as never,
      { symbols: ["NASDAQ:AAPL"], pineId: "STD;RSI" },
      { upstream: new testing.FakeUpstream() },
    );
    assert.equal(out.expectFailureKind(), "missing-context");
  });
});
