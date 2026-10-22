---
name: tradingview-spider
description: 全球市场行情采集技能集，覆盖任意国家/任意资产类别的标的：各国股票（美/中/日/港/英/德/印/韩/加/澳/法/巴西等）、加密货币（现货/合约/稳定币）、期货、外汇、债券与国债收益率、各国央行利率与宏观指标（CPI/逆回购/SOFR 等）、指数、基金、大宗商品、差价合约。提供 6 个 Skill：①「找标的」按关键词检索并产出 ticker（tv-search）；②「批量截面」一次取多标的的当前值或按条件筛选（tv-scan）；③「实时快照」取最新价与涨跌（tv-quote）；④「历史序列」取 K 线，支持指定分辨率与时间范围、自动翻页（tv-history）；⑤「找指标」列出可用技术指标并产出 pineId（tv-indicator-list）；⑥「指标数值」取 MA/RSI/MACD/布林带等技术指标的计算序列，支持自定义参数（tv-indicator）。当用户问"美股/A股/港股某标的现在多少钱""比特币价格""各国央行利率对比""某指标的历史走势""筛选符合条件的标的""某股票的 RSI/MACD 是多少""有哪些技术指标可用"等场景时使用。
argument-hint: <skill-id> '<params-json>'
allowed-tools: Bash(node *)
---

# tradingview-spider — 路由入口

> 本文件是**入口与路由层**——回答"该调哪个 Skill / 怎么传参 / 怎么读结果"。
>
> **始终生效的约束**抽离到 `claude/rules/tradingview-*.md`（运行环境、调用协议、输出契约），由 Claude Code 自动加载，**本文件不重复**。
>
> 复杂细节（完整参数、字段语义、命名空间陷阱、决策树）按需加载 `references/`。

---

## 0. 决策三步法

1. **我有 ID 了吗？** 标的入参是 `EXCHANGE:CODE`（如 `NASDAQ:AAPL`），**必须来自 `tv-search` 的 `items[].ticker`**；指标入参是 `pineId`（如 `STD;RSI`），**必须来自 `tv-indicator-list` 的 `items[].pineId`**。两者都不要自行拼写。
2. **要当前值、历史序列还是指标？** 当前值 → tv-quote / tv-scan；历史 K 线 → tv-history；指标计算值（RSI/MACD…）→ tv-indicator。
3. **是否落入命名空间陷阱？** 最常见的是宏观标的分流与「显示名 vs pineId」混淆，见 §2。

---

## 1. 意图路由（6 个 Skill）

### A 组 · 发现（先用它拿 ID）

| Skill | 用途 | 必填 | 产出 |
|---|---|---|---|
| `tv-search` | 按关键词检索全球任意标的 | `text` | `ticker`（下游标的入参） |
| `tv-indicator-list` | 列出可用技术指标 | 无 | `pineId`（tv-indicator 入参） |

查宏观指标（利率/CPI/逆回购）传 `searchType=economic` 更精准。留空则不限类别，能搜到全部资产。

```bash
node ${CLAUDE_SKILL_DIR}/scripts/index.js tv-search '{"text":"interest rate","searchType":"economic"}'
node ${CLAUDE_SKILL_DIR}/scripts/index.js tv-search '{"text":"BTCUSDT"}'
node ${CLAUDE_SKILL_DIR}/scripts/index.js tv-indicator-list '{"keyword":"RSI"}'
```

### B 组 · 取数（需要 ID）

| Skill | 用途 | 必填 | 特点 |
|---|---|---|---|
| `tv-scan` | 一次取多标的当前值 / 按条件筛选 | 无 | HTTP 截面查询，字段面宽，可加 filter 筛选；**但索引覆盖面受限** |
| `tv-quote` | 多标的实时快照（最新价/涨跌/买卖盘） | `symbols` | 走行情推送，覆盖面全 |
| `tv-history` | 历史 K 线序列 | `symbols` | 支持分辨率+时间范围，自动翻页；可指定复权口径 |
| `tv-indicator` | 技术指标数值序列（MA/RSI/MACD…） | `symbols`+`pineId` | 先编译再挂载；**需登录态** |

