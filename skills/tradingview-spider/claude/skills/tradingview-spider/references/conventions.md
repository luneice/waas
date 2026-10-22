# tradingview-spider · 权威约定

> 本文件是字段语义、命名空间、错误处置的**单一事实源**。SKILL.md 只做路由，细节在这里。

## 1. ticker 格式

全局主键形如 `EXCHANGE:CODE`，**两段缺一不可**：

```
NASDAQ:AAPL        美股
SSE:000001         A股指数
HKEX:700           港股
TSE:8301           日股
BINANCE:BTCUSDT    加密现货
NYMEX:CL1!         期货连续合约（! 是合法字符）
NYSE:BRK.A         含点号（合法）
TVC:US10Y          美债收益率
ECONOMICS:USINTR   宏观指标（全球央行口径）
FRED:SOFR          宏观指标（美联储口径）
```

**只传 `AAPL` 会被拒绝**。ticker 一律来自 `tv-search` 的 `items[].ticker`，不要自行拼写或猜测。

## 2. ID 命名空间全表

| 命名空间 | 产出 | 可投喂给 | 警告 |
|---|---|---|---|
| `tv-ticker` | tv-search.items[].ticker | tv-quote.symbols / tv-history.symbols / tv-scan.tickers | 必须带交易所前缀 |
| `tv-ticker-fred` | 同上，exchange=FRED 的项 | tv-quote / tv-history | **不在 tv-scan 索引内，投过去返回空集** |
| `tv-ticker-economics` | 同上，exchange=ECONOMICS 的项 | 三条链路都可用 | 多国对比优先用它 |
| `tv-exchange` | tv-search.items[].exchange | tv-search.exchange | 不是 tv-scan 的 market |
| `tv-scan-market` | 常量枚举 | tv-scan.market | 不是交易所代码 |
| `tv-scan-column` | 上游字典（未穷举） | tv-scan.columns / filter[].left / sortBy | 与 tv-quote-field 是两套 |
| `tv-quote-field` | 上游字典（未穷举） | tv-quote.fields | 与 tv-scan-column 是两套 |
| `tv-study-pine-id` | tv-indicator-list.items[].pineId | tv-indicator.pineId | **分号**分隔（`STD;RSI`），与 ticker 的冒号分隔不同；**不是显示名** |
| `tv-study-category` | 常量枚举 | tv-indicator-list.categories | 不是 tv-scan 的 market、也不是资产类别 |

投影输出的 `items[].namespace` 直接标注了每个 ticker 属于哪个命名空间，`meta.idConsumers` 列出可投喂的槽位。

### 2.1 pineId 的转义与陷阱

`pineId` 是上游内部标识，形态 `<命名空间>;<指标名>`：

| 命名空间 | 含义 | 示例 |
|---|---|---|
| `STD` | 官方内建指标 | `STD;RSI` / `STD;Aroon_Oscillator` |
| `PUB` | 社区发布脚本（32 位十六进制） | `PUB;6daafb2cabe6419d98ae25229d2327f8`（未实测走通） |

**转义规则**：`%1` = 空格、`%25` = 百分号。**原样传，不要解转义**：

| 显示名 | pineId |
|---|---|
| `Bars Up Dn Strategy` | `STD;Bars%1Up%1Dn%1Strategy` |
| `24h%Volume` | `STD;24h%25Volume` |
| `RSI 背离` | `STD;Divergence%1Indicator` ← **与显示名毫无字面关系** |

最后一行是最容易犯的错：**显示名与 pineId 可以完全不同**，必须查表而不是推导。

## 3. 空值与单位语义 ⚠️

| 约定 | 说明 |
|---|---|
| `volume: null` | 该类标的**无成交量概念**（利率/收益率/宏观指标）。与真实成交量为 `0` **语义不同**，不可混同 |
| `changePercent: 2.5` | 即 **2.5%**，保留上游原值，**未除以 100** |
| `price: null` | 上游未提供该字段，非"价格为零" |
| bar 的 `t` | Unix **秒**级 UTC 时间戳；**可为负数**（1970 年之前，长历史序列确实存在） |
| `updateMode` | `streaming` = 实时推送；其它值（如 `delayed_streaming_600`）意味着**延迟行情或已收盘**，勿当实时价用 |
| 指标 `points[].v` 里的 `null` | 该根 K 线上**该通道无值**（如均线在序列头部尚未形成、背离只在特定根出条件）。上游用 `1e+100` 表示（约占 20%），本包已归一为 `null`。**不是数据缺失、不是采集失败** |
| `adjustment.effective: null` | 上游**未回显**生效复权口径（A 股个股实测如此），不代表未复权。此时按请求口径理解并注明未确认，**不要**拿它当"无复权"的证据 |
| `adjustment.ignored: true` | 请求的复权口径**未被采纳**（该标的 `allowed: "none"`，无复权概念），价格为原始值 |

## 3.1 复权口径 ⚠️ 价格类回写的前提

`tv-history` 的 `o/h/l/c` 与 `stats` 全部是**复权后**价格，含义取决于 `adjustment`。
同一标的不同口径可差一个数量级，**报价格或涨跌幅时必须带口径**。

| 取值 | 含义 | 用于 |
|---|---|---|
| `splits`（默认） | 前复权，仅按拆股/送转/配股调整，**不含现金分红** | 价格涨跌幅、技术分析 |
| `dividends` | 前复权，含现金分红（总回报口径） | 长期收益、年化、跨资产收益对比 |
| `none` | 不复权，历史价位为当时真实盘面 | 核对当年成交价 |

⚠️ **默认的 `splits` 与 A 股行情软件说的「前复权」不是一回事**（后者通常含分红）。
这个默认值来自上游前端常量 `DEFAULT_ADJUSTMENT`，不是本包选的。

