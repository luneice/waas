/**
 * ID 命名空间登记表 —— 陷阱拦截的单元测试
 *
 * 重点守护「静默空集」这一类最难排查的错误：某些数据源前缀在截面扫描索引里
 * 根本不存在，上游既不报错也不提示，Agent 只会看到空集然后误判「没有数据」。
 */
import { test, describe } from "vitest";
import assert from "node:assert/strict";
import { SpiderError } from "@spider/core";
import {
  ID_NAMESPACES,
  ID_NAMESPACE_INFO,
  classifyTicker,
  partitionScannerTickers,
  assertTickerShape,
  nsTag,
  producerMeta,
} from "@src/projections/id-namespace";

const SCOPE = "test";

describe("classifyTicker", () => {
  test("按交易所前缀归类到对应子命名空间", () => {
    assert.equal(classifyTicker("FRED:SOFR").namespace, ID_NAMESPACES.TICKER_FRED);
    assert.equal(
      classifyTicker("ECONOMICS:USINTR").namespace,
      ID_NAMESPACES.TICKER_ECONOMICS,
    );
    assert.equal(classifyTicker("NASDAQ:AAPL").namespace, ID_NAMESPACES.TICKER);
  });

  test("拆出 exchange / code 两段，exchange 统一大写", () => {
    const c = classifyTicker("fred:SOFR");
    assert.equal(c.exchange, "FRED");
    assert.equal(c.code, "SOFR");
    assert.equal(c.ticker, "fred:SOFR", "原值必须原样透传，不做归一化改写");
  });

  test("代码段含点和感叹号（BRK.A / CL1!）不被破坏", () => {
    assert.equal(classifyTicker("NYSE:BRK.A").code, "BRK.A");
    assert.equal(classifyTicker("NYMEX:CL1!").code, "CL1!");
  });
});

describe("partitionScannerTickers —— 扫描索引盲区拦截", () => {
  test("全部命中盲区 → 抛 invalid-params 并给出改用建议", () => {
    let caught: SpiderError | null = null;
    try {
      partitionScannerTickers(["FRED:SOFR", "FRED:EFFR"], SCOPE);
    } catch (err) {
      caught = err as SpiderError;
    }
    assert.ok(caught instanceof SpiderError, "应抛 SpiderError 而非裸 Error");
    assert.equal(caught?.kind, "invalid-params");
    assert.equal(caught?.scope, SCOPE);
    assert.match(
      caught?.message ?? "",
      /tv-history|tv-quote/,
      "错误信息必须给出可执行的替代路径，不能只说失败",
    );
  });

  test("部分命中盲区 → 丢弃它们但保住其余标的", () => {
    const r = partitionScannerTickers(
      ["ECONOMICS:USINTR", "FRED:SOFR", "ECONOMICS:CNINTR"],
      SCOPE,
    );
    assert.deepEqual(r.accepted, ["ECONOMICS:USINTR", "ECONOMICS:CNINTR"]);
    assert.deepEqual(r.dropped, ["FRED:SOFR"]);
  });

  test("无盲区标的 → 全部放行，dropped 为空", () => {
    const r = partitionScannerTickers(["NASDAQ:AAPL", "ECONOMICS:USINTR"], SCOPE);
    assert.equal(r.dropped.length, 0);
    assert.equal(r.accepted.length, 2);
  });

  test("空输入不抛错（无标的 ≠ 全是盲区标的）", () => {
    const r = partitionScannerTickers([], SCOPE);
    assert.deepEqual(r.accepted, []);
    assert.deepEqual(r.dropped, []);
  });
});

describe("assertTickerShape —— 反注入与形状校验", () => {
  test("合法 ticker 放行（含短代码、点号、感叹号）", () => {
    for (const t of ["SP:SPX", "NASDAQ:AAPL", "NYSE:BRK.A", "NYMEX:CL1!", "TVC:US10Y"]) {
      assert.doesNotThrow(() => assertTickerShape(t, SCOPE), `${t} 应被判为合法`);
    }
  });

  test("缺交易所前缀 → 抛错并引导先跑 tv-search", () => {
    let caught: SpiderError | null = null;
    try {
      assertTickerShape("AAPL", SCOPE);
    } catch (err) {
      caught = err as SpiderError;
    }
    assert.equal(caught?.kind, "invalid-params");
    assert.match(caught?.message ?? "", /tv-search/);
  });

  test("注入类输入被拦截", () => {
    for (const bad of ['NASDAQ:AAPL"}', "NASDAQ:AAPL AND 1=1", "../../etc/passwd", ""]) {
      assert.throws(() => assertTickerShape(bad, SCOPE), SpiderError, `${bad} 应被拦截`);
    }
  });
});

describe("登记表自身的完整性", () => {
  test("每个命名空间都有 info 条目", () => {
    for (const ns of Object.values(ID_NAMESPACES)) {
      assert.ok(ID_NAMESPACE_INFO[ns], `${ns} 缺少 ID_NAMESPACE_INFO 条目`);
      assert.ok(ID_NAMESPACE_INFO[ns].label.length > 0);
      assert.ok(ID_NAMESPACE_INFO[ns].producedBy.length > 0);
    }
  });

  test("易混的三组命名空间都写了 warning", () => {
    for (const ns of [
      ID_NAMESPACES.TICKER_FRED,
      ID_NAMESPACES.EXCHANGE,
      ID_NAMESPACES.SCAN_MARKET,
      ID_NAMESPACES.SCAN_COLUMN,
      ID_NAMESPACES.QUOTE_FIELD,
    ]) {
      assert.ok(ID_NAMESPACE_INFO[ns].warning, `${ns} 必须写明易混警告`);
    }
  });

  test("nsTag / producerMeta 输出形状", () => {
    assert.equal(nsTag(ID_NAMESPACES.TICKER), "[ns:tv-ticker]");
    const m = producerMeta(ID_NAMESPACES.TICKER_FRED);
    assert.equal(m.idNamespace, ID_NAMESPACES.TICKER_FRED);
    assert.ok(Array.isArray(m.idConsumers) && m.idConsumers.length > 0);
    assert.ok(m.idWarning, "有 warning 的命名空间必须透出 idWarning");
  });
});