```bash
# 多国利率横向对比（一次请求）
node ${CLAUDE_SKILL_DIR}/scripts/index.js tv-scan '{"tickers":["ECONOMICS:USINTR","ECONOMICS:CNINTR","ECONOMICS:JPINTR"]}'

# 按扫描域筛选（crypto 域 5.8 万标的）
node ${CLAUDE_SKILL_DIR}/scripts/index.js tv-scan '{"market":"crypto","columns":["name","close","change"],"sortBy":"close","range":[0,20]}'

# 跨资产实时快照
node ${CLAUDE_SKILL_DIR}/scripts/index.js tv-quote '{"symbols":["NASDAQ:AAPL","BINANCE:BTCUSDT","FRED:SOFR"]}'

# 长历史序列（自动翻页到 2014 年）
node ${CLAUDE_SKILL_DIR}/scripts/index.js tv-history '{"symbols":["FRED:RRPONTSYAWARD"],"resolution":"1D","from":"2014-01-01"}'

# 含分红的总回报口径（默认口径不含分红，算长期收益必须显式指定）
node ${CLAUDE_SKILL_DIR}/scripts/index.js tv-history '{"symbols":["SSE:601398"],"resolution":"1M","from":"2007-01-01","adjustment":"dividends"}'

# 技术指标（pineId 来自 tv-indicator-list）
node ${CLAUDE_SKILL_DIR}/scripts/index.js tv-indicator '{"symbols":["NASDAQ:AAPL"],"pineId":"STD;RSI"}'
node ${CLAUDE_SKILL_DIR}/scripts/index.js tv-indicator '{"symbols":["NASDAQ:AAPL"],"pineId":"STD;RSI","inputs":{"in_0":21}}'
```

---

## 2. 同名歧义速判 ⚠️

### 2.1 宏观标的的两套数据源（最常踩）

`tv-search(searchType=economic)` 会同时返回两种前缀，**可用链路不同**：

| 前缀 | 含义 | tv-search | tv-quote | tv-history | tv-scan |
|---|---|---|---|---|---|
| `ECONOMICS:` | 全球央行口径（各国利率/CPI…） | ✅ | ✅ | ✅ | ✅ |
| `FRED:` | 美联储口径（SOFR/逆回购/EFFR…） | ✅ | ✅ | ✅ | ❌ **返回空集** |

**判定**：多国横向对比优先用 `ECONOMICS:`（一次 tv-scan 搞定）；美联储细分工具只有 `FRED:` 有，必须走 tv-quote / tv-history。
传 `FRED:` 给 tv-scan 会被自动剔除并在 insights 中告知（全是 FRED 时直接报错并引导）。

### 2.2 指标标识 vs 显示名（指标链路最常踩）

`pineId` 是上游内部标识，**与界面上看到的指标名不同**，必须先查再传：

| ❌ 传显示名 | ✅ 传 pineId | 说明 |
|---|---|---|
| `"RSI"` | `STD;RSI` | 缺命名空间前缀 |
| `"Aroon Oscillator"` | `STD;Aroon_Oscillator` | 空格要转义 |
| `"RSI 背离"` | `STD;Divergence%1Indicator` | **显示名与标识完全不同** |

`%1` = 空格、`%25` = 百分号（上游转义）。传显示名会被拦截并提示改用 tv-indicator-list。

### 2.3 指标的免费/付费边界

`tv-indicator-list` 的每条都带 `access`：

| access | 含义 | 建议 |
|---|---|---|
| `free` | 免费可直接用（常规指标 142/145、K 线形态 45/45） | **优先选它** |
| `restricted` | 需付费权限（常规指标 3 条 + 基本面全部 1442 条） | 能否取到数据**未经验证**，不建议依赖 |

想按权限筛：`tv-indicator-list '{"keyword":"RSI","access":"free"}'`。
**基本面分组（`fundamental`）实测全部付费**，要财务数值请改用 tv-scan 的财务类 columns。

