# financials —— 财务四表字段与勾稽

> **何时读**：使用 `xueqiu-income` / `-balance` / `-cashflow` / `-indicator` 时。
> 口径体系与单位规则见 `conventions.md`。

四表**入参完全一致**：`symbol`（必填）、`type`、`count`、`maxPages`。

---

## 1. 利润表 `xueqiu-income`

**口径**：期间累计（年初至该期末）。已验证 2025 年 `totalRevenue`
191.47 → 624.02 → 1105.34 → 1650.54 亿，单调递增。

### 核心字段（40 个科目，此处只列常用）

| 字段 | 中文 |
|---|---|
| `totalRevenue` / `revenue` | 营业总收入 / 营业收入 |
| `totalOperatingCosts` / `operatingCost` | 营业**总**成本 / 营业成本（⚠️ 只差一个 s） |
| `sellingExpenses` / `adminExpenses` / `rdExpenses` / `financeExpenses` | 销售/管理/研发/财务费用 |
| `operatingProfit` | 营业利润 |
| `totalProfit` | 利润总额 |
| `netProfit` | 净利润（**含**少数股东损益） |
| `netProfitAttrParent` | **归母**净利润 |
| `minorityInterestIncome` | 少数股东损益（**可为负**） |
| `netProfitDeductNonRecurring` | 归母**扣非**净利润 |
| `basicEps` / `dilutedEps` | 基本/稀释每股收益（**元/股**） |

### 勾稽等式（可作校验断言）

```
① 营业总成本 = 营业成本 + 税金及附加 + 销售/管理/研发/财务费用      ✅ 精确
② 利润总额   = 营业利润 + 营业外收入 − 营业外支出                  ✅ 精确
③ 净利润     = 利润总额 − 所得税费用                              ✅ 精确
④ 净利润     = 归母净利润 + 少数股东损益                          ✅ 精确
⑤ 营业利润   ≈ 营收 − 营业总成本 + 其他收益 + 投资收益 + …         差 0.9%（未单列科目）
```

### ⚠️ 两个符号陷阱

- `creditImpairmentLoss`（信用减值）上游为**负值**，
  `assetImpairmentLoss`（资产减值）为**正值** —— 符号约定相反，
  算营业利润时前者相加、后者相减。**不要「顺手统一符号」**。
- `minorityInterestIncome` 为负时，归母净利润**高于**合并净利润。

---

## 2. 资产负债表 `xueqiu-balance`

**口径**：🔴 **时点余额**，不可跨期相加。`type=S*` 时全表置空（见 `conventions.md` §1.3）。

### 核心字段（87 个科目）

| 字段 | 中文 |
|---|---|
| `totalAssets` / `totalLiabilities` / `totalEquity` | 资产总计 / 负债合计 / 所有者权益合计 |
| `equityAttrParent` / `minorityEquity` | 归母权益 / 少数股东权益 |
| `assetLiabRatio` | 资产负债率（**小数**，0.6592 = 65.92%） |
| `totalCurrentAssets` / `totalCurrentLiabilities` | 流动资产 / 流动负债合计 |
| `currencyFunds` | 货币资金（⚠️ 与现金流量表口径不同） |
| `inventory` / `accountsReceivable` / `goodwill` | 存货 / 应收账款 / 商誉 |
| `shareCapital` | **股本金额（元）**，不是股数 |

### 勾稽等式（五组全部精确吻合）

```
① 负债合计 + 所有者权益合计 = 资产总计
② 流动资产 + 非流动资产     = 资产总计
③ 流动负债 + 非流动负债     = 负债合计
④ 归母权益 + 少数股东权益   = 所有者权益合计
⑤ 负债合计 / 资产总计       = assetLiabRatio    （完全一致到末位）
```

### ⚠️ 易混字段对

| 字段对 | 本样本 |
|---|---|
| `fixedAssets` / `fixedAssetsTotal` | 裸名为 null，`Total` 才有值 |
| `constructionInProgress` / `…Total` | 同上 |
| `longTermPayables` / `…Total` | 同上，`Total` 是真实的 `0` |
| `availableForSaleFinancialAssets` / `…Alt` | 上游同时存在两个拼写变体（后者拼错但**必须保留**） |

> 裸名恒 null 可能是该公司/该期的披露口径所致，**两个都保留并透传**，
> 消费方按 `??` 取值，不要在采集侧二选一。

---

## 3. 现金流量表 `xueqiu-cashflow`

**口径**：期间累计。⚠️ 但**累计值可以下降甚至为负**（经营现金流本身可正可负），
不能用「单调递增」判定累计口径。

### 命名规律（掌握后字段自解释）

| 缩写 | 含义 |
|---|---|
| `oa` / `ia` / `fa` | operating / investing / financing activities |
| `ci` / `cos` | cash inflow / cash outflow |
| `ncf` | net cash flow |
| `cce` | cash and cash equivalents |

### 核心字段

