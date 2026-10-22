/**
 * Goal 元数据与翻页/路径语义的守护测试
 *
 * 守护几个**静默出错**的陷阱 —— 它们都不会报错，只会让请求打错地方、
 * 多发几十次，或把整类资产拒之门外，靠人眼 review 发现不了。
 */
import { test, describe } from "vitest";
import assert from "node:assert/strict";
import { getGoalMetadata } from "@spider/core";
import { ScannerScanGoal } from "@src/thrall/scan";
import { SymbolSearchGoal, buildStartOffsets } from "@src/thrall/search";
import { SCAN_MARKET_NAMES, SEARCH_TYPE_NAMES } from "@src/constants";

describe("Goal 元数据隔离", () => {
  test("扫描 Goal 与检索 Goal 的端点互不干扰", () => {
    const scanStore = getGoalMetadata(ScannerScanGoal);
    const searchStore = getGoalMetadata(SymbolSearchGoal);

    assert.ok(scanStore?.endpoints.has("fetchScan"));
    assert.ok(searchStore?.endpoints.has("fetchPage"));
    assert.equal(
      searchStore?.endpoints.has("fetchScan"),
      false,
      "检索 Goal 不该看到扫描 Goal 的端点",
    );
    assert.equal(scanStore?.aggregateMethod, "aggregate");
    assert.equal(searchStore?.aggregateMethod, "aggregate");
  });

  /**
   * 扫描域是路径段，靠 `@Expanded` 的 params 参与 `resolveUrl` 替换。
   * 若端点 URL 被写成静态路径（如 "/global/scan"），所有扫描域都会打到同一个地方
   * —— 而 aggregate 回显的 market 仍然「正确」，输出完全看不出请求打错了。
   */
  test("扫描端点 URL 保留 :market 占位符，且挂了 @Expanded", () => {
    const store = getGoalMetadata(ScannerScanGoal);
    const ep = store!.endpoints.get("fetchScan");
    assert.equal(ep!.url, "/:market/scan", "market 必须是动态路径段");
    assert.ok(
      ep!.expanded,
      "必须挂 @Expanded —— 非分页端点的 resolveUrl 不做路径参数替换",
    );
  });
});

describe("覆盖面不得被本地白名单阉割", () => {
  /**
   * 回归守护：曾经把扫描域写成 4 元素白名单并在 normalizeParams 里拦截，
   * 结果 crypto（5.8 万标的）/ futures（5.3 万）/ forex / america / japan
   * 等全部被拒。本站是全球全资产平台，域是开放集合。
   */
  test("已验证的扫描域覆盖主要国别与资产类别", () => {
    for (const m of [
      "global", "america", "china", "japan", "hongkong", "uk", "germany",
      "crypto", "coin", "forex", "futures", "cfd", "bonds", "bond",
    ]) {
      assert.ok(
        (SCAN_MARKET_NAMES as readonly string[]).includes(m),
        `扫描域清单缺少 ${m} —— 该域实测可用，漏了会导致 Agent 不知道能查`,
      );
    }
  });

  test("已验证的 searchType 覆盖加密/期货/外汇/宏观等类别", () => {
    for (const t of ["stock", "futures", "forex", "crypto", "index", "economic", "bond", "cfd"]) {
      assert.ok(
        (SEARCH_TYPE_NAMES as readonly string[]).includes(t),
        `searchType 清单缺少 ${t} —— 该取值实测可用`,
      );
    }
  });
});

describe("翻页页数必须精确等于入参 —— 曾经的 20 倍超发", () => {
  /**
   * 回归守护：旧版用 `@Paginated({maxPages: 20})` + aggregate 裁剪，
   * 实测 maxPages=1 时上游被打了 20 次请求，而输出的 pagesFetched 因裁剪仍显示 1
   * —— 从结果完全看不出超发。现改用 @Expanded + buildStartOffsets 由入参算页号。
   */
  test("buildStartOffsets 严格按 maxPages 产出偏移量", () => {
    const base = {
      text: "x", searchType: null, exchange: null, lang: "zh",
      sortByCountry: "CN", grouping: false,
    };
    assert.deepEqual(buildStartOffsets({ ...base, start: 0, maxPages: 1 }), [0]);
    assert.deepEqual(buildStartOffsets({ ...base, start: 0, maxPages: 3 }), [0, 50, 100]);
    assert.deepEqual(buildStartOffsets({ ...base, start: 150, maxPages: 2 }), [150, 200]);
  });

  test("maxPages 非法值兜底为 1 页，不会退化成 0 页或无限页", () => {
    const base = {
      text: "x", searchType: null, exchange: null, lang: "zh",
      sortByCountry: "CN", grouping: false, start: 0,
    };
    for (const bad of [0, -5, NaN, undefined]) {
      assert.equal(
        buildStartOffsets({ ...base, maxPages: bad as number }).length,
        1,
        `maxPages=${String(bad)} 应兜底为 1 页`,
      );
    }
  });
});