### 2.4 三组易混参数

| 参数 | 取值样例 | 属于 | 勿混 |
|---|---|---|---|
| `exchange`（tv-search） | `NASDAQ` / `TVC` / `FRED` | 交易所/数据源前缀 | 不是扫描域 |
| `market`（tv-scan） | `global` / `china` / `crypto` | 扫描域路径段 | 不是交易所代码 |
| `columns`（tv-scan）vs `fields`（tv-quote） | `close` / `lp` | 两套字段命名空间 | 多数同名但未逐一验证，勿互投 |
| `categories`（tv-indicator-list） | `standard` / `candlestick` | 指标目录分组 | 不是扫描域、不是资产类别 |
| `pineId`（tv-indicator） | `STD;RSI` | 指标标识（**分号**分隔） | 不是 ticker（那是**冒号**分隔） |

---

## 3. 多步组合范式

**「某宏观指标的长期走势」**
```
tv-search(searchType=economic) → 挑 ticker → tv-history(from=起始年份)
```

**「多国指标横向对比」**
```
tv-search(searchType=economic) → 筛出 ECONOMICS: 前缀 → tv-scan(tickers=[...])
```

**「筛选符合条件的标的」**
```
tv-scan(market=<域>, filter=[...], sortBy=..., range=[0,N])   # 不需要先 search
```

**「看某标的的技术指标」**（两个入口都要走）
```
tv-search(text=标的名)          → 拿 ticker
tv-indicator-list(keyword=指标名) → 拿 pineId（注意选 access=free）
                                 → tv-indicator(symbols=[ticker], pineId=...)
```

**「调指标参数」**（先跑默认再按编号覆盖）
```
tv-indicator(symbols, pineId)                    # 看返回的 items[].inputs 弄清每个参数含义
tv-indicator(symbols, pineId, inputs={in_0:21})  # 再按 in_N 编号覆盖
```

---

## 4. 读结果

优先读 `data.meta` + `data.insights`（中文要点，已含分流提示与告警），明细在 `data.items[]`。

```bash
jq '.data.insights[]'                              result.json
jq '.data.items[] | {ticker, price, changePercent}' result.json   # tv-quote
jq '.data.items[] | {ticker, barCount, range}'      result.json   # tv-history
jq '.data.items[] | {pineId, name, access}'         result.json   # tv-indicator-list
jq '.data.items[] | {ticker, plots, latest}'        result.json   # tv-indicator
```

**四个必读的语义约定**（详见 `references/conventions.md`）：
- `volume: null` = 该类标的**无成交量概念**（利率/收益率），与真实为 `0` 不同
- `changePercent` 保留上游原值（`2.5` 即 2.5%），**未除以 100**
- `dataCompleted: true` = 已取到该序列**最早可用数据**（数据边界），**不是采集失败**
- tv-indicator 的 `points[].v` 是**位置数组**，按 `items[].plots` 顺序解码；其中 `null` = 该根 K 线上该通道无值（如均线在序列头部尚未形成），**不是数据缺失**

**tv-history 的价格必须带复权口径回写**：默认 `splits` 仅按拆股/送转复权、**不含现金分红**（与 A 股行情软件的「前复权」不同），算总回报要传 `adjustment:"dividends"`。生效口径见 `items[].adjustment`，`ignored: true` 表示该标的无复权概念、价格为原始值。详见 `references/timeseries.md`。

---

## 5. 文档导航

| 文件 | 内容 |
|---|---|
| [conventions.md](references/conventions.md) | 权威约定：ticker 格式、命名空间全表、空值语义、错误处置 |
| [discovery.md](references/discovery.md) | tv-search / tv-scan 完整参数与实测取值 |
| [timeseries.md](references/timeseries.md) | tv-quote / tv-history 完整参数、翻页机制、超时调参 |
| [indicators.md](references/indicators.md) | tv-indicator-list / tv-indicator 完整参数、两段式原理、plots 解码、付费边界 |