实测 `SSE:601398` 工商银行 `1M` `from=2007-01-01`：`splits` +142.99%，
`dividends` +514.34% —— 差的 371 个百分点就是股息再投。
**用默认口径当总回报报给用户是错的。**

指数 / 汇率 / 利率类标的没有复权概念（`allowed: "none"`），传任何口径都被忽略，
此时 `ignored: true`，insights 会显式告警。

**取值不做白名单拦截** —— 上游是开放集合，只校验形状。

## 4. 历史序列的三种「结束」

拿到 `tv-history` 结果时，必须区分：

| 字段组合 | 含义 | 该怎么说 |
|---|---|---|
| `dataCompleted: true` | 已取到该序列**最早可用数据** | 「数据边界」，**不是采集失败**。如隔夜逆回购工具 2013 年才创设，翻到 2013-09 就到底了 |
| `truncatedByMaxRounds: true` | 因翻页轮数上限提前停止 | **未覆盖到请求的 from**，需调大 `maxRounds` 或 `pageBars` 重试 |
| 两者皆 false | 正常覆盖到请求区间 | 数据完整 |

insights 里已针对这三种情况给出中文说明，直接引用即可。

## 5. 实测可用取值

**扫描域**（`tv-scan.market`，实测各域标的量）：

| 域 | 标的量 | 域 | 标的量 |
|---|---|---|---|
| global | 45.9 万 | crypto | 5.8 万 |
| bond | 17.9 万 | futures | 5.3 万 |
| germany | 3.6 万 | america | 2 万 |
| uk | 9354 | canada | 8521 |
| india | 8361 | china | 7374 |
| forex | 6271 | japan | 4398 |
| korea | 4298 | france | 3750 |
| hongkong | 3013 | coin | 2894 |
| brazil | 2324 | australia | 2215 |
| bonds | 1163 | cfd | 650 |

**取值不做白名单拦截** —— 上游是开放集合，可能有未列出的域；传错由上游返回 HTTP 400。

**searchType**（`tv-search.searchType`）：`stock` / `futures` / `forex` / `crypto` / `index` / `economic` / `bond` / `cfd`。
留空 = 不限类别，能搜到全部资产（含期权等）。
⚠️ 注意 `searchType`（入参）与结果里的 `type`（资产类别）是**两套值域**：`option` / `spot` / `commodity` 作为 searchType 会被上游拒绝，但这些资产本身留空即可搜到（如 BTCUSDT 的 `type` 是 `spot`）。

**K 线周期**（`tv-history.resolution` / `tv-indicator.resolution`）：实测可用 `1D` / `1W` / `1M`。分钟线按上游惯例传纯数字（`1` / `60` / `240`），未逐一实测。

**复权口径**（`tv-history.adjustment`）：实测可用 `splits`（默认）/ `dividends` / `none`，语义见 §3.1。同样**不做白名单拦截**。

**指标目录分组**（`tv-indicator-list.categories`）：`standard`（145 条，142 免费）/ `candlestick`（45 条全免费）/ `fundamental`（1442 条**全付费**）/ `saved`（自建脚本，需登录态）。同样**不做白名单拦截**。

## 6. 错误处置

沿用框架统一错误码（见 `rules/spider-runtime.md`），本包特有的处置：

| kind | 触发 | 处置 |
|---|---|---|
| `invalid-params` | ticker/pineId 形状非法 / 全部标的属扫描盲区 / inputs 键名非 in_N | 按错误信息里的引导改用其它 Skill 或先跑对应的发现类 Skill |
| `missing-context` | pineId 缺失 | 先跑 tv-indicator-list 拿 pineId |
| `not-logged-in` | **tv-indicator 专有**：会话未登录 | 在 `127.0.0.1:4444` 浏览器内登录站点后重试；**不要代登录** |
| `no-results` | 未取到任何标的的数据 | 用 tv-search 确认 ticker 是否存在 |
| `upstream-shape-changed` | 上游响应结构变化 / 标的解析失败 / 指标编译无产物 / 指标计算被拒 | 确认 ticker、resolution、pineId 是否受支持（指标另需确认 access）；持续出现则报告维护者 |
| `endpoint-timeout` | 行情通道建连或取数超时 | 可重试；持续失败检查 Chrome 会话与网络 |
| `retry-exhausted` | 重试耗尽 | 看 `details.lastKind` 判断根因 |

## 7. 数据频率与阶梯值

`items[].symbolMeta.dataFrequency` 标注该指标的**原始发布频率**。请求比它更细的周期（如对月度发布的指标请求 `1D`）会得到**阶梯状重复值**，这是正常的，不是数据错误。insights 会在这种情况下给出提示。

## 8. 技术指标特有约定

| 约定 | 说明 |
|---|---|
| `points[].v` 是位置数组 | 按同项的 `items[].plots` 顺序解码，**不是**键值对象。丢了 plots 就无法判读 |
| `plots[].type` | `line`/`shapes` 是业务数值；`colorer` 是调色板索引、`alertcondition` 仅供提醒规则，**都不是指标值** |
| `items[].latest` | 各数值型通道的**末值**（已跳过尾部 null），要「当前 RSI 是多少」直接读它 |
| `inputs[].id` | `in_0` / `in_1` …，编号对应上游参数**位置**；覆盖参数时键名必须用它 |
| `historyMayRepaint: true` | 历史值可能随数据增补被上游重算，回测/复现类结论必须提示 |
| 指标不支持翻页 | 要更长序列调大 `bars`（父 K 线根数）；长周期指标需 `bars` 给到周期的 2–3 倍 |
| `access` | `free` 可直接用；`restricted` 需付费权限，**能否取到数据未验证** |

