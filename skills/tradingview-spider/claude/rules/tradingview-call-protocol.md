# tradingview-spider · 调用协议（始终生效 · 差异部分）

> 通用调用形式、一次一条命令、jq 提取、错误码表见 `rules/spider-core.md` /
> `rules/spider-runtime.md`（随包安装）。本文件只写本包特有约束。

## 1. ticker 严禁猜测

所有标的入参都是 `EXCHANGE:CODE`，**必须来自 `tv-search` 的 `items[].ticker`**。

| ❌ | ✅ |
|---|---|
| `AAPL` | `NASDAQ:AAPL` |
| `比特币` | `BINANCE:BTCUSDT` |
| `美国利率` | `ECONOMICS:USINTR` |

没有 ticker 就先跑 tv-search，不要凭印象拼写交易所前缀（同一标的在不同交易所的代码可能不同）。

## 1.1 pineId 同样严禁猜测

技术指标入参 `pineId` **必须来自 `tv-indicator-list` 的 `items[].pineId`**。
它是上游内部标识，**与界面显示名不同**：

| ❌ 显示名 | ✅ pineId |
|---|---|
| `RSI` | `STD;RSI` |
| `Aroon Oscillator` | `STD;Aroon_Oscillator` |
| `RSI 背离` | `STD;Divergence%1Indicator` |

`%1`=空格、`%25`=百分号（上游转义，原样传）。
注意 pineId 用**分号**分隔、ticker 用**冒号**分隔，两者不可混投。

## 2. 入口选择

| 用户意图 | 第一选择 | 备选 |
|---|---|---|
| 找标的 / 不知道代码 | `tv-search` | — |
| 多标的当前值横向对比 | `tv-scan`（一次请求） | `tv-quote`（覆盖面更全） |
| 按条件筛选标的 | `tv-scan` + `filter` | — |
| 单/多标的实时行情 | `tv-quote` | — |
| 历史走势 / 时间序列 | `tv-history` | — |
| **长期收益 / 总回报 / 年化** | `tv-history` + `adjustment:"dividends"` | 见 §2.1 |
| 有哪些技术指标可用 | `tv-indicator-list` | — |
| 某标的的 RSI/MACD 等指标值 | `tv-indicator`（需先拿 pineId） | — |

## 2.1 算收益必须先定复权口径

`tv-history` 默认口径是上游的 `splits`：**仅按拆股/送转/配股复权，不含现金分红**。
**这与 A 股行情软件说的「前复权」不是一回事**（后者通常含分红）。

| 用户问的是 | 必须传 |
|---|---|
| 长期收益 / 总回报 / 年化 / 持有到现在赚多少 | `adjustment:"dividends"` |
| 价格涨跌幅 / 技术分析 / K 线形态 | 默认 `splits` 即可 |
| 当年真实成交价是多少 | `adjustment:"none"` |

实测工商银行 2007 年至今：`splits` +143%，`dividends` +514%。
**拿默认口径的涨幅当总回报报给用户是错的**，会系统性低估（差额即股息再投）。

指数 / 汇率 / 利率类标的无复权概念，传了会被忽略并在 `items[].adjustment.ignored`
标出——此时不要按请求口径解释价格。

## 2.2 指标链路要走两个入口

tv-indicator 同时需要 `ticker` 与 `pineId`，两个入口都要先跑：

```
tv-search(标的名)        → items[].ticker
tv-indicator-list(指标名) → items[].pineId（优先挑 access=free）
                         → tv-indicator(symbols=[ticker], pineId=...)
```

**指标需要登录态**（本包唯一）：未登录返回 `not-logged-in`，
需在调试浏览器内登录站点。行情与 K 线不受影响（游客态即可）。

指标**不支持翻页**，要更长序列请调大 `bars`（父 K 线根数），
且长周期指标（如 200 日均线）需 `bars` 给到周期的 2–3 倍才有值。

## 3. 宏观标的必须分流

`FRED:` 前缀**不在 tv-scan 索引内**（返回空集），只能走 tv-quote / tv-history。
`ECONOMICS:` 三条链路都可用，多国对比优先用它。

传 `FRED:` 给 tv-scan 时本包会自动剔除并告警；全部是 FRED 时直接报错并引导改用其它 Skill。

## 4. 并发纪律（覆盖通用 ≤5 路建议）

- **不要并行跑多个行情类 Skill**（tv-quote / tv-history / tv-indicator 各建长连接，并发会加剧风控风险）
- 多标的用**单次调用的 `symbols` 数组**，不要并发多次单标的调用
- HTTP 类（tv-search / tv-scan / tv-indicator-list）可适度并发，但建议 ≤3 路

## 5. 分页续取

`tv-search` 的续取靠 `meta.nextStart`：

```bash
# 首次
tv-search '{"text":"interest rate","searchType":"economic","maxPages":3}'
# 续取（用上次返回的 nextStart）
tv-search '{"text":"interest rate","searchType":"economic","start":150,"maxPages":3}'
```

`meta.remaining` 是**剩余**匹配数（不是总数），为 0 表示已取完。
