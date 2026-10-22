# cookbook —— 基本面分析配方

> **何时读**：做完整分析、需要多 Skill 组合时。
> 字段细节见 `financials.md` / `equity.md`，口径见 `conventions.md`。
>
> 以下命令省略了 `node ${CLAUDE_SKILL_DIR}/scripts/index.js` 前缀。
> **遵守一次一条命令**（`rules/spider-core.md`）：取数与 jq 提取分两步。

---

## 配方 1 · 盈利质量排雷（最高优先级）

**判断利润是不是"纸面富贵"** —— 这是财务排雷最核心的一步。

```bash
xueqiu-income   '{"symbol":"SH601127","type":"Q4","maxPages":2}'
xueqiu-cashflow '{"symbol":"SH601127","type":"Q4","maxPages":2}'
```

按报告期对齐后计算 **经营现金流 ÷ 净利润**：

| 比值 | 判读 |
|---|---|
| 持续 > 1 | 利润有现金支撑，质量好 |
| 长期 < 1 | 应收账款堆积、利润虚增风险 |
| 为负 | 经营失血，需结合季节性判断 |

**实测示例**（赛力斯年报）：

```
2025年报  净利润 61.47 亿  经营现金流 289.14 亿  比值 4.70
2024年报  净利润 47.40 亿  经营现金流 225.15 亿  比值 4.75
2023年报  净利润 −41.57 亿 经营现金流  63.98 亿  比值 −1.54
```

> ⚠️ 用**年报**（`type=Q4`）做这个判断。一季度常因备货/回款周期为负，
> 单看会误判 —— 实测 2026Q1 比值 −34.31，但全年是 +4.70。

---

## 配方 2 · 完整基本面速览

```bash
xueqiu-income    '{"symbol":"SH601127","type":"Q4","maxPages":2}'
xueqiu-balance   '{"symbol":"SH601127","type":"Q4","maxPages":2}'
xueqiu-cashflow  '{"symbol":"SH601127","type":"Q4","maxPages":2}'
xueqiu-indicator '{"symbol":"SH601127","type":"Q4","maxPages":2}'
```

`indicator` 已给出现成的 ROE / 毛利率 / 周转率，**省去自行计算**
（尤其是需要期初期末数据的平均口径指标）。

> ⚠️ 但 `indicator` 的比率**精度被截断到 4 位**
> （`assetLiabRatio` 65.9226 vs 报表可算出 0.659226148333026）。
> **精确计算以三张报表为准**，indicator 用于交叉校验。

典型输出（5 年年报）：

```
期次      营收(亿)  归母净利(亿)  毛利率   ROE     资产负债率  经营现金流/净利
2025年报   1650.5      59.6      29.1%   23.5%    70.9%        4.70
2024年报   1451.8      59.5      26.2%   45.4%    87.4%        4.75
2023年报    358.4     -24.5      10.4%  -22.4%    85.9%       -1.54
```

---

## 配方 3 · 股权结构尽调

```bash
xueqiu-top-holders   '{"symbol":"SZ300750","maxPeriods":4}'
xueqiu-holders-num   '{"symbol":"SZ300750","maxPages":2}'
xueqiu-insider-trades '{"symbol":"SZ300750","maxPages":2}'
```

**三个维度交叉看**：

| 数据 | 看什么 |
|---|---|
| `top-holders.totalHeldRatio` | 股权集中度。持续下降 = 大股东减持或稀释 |
| `holders-num` 户数 vs 户均持股 | 筹码分散还是集中（见 `equity.md` §3） |
| `insider-trades` 方向与规模 | 管理层信心 |

**互相印证的信号**：股权集中度下降 + 户数增加 + 高管减持 → 三者同向，
说明筹码确实在向散户转移。

> ⚠️ 单看任一个都可能误判。如户数增加也可能是转增股本所致。

---

## 配方 4 · 分红能力评估

