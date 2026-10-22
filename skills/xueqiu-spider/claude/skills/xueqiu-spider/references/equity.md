# equity —— 股权六表字段与特性

> **何时读**：使用 B 组六个 Skill 时。
> 口径体系见 `conventions.md`，分析配方见 `cookbook.md`。

B 组数值是**标量**（不是 A 组的 `{value, yoy}` 二元组）。

---

## 1. 两种翻页范式（入参不同）

| 范式 | Skill | 翻页参数 |
|---|---|---|
| **page/size** | `bonus` / `holders-num` / `restricted-release` / `insider-trades` | `maxPages` |
| **日期索引** | `top-holders` / `fund-holding` | `maxPeriods` |

**日期索引不是翻页** —— 上游先返回可用报告期清单，再按期逐个请求。
`maxPeriods` 越大请求越多，`meta.availablePeriodCount` 会告知上游共有多少期。

---

## 2. `xueqiu-top-holders` —— 十大股东 / 流通股东

### 口径开关

| `circulating` | 口径 | 实测可用期数 |
|---|---|---|
| `false`（默认） | 十大股东（全体） | 48 期 |
| `true` | 十大**流通**股东 | 37 期 |

⚠️ 两种口径的持股比例不同（实测首位 22.04% vs 22.77%），
可用期数也不同，**不要混用**。`meta.scope` 会回显实际口径。

### 字段

| 字段 | 含义 | 单位 |
|---|---|---|
| `totalHeldRatio` | 十大合计持股比例 —— 即**股权集中度** | **百分数** |
| `holders[].heldShares` / `heldRatio` | 单个股东持股数 / 占比 | 股 / 百分数 |
| `holders[].changePct` | 持股**数量**的环比变动 | 百分数 |
| `quitHolders[]` | 本期退出前十的股东 | — |

**已验证**：`items` 占比之和 == `totalHeldRatio`（66.28%），持股数之和 == 合计。

### ⚠️ 两个易错点

- **`changePct` 是持股数量的变动率，不是占比变动率**。
  实测易方达 ETF：数量变动 +14.0%（匹配字段）、占比变动 +14.81%（不匹配）。
  增发后股东未减持时，`changePct=0` 但 `heldRatio` 会下降。
- **`quitHolders[]` 字段集与 `holders[]` 不同**：没有 `changePct`，
  但多了 `rankBefore`（退出前排名）。二者语义相反，**不要合并成一个数组**。

---

## 3. `xueqiu-holders-num` —— 股东人数与筹码结构

### 字段

| 字段 | 含义 | 单位 |
|---|---|---|
| `holderNum` | 股东总户数 | 户 |
| `aShareHolders` / `hShareHolders` / `bShareHolders` | A/H/B 股股东数 | 户 |
| `holderNumChgPct` | 户数**环比**变动 | 百分数 |
| `sharesPerHolder` | 户均持流通股 | 股 |
| `amountPerHolder` | 户均持股市值 | 元 |
| `topHolderRatio` / `topFloatHolderRatio` | 前十大 / 前十大流通股东合计比例 | 百分数 |
| `price` | 该披露日股价 | 元 |

**已验证勾稽**：

```
amountPerHolder = sharesPerHolder × price                      ✅ 完全吻合
aShareHolders + hShareHolders = holderNum                      ✅ 完全吻合
holderNumChgPct 用相邻期反算（四期全中）                        ✅
```

### 筹码流向判读

| 信号 | 含义 |
|---|---|
| 户数 ↑ + 户均持股 ↓ | **筹码分散**（散户增多） |
| 户数 ↓ + 户均持股 ↑ | **筹码集中**（通常视为积极信号） |
| `topHolderRatio` 持续 ↓ | 大股东减持或股权稀释 |

本包会在 `insights` 中自动给出定性。

> 🔴 `price` 只在披露日有值（一年数期），且未说明是收盘价还是均价，
> **不能替代行情源做估值**。

---

## 4. `xueqiu-fund-holding` —— 基金持股

### 规模与截断

单期可达 **2000+ 只**基金。默认 `topN=50`（按持股量取前 N），
传 `topN:0` 不截断（慎用，会撑爆上下文）。

**合计数来自上游汇总行，不受截断影响** ——
`totalHeldShares` / `totalToFloatRatio` 始终是全量口径。

### 字段

| 字段 | 含义 | 单位 |
|---|---|---|
| `fundCount` | 持仓基金数量（**已剔除汇总行**） | 只 |
| `totalHeldShares` / `totalToFloatRatio` | 全部基金合计持股 / 占流通股比例 | 股 / 百分数 |
| `funds[].fundName` / `heldShares` / `toFloatRatio` | 单只基金明细 | — |

