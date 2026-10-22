---
name: xueqiu-spider
description: A 股上市公司基本面数据采集技能集，提供 10 个 Skill 覆盖两大域：①「财务报表」利润表/资产负债表/现金流量表/主要财务指标（xueqiu-income / -balance / -cashflow / -indicator），含 200+ 会计科目、支持单季与累计口径、可取 10 年以上历史；②「股权与公司运作」分红增发/十大股东/股东人数/基金持股/限售解禁/高管增减持（xueqiu-bonus / -top-holders / -holders-num / -fund-holding / -restricted-release / -insider-trades）。当用户问「某公司财务怎么样」「营收利润增长如何」「盈利质量/现金流健不健康」「ROE/毛利率/资产负债率多少」「谁是大股东/股权集中度」「分红多不多」「机构在买还是卖」「高管在减持吗」「有多少解禁压力」「做基本面分析」等场景时使用。默认连接已登录的 Chrome 远程调试会话（127.0.0.1:4444），通过统一 CLI 暴露结构化 JSON。不提供股价与估值指标（PE/PB），需另接行情源。
argument-hint: <skill-id> '<params-json>'
allowed-tools: Bash(node *)
---

# xueqiu-spider — 路由入口

> 本文件是**入口与路由层** —— 回答「该调哪个 Skill / 怎么传参 / 结果怎么读」。
>
> **始终生效的约束**（Chrome 端口前置、一次一条命令、jq 提取、错误码表）
> 见随包安装的 `rules/spider-core.md` / `rules/spider-runtime.md`，**本文件不重复**。
>
> 复杂细节按需加载 `references/`：
>
> | 文件 | 何时读 |
> |---|---|
> | `references/conventions.md` | 传参前：口径体系、单位规则、报告期语义、跨表冲突 |
> | `references/financials.md` | 用财务四表时：字段字典、勾稽等式、单季口径适用性 |
> | `references/equity.md` | 用股权六表时：字段字典、分红解析、翻页差异 |
> | `references/cookbook.md` | 做完整分析时：常见分析任务的 Skill 组合配方 |

---

## 0. 决策三步法

1. **要财务表现还是股权结构？**
   财务（营收/利润/现金流/比率）→ §1 A 组；
   股权（股东/分红/机构/解禁/高管）→ §1 B 组。

2. **要累计值还是单季值？**
   默认 `type=all` 是**累计口径**（年初至该期末）。
   要单季必须传 `type=S*`，但**不是所有表都适用** —— 见 §2.1。

3. **是否落入口径陷阱？**
   本包最大的风险不是取不到数，而是**取到看起来正常的错数据**。
   三个高频陷阱见 §2，完整清单见 `references/conventions.md`。

---

## 1. 意图路由（10 个 Skill）

所有 Skill **必填 `symbol`**，格式 `{两位交易所前缀}{6位数字}`（如 `SH601127` / `SZ300750`），
仅支持 A 股。

### A 组 · 财务报表（4 个）

| Skill | 用途 | 口径 | 常用参数 |
|---|---|---|---|
| `xueqiu-income` | 利润表：营收/成本/费用/各级利润/EPS | 期间累计 | `type` `maxPages` |
| `xueqiu-balance` | 资产负债表：资产/负债/权益全科目 | **时点余额** | 同上 |
| `xueqiu-cashflow` | 现金流量表：经营/投资/筹资三大活动 | 期间累计 | 同上 |
| `xueqiu-indicator` | 主要财务指标：ROE/毛利率/周转率/每股指标 | 衍生指标 | 同上 |

```bash
# 近 10 年年报利润表
node ${CLAUDE_SKILL_DIR}/scripts/index.js xueqiu-income '{"symbol":"SH601127","type":"Q4","maxPages":3}'

# 资产负债表最新几期
node ${CLAUDE_SKILL_DIR}/scripts/index.js xueqiu-balance '{"symbol":"SH601127"}'

# 单季现金流（S4 = 第四季度单季，上市公司不单独披露）
node ${CLAUDE_SKILL_DIR}/scripts/index.js xueqiu-cashflow '{"symbol":"SH601127","type":"S4"}'
```

### B 组 · 股权与公司运作（6 个）

| Skill | 用途 | 翻页参数 |
|---|---|---|
| `xueqiu-top-holders` | 十大股东 / 十大流通股东、股权集中度、退出股东 | `maxPeriods` |
| `xueqiu-holders-num` | 股东户数、户均持股、筹码集中度 | `maxPages` |
| `xueqiu-fund-holding` | 基金持股明细（单期可达 2000+ 只） | `maxPeriods` `topN` |
| `xueqiu-bonus` | 分红 + 增发 + 配股 | `maxPages` |
| `xueqiu-restricted-release` | 限售解禁明细 + 按日聚合 | `maxPages` |
| `xueqiu-insider-trades` | 高管及关联人增减持 | `maxPages` |