```bash
xueqiu-bonus  '{"symbol":"SZ300750","maxPages":3}'
xueqiu-income '{"symbol":"SZ300750","type":"Q4","maxPages":2}'
xueqiu-balance '{"symbol":"SZ300750","type":"Q4","maxPages":2}'
```

**分红率** = 每股派息 × 股本 ÷ 归母净利润

```bash
# 分红侧
jq -r '.data.items[] | select(.status=="implemented") |
       "\(.dividendPeriod) 每股\(.dividendPerShare)元 \(.planExplain)"' bonus.json

# 股本（用于折算总额）
jq '.data.items[0].shareCapital.value' balance.json
```

> 🔴 **三个前提必须先确认**：
> 1. `meta.unparsedCount` 为 0 —— 非零说明有方案没解析出来，汇总不完整
> 2. 只算 `status: "implemented"` —— 预案不算
> 3. 排除 `cancelled: true` 的记录
>
> 🔴 **算股息率还需股价**，本包不提供，需接 `tradingview-spider`。

---

## 配方 5 · 供给冲击预判

```bash
xueqiu-restricted-release '{"symbol":"SZ300750","maxPages":3}'
xueqiu-top-holders        '{"symbol":"SZ300750","maxPeriods":2}'
```

```bash
# 用 byDate（已按解禁日聚合），不要用 items 单条
jq -r '.data.byDate[] | "\(.date[0:10]) 解禁 \(.totalShares/1e8|floor)亿股 涉及\(.holderCount)个股东"' \
   restricted.json
```

把解禁量与流通股本对比，评估冲击规模；再看解禁股东是否在十大股东名单里
（若是，其后续减持动向值得跟踪）。

---

## 配方 6 · 机构持仓变化

```bash
xueqiu-fund-holding '{"symbol":"SZ300750","maxPeriods":4,"topN":20}'
```

```bash
jq -r '.data.items[] |
  "\(.periodName) \(.fundCount)只基金 合计\(.totalHeldShares/1e8|floor)亿股 占流通\(.totalToFloatRatio)%"' \
  fund.json
```

看 `totalToFloatRatio` 的**趋势**（机构整体在增持还是减持），
以及 `fundCount` 变化（覆盖面扩大还是收缩）。

> ⚠️ 明细默认截断为前 50 只，但**合计数不受影响**（来自上游汇总行）。
> 只做趋势分析时无需调大 `topN`。

---

## 配方 7 · 单季环比分析

上市公司**不单独披露第四季度单季数据**，用 `S4` 可以拿到：

```bash
xueqiu-income   '{"symbol":"SH601127","type":"S4","maxPages":2}'
xueqiu-cashflow '{"symbol":"SH601127","type":"S4","maxPages":2}'
```

> 🔴 **不要对 `xueqiu-balance` 用 `S*`** —— 会全表置空（时点存量做差分无意义）。
> `cashflow` 的期初/期末现金余额也会被置空，其余 36 个流量字段正确。
>
> 详见 `conventions.md` §1.3。

---

## 通用纪律

### 翻页要翻到底

默认只取 5 期（A 组）远不够做趋势分析。做多年对比时：

```bash
# 约 40 期 ≈ 10 年
xueqiu-income '{"symbol":"SH601127","maxPages":8}'
```

### 先读 insights

```bash
jq -r '.data.insights[]' result.json
```

本包的 `insights` 会主动提示口径陷阱（少数股东损益为负、S 口径失真、
解析失败的分红方案等），**比自己看 items 更快发现问题**。

### 回写时只用 `meta.semantics` 的口径

```bash
jq -r '.data.meta.semantics' result.json
```

不要自造口径词。例如资产负债表说的是「时点余额」，
就不能写成「累计值」或「全年数据」。

### 遇到 null 先查原因

```bash
jq '.data.meta.suppressedFields' result.json   # S 口径下被置空的字段
jq '.data.meta.unparsedCount'    result.json   # 分红未解析数
```

`null` 可能是「上游不提供」「本期不适用」「被本包主动置空」三种情况之一，
不要一律当成「无数据」。