⚠️ `toFloatRatio` 的分母是**流通股**，不是总股本、也不是基金净值。

> 上游 `fund_items[0]` 是「全部合计」汇总行（不是一只基金），
> 本包已剥离。已验证合计行 == 2159 条明细之和（差额 0）。

---

## 5. `xueqiu-bonus` —— 分红 / 增发 / 配股

一个 Skill 返回三块：`items`（分红）、`additions`（增发）、`allotments`（配股）。

### 🔴 分红金额是从中文串解析的

上游**不提供结构化金额字段**，只有 `plan_explain`（如 `10派69.57元(实施方案)`）。
本包已解析为每股值，**并保留原文**。

| 字段 | 含义 |
|---|---|
| `dividendPerShare` | 每股派息（元，**税前**）。已从「每 10 股」折算到每 1 股 |
| `transferPerShare` / `bonusSharesPerShare` | 每股转增 / 送股数 |
| `status` | `implemented`（已实施）/ `proposed`（预案）/ `unknown` |
| `parsed` | **是否解析成功** |
| `planExplain` | 🔴 **原文，永远保留** |
| `cancelled` | 该次分红是否已被取消 |

### 🔴 消费纪律

1. **`parsed: false` 时 `dividendPerShare` 为 `null`，不是 0** ——
   这表示「形态未覆盖」，**不是「未分红」**。须回退到 `planExplain` 原文。
2. **只有 `status: "implemented"` 才算已分红** ——
   `proposed`（预案）尚未实施，不能计入。
3. `meta.unparsedCount` 非零时，任何金额汇总都**不完整**。

### 已覆盖的方案形态

```
10派69.57元          → 纯派息
10转8股派25.2元       → 转增 + 派息
10送3股派2元          → 送股 + 派息
10转10股              → 纯转增（dividendPerShare 为 null，表示不适用）
不分配不转增           → 全 0（这是已知信息，parsed:true）
```

⚠️ A 股形态远不止这些，遇到未覆盖的会如实返回 `parsed:false`。

### `dividendPeriod` 两种格式

| 格式 | 含义 |
|---|---|
| `2025年报` / `2026中报` | 与定期报告绑定 |
| `2024-12-11` | **特别分红**（`isSpecialDividend: true`） |

⚠️ 按报告期与三张报表 join 时，日期格式的记录会**漏配**。
算年度分红总额须把它们也归入对应年份。

### 增发字段

| 字段 | 含义 | 单位 |
|---|---|---|
| `issueVolume` / `issuePrice` | 实际发行数量 / 发行价 | 股 / 元每股 |
| `netRaisedAmount` | 实际募资**净额**（已扣发行费用） | 元 |
| `listingDate` | 增发股份上市日 | — |

**已验证**：109,756,097 股 × 410 元 = 450 亿（毛额），净额 448.7 亿，
差 1.3 亿即发行费用 ✅

---

## 6. `xueqiu-restricted-release` —— 限售解禁

| 字段 | 含义 |
|---|---|
| `holderName` | 股东名称 |
| `floatableDate` | 解禁日 |
| `floatableShares` | 解禁数量（股） |
| `shareType` | 解禁股份类型（开放字符串，不做枚举映射） |
| **`byDate[]`** | **按解禁日聚合的合计**（本包附加） |

🔴 **同一解禁日按股东拆成多条** —— 实测 20 条记录同属 1 个解禁日。
**算单日解禁总量必须用 `byDate`**（已分组求和），不要取单条。

---

## 7. `xueqiu-insider-trades` —— 高管增减持

| 字段 | 含义 |
|---|---|
| `changerName` / `managerName` / `relation` | 变动人 / 关联高管 / 二者关系 |
| `duty` | 职务 |
| `changeShares` | 变动股数 —— 🔴 **负数=减持，正数=增持** |
| `direction` | `increase` / `decrease`（本包由符号派生，便于过滤） |
| `avgPrice` | 成交均价（元/股） |
| `balanceAfter` | **变动后**持股余额 |
| `estimatedAmount` | 估算变动金额 = \|变动股数\| × 均价 |

**余额链已验证**（5/6 精确吻合）：`本期余额 − 本期变动 == 上期余额`。
有 1 条差 100 股，是同日多笔交易合并所致 —— **不要当强校验**。

> ⚠️ **不要仅凭减持下结论**：可能出于个人资金需求、股权激励行权、
> 大宗减持计划等多种原因。本数据为**事实记录**，回写时作事实陈述，
> 不作投资判断。