```bash
# 十大股东（默认全体口径）
node ${CLAUDE_SKILL_DIR}/scripts/index.js xueqiu-top-holders '{"symbol":"SZ300750","maxPeriods":4}'

# 十大流通股东（口径不同，见 §2.3）
node ${CLAUDE_SKILL_DIR}/scripts/index.js xueqiu-top-holders '{"symbol":"SZ300750","circulating":true}'

# 分红记录（金额已从中文方案串解析）
node ${CLAUDE_SKILL_DIR}/scripts/index.js xueqiu-bonus '{"symbol":"SZ300750","maxPages":3}'

# 基金持股，只要前 20 只
node ${CLAUDE_SKILL_DIR}/scripts/index.js xueqiu-fund-holding '{"symbol":"SZ300750","topN":20}'
```

> ⚠️ 两组的翻页参数**不同**：A 组与 B 组 page/size 类用 `maxPages`，
> `top-holders` / `fund-holding` 用 `maxPeriods`（按报告期展开，不是翻页）。

---

## 2. 口径陷阱速判 ⚠️

本包的数据本身准确（勾稽已验证），风险集中在**口径误用**。以下三个最高频。

### 2.1 单季口径 `type=S*` 不是哪张表都能用

| Skill | `S` 系列 | 说明 |
|---|---|---|
| `xueqiu-income` | ✅ 可用 | 单季利润 |
| `xueqiu-cashflow` | ⚠️ 部分 | 36 个流量字段可用；**期初/期末现金余额会被置空** |
| `xueqiu-balance` | ❌ **全表置空** | 时点存量做差分会产出负的总资产，本包已拦截 |
| `xueqiu-indicator` | ⚠️ 不建议 | 对比率做差分无意义 |

被置空的字段列在 `meta.suppressedFields`，`insights` 会说明原因。
**看到 null 不要当成「无数据」**，先读 insights。

### 2.2 `Q2` 是中报、`Q4` 是年报 —— 不是季度

| 取值 | 实际含义 |
|---|---|
| `Q1` | 一季报（年初至 3 月末累计） |
| `Q2` | **中报**（年初至 6 月末累计），不是第二季度 |
| `Q3` | 三季报 |
| `Q4` | **年报**（全年累计），不是第四季度 |
| `S0`–`S4` | 单季值（相邻期差分） |

要「第四季度单季」用 `S4`，不是 `Q4`。

### 2.3 归母 ≠ 合并，全体股东 ≠ 流通股东

- **净利润**：`netProfit` 含少数股东损益，`netProfitAttrParent` 是归母。
  少数股东亏损时**归母会高于合并**（实测赛力斯：归母 7.54 亿 > 合并 6.11 亿）。
- **十大股东**：`circulating:false`（默认）是全体股东口径，
  `true` 是流通股东。两者的持股比例、可用期数都不同。

更多陷阱（单位混合、跨表同名字段冲突、分红假朋友）见 `references/conventions.md`。

---

## 3. 读结果：先看 `insights`，再看 `items`

所有 Skill 返回 AI-Ready 信封：

```jsonc
{
  "meta":     { "semantics": "…", "symbol": "…", … },  // ★ 口径声明，回写时只用它
  "units":    { … },                                    // 字段单位
  "insights": [ "中文要点…" ],                           // ★ 优先读
  "items":    [ … ]                                     // 明细
}
```

```bash
jq -r '.data.insights[]'                    result.json   # 中文要点
jq -r '.data.meta.semantics'                result.json   # 口径声明
jq '.data.items[0]'                         result.json   # 首条明细
jq '.data.meta.suppressedFields'            result.json   # 被置空的字段（S 口径下）
```

> 🔴 **`meta.semantics` 是回写时唯一允许的口径来源**，不要自造词。
> 例如资产负债表说的是「时点余额」，就不能写成「累计值」。

---

## 4. 本包**不提供**什么

| 缺失 | 影响 | 替代 |
|---|---|---|
| **股价 / 市值** | **所有估值指标**（PE/PB/PS） | `tradingview-spider` |
| 分部数据 | 业务构成拆解 | — |
| 审计意见 / 关联交易 | 财报排雷 | — |

⚠️ `xueqiu-holders-num` 返回的 `price` 只是披露日快照（一年数期），
**不能替代行情源做估值**。

---

## 5. 常见任务 → Skill 组合

| 任务 | 组合 |
|---|---|
| 盈利质量排雷 | `income` + `cashflow`，算 经营现金流/净利润 |
| 完整基本面 | `income` + `balance` + `cashflow` + `indicator` |
| 股权结构尽调 | `top-holders` + `holders-num` + `insider-trades` |
| 分红能力评估 | `bonus` + `income`（分红率 = 每股派息 × 股本 / 归母净利） |
| 供给冲击预判 | `restricted-release` + `top-holders` |

完整配方（含 jq 命令与判读标准）见 `references/cookbook.md`。