| 字段 | 中文 |
|---|---|
| `netCashFromOperating` | **经营活动**现金流量净额 |
| `netCashFromInvesting` / `netCashFromFinancing` | 投资 / 筹资活动净额 |
| `netIncreaseInCash` | 现金及现金等价物净增加额 |
| `beginningCashBalance` / `endingCashBalance` | 期初 / 期末现金余额（⚠️ **时点字段**） |
| `cashFromSalesAndServices` | 销售商品、提供劳务收到的现金 |
| `cashPaidForFixedAssets` | 购建固定资产支付的现金（≈ 资本开支） |

### 勾稽等式（九组全部精确吻合）

```
经营/投资/筹资 各自：流入小计 − 流出小计 = 净额                    ✅ ×3
净增加额 = 三大活动净额之和 + 汇率变动影响                         ✅
期末余额 = 期初余额 + 净增加额                                    ✅
```

### 🔴 S 口径下的失真

`beginningCashBalance` / `endingCashBalance` 是**时点字段**，
`type=S*` 时期初恒变 0、期末退化成当季净增额 —— 本包已置空。
其余 36 个流量字段正确，`S4` 可拿到上市公司不单独披露的 Q4 单季数据。

---

## 4. 主要财务指标 `xueqiu-indicator`

**性质**：由报表计算的**衍生指标**，不是原始科目。
🔴 **单位不统一**，换算前必查 `meta.fieldUnits`（见 `conventions.md` §2.2）。

### 字段分组

**盈利能力（%）**

| 字段 | 中文 | 口径 |
|---|---|---|
| `avgRoe` | 净资产收益率 | 归母净利 ÷ **平均**归母权益 |
| `dilutedRoe` | 净资产收益率（摊薄） | 归母净利 ÷ **期末**归母权益 |
| `returnOnTotalAssets` | 总资产净利率 | 净利润 ÷ **平均**总资产 |
| `grossMargin` / `netMargin` | 毛利率 / 净利率 | 净利率分子是**含少数股东**的净利润 |

⚠️ `avgRoe` 与 `dilutedRoe` 是**一对**（平均 vs 期末口径），数值不同，
回写时须说明用的哪个，不可混用。

**每股指标（元/股）**

| 字段 | 中文 |
|---|---|
| `basicEps` | 基本每股收益 |
| `netAssetsPerShare` | **每股净资产**（⚠️ 上游字段名 `np_per_share` 极具误导性，`np` = net **property**） |
| `undistributedProfitPerShare` | 每股未分配利润 |
| `operatingCashFlowPerShare` | 每股经营现金流 |
| `capitalReservePerShare` | **每股**资本公积 |

🔴 **`netAssetsPerShare` 不是每股净利润** —— 实测赛力斯每股净资产 23.71 元、
EPS 0.43 元，**相差 55 倍**，混淆会得出荒谬估值。

**偿债与结构（单位混合）**

| 字段 | 单位 | 备注 |
|---|---|---|
| `assetLiabRatio` | **%** | 与 balance 的小数口径差 100 倍 |
| `equityRatio` | **%** | 权益比率（不是权益金额）。与资产负债率互补 = 100 |
| `currentRatio` / `quickRatio` | 倍 | |
| `debtToEquityRatio` | 倍 | 产权比率，分母是**归母**权益 |
| `equityMultiplier` | 倍 | 权益乘数，分母是**全部**权益 |
| `operatingCashFlowToLiabilities` | **小数** | ⚠️ 本表唯一的小数比率 |

⚠️ `debtToEquityRatio` 与 `equityMultiplier` **分母不一致**（归母 vs 全部），
做杜邦分解时若假设同分母会推错。

**营运效率（次 / 天）**

周转率与周转天数配对，**天数 = 报告期实际天数 ÷ 周转率**（一季报用 90 天，非 360）：

```
inventoryTurnoverDays 10.4347 = 90 / inventoryTurnover 8.6251     ✅
operatingCycle 16.0659 = 存货周转天数 + 应收周转天数              ✅
cashCycle −130.9449   = 营业周期 − 应付周转天数                  ✅
```

⚠️ `cashCycle` **为负是正常的**（占用上游资金，强势产业链地位），不是数据错误。

**成长能力（%）**

`revenueYoy` / `netProfitAttrParentYoy` / `netProfitDeductNonRecurringYoy`

⚠️ 这三个字段的值与 A 组二元组的 `yoy` **是同一个同比但单位差 100 倍**
（本表是百分数 34.4629，A 组是小数 0.3446）。
上游该字段的 `[1]` 是「增速的同比」（二阶量），本包**已丢弃**以免误读。

**语义未确认**

`rop` = 73.0061 —— 已排除 5 种口径（营业成本率、营业总成本率、每股营收等）
均不匹配，**语义未破解**。原样透传，**不要据此下结论**。

---

## 5. 特殊机构类型

`meta.orgType` ≠ 1 时（银行/保险/券商），**科目结构与上述字典完全不同**
（如银行有「吸收存款」「发放贷款」而无「营业成本」）。

本包会在 `insights` 中给出警告。此时上述勾稽等式预期会失败，
需按该机构类型单独处理，**不要硬套本字典**。
