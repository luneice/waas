# tradingview-spider · 输出契约（差异部分）

> 顶层信封、AI-Ready 信封消费规则、jq 标准提取、回写约束见
> `rules/spider-runtime.md §4-§6`（随包安装）。本文件只写本包特有形态。

## 1. 统一为列表型信封

六个 Skill 的 `.data` 都是 `{ meta, insights, items[] }`，`jq '.data.items[]'` 全包一致。

```bash
jq '.data.insights[]'                                result.json   # 中文要点，优先读
jq '.data.items[] | {ticker, namespace}'             result.json   # tv-search
jq '.data.items[] | {ticker, values}'                result.json   # tv-scan
jq '.data.items[] | {ticker, price, changePercent}'  result.json   # tv-quote
jq '.data.items[] | {ticker, barCount, dataCompleted, stats}' result.json   # tv-history
jq '.data.items[] | {pineId, name, access}'          result.json   # tv-indicator-list
jq '.data.items[] | {ticker, plots, latest}'         result.json   # tv-indicator
jq '.data.meta.columns'                              result.json   # tv-scan 的解码键
```

## 2. 回写时必须遵守的语义

| 字段 | 语义 | 回写要求 |
|---|---|---|
| `volume: null` | 该类标的无成交量概念 | **不要写成"成交量为 0"** |
| `changePercent: 2.5` | 2.5%（原值） | 不要再除以 100 |
| `dataCompleted: true` | 已到数据边界 | 说「该序列最早数据到此为止」，**不要说"采集失败"或"数据缺失"** |
| `truncatedByMaxRounds: true` | 被上限截断 | **必须告知用户未覆盖完整区间**，并给出调参建议 |
| `updateMode !== "streaming"` | 延迟行情/已收盘 | 标注「非实时价」 |
| `points[].v` 里的 `null` | 该根 K 线上该通道无值（如均线头部未形成） | **不要说"数据缺失"**；说「该区间尚未形成有效值」 |
| `access: "restricted"` | 指标需付费权限 | 说明需付费，**不要断言"一定取不到"**（未验证） |
| `historyMayRepaint: true` | 指标历史值可能被上游重算 | 做回测/复现类结论时必须提示该风险 |
| `adjustment.effective` | 该序列的**生效**复权口径 | tv-history 报价格/涨跌幅时**必须带口径**，见 §2.1 |
| `adjustment.ignored: true` | 请求的口径未被采纳 | 说明「该标的无复权概念，价格为原始值」，**不要按请求口径解释** |

`meta.semantics` 给出了这组数字的口径，回写时**只用这个口径，不自造词**。

### 2.1 tv-history 的复权口径（价格类回写的前提）

价格字段的含义完全取决于复权口径，同一标的不同口径可差一个数量级。

| 取值 | 含义 |
|---|---|
| `splits`（默认） | 前复权，仅按拆股/送转/配股调整，**不含现金分红** |
| `dividends` | 前复权，含现金分红（总回报口径） |
| `none` | 不复权，历史价位为当时真实盘面 |

- **默认的 `splits` 与 A 股行情软件说的「前复权」不是一回事**（后者通常含分红）。
- 用户问**长期收益 / 总回报 / 年化**时，必须传 `adjustment:"dividends"`；用默认口径会系统性低估。
  实测工商银行 2007 年至今：`splits` +143%，`dividends` +514%，差的就是股息再投。
- 用户要**核对当年真实成交价**时传 `none`。
- 以 `items[].adjustment.effective` 为准，不是请求值；为 `null` 表示上游未回显，此时按请求口径说明并注明未确认。

## 3. 两类位置数组都需要解码键

| Skill | 位置数组 | 解码键 |
|---|---|---|
| tv-scan | `items[].values` 的底层 `d` | 请求侧 `columns`，已回显在 `meta.columns` |
| tv-indicator | `items[].points[].v` | `items[].plots`（同项内） |

本包已按解码键还原/回显，**核对字段对应关系时看这两个字段，不要猜测**。

tv-indicator 的 `plots[].type` 决定该位置能不能当业务数值用：
`line`/`shapes` 可以；`colorer`（调色板索引）与 `alertcondition`（提醒规则）**不是数值**，
回写时不要把它们当指标值报给用户。要末值直接读 `items[].latest`（已算好并跳过尾部 null）。

## 4. 不要这样输出

- 不要把 `volume: null` 说成成交量为零
- 不要把数据边界（`dataCompleted`）说成采集失败
- 不要在 `truncatedByMaxRounds: true` 时声称拿到了完整区间
- 不要把延迟行情当实时价报给用户
- **不要在不说明复权口径的情况下报 tv-history 的价格或涨跌幅**
- **不要拿默认口径（不含分红）的涨幅当总回报/年化收益**
- 不要暴露 `meta.transport` 里的诊断细节给最终用户（那是排查用的）
- 不要把指标的 `null` 说成数据缺失（那是该根 K 线上该通道无值）
- 不要把 `colorer` 通道的调色板索引当成指标数值
- 不要把指标显示名与 `pineId` 混着说（回写时用显示名，传参时用 pineId）
