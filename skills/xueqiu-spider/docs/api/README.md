# 雪球（xueqiu）财务数据接口梳理

> 本目录基于 `docs/` 下的 HAR 抓包逆向整理，覆盖 A 股个股财务数据四大模块。
> 机器可读契约见 [`openapi.yaml`](./openapi.yaml)（OpenAPI 3.1），本文件是人读导航 + 通用约定 + 字段字典。
>
> 证据来源（`skills/xueqiu-spider/docs/*.har`）：
>
**A 组 · 财务报表**（`/v5/stock/finance/cn/**`，样本：赛力斯 `SH601127`，2026-08-06 采集）
>
> | HAR | 覆盖端点 | 字段数 | 状态 |
> | --- | --- | --- | --- |
> | `【利润表】` | `finance/cn/income.json` | 43 | ✅ |
> | `【资产负债表】` | `finance/cn/balance.json` | 90 | ✅ |
> | `【现金流量表】` | `finance/cn/cash_flow.json` | 41 | ✅ |
> | `【主要财务指标】` | `finance/cn/indicator.json` | 38 | ✅ |
>
> **B 组 · 股权与公司运作**（`/v5/stock/f10/cn/**`，样本：宁德时代 `SZ300750`，2026-08-07 采集）
>
> | HAR | 覆盖端点 | 状态 |
> | --- | --- | --- |
> | `【分红】` + `【增发】` | `f10/cn/bonus.json`（一个端点返回分红/增发/配股三块） | ✅ 本轮 |
> | `【十大股东】` + `【十大流通股东】` | `f10/cn/top_holders.json`（`circula` 区分） | ✅ 本轮 |
> | `【股东人数】` | `f10/cn/holders.json` | ✅ 本轮 |
> | `【基金持股】` | `f10/cn/org_holding/detail.json` | ✅ 本轮 |
> | `【限售解禁】` | `f10/cn/shareschg.json` | ✅ 本轮 |
> | `【高管增减持】` | `f10/cn/skholderchg.json` | ✅ 本轮 |
>
> ⚠️ **8 个 HAR 收敛为 6 个端点**：`bonus.json` 同时承载分红与增发（「增发」HAR 中
> 没有独立端点）；`top_holders.json` 靠 `circula=0/1` 区分全体/流通股东。
>
> **文档组织**：§2 是**端点族共性**（信封、鉴权、翻页、二元组等，各端点一致），
> §3 起按端点分节写**特性**。新增端点时先读 §2，只把差异写进自己的小节。

---

## 1. 域名与模块总览

抓包中出现的域名里，**只有一个承载业务数据**，其余全是页面壳、埋点与配置，实现时应全部忽略：

| 域名 | 用途 | 是否需要 |
| --- | --- | --- |
| `stock.xueqiu.com` | **业务数据 API**：`/v5/stock/finance/cn/**`（财务报表）+ `/v5/stock/f10/cn/**`（股权与公司运作） | ✅ 唯一目标 |
| `xueqiu.com` | 页面壳（`/snowman/S/{symbol}/detail`）、用户态与埋点 | 仅用于建立会话 / 提供 Origin |
| `open.xueqiu.com` | 前端配置下发（`/mpaas/config/content`）、APM 上报 | ❌ 忽略 |
| `assets.imedao.com` / `xqimg.imedao.com` / `xqdoc.imedao.com` | 静态资源 CDN | ❌ 忽略 |
| `g.alicdn.com` / `o.alicdn.com` / `hm.baidu.com` / `fp-it.portal101.cn` | 第三方库、百度统计、设备指纹 | ❌ 忽略 |

### 1.1 页面不做 SSR

`GET https://xueqiu.com/snowman/S/SH601127/detail` 返回的 HTML **不含任何财务数据**，也没有 `window.__INITIAL_STATE__` 一类内联状态（已 grep 验证：`net_profit_atsopc`、中文表头均无命中）。数据 100% 由前端 XHR 拉取。

**含义**：不需要解析 HTML，直接打 API 即可；页面只在需要 Origin/Cookie 时用来建立会话上下文。

### 1.2 字段中文名不在抓包内

表头中文名由前端 bundle 内的字典渲染，本次抓包的 JS 资源中**未命中**该映射表。因此各端点字段字典（§3.5.3 / §4.5）的中文名是**依据勾稽关系验算与会计准则推定的**，不是抓包直接证据——已逐项标注置信度，凡标「勾稽验证」的均已用实际数值验算通过。

---

## 2. 通用约定（跨端点族共性）

> 本节内容已在 **A 组 4 个财务端点**上交叉验证一致，
> 并在 **B 组 6 个 f10 端点**上复核了信封、鉴权、CORS 三项 —— 全部一致。
>
> **两组的差异只在翻页范式与 `data` 内部形态**（见 §2.9），
> 信封解包、错误判定、鉴权可完全共用一套实现。

### 2.0 共性一览

四端点在以下方面**完全相同**，实现时应抽公共基类 / 共享 Goal 逻辑：

| 维度 | 结论 |
| --- | --- |
| URL 形态 | `/v5/stock/finance/cn/{report}.json`，仅 `{report}` 段不同 |
| 入参 | `symbol` / `type` / `is_detail` / `count` / `timestamp` 五个，**完全一致** |
| 响应信封 | `{data, error_code, error_description}` |
| `data` 外层键 | `quote_name` / `currency` / `currency_name` / `org_type` / `last_report_name` / `statuses` / `list`，**7 个完全一致** |
| 翻页机制 | `timestamp` 游标 + `list.length < count` 终止 |
| 数值形态 | `[值, 同比]` 二元组 |
| 鉴权 | 登录态 Cookie |

**差异**集中在四处：`list[]` 的**字段集**、`type` 的**可用取值**、
**`S` 系列是否语义正确**（§2.8）、以及 **`indicator.json` 的单位不统一**（§6.3）。

> ⚠️ **前三个端点是原始报表，`indicator.json` 是衍生指标**，性质不同。
> 报表的单位统一（元 / 小数同比），indicator **混着百分数、小数、倍数、元**四种，
> 且与报表有 2 个同名字段口径冲突（§6.4）。**不要把它当第四张报表同等对待。**

### 2.1 响应信封

`stock.xueqiu.com/v5/**` 全族共用一个信封：

```jsonc
{
  "data": { /* 业务数据 */ },
  "error_code": 0,             // 成功为数字 0
  "error_description": ""
}
```

**失败时 `error_code` 变成字符串**（类型漂移，实测）：

```jsonc
{
  "data": { "list": [] },      // 注意：仍有 data，且 list 为空数组
  "error_code": "400016",      // ← string，不是 number
  "error_description": "遇到错误，请刷新页面或者重新登录帐号后再试"
}
```

> ⚠️ **判定成功不能只看 HTTP 状态码，也不能只看 `data` 是否存在**。上例的 HTTP 状态是 `400`，但也观察到过业务软失败裹在 200 里的模式（雪球一贯做法）。可靠判据是 `error_code` 归一化后 `== 0`，且必须容忍它是 string 或 number。

### 2.2 鉴权：必须有登录态 Cookie

实测（`curl` 带齐 `Origin` / `Referer` / `User-Agent`，仅缺 Cookie）：

```
HTTP 400 → error_code "400016" 遇到错误，请刷新页面或者重新登录帐号后再试
```

HAR 中的请求**看不到 `cookie` 请求头**，这是 Chrome 导出 HAR 时对 Cookie 的常规脱敏，不代表实际未发送——响应头 `access-control-allow-credentials: true` 与 `access-control-allow-origin: https://xueqiu.com`（回显具体 Origin 而非 `*`）共同证明这是**带凭据的跨域请求**。

**实现要求**（对齐 CLAUDE.md §4.6 红线）：必须在 `page.evaluate(fetch(...))` 内于已登录的 `https://xueqiu.com` 页面上下文发请求，让浏览器自动带 Cookie 并携带正确 Origin；**不得把 Cookie 提取到 Node 层**。

### 2.3 必需请求头

在页面上下文内 `fetch` 时，以下头由浏览器自动补齐，无需手写：

| 头 | 值 | 必要性 |
| --- | --- | --- |
| `origin` | `https://xueqiu.com` | 必需（CORS 白名单，回显式校验） |
| `referer` | `https://xueqiu.com/snowman/S/{symbol}/detail` | 建议保留 |
| `cookie` | 登录态 | **必需**，见 §2.2 |
| `accept` | `application/json, text/plain, */*` | 常规 |

无自定义签名头、无 token 参数——**没有加签机制**，凭据完全依赖 Cookie。

### 2.4 URL 里的 `md5__1038` 是噪声

`xueqiu.com` 域下部分请求（`autocomplete.json`、`pre_check.json` 等）带一个超长 `md5__1038` 参数，这是**加速乐/CDN 的风控埋点**，由第三方脚本注入。

> **`stock.xueqiu.com/v5/**` 的财务接口不带该参数**（见 HAR 中 14 条 income 请求的完整 URL），无需构造。

### 2.5 时间戳单位

**全部为毫秒**：`report_date`、`ctime`、`timestamp` 入参均为 13 位毫秒时间戳。

`report_date` 恒为报告期最后一日 `00:00:00` **东八区**（`1774886400000` → 2026-03-31 00:00:00 CST）。

### 2.6 ⚠️ 数值可能是科学计数法

上游是 Java 序列化，**大额数值会以科学计数法出现在原始 JSON 里**（无引号，是合法 JSON number）：

```jsonc
{ "dividend_receivable": [3.0E8, null] }      // ← 原文即 3.0E8，表示 300000000
{ "total_assets": [1.2374786503834E11, ...] } // ← 1237.48 亿
```

在 `balance.json` 单次响应中即出现**上千处**，`income.json` 同样存在。

**影响与对策**：

| 处理方式 | 是否安全 |
| --- | --- |
| `JSON.parse()` / `response.json()` | ✅ 安全，自动还原为 number |
| 正则 / 字符串截取原始报文 | ❌ **会挂**，`3.0E8` 匹配不到常规数字模式 |
| 把值当字符串直接回显给用户 | ❌ 会显示成 `3.0E8` 这种不可读形态 |

> 只要走标准 JSON 解析就没问题。但**投影层做格式化时要注意**：`Number.prototype.toLocaleString()` 能正确处理，
> 而任何基于字符串的千分位处理都必须先确保拿到的是 number 而非原始文本。

### 2.7 ⚠️ 二元组的三种状态（不止两种）

`[值, 同比]` 二元组实际有**三种**形态，语义各不相同：

| 形态 | 含义 | 映射建议 |
| --- | --- | --- |
| `[123.45, 0.34]` | 有值、有同比 | 正常 |
| `[null, null]` | **该科目本期不适用/未披露** | 值与同比均为 `null`，**不得填 0** |
| `[0.0, null]` 或 `[123.45, null]` | **有值但无同比**（去年同期为 0 或缺失，无法计算增长率） | 值照常保留，同比为 `null` |

实测第三种（balance 2026Q1）：`interest_receivable: [12195913.24, null]`、
`dividend_receivable: [3.0E8, null]`、`lt_payable_sum: [0.0, null]`。

> ⚠️ **`lt_payable_sum: [0.0, null]` 是「值确实为零」，不是「无数据」**——这正是 CLAUDE.md §3.5
> 「`null` = 数据源不提供，`0` = 值确实为零，二者不可混用」的实例。
> 若实现里用 `value || null` 一类写法做归一化，会把真实的 `0` 误吞成 `null`。

### 2.8 🔴 `S0`–`S4` 单季口径的适用性矩阵

`S` 系列是上游对相邻期做的**机械差分**，对全族端点无差别套用。
但差分是否有意义**取决于字段是流量还是存量**——这是本套接口最大的语义陷阱。

| 端点 | 表类型 | `S` 系列是否可用 | 说明 |
| --- | --- | --- | --- |
| `income.json` | 期间流量表 | ⚠️ **未实测**（HAR 未覆盖，缺登录态无法验证） | 若可用则是「单季利润」高价值口径 |
| `balance.json` | **时点存量表** | ❌ **禁用** | 产出负的总资产、负的资产负债率（§4.3） |
| `cash_flow.json` | 期间流量表 | ⚠️ **部分可用** | 36 个流量字段正确，**2 个余额字段失真**（§5.3） |
| `indicator.json` | 衍生指标 | ⚠️ **HAR 未出现** | 对比率做差分无意义；未实测上游是否接受（§6.1） |

**判据不是"表的类型"，而是"字段的类型"** —— 现金流量表虽是流量表，
内部却混着 2 个时点余额字段，差分后同样失真。见 §5.3。

> ⚠️ **实现上不要按端点粗粒度开关 `S` 系列**，那对 `cash_flow.json` 会误伤 36 个正确字段
> 或放行 2 个错误字段。正确做法是**按字段白名单**处理，见 §8.2。

### 2.9 两组端点族的差异对照（实现选型依据）

| 维度 | A 组 · 财务报表 `finance/cn/**` | B 组 · 股权运作 `f10/cn/**` |
| --- | --- | --- |
| **响应信封** | `{data, error_code, error_description}` | **完全相同** ✅ |
| **鉴权** | 登录态 Cookie | **完全相同** ✅ |
| **CORS** | ACAC=true + ACAO 回显具体 Origin | **完全相同** ✅ |
| **导航目标** | `/snowman/S/{symbol}/detail` | **完全相同** ✅ |
| **入参** | `symbol` / `type` / `is_detail` / `count` / `timestamp` | **各端点不同**（见各节） |
| **翻页范式** | 统一游标（`timestamp` + `report_date`） | **三种并存**（见下） |
| **`data` 形态** | 统一 `{...元数据, list[]}` | **各端点不同**（`items` / `fund_items` / 多块并列） |
| **数值形态** | 统一 `[值, 同比]` 二元组 | **标量**（无二元组） |

**含义**：信封解包、`error_code` 判定、鉴权、导航可完全复用 A 组的实现；
但**翻页与投影必须逐端点写**，不能套用财务表的泛型 Goal 工厂。

#### B 组内部的三种翻页范式

| 范式 | 端点 | 入参 | 终止判据 |
| --- | --- | --- | --- |
| **page/size** | `bonus` / `holders` / `shareschg` / `skholderchg` | `page` + `size` | ⚠️ 见 §2.10 |
| **日期索引** | `top_holders` | `locate` + `start` | 由 `times[]` 枚举，非翻页 |
| **日期索引** | `org_holding/detail` | `timestamp` | 由 `times[]` 枚举，非翻页 |

> **日期索引类不是翻页**：首次请求（不带日期参数）会返回 `times[]` 数组，
> 列出全部可用报告期；取历史期是**按 `times[].value` 展开请求**，
> 属于「入参驱动、要几期发几次」的形态 —— 用 `@Expanded` 而非 `@Paginated`。

### 2.10 🔴 每页条数逐端点而异 —— `holders` 多返一条，其余不会

**终止判据必须按端点区分，不能一刀切。**

#### 实测：四个 page/size 端点的每页条数（`size=10`）

| 端点 | 每页返回 | 行为 |
| --- | --- | --- |
| `holders` | **11 条** | 多返一条作「下页预览」，末条 == 下页首条 |
| `bonus` | 10 条 | 标准 |
| `shareschg` | 10 条 | 标准 |
| `skholderchg` | 10 条 | 标准 |

`holders.json` 的重复证据（各页 `timestamp`）：

```
page=1 → 11 条，末条 1719676800000
page=2 → 11 条，首条 1719676800000  ← 与上页末条重复
                末条 1656518400000
page=3 → 11 条，首条 1656518400000  ← 与上页末条重复
page=4 →  8 条（到底）
```

#### 正确的终止判据

| 端点 | 满页条数 | 到底判据 |
| --- | --- | --- |
| `holders` | `size + 1` | `length <= size` |
| 其余三个 | `size` | `length < size` |

> 🔴 **两个方向都会出错，且都不报错**：
>
> | 错误做法 | 后果 |
> | --- | --- |
> | 对 `holders` 用 `length < size` | **永远不成立**（11 > 10），一直翻到上游返空，多发大量请求 |
> | 对其余端点用 `length <= size` | **第一页就误判到底**（10 <= 10），后续数据全丢 |
>
> 后者是本仓踩过的真实坑：实现时把 `holders` 的行为当成了全族规则，
> 结果 `bonus` 只拿到 10 条而真实有 12 条 —— **静默少数据，不报错**。
> 修正见 `src/thrall/f10-shared.ts` 的 `overFetch` 标志。

#### 跨页去重仍然必要

`holders` 的边界会重复一条，必须按业务主键去重：

| 端点 | 业务主键 |
| --- | --- |
| `holders` | `timestamp` |
| `bonus` | `dividend_year` + `ex_dividend_date` |
| `shareschg` | `floatable_time` + `holder_name` + `floatable_shares_num` |
| `skholderchg` | `chg_date` + `share_changer_name` + `chg_shares_num` |

> 其余三个端点虽无重复，统一去重可防御上游变化，且对正常数据无副作用。

> ⚠️ **本节结论来自四个端点的逐一实测**（各页条数已核对）。
> 不要把任一端点的行为外推到其它端点 —— 这正是上面那个坑的成因。

---

## 3. 端点：利润表

```
GET https://stock.xueqiu.com/v5/stock/finance/cn/income.json
```

### 3.1 入参

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `symbol` | string | ✅ | 标的代码，格式 `{交易所}{代码}`，如 `SH601127`、`SZ000001`。路径中的 `/cn/` 表明本端点**仅限 A 股**；港股/美股应有同族异径端点（本次未抓到，勿臆测） |
| `type` | string | ✅ | 报告期筛选，见 §3.2 |
| `is_detail` | boolean | ✅ | 抓包恒为 `true`。为 `false` 时是否精简字段**未验证** |
| `count` | number | ✅ | 每次返回期数，抓包恒为 `5`。上限未验证 |
| `timestamp` | number \| 空串 | ⚠️ | **双重语义**，见 §3.3 |

### 3.2 `type`：报告期筛选（上游枚举）

| 取值 | 语义 | 实测返回（`count=5`） |
| --- | --- | --- |
| `all` | 全部期次，按 `report_date` 倒序 | 2026Q1 / 2025年报 / 2025Q3 / 2025中报 / 2025Q1 |
| `Q1` | **仅一季报** | 2026Q1 / 2025Q1 / 2024Q1 / 2023Q1 / 2022Q1 |
| `Q2` | **仅中报**（非"第二季度"） | 2025中报 / 2024中报 / 2023中报 / 2022中报 / 2021中报 |
| `Q3` | **仅三季报** | 2025三季报 / 2024三季报 / … |
| `Q4` | **仅年报**（非"第四季度"） | 2025年报 / 2024年报 / … |

> ⚠️ **`Q2`/`Q4` 的命名有误导性**：它们指的是**累计到该季度末的定期报告**（中报 / 年报），不是单季数据。见 §3.4。
>
> ⚠️ 这是**上游定义的枚举**，按 CLAUDE.md §3.6 只做形状校验、不做白名单拦截——上表是已验证取值，可能存在未列出的取值。

> 🔴 **上表已被后续抓包证伪为「不完整」**：分析资产负债表 HAR 时发现了本表完全没出现的
> `S0` / `S1` / `S2` / `S3` / `S4` 五个取值（**单季口径**，见 §4.2）。
>
> 利润表**是否也支持 `S` 系列尚未验证**（缺登录态无法实测），但两端点入参完全一致，**很可能支持**。
> 这是「一次抓包只覆盖你走过的那条用户路径」的活教材——**再次确认不要对 `type` 做白名单拦截**。

### 3.3 `timestamp`：翻页游标（不是当前时间）

这是本端点最容易踩坑的参数，它有**两种截然不同的用法**：

**用法 A — 首页**：传当前毫秒时间戳，或**传空串**。

抓包中两种都出现且返回完全一致（`timestamp=1786022292643` 与 `timestamp=` 的响应字节数同为 11493）。所以它**不是防缓存参数，语义是「取 report_date < timestamp 的记录」**，给一个未来时间即等价于"从最新开始"。

**用法 B — 续取**：传 `上一页最后一条的 report_date + 1`。

实测证据（`type=all`，`count=5`）：

| 请求 `timestamp` | 返回期次 | 末条 `report_date` |
| --- | --- | --- |
| `1786022292643`（当前时间） | 2026Q1 … 2025Q1 | `1743350400000` |
| `1743350400001` ← 上页末条 **+1** | 2025Q1 … 2024Q1 | `1711814400000` |
| `1711814400001` ← 上页末条 **+1** | 2024Q1 … 2023Q1 | `1680192000000` |
| `1680192000001` ← 上页末条 **+1** | 2023Q1 … 2022Q1 | `1648656000000` |

**边界语义**：`+1` 表明比较是**闭区间 `<=`**——若直接传末条的 `report_date` 会把该条重复返回。前端刻意 `+1` 来跳过。

**终止条件**：上游**不返回** `has_more` / `total` 一类字段。唯一可靠的终止判据是 **`data.list` 长度 < `count`** 或为空。

> **实现选型**：这是「入参驱动、需读取上一页返回值才能算出下一页游标」的形态 → 用 `@Paginated` + `stopWhen`。但注意 CLAUDE.md §2.5 的警告：`stopWhen(response, page, accumulated)` **拿不到 ctx**，读不到用户传的 `maxPages`。若要让用户控制页数，须在 `@Paginated` 上同时给 `maxPages`（装饰器级）并接受它是硬上限，或改用「先探首页拿到期次范围、再用 `@Expanded` 展开游标数组」的两段式。**不要用「装饰器给大上限 + 聚合层裁剪」**——那会实打实超发请求。

### 3.4 口径：累计值，非单季值

已验证（赛力斯 2025 年，单位元）：

| 期次 | `total_revenue` |
| --- | --- |
| 2025一季报 | 19,147,080,403.63 |
| 2025中报 | 62,401,722,813.80 |
| 2025三季报 | 110,534,420,761.80 |
| 2025年报 | 165,053,636,639.13 |

单调递增 → **每期都是年初至该期末的累计值**（中国证监会定期报告标准口径）。

> ⚠️ **投影层不得自行做单季差分**。若下游需要单季值，应作为显式能力提供并标注口径，绝不能悄悄改变 `total_revenue` 的含义。这也符合 §2 "统计口径只用上游给出的含义，不自造词"。

---

## 3.5 响应结构与字段字典（利润表）

### 3.5.1 `data` 外层

```jsonc
{
  "data": {
    "quote_name": "赛力斯",          // 标的名称
    "currency": "CNY",              // 币种代码
    "currency_name": "人民币",       // 币种中文名
    "org_type": 1,                  // 机构类型（1=一般工商企业；其余取值未验证）
    "last_report_name": "2026一季报", // 最新一期报告名
    "statuses": null,               // 抓包全程为 null，语义未知
    "list": [ /* 见 §4.2 */ ]
  }
}
```

> `org_type` 值得重视：银行/保险/券商的利润表科目与工商企业**完全不同**（如银行有"利息净收入"而无"营业成本"）。本次样本只有 `org_type: 1`，**其他类型的字段集未验证**，实现时不可假设字段集恒定。

### 3.5.2 `list[]` 元素：`[值, 同比]` 二元组

**除 `report_date` / `report_name` / `ctime` 三个标量外，其余 40 个字段全部是长度恒为 2 的数组**（已用 jq 校验：40 个数组字段，长度全为 2）。

```jsonc
{
  "report_date": 1774886400000,   // number，报告期末（毫秒，东八区零点）
  "report_name": "2026一季报",     // string
  "ctime": 1777463147000,         // number，该条数据入库时间（≈公告披露后）

  "total_revenue": [25745711786.75, 0.3446285931858831],
  //                ↑ [0] 本期值（元）  ↑ [1] 同比增长率
  "exchg_gain": [null, null]      // ← 该科目本期不适用/未披露
}
```

**二元组语义**（已验证）：

| 位置 | 含义 | 单位 | 说明 |
| --- | --- | --- | --- |
| `[0]` | 本期值 | **元**（人民币，见 `currency`） | 原始精度，含两位小数 |
| `[1]` | **同比增长率** | **小数**（`0.3446` = +34.46%） | ⚠️ **不是百分数**，回写前需 ×100 |

验证：赛力斯 2026Q1 营收 257.46 亿 vs 2025Q1 营收 191.47 亿 → `(257.46-191.47)/191.47 = 0.3446` ✅ 与 `[1]` 完全吻合。

> ⚠️ **`[1]` 与 CLAUDE.md §3.5「百分比保留原值」的关系**：该规范说的是"上游给 `0.5` 即 0.5%，不要 /100"。此处上游给的是**小数形态的比率**（0.3446 表示 34.46%），语义不同。投影层应**原样透传**并在 `units` / `meta.semantics` 中明确声明"同比为小数比率"，把换算交给消费方，避免二次转换歧义。

**`null` 语义**：`[null, null]` 表示**该科目本期不适用或未披露**，按 CLAUDE.md §3.5 必须映射为 `null`，**不得填 0**。

### 3.5.3 字段字典（40 项）

中文名与勾稽关系已依据实际数值验算（见 §4.4）。**置信度**列：`高` = 数值勾稽验证通过；`中` = 会计准则标准科目名推定，本样本数值不矛盾。

#### 营业总收入 / 成本

| 字段 | 推定中文名 | 置信度 | 备注 |
| --- | --- | --- | --- |
| `total_revenue` | 营业总收入 | 高 | 本样本与 `revenue` 完全相等 |
| `revenue` | 营业收入 | 高 | 工商企业二者相等；金融企业会分离，勿假设恒等 |
| `operating_costs` | 营业总成本 | 高 | 见 §4.4 勾稽 ① |
| `operating_cost` | 营业成本 | 高 | ⚠️ 与 `operating_costs` **只差一个 s**，极易混淆 |
| `operating_taxes_and_surcharge` | 税金及附加 | 高 | |
| `sales_fee` | 销售费用 | 高 | |
| `manage_fee` | 管理费用 | 高 | |
| `rad_cost` | 研发费用 | 高 | R&D |
| `financing_expenses` | 财务费用 | 高 | |
| `finance_cost_interest_fee` | 财务费用—利息费用 | 中 | |
| `finance_cost_interest_income` | 财务费用—利息收入 | 中 | |

#### 营业利润构成

| 字段 | 推定中文名 | 置信度 | 备注 |
| --- | --- | --- | --- |
| `other_income` | 其他收益 | 高 | 见 §4.4 勾稽 ② |
| `invest_income` | 投资收益 | 高 | |
| `invest_incomes_from_rr` | 对联营/合营企业的投资收益 | 中 | rr = related relation |
| `income_from_chg_in_fv` | 公允价值变动收益 | 高 | |
| `credit_impairment_loss` | 信用减值损失 | 高 | ⚠️ 本样本为**负数**（-352 万）而 `asset_impairment_loss` 为正 —— 两者符号约定不一致，见 §4.4 ② |
| `asset_impairment_loss` | 资产减值损失 | 高 | 本样本为正数，勾稽时须**减去** |
| `asset_disposal_income` | 资产处置收益 | 高 | |
| `exchg_gain` | 汇兑收益 | 中 | 本样本全为 `null` |
| `op` | **营业利润** | 高 | operating profit，见勾稽 ② |

#### 利润总额 / 净利润

| 字段 | 推定中文名 | 置信度 | 备注 |
| --- | --- | --- | --- |
| `non_operating_income` | 营业外收入 | 高 | |
| `non_operating_payout` | 营业外支出 | 高 | |
| `noncurrent_assets_dispose_gain` | 非流动资产处置利得 | 中 | |
| `noncurrent_asset_disposal_loss` | 非流动资产处置损失 | 中 | |
| `profit_total_amt` | **利润总额** | 高 | 见勾稽 ③ |
| `income_tax_expenses` | 所得税费用 | 高 | 见勾稽 ④ |
| `net_profit` | **净利润** | 高 | 含少数股东损益 |
| `continous_operating_np` | 持续经营净利润 | 高 | 本样本 == `net_profit`（无终止经营） |
| `net_profit_bi` | 终止经营净利润 | 中 | 本样本全 `null`，佐证上一条 |
| `net_profit_atsopc` | **归属于母公司股东的净利润** | 高 | atsopc = attributable to shareholders of parent company，见勾稽 ⑤ |
| `minority_gal` | 少数股东损益 | 高 | gal = gain and loss |
| `net_profit_after_nrgal_atsolc` | 归母**扣非**净利润 | 高 | nrgal = non-recurring gain and loss |

#### 每股收益

| 字段 | 推定中文名 | 置信度 | 备注 |
| --- | --- | --- | --- |
| `basic_eps` | 基本每股收益 | 高 | 单位**元/股**，与其余字段单位不同 |
| `dlt_earnings_per_share` | 稀释每股收益 | 高 | 同上 |

> ⚠️ **单位陷阱**：`basic_eps` / `dlt_earnings_per_share` 的 `[0]` 是元/股（如 `0.43`），其余金额字段是元（如 `25745711786.75`）。投影层若统一做"万/亿"分档格式化，**必须排除这两个字段**。

#### 综合收益

| 字段 | 推定中文名 | 置信度 |
| --- | --- | --- |
| `othr_compre_income` | 其他综合收益 | 高 |
| `othr_compre_income_atoopc` | 归属母公司的其他综合收益 | 中 |
| `othr_compre_income_atms` | 归属少数股东的其他综合收益 | 中 |
| `total_compre_income` | 综合收益总额 | 高 |
| `total_compre_income_atsopc` | 归属母公司的综合收益总额 | 中 |
| `total_compre_income_atms` | 归属少数股东的综合收益总额 | 中 |

### 3.5.4 勾稽关系（用赛力斯 2026Q1 实数验算）

这些等式是**字段语义的硬证据**，也可作为投影层的校验断言：

**① 营业总成本**（差额 = 其他未单列科目，如信用减值等）

```
operating_cost                18,990,470,700.37
+ operating_taxes_and_surcharge  528,873,300.52
+ sales_fee                    3,718,989,331.35
+ manage_fee                     736,477,052.83
+ rad_cost                     1,793,557,041.70
+ financing_expenses              95,813,795.68
                             ─────────────────
                              25,864,181,222.45  == operating_costs ✅ 完全吻合
```

**② 营业利润**

```
total_revenue                 25,745,711,786.75
- operating_costs             25,864,181,222.45
+ other_income                   909,719,742.83
+ invest_income                   41,865,166.44
+ income_from_chg_in_fv           22,342,998.05
+ credit_impairment_loss          -3,527,617.58   ← 本身为负，直接相加
- asset_impairment_loss           52,413,715.72   ← 本身为正，须减去
+ asset_disposal_income           -1,014,345.93
                             ─────────────────
                                 798,502,795.39
op（上游给出）                    805,558,027.55
差额                               7,055,232.16   ← 约 0.9%，为未单列科目
```

> ⚠️ **`credit_impairment_loss` 与 `asset_impairment_loss` 符号约定相反**（前者负、后者正）。这是上游的既有形态，投影层**不要"顺手统一符号"**——那会静默改变数据含义。原样透传，在字段说明里注明。

**③ 利润总额**

```
op                               805,558,027.55
+ non_operating_income            48,390,474.04
- non_operating_payout             5,089,352.55
                             ─────────────────
                                 848,859,149.04  == profit_total_amt ✅ 完全吻合
```

**④ 净利润**

```
profit_total_amt                 848,859,149.04
- income_tax_expenses            238,313,832.11
                             ─────────────────
                                 610,545,316.93  == net_profit ✅ 完全吻合
```

**⑤ 归母拆分**

```
net_profit_atsopc                754,464,672.82
+ minority_gal                  -143,919,355.89
                             ─────────────────
                                 610,545,316.93  == net_profit ✅ 完全吻合
```

> ⑤ 揭示了一个易错点：`minority_gal` 为**负**（少数股东亏损 1.44 亿），所以**归母净利润高于合并净利润**。回写时若写成"净利润 7.54 亿"会张冠李戴——必须明确区分「净利润」与「归母净利润」。

---

## 4. 端点：资产负债表

```
GET https://stock.xueqiu.com/v5/stock/finance/cn/balance.json
```

**与利润表的关系**：入参、信封、`data` 外层键、翻页机制、鉴权**完全一致**（见 §2.0）。
本节只写差异：`type` 多出 `S` 系列（§4.2）、口径是**时点存量**而非期间累计（§4.3）、字段集不同（§4.5）。

### 4.1 入参

与利润表**完全相同**的五个参数：`symbol` / `type` / `is_detail` / `count` / `timestamp`。
`timestamp` 游标语义、`+1` 规则、终止判据均与 §3.3 一致，不再重复。

**本 HAR 新增的边界证据**（利润表 HAR 未覆盖）：

`type=Q2` 翻到最后一页时返回 **4 条 < `count=5`**（2017/2016/2015/2014 中报），
上游**截断返回而非报错**。这实证了「`list.length < count` 即终止」的判据可靠。

### 4.2 ⚠️ `type` 多出 `S0`–`S4`：单季口径

这是本次分析**最重要的发现**。资产负债表 HAR 中出现了利润表 HAR 完全没有的五个取值：

| 取值 | `report_name` 措辞 | 语义 |
| --- | --- | --- |
| `all` / `Q1` / `Q2` / `Q3` / `Q4` | 「2026一季**报**」 | **定期报告口径**（年初至今累计） |
| `S0` | 「2026一季**度**」 | 全部期次的**单季**值，倒序 |
| `S1` / `S2` / `S3` / `S4` | 「2026一季**度**」 | 仅第 N 季度的**单季**值 |

**唯一的文本区分是「报」vs「度」**——极易看漏。

**`S` 系列 = 相邻期累计值的机械差分**，已验算（赛力斯 `total_assets`，单位亿元）：

```
S0「2025四季度」 22,399,968,216.45
  = 2025年报 143,905,863,420.75 − 2025三季报 121,505,895,204.30  ✅ 精确吻合

S2「2025二季度」 14,202,139,718.56
  = 2025中报  112,911,810,263.11 − 2025一季报  98,709,670,544.55  ✅ 精确吻合
```

`S1`（一季度）因无需差分，数值与 `Q1` **完全相同**（已逐期比对 2022–2026 五期，
`total_assets`、`currency_funds` 全部一致），仅 `report_name` 措辞不同。

### 4.3 🔴 `S` 系列用在资产负债表上是**语义错误的**

利润表是**期间流量表**（营收、利润），差分得到单季值**有意义**。
但资产负债表是**时点存量表**（某日的资产、负债余额），**对存量做差分得到的是「变动额」，不是「余额」**。

上游显然是对全族端点套用了同一套差分逻辑，未区分流量表/存量表。后果是荒谬数据：

| 证据 | 数值 | 为何荒谬 |
| --- | --- | --- |
| `S2`「2023二季度」`total_assets` | **−7,358,094,375.04** | **负的总资产**，会计上不存在 |
| `S0`「2025四季度」`asset_liab_ratio` | **−0.0545**（−5.45%） | **负的资产负债率**，无意义 |
| `S0`「2025四季度」`total_assets` | 22,399,968,216.45 | 实际是「四季度总资产**增加了** 224 亿」，不是「总资产 224 亿」 |

> 🔴 **实现红线**：`balance.json` **不应向用户暴露 `S` 系列**，或必须在返回中
> 极醒目地标注「本组数值为相邻期差额（变动额），非时点余额；比率类字段无意义」。
>
> 让 Agent 拿到「总资产 −73.58 亿」而不加解释，会直接产出错误的分析结论。
> 这比返回空数据危险得多——**它看起来完全正常**。
>
> 对 `income.json` 则相反：`S` 系列若可用，正是「单季利润」这一高价值口径，应当支持。

### 4.4 口径对照（与利润表的根本差异）

| | 利润表 `income.json` | 资产负债表 `balance.json` |
| --- | --- | --- |
| 表类型 | **期间流量表** | **时点存量表** |
| `Q`/`all` 口径 | 年初至该期末**累计发生额** | 该期末**时点余额** |
| 期间可加性 | ✅ 可加（Q1+Q2 有意义） | ❌ **不可加** |
| 差分（`S` 系列）| ✅ 有意义 = 单季发生额 | ❌ **无意义** = 期间变动额 |
| 验证 | 191→624→1105→1650 亿单调递增（累计特征） | 987→1129→1215→1439 亿（余额自然增长，非累计） |

> ⚠️ 注意资产负债表的数值**看起来也在递增**，容易误判为累计口径。
> 区分依据是**表的性质**，不是数值趋势——2023 年就出现过中报总资产（370 亿）
> 低于一季报（444 亿）的情况，累计口径不可能下降。

### 4.5 字段字典（88 项 + 2 标量）

`list[]` 共 **90 个字段**（利润表 43）。除 `report_date` / `report_name` 外全部是 `ValueWithYoY` 二元组。

> ⚠️ **`ctime` 在资产负债表中恒为 `null`**（利润表有值，如 `1777463147000`）。
> 同名字段跨端点行为不同，不要假设一致。

#### 4.5.1 核心汇总项（勾稽全部验证通过）

| 字段 | 推定中文名 | 置信度 |
| --- | --- | --- |
| `total_assets` | **资产总计** | 高 |
| `total_liab` | **负债合计** | 高 |
| `total_holders_equity` | **所有者权益合计**（含少数股东） | 高 |
| `total_liab_and_holders_equity` | 负债和所有者权益总计 | 高 |
| `total_current_assets` | 流动资产合计 | 高 |
| `total_noncurrent_assets` | 非流动资产合计 | 高 |
| `total_current_liab` | 流动负债合计 | 高 |
| `total_noncurrent_liab` | 非流动负债合计 | 高 |
| `total_quity_atsopc` | **归属于母公司股东权益合计**（注意上游拼写 `quity` 缺 e） | 高 |
| `minority_equity` | 少数股东权益 | 高 |
| `asset_liab_ratio` | **资产负债率** | 高 |

**五组勾稽验算**（赛力斯 2026Q1，全部精确吻合）：

```
① total_liab + total_holders_equity          = total_assets                    ✅
   81,577,828,433.66 + 42,170,036,604.68      = 123,747,865,038.34
② total_current_assets + total_noncurrent_assets = total_assets                ✅
③ total_current_liab + total_noncurrent_liab = total_liab                      ✅
④ total_quity_atsopc + minority_equity       = total_holders_equity            ✅
⑤ total_liab / total_assets                  = asset_liab_ratio                ✅
   81,577,828,433.66 / 123,747,865,038.34     = 0.659226148333026（完全一致到末位）
```

> ⑤ 证实 **`asset_liab_ratio` 是小数**（`0.659` = 65.9%），与二元组的同比一样**不是百分数**。

#### 4.5.2 ⚠️ 单位不是「元」的字段

| 字段 | 单位 | 说明 |
| --- | --- | --- |
| `asset_liab_ratio` | **小数比率** | `0.659` = 65.9%，格式化时须排除金额处理 |
| `shares` | **元**（不是股！） | 见下方警告 |

> 🔴 **`shares` 是股本金额（元），不是股数** —— 这个坑极其隐蔽。
>
> 字段名 `shares` 强烈暗示"股数"，赛力斯该值 `1,741,985,086` 看起来也确实像"17.42 亿股"。
> 但归母权益构成勾稽证明它是**金额**：
>
> ```
> shares 1,741,985,086.00 + capital_reserve 37,030,444,558.60
>   + earned_surplus 595,120,048.80 + undstrbtd_profit 1,777,233,986.07
>   + special_reserve 111,066,918.11 + othr_compre_income 54,326,795.01
> = 41,310,177,392.59  == total_quity_atsopc ✅（差额仅 7.6e-06 浮点误差）
> ```
>
> 它作为加数直接参与了金额求和 —— 若是股数，量纲不可能对上。
>
> 之所以数值与股数相同，是因为赛力斯**股本面值 1 元/股**（A 股通例），
> 于是「股本金额 = 股数 × 1 元」。**对面值非 1 元的标的两者会不同**，
> 把它当股数用会静默算错每股指标。

#### 4.5.3 ⚠️ 易混字段对（上游命名陷阱）

| 字段对 | 本样本取值 | 陷阱 |
| --- | --- | --- |
| `fixed_asset` / `fixed_asset_sum` | `null` / 143.56 亿 | **裸名为 null，`_sum` 才有值** |
| `construction_in_process` / `construction_in_process_sum` | `null` / 8.61 亿 | 同上 |
| `lt_payable` / `lt_payable_sum` | `null` / `0.0` | 同上，且 `_sum` 是真实的 0 |
| `salable_financial_assets` / `saleable_finacial_assets` | `null` / `null` | **两个拼写变体并存**，后者上游拼错（`finacial` 缺 n） |
| `ar_and_br` / `account_receivable` / `bills_receivable` | 14.86 亿 / 14.86 亿 / `null` | `ar_and_br` = 应收账款及应收票据合计 |
| `bp_and_ap` / `accounts_payable` / `bill_payable` | 626.50 亿 / 211.32 亿 / 415.18 亿 | `bp_and_ap` = 应付票据及应付账款；**211.32 + 415.18 = 626.50** ✅ |

> ⚠️ **`_sum` 后缀的取舍**：本样本中裸名字段恒为 `null`、`_sum` 才有值，
> 但这**可能是该公司/该期的披露口径所致**，不能断定"裸名字段永远无用"。
> 投影层建议两个都保留并透传，由消费方按 `?? ` 取值，不要在采集侧擅自二选一。
>
> ⚠️ **`saleable_finacial_assets` 的拼写错误必须原样保留**——那是上游的真实字段名。
> "顺手改对"会导致取不到值。

#### 4.5.4 资产类字段

**流动资产**：`currency_funds`（货币资金）、`tradable_fnncl_assets`（交易性金融资产）、
`bills_receivable`（应收票据）、`account_receivable`（应收账款）、`ar_and_br`（应收票据及应收账款）、
`pre_payment`（预付款项）、`interest_receivable`（应收利息）、`dividend_receivable`（应收股利）、
`othr_receivables`（其他应收款）、`inventory`（存货）、`contractual_assets`（合同资产）、
`to_sale_asset`（持有待售资产）、`nca_due_within_one_year`（一年内到期的非流动资产）、
`othr_current_assets`（其他流动资产）、`current_assets_si`（流动资产特殊项目）

**非流动资产**：`salable_financial_assets` / `saleable_finacial_assets`（可供出售金融资产）、
`held_to_maturity_invest`（持有至到期投资）、`lt_receivable`（长期应收款）、
`lt_equity_invest`（长期股权投资）、`other_eq_ins_invest`（其他权益工具投资）、
`invest_property`（投资性房地产）、`fixed_asset` / `fixed_asset_sum`（固定资产）、
`construction_in_process` / `construction_in_process_sum`（在建工程）、
`project_goods_and_material`（工程物资）、`fixed_assets_disposal`（固定资产清理）、
`productive_biological_assets`（生产性生物资产）、`oil_and_gas_asset`（油气资产）、
`intangible_assets`（无形资产）、`dev_expenditure`（开发支出）、`goodwill`（商誉）、
`lt_deferred_expense`（长期待摊费用）、`dt_assets`（递延所得税资产）、
`othr_illiquid_fnncl_assets` → 实为 `other_illiquid_fnncl_assets`（其他非流动金融资产）、
`othr_noncurrent_assets`（其他非流动资产）、`noncurrent_assets_si`（非流动资产特殊项目）

#### 4.5.5 负债类字段

**流动负债**：`st_loan`（短期借款）、`tradable_fnncl_liab`（交易性金融负债）、
`derivative_fnncl_liab`（衍生金融负债）、`bill_payable`（应付票据）、
`accounts_payable`（应付账款）、`bp_and_ap`（应付票据及应付账款）、
`pre_receivable`（预收款项）、`contract_liabilities`（合同负债）、
`payroll_payable`（应付职工薪酬）、`tax_payable`（应交税费）、
`interest_payable`（应付利息）、`dividend_payable`（应付股利）、
`othr_payables`（其他应付款）、`to_sale_debt`（持有待售负债）、
`noncurrent_liab_due_in1y`（一年内到期的非流动负债）、
`othr_current_liab`（其他流动负债）、`current_liab_si`（流动负债特殊项目）

**非流动负债**：`lt_loan`（长期借款）、`bond_payable`（应付债券）、
`perpetual_bond`（永续债）、`lt_payable` / `lt_payable_sum`（长期应付款）、
`special_payable`（专项应付款）、`estimated_liab`（预计负债）、
`dt_liab`（递延所得税负债）、`othr_non_current_liab`（其他非流动负债）、
`noncurrent_liab_si`（非流动负债特殊项目）、`noncurrent_liab_di`（非流动负债递延收益，推定）

#### 4.5.6 所有者权益类字段

| 字段 | 推定中文名 | 本样本值 |
| --- | --- | --- |
| `shares` | **股本（金额，元）** | 17.42 亿 |
| `othr_equity_instruments` | 其他权益工具 | `null` |
| `capital_reserve` | 资本公积 | 370.30 亿 |
| `treasury_stock` | 库存股 | `null` |
| `othr_compre_income` | 其他综合收益 | 0.54 亿 |
| `special_reserve` | 专项储备 | 1.11 亿 |
| `earned_surplus` | 盈余公积 | 5.95 亿 |
| `general_risk_provision` | 一般风险准备 | `null` |
| `undstrbtd_profit` | 未分配利润 | 17.77 亿 |
| `frgn_currency_convert_diff` | 外币报表折算差额 | `null` |

> ⚠️ **`othr_compre_income` 是两表唯一的同名业务字段，但语义不同**：
> 利润表中是「本期其他综合收益**发生额**」，资产负债表中是「其他综合收益**累计余额**」。
> 两表交集仅 4 个字段：`report_date` / `report_name` / `ctime` / `othr_compre_income`，
> 前三者是元数据，**只有 `othr_compre_income` 是业务字段且含义不同**——
> 若做跨表合并（如按报告期 join），此字段会静默冲突。

---

## 5. 端点：现金流量表

```
GET https://stock.xueqiu.com/v5/stock/finance/cn/cash_flow.json
```

**与另两表的关系**：入参、信封、`data` 外层 7 键、翻页机制、鉴权**完全一致**（§2.0）。
字段数 41（income 43 / balance 90），是三表中最少的。

### 5.1 口径：期间流量（与利润表同类）

现金流量表是**期间流量表**，`Q`/`all` 口径为「年初至该期末的累计发生额」。

已验证（赛力斯 2025 年 `ncf_from_oa` 经营活动现金流净额）：

| 期次 | 累计值 |
| --- | --- |
| 2025一季报 | −76.30 亿 |
| 2025中报 | +144.37 亿 |
| 2025三季报 | +226.49 亿 |
| 2025年报 | +289.14 亿 |

> ⚠️ 注意本表累计值**可以下降甚至为负**（经营现金流本身可正可负），
> 不能像利润表那样用「单调递增」来判定累计口径。

### 5.2 ✅ `S` 系列在本表**语义正确**（与资产负债表相反）

这印证了 §2.8 的判据：对**期间流量**做差分得到单季发生额，是有意义的。

已验算（`ncf_from_oa`）：

```
S0「2025四季度」 6,264,296,304.74
  = 2025年报 28,913,743,329.24 − 2025三季报 22,649,447,024.50   ✅ 精确吻合
```

`S1` 与 `Q1` 数值**完全相同**（一季度无需差分，已逐期比对 2022–2026 五期），
仅 `report_name` 措辞不同（「一季**度**」vs「一季**报**」）。

`S4`（四季度）= 年报 − 三季报，是**上市公司不单独披露的 Q4 单季数据**，
对分析季度环比很有价值。

### 5.3 🔴 但本表有 2 个字段在 `S` 口径下失真

**现金流量表不是纯流量表** —— 它混着 2 个**时点余额**字段，差分后同样荒谬
（下表一并列出相邻的 `net_increase_in_cce` 作对照，它是流量字段，差分正确）：

| 字段 | 性质 | `S` 口径下的表现 |
| --- | --- | --- |
| `initial_balance_of_cce` | 期初现金余额（**时点**） | **恒变成 `0.0`**（Q2–Q4） |
| `final_balance_of_cce` | 期末现金余额（**时点**） | **退化成等于当季净增额** |
| `net_increase_in_cce` | 本期现金净增加额（流量） | ✅ 正确 |

实测证据（`type=S0`）：

| 期次 | 期初 | 期末 | 净增 |
| --- | --- | --- | --- |
| 2026一季度 | 483.63 亿 | 221.49 亿 | −262.15 亿 | ← **正确**（S1 无需差分） |
| 2025四季度 | **0.0** | 216.79 亿 | 216.79 亿 | ← 期末 == 净增，**失真** |
| 2025三季度 | **0.0** | 50.19 亿 | 50.19 亿 | ← 同上 |
| 2025二季度 | **0.0** | 118.46 亿 | 118.46 亿 | ← 同上 |
| 2025一季度 | 63.34 亿 | 98.19 亿 | 34.85 亿 | ← **正确**（Q1 无需差分） |

对照 `all` 口径的真实值：2025四季度末现金应为 **483.63 亿**，而非 216.79 亿。

> 🔴 **这是比资产负债表更隐蔽的坑**。balance 的 `S` 系列会产出负的总资产，
> 一眼就知道有问题；而这里 `final_balance_of_cce` 退化后仍是个**正的、量级合理的数字**，
> 从结果完全看不出错误 —— 但它把「期末余额」悄悄换成了「当季净增」。
>
> **实现要求**：`type=S*` 时，`initial_balance_of_cce` / `final_balance_of_cce`
> 必须**置 `null` 并标注不可用**，或整体拒绝 `S` 系列。
> 绝不能原样透传 —— Agent 会把 216.79 亿当成期末现金报给用户。

### 5.4 字段字典（38 项 + 3 标量）

`list[]` 共 **41 个字段**：`report_date` / `report_name` / `ctime` 三个标量 + 38 个二元组。

> ⚠️ **`ctime` 恒为 `null`**（与 `balance.json` 一致；三表中只有 `income.json` 有值）。

**命名规律**（掌握后字段自解释）：

| 缩写 | 含义 |
| --- | --- |
| `oa` | operating activities，经营活动 |
| `ia` | investing activities，投资活动 |
| `fa` | financing activities，筹资活动 |
| `ci` | cash inflow，现金流入 |
| `cos` | cash outflow，现金流出 |
| `ncf` | net cash flow，现金流量净额 |
| `cce` | cash and cash equivalents，现金及现金等价物 |

于是 `sub_total_of_ci_from_oa` = 经营活动现金流入小计，`ncf_from_ia` = 投资活动现金流量净额。

#### 5.4.1 三大活动汇总（全部勾稽验证）

| 字段 | 推定中文名 | 置信度 |
| --- | --- | --- |
| `sub_total_of_ci_from_oa` | 经营活动现金流入小计 | 高 |
| `sub_total_of_cos_from_oa` | 经营活动现金流出小计 | 高 |
| `ncf_from_oa` | **经营活动产生的现金流量净额** | 高 |
| `sub_total_of_ci_from_ia` | 投资活动现金流入小计 | 高 |
| `sub_total_of_cos_from_ia` | 投资活动现金流出小计 | 高 |
| `ncf_from_ia` | **投资活动产生的现金流量净额** | 高 |
| `sub_total_of_ci_from_fa` | 筹资活动现金流入小计 | 高 |
| `sub_total_of_cos_from_fa` | 筹资活动现金流出小计 | 高 |
| `ncf_from_fa` | **筹资活动产生的现金流量净额** | 高 |

#### 5.4.2 经营活动明细

| 字段 | 推定中文名 |
| --- | --- |
| `cash_received_of_sales_service` | 销售商品、提供劳务收到的现金 |
| `refund_of_tax_and_levies` | 收到的税费返还 |
| `cash_received_of_othr_oa` | 收到其他与经营活动有关的现金 |
| `goods_buy_and_service_cash_pay` | 购买商品、接受劳务支付的现金 |
| `cash_paid_to_employee_etc` | 支付给职工以及为职工支付的现金 |
| `payments_of_all_taxes` | 支付的各项税费 |
| `othrcash_paid_relating_to_oa` | 支付其他与经营活动有关的现金 |

#### 5.4.3 投资活动明细

| 字段 | 推定中文名 |
| --- | --- |
| `cash_received_of_dspsl_invest` | 收回投资收到的现金（dspsl = disposal） |
| `invest_income_cash_received` | 取得投资收益收到的现金 |
| `net_cash_of_disposal_assets` | 处置固定/无形/其他长期资产收回的现金净额 |
| `net_cash_of_disposal_branch` | 处置子公司及其他营业单位收到的现金净额 |
| `cash_received_of_othr_ia` | 收到其他与投资活动有关的现金 |
| `cash_paid_for_assets` | 购建固定/无形/其他长期资产支付的现金 |
| `invest_paid_cash` | 投资支付的现金 |
| `net_cash_amt_from_branch` | 取得子公司及其他营业单位支付的现金净额 |
| `othrcash_paid_relating_to_ia` | 支付其他与投资活动有关的现金 |

#### 5.4.4 筹资活动明细

| 字段 | 推定中文名 |
| --- | --- |
| `cash_received_of_absorb_invest` | 吸收投资收到的现金 |
| `cash_received_from_investor` | 其中：子公司吸收少数股东投资收到的现金 |
| `cash_received_of_borrowing` | 取得借款收到的现金 |
| `cash_received_from_bond_issue` | 发行债券收到的现金 |
| `cash_received_of_othr_fa` | 收到其他与筹资活动有关的现金 |
| `cash_pay_for_debt` | 偿还债务支付的现金 |
| `cash_paid_of_distribution` | 分配股利、利润或偿付利息支付的现金 |
| `branch_paid_to_minority_holder` | 其中：子公司支付给少数股东的股利、利润 |
| `othrcash_paid_relating_to_fa` | 支付其他与筹资活动有关的现金 |

#### 5.4.5 现金余额（⚠️ 含时点字段）

| 字段 | 推定中文名 | 性质 | `S` 口径 |
| --- | --- | --- | --- |
| `effect_of_exchange_chg_on_cce` | 汇率变动对现金及现金等价物的影响 | 流量 | ✅ |
| `net_increase_in_cce` | 现金及现金等价物净增加额 | 流量 | ✅ |
| `initial_balance_of_cce` | 期初现金及现金等价物余额 | **时点** | ❌ 见 §5.3 |
| `final_balance_of_cce` | 期末现金及现金等价物余额 | **时点** | ❌ 见 §5.3 |

### 5.5 勾稽关系（赛力斯 2026Q1 实数，八组全部精确吻合）

```
① 经营流入明细 → 小计
   销售商品 269.84 亿 + 退税 1.10 亿 + 其他 6.38 亿 = 277.32 亿  == sub_total_of_ci_from_oa ✅
② 经营流出明细 → 小计
   购买商品 353.22 亿 + 职工 25.22 亿 + 税费 18.51 亿 + 其他 89.87 亿 = 486.82 亿
                                                          == sub_total_of_cos_from_oa ✅
③ 经营净额     277.32 − 486.82 = −209.50 亿  == ncf_from_oa ✅
④ 投资流入明细 → 小计                        == sub_total_of_ci_from_ia ✅
⑤ 投资流出明细 → 小计                        == sub_total_of_cos_from_ia ✅
⑥ 投资净额     294.20 − 337.72 = −43.52 亿   == ncf_from_ia ✅
⑦ 筹资净额     0.72 − 6.94   = −6.23 亿      == ncf_from_fa ✅
⑧ 现金净增加额
   ncf_from_oa + ncf_from_ia + ncf_from_fa = −259.25 亿
   + effect_of_exchange_chg_on_cce −2.90 亿  = −262.15 亿  == net_increase_in_cce ✅
⑨ 期末余额
   initial_balance_of_cce 483.63 亿 + net_increase_in_cce −262.15 亿
                                            = 221.49 亿  == final_balance_of_cce ✅
```

> 这九组等式可直接作为投影层的校验断言 —— 若某期不成立，说明该 `org_type`
> 的科目结构不同（如金融企业），需要单独处理而非硬套。

### 5.6 ⚠️ 现金口径与资产负债表「货币资金」不同

| 来源 | 字段 | 2026Q1 值 |
| --- | --- | --- |
| `balance.json` | `currency_funds`（货币资金） | **638.54 亿** |
| `cash_flow.json` | `final_balance_of_cce`（期末现金及现金等价物） | **221.49 亿** |

差额 417 亿。**这不是数据错误**，而是标准的会计口径差异：
货币资金含受限资金（保证金、冻结存款等），现金等价物不含。

> ⚠️ 若下游把两者混用（如"现金余额"只取其一），会得出严重偏离的结论。
> 投影层应保留各自的原始字段名与出处，不要归并成一个笼统的"现金"。

### 5.7 跨表字段交集

`cash_flow.json` 与另两表的字段交集**只有 3 个元数据字段**：
`report_date` / `report_name` / `ctime`，**无业务字段冲突**。

> 对比：`income.json` 与 `balance.json` 有一个同名业务字段 `othr_compre_income`
> 但语义不同（发生额 vs 累计余额），跨表 join 会冲突（见 §4.5.6）。
> 现金流量表无此问题。

---

## 6. 端点：主要财务指标

```
GET https://stock.xueqiu.com/v5/stock/finance/cn/indicator.json
```

**与三张报表的根本区别**：前三个端点是**原始报表**（上游披露的科目原值），
本端点是**衍生指标**（由报表数据计算出的比率、每股值、周转率）。

这带来三个特有问题，都会静默产出错误结论：
**单位在同一张表内不统一**（§6.3）、**同名字段与报表口径冲突**（§6.4）、
**字段名与实际语义不符**（§6.5）。

### 6.1 入参：无 `S` 系列

入参五个与其它端点一致，但 **HAR 中只出现 `all` / `Q1` / `Q2` / `Q3` / `Q4`，
没有 `S0`–`S4`**。

这符合逻辑——衍生指标是比率，对比率做差分没有意义（如"本季度的资产负债率
减去上季度的资产负债率"不是任何有效指标）。

> ⚠️ 但**不能据此断定上游不接受 `S` 系列**（未实测）。按 CLAUDE.md §3.6，
> 仍然只做形状校验、不做白名单拦截。若上游确实返回了 `S` 数据，
> 那些数值大概率是无意义的差分产物，应参照 §2.8 处理。

### 6.2 翻页：历史最深，且早期数据不完整

本 HAR 的翻页链最长（一路翻到 2011 年，14 次请求）。末页证据：

```
timestamp=1364659200001 → 返回 3 条（< count=5）
   期次：2013一季报 / 2012年报 / 2011年报
```

⚠️ **期次出现跳跃**：2013Q1 之后直接跳到 2012 年报、2011 年报，
中间的 2012 三季报/中报/一季报**缺失**。

> 早期数据不完整是上游的真实状态，**不是采集失败**。
> 回写时不要假设期次连续，也不要用"缺失=0"填补。

### 6.3 🔴 单位在同一张表内不统一（本表最大陷阱）

这是本端点与三张报表最危险的差异。报表的金额字段统一是「元」、同比统一是小数；
而本表**混着四种单位**，且**无法从字段名判断**：

| 单位类型 | 示例字段 | 示例值 | 含义 |
| --- | --- | --- | --- |
| **百分数** | `asset_liab_ratio` | `65.9226` | 65.92%（**不是 0.659**） |
| | `gross_selling_rate` | `26.2383` | 毛利率 26.24% |
| | `avg_roe` / `ore_dlt` | `1.83` | ROE 1.83% |
| | `holder_equity` | `34.0774` | 权益占比 34.08% |
| | `operating_income_yoy` | `34.4629` | 营收同比 +34.46% |
| **小数比率** | `ncf_from_oa_to_total_liab` | `-0.2568` | −25.68%（**不是 −0.26%**） |
| **倍数** | `current_ratio` | `1.0687` | 流动比率 1.07 倍 |
| | `equity_multiplier` | `2.9345` | 权益乘数 2.93 倍 |
| | `inventory_turnover` | `8.6251` | 存货周转 8.63 次 |
| **元 / 元每股** | `total_revenue` | `25745711786.75` | 营收（元） |
| | `np_per_share` | `23.7144` | 每股净资产（元/股） |

> 🔴 **`asset_liab_ratio` 65.9226 与 `ncf_from_oa_to_total_liab` −0.2568
> 在同一行里，一个是百分数一个是小数** —— 若投影层统一按某一种处理，
> 必然有一半字段错 100 倍。
>
> **实现要求**：必须为每个字段显式声明单位（`units` 字典），
> 不得靠数值范围或字段名后缀猜测。§6.6 的字段表给出了逐项单位。

### 6.4 🔴 跨表同名字段：4 个同义、2 个冲突

本端点与三张报表有 6 个同名业务字段，**必须分两类对待**：

#### ✅ 与 `income.json` 同名的 4 个：数值完全一致（同义）

| 字段 | indicator | income | 判定 |
| --- | --- | --- | --- |
| `total_revenue` | 25745711786.75 | 25745711786.75 | ✅ 完全一致 |
| `net_profit_atsopc` | 754464672.82 | 754464672.82 | ✅ |
| `net_profit_after_nrgal_atsolc` | 102900401.65 | 102900401.65 | ✅ |
| `basic_eps` | 0.43 | 0.43 | ✅ |

这 4 个是原始金额的**直接搬运**，跨表 join 安全。

#### ❌ 与 `balance.json` 同名的 2 个：语义/单位冲突

| 字段 | indicator | balance | 冲突类型 |
| --- | --- | --- | --- |
| `asset_liab_ratio` | **65.9226** | **0.659226148333026** | **单位差 100 倍**，且 indicator 精度被截断至 4 位 |
| `capital_reserve` | **21.2576** | **37030444558.6** | **语义完全不同** |

**`capital_reserve` 的冲突已精确验证**：

```
balance 资本公积总额 37,030,444,558.6 ÷ 股本 1,741,985,086
  = 21.2576  == indicator.capital_reserve  ✅
```

即 indicator 的 `capital_reserve` 是「**每股**资本公积（元/股）」，
balance 的是「资本公积**总额**（元）」。同名、异义、异量纲。

> 🔴 **跨表按报告期 join 时这 2 个字段会静默产生错误数据**。
> 若下游做 `{...balanceRow, ...indicatorRow}` 一类合并，
> `capital_reserve` 会被 21.2576 覆盖掉 370 亿的真实值，而**不会有任何报错**。
>
> 实现上必须为 indicator 的字段加命名空间前缀，或显式排除这 2 个字段。

### 6.5 ⚠️ 三个字段名与实际语义不符

| 字段 | 望文生义 | **实际语义**（已验证） |
| --- | --- | --- |
| `np_per_share` | 每股净**利润** | **每股净资产**（归母权益 ÷ 股本 = 23.7144）。`np` = net property，不是 net profit |
| `holder_equity` | 股东权益**金额** | **权益比率**（全部权益 ÷ 总资产 × 100 = 34.0774%） |
| `capital_reserve` | 资本公积总额 | **每股**资本公积（见 §6.4） |

`holder_equity` 的验证：`34.0774 + asset_liab_ratio 65.9226 = 100.0000`，
与资产负债率恰好互补 ✅

> ⚠️ **`np_per_share` 尤其危险**：赛力斯 2026Q1 每股净资产 23.71 元、
> 每股收益（`basic_eps`）0.43 元，相差 55 倍。
> 把它当"每股净利润"报给用户会得出荒谬的估值结论。

### 6.6 字段字典（35 项 + 3 标量）

`list[]` 共 **38 个字段**：`report_date` / `report_name` / `ctime` 三个标量 + 35 个二元组。

> `ctime` **有值**（如 `1777463147000`）—— 与 `income.json` 一致；
> `balance.json` / `cash_flow.json` 的同名字段恒为 `null`。

#### 6.6.1 盈利能力

| 字段 | 中文名 | 单位 | 验证 |
| --- | --- | --- | --- |
| `avg_roe` | 净资产收益率（**平均**口径） | % | 归母净利 ÷ 平均归母权益 = 1.835 ≈ 1.83 |
| `ore_dlt` | 净资产收益率（**摊薄**口径，dlt = diluted） | % | 归母净利 ÷ **期末**归母权益 = 1.8263 ✅ 精确 |
| `net_interest_of_total_assets` | 总资产净利率 | % | 净利润 ÷ **平均**总资产 = 0.45622 ✅ 精确 |
| `gross_selling_rate` | 毛利率 | % | (营收 − 营业成本) ÷ 营收 = 26.2383 ✅ 精确 |
| `net_selling_rate` | 净利率 | % | **净利润**（非归母）÷ 营收 = 2.3714 ✅ 精确 |

> ⚠️ **`avg_roe` 与 `ore_dlt` 是一对**：前者用期初期末平均权益，后者用期末权益。
> 数值不同（1.83 vs 1.8263），回写时必须说明口径，不可混用或二选一。
>
> ⚠️ **`net_selling_rate` 用的是含少数股东的净利润**，不是归母净利润。
> 用归母算会得到 2.9304，与字段值不符。

#### 6.6.2 每股指标（单位均为 元/股）

| 字段 | 中文名 | 验证 |
| --- | --- | --- |
| `basic_eps` | 基本每股收益 | 与 income 一致 |
| `np_per_share` | **每股净资产**（非每股净利润，见 §6.5） | 归母权益 ÷ 股本 = 23.7144 ✅ 精确 |
| `undistri_profit_ps` | 每股未分配利润 | 未分配利润 ÷ 股本 = 1.0202 ✅ 精确 |
| `operate_cash_flow_ps` | 每股经营现金流 | 经营现金流净额 ÷ 股本 = −12.0267 ✅ 精确 |
| `capital_reserve` | **每股**资本公积（见 §6.4） | 资本公积 ÷ 股本 = 21.2576 ✅ 精确 |

> 这 5 个指标的分母都是 `balance.shares`（股本金额，面值 1 元时数值等于股数）。
> 这也**反证了上一轮对 `shares` 的判定**（§4.5.2）：若 `shares` 不是"数量"含义，
> 这些每股指标不可能算对。

#### 6.6.3 偿债能力与资本结构

| 字段 | 中文名 | 单位 | 验证 |
| --- | --- | --- | --- |
| `asset_liab_ratio` | 资产负债率 | **%** | 65.9226（⚠️ 与 balance 单位不同，§6.4） |
| `holder_equity` | **权益比率**（非权益金额，§6.5） | % | 全部权益 ÷ 总资产 = 34.0774 ✅ 精确 |
| `current_ratio` | 流动比率 | 倍 | 流动资产 ÷ 流动负债 = 1.0687 ✅ 精确 |
| `quick_ratio` | 速动比率 | 倍 | 0.91 —— ⚠️ **推定**，见下 |
| `equity_ratio` | 产权比率 | 倍 | 负债 ÷ **归母**权益 = 1.9748 ✅ 精确 |
| `equity_multiplier` | 权益乘数 | 倍 | 总资产 ÷ **全部**权益 = 2.9345 ✅ 精确 |
| `ncf_from_oa_to_total_liab` | 经营现金流 / 总负债 | **小数** | −0.2568 ✅ 精确（⚠️ 本表唯一的小数比率） |

> ⚠️ **`equity_ratio` 与 `equity_multiplier` 的分母不一致**：
> 前者用归母权益、后者用全部所有者权益（含少数股东）。
> 同一张表内口径混用，做杜邦分解时若假设二者同分母会推错。
>
> ⚠️ **`quick_ratio` 未能精确复现**：标准公式 (流动资产−存货)/流动负债 = 1.0421，
> 与字段值 0.91 不符。按「货币资金+交易性金融资产+应收票据及账款+预付款项」
> 口径算得 0.9127，接近但因字段仅 2 位精度**无法确证**。
> **本项标为推定，不宣称已验证。**

#### 6.6.4 营运效率（周转率与周转天数）

| 字段 | 中文名 | 单位 |
| --- | --- | --- |
| `inventory_turnover` | 存货周转率 | 次 |
| `inventory_turnover_days` | 存货周转天数 | 天 |
| `account_receivable_turnover` | 应收账款周转率 | 次 |
| `receivable_turnover_days` | 应收账款周转天数 | 天 |
| `accounts_payable_turnover` | 应付账款周转率 | 次 |
| `accounts_payable_turnover_days` | 应付账款周转天数 | 天 |
| `total_capital_turnover` | 总资产周转率 | 次 |
| `current_asset_turnover_rate` | 流动资产周转率 | 次 |
| `fixed_asset_turnover_ratio` | 固定资产周转率 | 次 |
| `operating_cycle` | 营业周期 | 天 |
| `cash_cycle` | 现金循环周期 | 天 |

**周转天数的换算基数是报告期实际天数，不是 360 天**（已精确验证）：

```
inventory_turnover_days   10.4347 = 90 / inventory_turnover 8.6251          ✅
receivable_turnover_days   5.6312 = 90 / account_receivable_turnover 15.9825 ✅
accounts_payable_turnover_days 147.0108 = 90 / accounts_payable_turnover 0.6122 ✅
```

一季报用 90 天。**年报应为 360/365 天，跨期比较周转天数时必须注意基数不同**
（本次未验证年报基数，列入待验证）。

**营业周期勾稽**（精确到小数点后四位）：

```
operating_cycle 16.0659 = inventory_turnover_days 10.4347 + receivable_turnover_days 5.6312  ✅
cash_cycle    −130.9449 = operating_cycle 16.0659 − accounts_payable_turnover_days 147.0108  ✅
```

> ⚠️ **`cash_cycle` 为负（−131 天）是正常的**，表示供应链上占用上游资金
> （应付账款周转天数远大于营业周期），是强势产业链地位的体现，**不是数据错误**。

#### 6.6.5 成长能力（⚠️ 与二元组同比重复但单位不同）

| 字段 | 中文名 | 单位 |
| --- | --- | --- |
| `operating_income_yoy` | 营业收入同比增长率 | **%** |
| `net_profit_atsopc_yoy` | 归母净利润同比增长率 | **%** |
| `np_atsopc_nrgal_yoy` | 归母扣非净利润同比增长率 | **%** |

🔴 **这三个字段与同一行二元组的 `[1]` 是同一个数，但单位差 100 倍**：

| 字段 | `*_yoy` 的 `[0]` | 对应二元组的 `[1]` |
| --- | --- | --- |
| 营收同比 | `operating_income_yoy[0]` = **34.4629** | `total_revenue[1]` = **0.3446** |
| 归母净利同比 | `net_profit_atsopc_yoy[0]` = **0.8921** | `net_profit_atsopc[1]` = **0.008921** |
| 归母扣非同比 | `np_atsopc_nrgal_yoy[0]` = **−73.8735** | `net_profit_after_nrgal_atsolc[1]` = **−0.7387** |

> 🔴 **更绕的是 `*_yoy` 字段自己的 `[1]`**：它是「**同比增长率的同比**」（增速的变化率），
> 是个二阶量。例如 `operating_income_yoy = [34.4629, 2.2347]` 意为
> 「营收同比 +34.46%，而这个增速本身比去年同期的增速涨了 2.23 倍」。
>
> **回写时极易误读成"营收增长 223%"**。建议投影层直接丢弃 `*_yoy` 字段的 `[1]`，
> 或改名为 `yoyOfYoy` 之类明确标识。

#### 6.6.6 ⚠️ 语义未确认字段

| 字段 | 本样本值 | 状态 |
| --- | --- | --- |
| `rop` | `73.0061` | **未破解** |

已排除的口径（均不匹配）：

| 尝试 | 计算值 | 字段值 |
| --- | --- | --- |
| 营业成本 / 营收 × 100 | 73.7617 | 73.0061 |
| 营业成本 / 营业总成本 × 100 | 73.4238 | |
| 营业总成本 / 营收 × 100 | 100.4602 | |
| (营收 − 营业利润) / 营收 × 100 | 96.8711 | |
| 每股营收 | 14.7795 | |

跨期观察值：74.10（2025Q1）→ 143.26（中报）→ 157.86（三季报）→ 100.64（年报）
→ 73.01（2026Q1），**呈期内累积后回落的形态**，不像稳定比率。

> **不要凭字段名猜测**（`rop` 可能是 return on ... 的缩写，但所有 return 类
> 口径都已排除）。实现时应**原样透传并标注语义未知**，
> 不要给它编一个中文名——那会让 Agent 基于错误理解产出结论。

### 6.7 与三张报表的关系总结

| 维度 | 三张报表 | `indicator.json` |
| --- | --- | --- |
| 数据性质 | 上游披露的**原始科目** | **计算出的衍生指标** |
| 单位 | 统一（元 / 小数同比） | **混合四种**（%、小数、倍、元） |
| `S` 系列 | income/cash_flow 有，balance 有但错 | **未出现** |
| `ctime` | 仅 income 有值 | **有值** |
| 跨表 join | 安全（除 `othr_compre_income`） | **2 个字段冲突**（§6.4） |
| 可独立获取 | ✅ | ✅（但也可由报表自行计算） |

> **实现建议**：本端点的价值在于**省去自行计算**（尤其是平均口径的 ROE、
> 周转率这类需要期初期末数据的指标）。但因为单位陷阱密集，
> 若下游只需要少量常用指标，**由三张报表自行计算反而更可控**。

---

## 7. 数据质量评估（面向基本面分析的适用性核对）

> 本节是**实证核对结论**，不是主观判断。所有结论都附验证方法与实测数值，
> 可用同样方法在其它标的上复核。核对对象：赛力斯 `SH601127`。

### 7.1 一句话结论

**满足基本面分析的核心需求，但有 3 个必须补足的缺口和 2 个必须规避的陷阱。**

| 维度 | 评级 | 依据 |
| --- | --- | --- |
| **准确性** | 🟢 高 | 三表内部 20+ 组勾稽精确吻合到分；跨表自洽（误差 1.1e-06） |
| **一致性** | 🟢 高 | 同期次跨请求 20/20 完全一致；同比与历史值反算差 0.00e+00 |
| **连续性** | 🟢 高 | 2013 年起 53 期完全连续，唯一缺口在 2011–2012（上市早期） |
| **时效性** | 🟢 高 | 报告期结束后约 30 天入库（2026Q1 报告期末 03-31，入库 04-29） |
| **全面性** | 🟡 中 | 三表 + 指标齐全，但**缺分红、股东、分部、股价**四类（§7.5） |
| **口径可比性** | 🟡 中 | 同比口径可比（已重述），但**股数不精确**（§7.4） |

### 7.2 ✅ 准确性：已实证

**三表内部勾稽**（赛力斯 2026Q1，见 §3.5.4 / §4.5.1 / §5.5）：

| 表 | 勾稽组数 | 结果 |
| --- | --- | --- |
| 利润表 | 5 组 | 4 组精确吻合，营业利润差 0.9%（未单列科目） |
| 资产负债表 | 5 组 | **全部精确吻合**（资产=负债+权益 等） |
| 现金流量表 | 9 组 | **全部精确吻合**（三大活动 + 净增 + 期末余额） |

**跨表自洽**（本轮新增核对）：

```
指标表 net_profit_atsopc  754,464,672.82  == 利润表同名字段  ✅ 完全一致
指标表 np_per_share × balance.shares
  = 23.7144 × 1,741,985,086 = 41,310,131,123.44
  vs balance 归母权益         41,310,177,392.59
  相对误差 1.12e-06（源于指标表 4 位截断）        ✅ 自洽
```

**结论**：数据本身可信，不存在错配或算错。

### 7.3 ✅ 一致性与重述：已实证，且是加分项

**同期次跨请求一致性**：利润表 HAR 中 20 个期次在不同 `type` 请求间出现多次，
**数值 100% 一致**，无矛盾。

**发现数据重述迹象**（`ctime` 揭示）：

| 期次 | 报告期末 | 入库时间 |
| --- | --- | --- |
| 2025一季报 | 2025-03-31 | **2026-04-29** ← 晚了约 1 年 |
| 2025中报 | 2025-06-30 | 2025-08-29 |
| 2025三季报 | 2025-09-30 | 2025-10-30 |
| 2026一季报 | 2026-03-31 | 2026-04-29 |

2025一季报的入库时间与 2026 一季报**同日** —— 这是标准的**同比重述**：
披露新报告时按当前口径重列上年同期数。

**这是好事，已验证**：

```
2026Q1 API 同比        反算(用接口自身的2025Q1)      差值
total_revenue      +0.344629    +0.344629      0.00e+00
net_profit_atsopc  +0.008921    +0.008921      0.00e+00
net_profit         -0.175641    -0.175641      0.00e+00
```

同比与历史值**完全自洽**，说明上游做的是**一致性重述**（上年同期已按新口径重列）。

> ⚠️ **但要意识到代价**：接口返回的是**重述后口径**，不是当年的原始披露值。
>
> - ✅ 做**趋势分析、同比对比**：口径统一，可直接用。
> - ❌ 做**"当年投资者看到的是什么"**类研究（如事件研究、预期差分析）：
>   本接口给不了原始披露值，需另找存档数据源。

### 7.4 ⚠️ 陷阱一：股数不精确，影响每股类估值

`balance.shares` 是**股本金额（元）**，面值 1 元时数值等于**期末**股数。
但 EPS 用的是**加权平均股数**，两者有实质差异。

**实测偏差**（用 归母净利 ÷ EPS 反算真实加权股数）：

| 期次 | `shares`（亿） | EPS 反算（亿） | 偏差 |
| --- | --- | --- | --- |
| 2026一季报 | 17.4199 | 17.5457 | 0.72% |
| 2025年报 | 17.4199 | 16.1869 | **7.08%** |
| 2025三季报 | 16.3337 | 15.9053 | 2.62% |
| 2025中报 | 16.3337 | 15.7267 | 3.72% |
| 2025一季报 | 16.3337 | 14.9559 | **8.44%** |

偏差最高 8.44% 且不稳定（该公司期内有股本变动）。

**影响与对策**：

| 场景 | 处置 |
| --- | --- |
| 每股净资产、每股现金流 | ✅ 用 `shares`（期末口径本就正确） |
| 市盈率、每股收益类 | ❌ **不要用 `shares` 反算**，直接用 `basic_eps` / `dlt_earnings_per_share` |
| 需要精确总股本 | ⚠️ 本接口族给不了，需另取股本结构数据 |

> ⚠️ 另注意：面值非 1 元的标的，`shares` 与股数**根本不等**（见 §4.5.2）。
> 跨标的批量分析时不可假设面值恒为 1。

### 7.5 缺口现状（B 组已填补两项 🔴 高严重度缺口）

| 缺失数据 | 影响的分析 | 严重度 | 状态 |
| --- | --- | --- | --- |
| ~~分红/股息记录~~ | 股息率、分红率 | 🔴 高 | ✅ **已补**（§9，⚠️ 金额需解析中文串） |
| ~~股东结构 / 前十大股东~~ | 控股权、股权集中度 | 🔴 高 | ✅ **已补**（§10） |
| ~~机构持仓~~ | 基金持仓分布 | 🟡 中 | ✅ **已补**（§12） |
| ~~筹码集中度~~ | 散户/机构结构 | 🟡 中 | ✅ **已补**（§11） |
| ~~解禁压力~~ | 供给冲击 | 🟡 中 | ✅ **已补**（§13） |
| ~~高管增减持~~ | 管理层信心 | 🟡 中 | ✅ **已补**（§14） |
| **股价 / 市值** | **所有估值指标**（PE/PB/PS/EV） | 🔴 高 | ❌ **仍缺** |
| 分部数据（业务/地区构成） | 业务结构拆解 | 🟡 中 | ❌ 仍缺 |
| 审计意见 | 财报可信度排雷 | 🟡 中 | ❌ 仍缺 |
| 关联交易 | 利益输送排查 | 🟡 中 | ❌ 仍缺 |
| 员工人数 | 人均创收 | 🟢 低 | ❌ 仍缺 |
| 母公司单体报表 | 母子公司结构 | 🟢 低 | ❌ 仍缺 |

> 🔴 **股价仍是唯一的高严重度缺口**：没有股价就做不了任何估值（PE/PB/PS）。
> 本接口族只能做「财务表现 + 股权结构」分析，不能判断「贵不贵」。
> 估值需另接行情源（本仓 `tradingview-spider` 可取价格与市值）。
>
> ⚠️ **`holders.json` 自带 `price` 字段但不能替代行情源** —— 它只在股东人数
> 披露日有值（一年数期），且未说明是收盘价还是均价（见 §11.3）。

#### 分红数据的三个"假朋友"（务必区分）

| 字段 | 出处 | **不是什么** |
| --- | --- | --- |
| `dividend_payable` | 资产负债表 | 应付股利，是**时点欠付余额**，不是分红额 |
| `cash_paid_of_distribution` | 现金流量表 | "分配股利、利润**或偿付利息**"，**混了利息支出** |
| `dividend_receivable` | 资产负债表 | 应收股利，是公司**收到**的分红，方向相反 |

**真正的分红数据在 §9 的 `bonus.json`**，但金额只在 `plan_explain`
中文串里（如 `10派69.57元`），需解析。

### 7.6 ✅ 可直接做的分析（已验证数据充分）

| 分析类型 | 所需字段 | 状态 |
| --- | --- | --- |
| **盈利能力** | 毛利率/净利率/ROE(双口径)/总资产净利率 | ✅ 指标表直接给 |
| **盈利质量** | 经营现金流 / 净利润 | ✅ 实测可算（见下） |
| **偿债能力** | 资产负债率/流动比率/速动比率/产权比率 | ✅ 指标表直接给 |
| **营运效率** | 各类周转率/周转天数/营业周期/现金循环 | ✅ 指标表直接给 |
| **成长能力** | 营收/净利/扣非同比 | ✅ 且已重述，口径可比 |
| **杜邦分解** | 净利率 × 周转率 × 权益乘数 | ⚠️ 可做，但注意 §6.6.3 分母口径不一致 |
| **单季分析** | `type=S*` | ⚠️ 仅 income/cash_flow，且需字段白名单（§2.8） |
| **估值分析** | PE/PB/PS | ❌ **缺股价，做不了** |

**盈利质量实测**（这是财务排雷最核心的指标，本接口族完全支持）：

| 期次 | 净利润 | 经营现金流 | 比值 |
| --- | --- | --- | --- |
| 2025一季报 | 7.41 亿 | −76.30 亿 | −10.30 |
| 2025中报 | 30.77 亿 | 144.37 亿 | 4.69 |
| 2025三季报 | 56.37 亿 | 226.49 亿 | 4.02 |
| 2025年报 | 61.47 亿 | 289.14 亿 | 4.70 |
| 2026一季报 | 6.11 亿 | **−209.50 亿** | **−34.31** |

> 该表本身就说明分析价值：全年比值 4.70（现金流远好于账面利润，质量优），
> 但一季度剧烈为负（季节性备货/回款周期）。**这也印证了做单季分析的必要性**
> —— 只看累计数会掩盖季度间的剧烈波动。

### 7.7 历史深度：接口支持长历史，抓包只是没翻完

HAR 中各端点覆盖期次差异很大，**这是抓包时翻页次数不同，不是接口限制**：

| 端点 | HAR 中 `type=all` 覆盖 | 最早期次 |
| --- | --- | --- |
| 利润表 | 17 期 | 2022一季报 |
| 资产负债表 | 13 期 | 2023一季报 |
| 现金流量表 | 5 期 | 2025一季报 |
| **主要财务指标** | **55 期** | **2011年报** |

指标表翻到了 2011 年，证明**接口本身支持长历史**（≥15 年）。
三张报表只要持续翻页，预期可取到同等深度（**未实测，列入待验证**）。

**期次连续性**（指标表 55 期）：

```
2011年报 → 2012年报   ⚠️ 中间缺 3 期（2012 一季报/中报/三季报）
2013一季报 起 …… 2026一季报   ✅ 连续 53 期无缺口
```

> 早期（上市初期）数据不完整是上游真实状态。
> **实现须容忍期次跳跃**，不要假设连续，更不要用「缺失=0」填补。

### 7.8 采集实施建议

1. **翻页要翻到底**：默认只取 5 期远不够做趋势分析。建议循环到
   `list.length < count`，取 10 年以上（约 40 期）。
2. **四个端点都要取**：指标表虽有现成比率，但**精度被截断到 4 位**
   （`asset_liab_ratio` 65.9226 vs 报表可算出 0.659226148333026）。
   做精确计算应以三张报表为准，指标表用于交叉校验。
3. **必须做勾稽校验**：把 §3.5.4 / §4.5.1 / §5.5 的等式写成断言，
   校验失败说明该标的是特殊 `org_type`（金融企业），科目结构不同，需单独处理。
4. **补数据源**：分红与股东结构**已由 B 组端点补齐**（§9–§14）；
   仅剩**股价/市值**仍需另接行情源（本仓 `tradingview-spider`）。
5. **单季分析用 `S` 系列**但严守字段白名单（§8.2），
   或**自行从累计值差分**（可控性更好，且能避开上游对存量字段的错误差分）。

---

## 8. 实现建议（对接本仓框架）

| 决策点 | 结论 | 依据 |
| --- | --- | --- |
| 模式 | **GoalExecutor**（`PuppeteerGoalSkill`） | 需登录态 Cookie（§2.2），且是标准 HTTP 端点 |
| 请求发起 | `page.evaluate(fetch(...))` 于已登录的 `xueqiu.com` 页面内 | CLAUDE.md §4.6 红线；且 Origin 必须是 `https://xueqiu.com` |
| 导航目标 | `https://xueqiu.com/snowman/S/{symbol}/detail` | 同时满足 Origin 与 Referer |
| 翻页 | `@Paginated` + `stopWhen`（`list.length < count`） | §3.3；注意 `stopWhen` 拿不到 ctx |
| `symbol` 校验 | 只做形状校验 `/^(SH\|SZ\|BJ)\d{6}$/`，不做代码白名单 | CLAUDE.md §3.6 |
| `type` 校验 | 上游枚举，**不拦截**，透传让上游判定 | CLAUDE.md §3.6 |
| 错误判定 | `Number(error_code) !== 0` → 失败 | §2.1，注意类型漂移 |
| `400016` 映射 | `not-logged-in`（auth 类，不可重试） | §2.2 实测 |
| `data.list` 为空 | `no-results`（business 类） | 需与鉴权失败区分——后者 list 也为空 |

> ⚠️ **`400016` 与空结果的区分是必须的**：鉴权失败时上游同样返回 `data.list: []`。若只看 list 长度会把"未登录"误报成"该股票无财务数据"，Agent 拿到后会给用户完全错误的结论。**先判 `error_code`，再判 list**。

### 8.1 端点族的复用设计（已落地）

按 CLAUDE.md §3.3 的「包内基类分层」组织，10 个端点两级抽象：

```
XueqiuSkillBase          siteURL = https://xueqiu.com              定站点
  ├ FinanceSkillBase     getPath() = /snowman/S/{symbol}/detail    A 组
  │   ├ income.skill.ts      ┐
  │   ├ balance.skill.ts     │ 共用 createFinanceGoal
  │   ├ cashflow.skill.ts    │ （timestamp 游标翻页）
  │   └ indicator.skill.ts   ┘
  ├ F10SkillBase         同上路径                                  B 组 page/size
  │   └ page-skills.ts       bonus / holders-num
  │                          restricted-release / insider-trades
  │                          共用 createF10PageGoal
  └ F10TimeSkillBase     同上路径                                  B 组 日期索引
      └ time-skills.ts       top-holders / fund-holding
                             各自 createXxxGoal（@Expanded 按期展开）
```

**四个端点族共享同一套导航与鉴权**（都导航到个股详情页、都靠登录态 Cookie），
差异只在翻页与投影。

- **全包共享**：信封解包与 `error_code` 判定（`unwrapFinanceEnvelope`）、
  `symbol` 形状校验、Goal defaults（`credentials: "include"`）——
  A 组与 B 组完全一致，放 `thrall/shared.ts`。
- **组内共享**：翻页逻辑（A 组游标 / B 组 page-size）、去重工具。
- **各自持有**：`Raw*` 类型与字段字典、`insights` 构建逻辑。
- **不要共享**：`type` 的语义正确性判定（§8.2）、**字段单位声明**（§8.3）、
  **每页条数判据**（§2.10 —— 逐端点而异，一刀切会静默出错）。

> ⚠️ **`indicator.skill.ts` 不要复用报表的投影工具**：报表的二元组统一是
> 「元 + 小数同比」，indicator 混着四种单位（§6.3），套用会错 100 倍。

### 8.2 🔴 `S` 系列必须按**字段级白名单**处理

`S0`–`S4` 的语义正确性**不是 per-endpoint 的，而是 per-field 的**（§2.8）。
三种粗粒度做法都是错的：

| 做法 | 后果 |
| --- | --- |
| 全局放行 `S` 系列 | balance 产出负的总资产；cash_flow 的期末现金被换成当季净增 |
| 全局禁用 `S` 系列 | 丢掉 income 的单季利润与 cash_flow 的 36 个正确单季字段（高价值） |
| 按端点开关（income/cash_flow 开、balance 关） | 仍会放行 cash_flow 那 2 个失真的余额字段 |

**正确做法**：为每个端点维护一份「`S` 口径下不可用字段」清单，
命中时置 `null` 并在 `meta` / `insights` 中标注原因。

```
income.json     → 待验证（HAR 未覆盖 S 系列）
balance.json    → 全部 87 个业务字段均不可用（存量表）
cash_flow.json  → 仅 initial_balance_of_cce / final_balance_of_cce 不可用
                  其余 36 个流量字段正确
indicator.json  → HAR 未出现 S 系列；若上游接受，比率差分无意义，建议整体拒绝
```

> ⚠️ **`cash_flow.json` 的失真最危险**：`final_balance_of_cce` 退化后仍是
> 正的、量级合理的数字，**从结果完全看不出错误**。
> balance 的负总资产反而是"安全"的错误——因为一眼能识破。
>
> 这类"看起来正常的错误数据"必须在采集层拦掉，不能指望下游发现。

### 8.3 🔴 `indicator.json` 必须逐字段声明单位

报表端点可以「金额一律元、同比一律小数」一刀切；**`indicator.json` 不行**。
同一行里 `asset_liab_ratio` 是 65.9226（百分数）而 `ncf_from_oa_to_total_liab`
是 −0.2568（小数），任何统一处理都会让一半字段错 100 倍。

**实现要求**：

1. 维护一份 `字段名 → 单位` 的常量表（`percent` / `ratio` / `times` / `yuan` / `yuanPerShare`），
   在信封的 `units` 中透出（对齐 CLAUDE.md §4.3「`units` 显式声明」）。
2. **不做单位归一化** —— 原样透传上游值，把换算交给消费方。
   采集侧擅自 `/100` 会与报表端点的同名字段产生新的不一致。
3. 对 §6.4 的 2 个冲突字段（`asset_liab_ratio` / `capital_reserve`）
   加命名空间前缀或显式排除，避免跨表 join 时静默覆盖。
4. `rop` 语义未确认（§6.6.6），**透传并标注未知**，不要编中文名。
5. `*_yoy` 字段的 `[1]` 是「增速的同比」（二阶量），建议丢弃或明确改名。

### 8.4 B 组实现纪要（已落地，含两个静默错误的教训）

10 个端点已全部实现为 Skill（见 `src/registry.ts`）。B 组的三种翻页范式
分别对应两套 Goal 工厂：

```
createF10PageGoal   （@Paginated）  bonus / holders / shareschg / skholderchg
createTopHoldersGoal（@Expanded）   top_holders
createFundHoldingGoal（@Expanded）  org_holding
```

日期索引类的实现骨架是**两个端点方法**：

```
① fetchLatest  不带日期参数 → 拿最新期数据 + times[]
② fetchHistory @Expanded，source 取 times[].slice(1)，按 value 展开
   （必须声明 dependencies: ["fetchLatest"]）
```

#### 🔴 两个「不报错、只出错数据」的坑（都已实际发生）

**坑 1：把单个端点的行为当成全族规则**

把 `holders` 的 `size+1` 写成了 f10 通用判据（`length <= size`），
导致 `bonus` 在第一页就误判到底 —— 只取到 10 条而真实有 12 条。
**没有任何报错**，`success: true`，只是少数据。

> 教训：抓包结论要**逐端点验证**再泛化。文档 §2.10 最初就写错了，
> 代码照着文档实现，于是错误被放大。

**坑 2：`ctx.params` 里没有 `createGoal` 阶段派生的值**

`top_holders` 的 `circulating`（布尔入参）在 `createGoal` 里换算成
`circula`（数字），但 Goal 的 `query` 回调读的是 `ctx.params.circula`
—— 而 `ctx.params` 是**Skill 归一化后的入参**，只有 `circulating`。
取到 `undefined`，上游按默认值返回了**流通股口径**，
而 `meta.scope` 仍标称 `"all"`。

```
请求 circula=0（全体）  实际返回 63.07% / 首位 22.77%  ← 流通口径
                       应该返回 66.28% / 首位 22.04%
```

> 教训：**`createGoal` 阶段派生的值只存在于闭包，不会进 `ctx.params`**。
> 要么在 `normalizeParams` 里就换算好（进 ctx.params），
> 要么在 Goal 里一律从闭包读 —— 不要两处混用。
> 本包选了后者，并在代码注释里写明了原因。

#### 其它已落地的防错点

| 端点 | 处理 |
| --- | --- |
| `bonus` | `plan_explain` 解析为结构化金额，**失败返 null 不返 0**；`addtions` 只取首页 |
| `holders` | `overFetch: true` 标志 + 按 `timestamp` 去重 |
| `shareschg` | 输出附带 `byDate`（按解禁日分组求和） |
| `org_holding` | 剥离 `fund_items[0]` 汇总行；默认 `topN=50` 截断并在 insights 告知 |
| `top_holders` | `quit[]` 独立类型（无 `chg`、有 `holder_rank`），不继承 `HolderItem` |

---

### 8.5 待验证清单（不要凭猜测实现）

- [ ] **`income.json` 是否支持 `S0`–`S4`**（单季利润，高价值口径；缺登录态未能实测）
- [x] ~~`S` 系列在现金流量表上的语义~~ → **已验证**：流量字段正确，
      但 `initial_balance_of_cce` / `final_balance_of_cce` 两个时点字段失真（§5.3）
- [ ] `count` 的上限（抓包只见 `5`）
- [ ] `is_detail=false` 的字段集差异
- [ ] `org_type != 1`（银行/保险/券商）的字段集 —— 资产负债表差异会比利润表更大；
      现金流量表的金融企业科目（如"客户存款净增加额"）也完全不同
- [ ] 港股 / 美股的同族端点路径（`/cn/` 段暗示存在，但**未抓到，勿臆造**）
- [ ] `statuses` 字段语义（四端点全程 `null`）
- [ ] **`indicator.json` 的 `rop` 字段语义**（§6.6.6，已排除 5 种口径仍未命中）
- [ ] `quick_ratio` 的精确口径（§6.6.3，推定为「货币资金+交易性金融资产+应收票据账款+预付」，
      算得 0.9127 vs 字段 0.91，因精度不足无法确证）
- [ ] **周转天数在年报期的换算基数**（一季报已验证为 90 天；年报是 360 还是 365 未验证，
      直接影响跨期比较）
- [ ] `indicator.json` 是否接受 `S0`–`S4`（HAR 未出现）
- [ ] `avg_roe` 的精确口径（平均 1.8350 vs 期末 1.8263，字段仅 2 位精度 `1.83`，
      无法区分；已由 `ore_dlt` 反证前者应为平均口径）
- [ ] **三张报表能否翻到与指标表同等深度**（指标表已实测到 2011 年 55 期；
      三表因抓包未翻完只覆盖 5–17 期，**接口能力预期相同但未实测**，见 §7.7）
- [ ] 金融企业（`org_type != 1`）的勾稽等式是否仍成立
      —— §7.8 建议把勾稽写成断言，这类标的预期会触发失败
- [ ] `ctime` 为何在 balance / cash_flow 中恒为 `null`（仅 income 有值）
- [ ] `fixed_asset` 等裸名字段是否在其他公司/期次有值（本样本恒 `null`）
- [ ] 字段中文名的权威来源（本次抓包无映射表，字段字典为勾稽推定）


# B 组 · 股权与公司运作（`/v5/stock/f10/cn/**`）

> 本组补上了 §7.5 指出的两个 🔴 **高严重度缺口**：分红与股东结构。
>
> 样本：宁德时代 `SZ300750`，2026-08-07 采集。
> 信封 / 鉴权 / CORS 与 A 组完全一致（§2.9），差异在翻页与 `data` 形态。

## 9. 端点：分红 · 增发 · 配股

```
GET https://stock.xueqiu.com/v5/stock/f10/cn/bonus.json
```

⚠️ **一个端点返回三块互不相干的数据** —— 这是「增发」HAR 中没有独立端点的原因：

| `data` 字段 | 内容 | 本样本条数 |
| --- | --- | --- |
| `items` | **分红**（派息/送转）记录 | 12（分 2 页） |
| `addtions` | **增发**记录 | 2 |
| `allots` | **配股**记录 | 0 |

### 9.1 入参

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `symbol` | string | ✅ | 标的代码，如 `SZ300750` |
| `page` | number | ✅ | 页码，从 1 开始 |
| `size` | number | ✅ | 每页条数，抓包为 `10` |
| `extend` | boolean | — | 抓包恒为 `true`，语义未验证 |

⚠️ **`page`/`size` 只对 `items`（分红）生效**：`addtions` / `allots`
在每一页都**原样重复返回**（实测 page=1 与 page=2 的 `addtions` 完全相同）。
跨页合并时若把 `addtions` 也 concat，会得到重复数据。

**翻页终止**：本端点返回**标准的 10 条**（不像 `holders` 多返一条），
故判据是 `length < size`。本样本 page=2 返回 2 条 < 10 即到底，共 12 条分红记录。

> ⚠️ 曾误按 `holders` 的 `size+1` 行为处理（用 `length <= size`），
> 导致第一页就误判到底、只取到 10 条。详见 §2.10。

### 9.2 `items[]` —— 分红记录

```jsonc
{
  "dividend_year": "2025年报",              // 分红所属期
  "plan_explain": "10派69.57元(实施方案)",   // ⚠️ 金额只在这个中文串里
  "equity_date": 1776700800000,             // 股权登记日
  "ex_dividend_date": 1776787200000,        // 除权除息日
  "ashare_ex_dividend_date": 1776787200000, // A 股除权除息日
  "dividend_date": 1776787200000,           // 派息日
  "cancle_dividend_date": null              // 取消分红日（上游拼写 cancle）
}
```

| 字段 | 中文名 | 说明 |
| --- | --- | --- |
| `dividend_year` | 分红所属期 | ⚠️ **两种格式并存**，见 §9.3 |
| `plan_explain` | 分配方案说明 | 🔴 **金额唯一来源**，是中文串，见 §9.4 |
| `equity_date` | 股权登记日 | 毫秒时间戳 |
| `ex_dividend_date` | 除权除息日 | 毫秒 |
| `ashare_ex_dividend_date` | A 股除权除息日 | 本样本与上一字段相同 |
| `dividend_date` | 派息日 | 毫秒 |
| `cancle_dividend_date` | 取消分红日 | 上游拼写错误（cancle），原样保留；非 null 表示该次分红被取消 |

### 9.3 ⚠️ `dividend_year` 有两种格式

```
2026中报 / 2025年报 / 2025中报 / 2024年报   ← 报告期格式
2024-12-11 / 2024-03-16                    ← 日期格式（特别分红）
```

日期格式对应**不与定期报告绑定的特别分红**。

> ⚠️ 按报告期与三张报表 join 时，日期格式的记录会**漏配**。
> 若要算「某年度分红总额」，必须把日期格式的记录也归入对应年份，
> 不能简单按字符串匹配 `"2024年报"`。

### 9.4 🔴 分红金额没有结构化字段，只在 `plan_explain` 里

**这是本端点最大的约束**。上游不提供 `dividend_per_share` 一类数值字段，
金额只能从中文串解析：

本样本已见的**全部**形态（⚠️ 单一标的样本，不是 A 股全集）：

| 形态 | 示例 | 含义 |
| --- | --- | --- |
| 纯派息 | `10派69.57元(实施方案)` | 每 10 股派 69.57 元（**税前**） |
| 转增 + 派息 | `10转8股派25.2元(实施方案)` | 每 10 股转增 8 股 + 派 25.2 元 |

**A 股实际还存在但本样本未出现**的形态（实现时必须容错，不要假设只有两种）：

```
10送3股派2元          （送股，与"转增"税务处理不同）
10转10股              （纯转增，无派息）
不分配不转增
10派1.5元(含税)        （标注方式可能不同）
```

**实现要求**：

1. 解析用**宽松正则 + 显式失败**：解析不出金额时返回 `null` 并保留原文，
   **绝不能猜或填 0** —— 后者会让"未分红"和"解析失败"混为一谈。
2. 投影层**必须同时保留 `planExplain` 原文**，让消费方可核对。
3. `(实施方案)` 后缀表示**已实施**；若出现 `(预案)` / `(股东大会通过)`
   等其它状态，含义完全不同（尚未实施），**不能计入已分红金额**。
   本样本全是「实施方案」，其它状态未验证。

> 🔴 **算股息率还缺股价** —— 本端点只给每股派息额，
> 股息率 = 每股派息 ÷ 股价，股价需另接行情源（见 §7.5）。

### 9.5 `addtions[]` —— 增发记录

```jsonc
{
  "actual_issue_vol": 109756097.0,      // 实际发行数量（股）
  "actual_issue_price": 410.0,          // 实际发行价（元/股）
  "actual_rc_net_amt": 44870113208,     // 实际募集资金净额（元）
  "listing_ad": 1656518400000           // 增发股份上市日
}
```

| 字段 | 中文名 | 单位 |
| --- | --- | --- |
| `actual_issue_vol` | 实际发行数量 | 股 |
| `actual_issue_price` | 实际发行价 | 元/股 |
| `actual_rc_net_amt` | 实际募集资金**净额** | 元 |
| `listing_ad` | 增发股份上市日 | 毫秒时间戳 |

**验算**（宁德时代 2022 年定增）：

```
109,756,097 股 × 410.0 元/股 = 45,000,000,000 元（毛额）
actual_rc_net_amt            = 44,870,113,208 元（净额）
差额                          =    129,886,792 元  ← 发行费用
```

净额 ≈ 毛额 − 发行费用，符合「净额」定义 ✅

> ⚠️ `actual_issue_vol` 上游值带浮点噪声（`109756097.00000001`），
> 投影时按需取整，但**不要四舍五入到万/亿**（CLAUDE.md §5：数字 ID 类保留原值）。

### 9.6 `allots[]` —— 配股记录

本样本为**空数组**（宁德时代无配股）。字段结构**未验证**，
实现时按 `unknown[]` 透传，不要臆造字段名。

---

## 10. 端点：十大股东 / 十大流通股东

```
GET https://stock.xueqiu.com/v5/stock/f10/cn/top_holders.json
```

⚠️ **一个端点承载两种口径**，靠 `circula` 区分 —— 这是「十大股东」与
「十大流通股东」两个 HAR 命中同一端点的原因。

### 10.1 入参

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `symbol` | string | ✅ | 标的代码 |
| `circula` | number | ✅ | **口径开关**：`0`=十大股东（全体）、`1`=十大流通股东 |
| `count` | number | — | ⚠️ **不控制返回条数**，见下 |
| `locate` | number | — | 报告期时间戳（毫秒），取历史期时用 |
| `start` | number | — | 抓包中恒与 `locate` 同值，语义未单独验证 |

> ⚠️ **`count=200` 实测只返回 10 条** —— 该参数不控制条数，上游固定返回前十大。
> 不要以为调大就能拿到更多股东。

### 10.2 翻页范式：日期索引，不是翻页

首次请求（不带 `locate`）返回的 `data.times[]` 列出**全部可用报告期**：

```jsonc
"times": [
  { "name": "2026-08-05", "value": 1785859200000 },
  { "name": "2026-07-24", "value": 1784822400000 },
  { "name": "2026中报",   "value": 1782748800000 },
  …
]
```

取历史期 = 按 `times[].value` 逐个请求 `locate=<value>&start=<value>`。

**这是「入参驱动、要几期发几次」的形态** —— 实现用 `@Expanded`（source 为
`times[]`）而非 `@Paginated`（CLAUDE.md §2.5：入参驱动的翻页优先用 `@Expanded`）。

⚠️ **两种 `circula` 的可用期数不同**（实测 `circula=0` 有 48 期、`circula=1` 有 36 期），
不能用一次请求的 `times` 去展开另一种口径。

⚠️ `times[].name` **混着报告期与具体日期**（`2026中报` / `2026-08-05`）——
后者是定期报告之外的临时披露（如季度间的股东变动公告）。

### 10.3 `data` 结构

```jsonc
{
  "items": [ /* 前十大股东 */ ],
  "total": { "held_num": …, "held_ratio": …, "chg": … },   // 十大合计
  "quit":  [ /* 本期退出前十的股东 */ ],
  "times": [ /* 全部可用报告期 */ ]
}
```

#### `items[]` —— 前十大股东

| 字段 | 中文名 | 单位 | 说明 |
| --- | --- | --- | --- |
| `holder_name` | 股东名称 | — | 原样透传，含席位/产品全称 |
| `held_num` | 持股数量 | **股** | |
| `held_ratio` | 持股占比 | **百分数** | `22.04` = 22.04% |
| `chg` | 持股数量环比变动 | **百分数** | 见 §10.4 |

#### `total` —— 十大合计（已验证）

```
items 占比之和 66.28  == total.held_ratio 66.28        ✅
items 持股之和 3,066,053,502 == total.held_num          ✅
```

`total.held_ratio` 即**股权集中度**（前十大合计持股比例），是股权分析的核心指标。

#### `quit[]` —— 本期退出前十的股东

⚠️ **字段集与 `items[]` 不同 —— 不是简单的「多一个字段」**
（已全量核实 66 条 quit 项：全体股东侧 19 条 + 流通股东侧 47 条，形态一致）：

| 字段 | `items[]` | `quit[]` |
| --- | --- | --- |
| `holder_name` / `held_num` / `held_ratio` | ✅ | ✅ |
| `chg`（环比变动） | ✅ | ❌ **没有** |
| `holder_rank`（退出前排名） | ❌ | ✅ |

```jsonc
{
  "holder_name": "中国工商银行股份有限公司-华泰柏瑞沪深300ETF",
  "held_num": 43712032,
  "held_ratio": 0.96,
  "holder_rank": 8          // ← items[] 里没有；而 items 的 chg 这里也没有
}
```

`holder_rank` 是**退出前的位次**。本样本最新期 `quit` 为空数组，
历史期中有 1–2 条的样本。

> ⚠️ 类型定义时**不要让 `QuitHolderItem` 继承 `HolderItem`** ——
> 会凭空多出一个上游并不返回的 `chg` 字段。

> ⚠️ 投影时不要把 `quit` 与 `items` 合并成一个数组 —— 二者语义相反
> （在榜 vs 已退出），且字段集不同。

### 10.4 `chg` 的口径：持股数量环比变动百分比

**已用相邻两期实数验证**：

```
易方达创业板 ETF
  本期 held_num 28,619,389
  上期 held_num 25,105,056
  (28,619,389 − 25,105,056) / 25,105,056 = +14.0%   == 字段 chg 14.0  ✅
```

| 取值 | 含义 |
| --- | --- |
| `0.0` | 持股数量未变（**不是"无数据"**） |
| 正数 | 增持该比例 |
| 负数 | 减持该比例 |

⚠️ 注意 `chg` 是**持股数量**的变动率，不是持股**占比**的变动。
总股本变化时两者不同向 —— 如增发后股东未减持，`chg=0` 但 `held_ratio` 会下降。

---

## 11. 端点：股东人数

```
GET https://stock.xueqiu.com/v5/stock/f10/cn/holders.json
```

筹码集中度分析的核心数据源。

### 11.1 入参

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `symbol` | string | ✅ | 标的代码 |
| `page` | number | ✅ | 页码，从 1 开始 |
| `size` | number | ✅ | 每页条数，抓包为 `10` |
| `extend` | boolean | — | 抓包恒为 `true` |

🔴 **本端点是四个 page/size 端点中唯一多返一条的**（§2.10）——
`size=10` 实测每页返回 **11 条**，末条是下一页的第一条。

故本端点的终止判据是 `length <= size`（其余三个端点用 `length < size`），
跨页合并须按 `timestamp` 去重。**不要把这个行为外推到其它端点。**

### 11.2 字段字典

```jsonc
{
  "timestamp": 1782748800000,          // 报告期（毫秒）
  "holder_num": 270033,                // 股东总户数
  "ashare_holder": 269979,             // A 股股东户数
  "hshare_holder": 54,                 // H 股股东户数
  "bshare_holder": null,               // B 股股东户数（无 B 股时为 null）
  "chg": 32.04,                        // 股东户数环比变动（%）
  "per_float": 16584.555446926857,     // 户均持流通股（股）
  "per_float_chg": -23.14,             // 户均持股环比变动（%）
  "per_amount": 6517896.136196724,     // 户均持股市值（元）
  "price": 393.01,                     // 该报告期股价（元）
  "top_holder_ratio": 66.53,           // 前十大股东合计持股比例（%）
  "top_float_holder_ratio": 63.3138    // 前十大流通股东合计持股比例（%）
}
```

**两组勾稽已验证**：

```
① per_amount = per_float × price
   16584.555446926857 × 393.01 = 6,517,896.136196724   ✅ 完全吻合

② ashare_holder + hshare_holder = holder_num
   269,979 + 54 = 270,033                              ✅ 完全吻合
```

**`chg` 口径已验证**（四期反算全部吻合）：股东户数**环比**变动百分比。

```
(270,033 − 204,504) / 204,504 = +32.04%   == 字段 chg 32.04  ✅
```

### 11.3 ⚠️ 本端点自带 `price`，但不是行情源

`price` 是该报告期的股价快照，用于算 `per_amount`。

> 🔴 **不要用它替代行情数据做估值**：它只在股东人数披露日有值（一年数期），
> 且未说明是收盘价还是均价。算 PE/PB 仍须接专门的行情源（见 §7.5）。

### 11.4 分析价值

本端点是少数能**直接反映筹码流向**的数据：

| 信号 | 含义 |
| --- | --- |
| `holder_num` ↑ + `per_float` ↓ | 筹码分散（散户增多） |
| `holder_num` ↓ + `per_float` ↑ | 筹码集中（通常视为积极信号） |
| `top_holder_ratio` 持续 ↓ | 大股东减持或股权稀释 |

本样本 2026 中报：户数 +32.04%、户均持股 −23.14% —— 典型的筹码分散。

---

## 12. 端点：基金持股

```
GET https://stock.xueqiu.com/v5/stock/f10/cn/org_holding/detail.json
```

机构持仓分析的数据源。本样本单期返回 **2160 条**基金明细。

### 12.1 入参

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `symbol` | string | ✅ | 标的代码 |
| `timestamp` | number | — | 报告期（毫秒），不传取最新期 |
| `extend` | boolean | — | 抓包恒为 `true` |

### 12.2 翻页范式：日期索引（同 `top_holders`）

首次请求返回 `data.times[]`（本样本 33 期），取历史期按 `times[].value`
传 `timestamp` 展开 —— 用 `@Expanded`，不是 `@Paginated`。

⚠️ 与 `top_holders` 的参数名不同：**这里叫 `timestamp`，那里叫 `locate`**。
两者语义相同（指定报告期），但不可互换。

### 12.3 `data` 结构

```jsonc
{
  "timestamp": 1782748800000,     // 当前期时间戳
  "chg_date": "2026中报",          // 当前期名称（⚠️ 是字符串不是日期）
  "times": [ /* 全部可用报告期 */ ],
  "fund_items": [ /* 基金明细，2160 条 */ ]
}
```

> ⚠️ **业务数据在 `fund_items` 而非 `items`** —— 与本组其它端点不一致，
> 取值时容易写错键名。
>
> ⚠️ `chg_date` 字段名像日期，**实为报告期名称字符串**（`"2026中报"`）。

### 12.4 🔴 首条是「全部合计」汇总行，不是一只基金

```jsonc
fund_items[0] = {
  "org_name_or_fund_name": "全部合计",     // ← 汇总行
  "held_num": 294063712,
  "to_float_shares_ratio": 6.9
}
fund_items[1] = {
  "org_name_or_fund_name": "易方达创业板ETF",  // ← 从这里才是个体基金
  "held_num": 16165525,
  "to_float_shares_ratio": 0.3795
}
```

**已验证合计行与明细吻合**：

```
合计行 held_num                294,063,712
2159 条明细之和                294,063,712    ✅ 差额 0
```

**实现要求**：投影时必须把首条**剥离为独立的汇总字段**，
不能混在明细数组里 —— 否则「持仓基金数量」会多算 1，
「最大持仓基金」会永远是那条汇总行。

> ⚠️ 本样本中汇总行**恰好在首位且只有一条**（已全量扫描确认无其它
> 「合计/总计/小计」行）。但不要依赖位置判断，**按名称匹配**更稳妥。

### 12.5 字段字典

| 字段 | 中文名 | 单位 |
| --- | --- | --- |
| `org_name_or_fund_name` | 机构或基金名称 | — |
| `held_num` | 持股数量 | **股** |
| `to_float_shares_ratio` | 占流通股比例 | **百分数**（`0.3795` = 0.3795%） |

⚠️ 字段名 `to_float_shares_ratio` 中的比例是**占流通股**，
不是占总股本，也不是占该基金净值。跨表比对时注意分母口径。

---

## 13. 端点：限售解禁

```
GET https://stock.xueqiu.com/v5/stock/f10/cn/shareschg.json
```

解禁压力分析的数据源。

### 13.1 入参

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `symbol` | string | ✅ | 标的代码 |
| `type` | string | ✅ | 抓包中恒为 `restricts`（限售解禁）。⚠️ **其它取值未验证**，该端点名 `shareschg`（股本变动）暗示可能承载多类数据 |
| `page` / `size` | number | ✅ | 分页，抓包 `size=10` |
| `extend` | boolean | — | 抓包恒为 `true` |

> ⚠️ `type=restricts` 是**上游定义的枚举**，只做形状校验不做白名单
> （CLAUDE.md §3.6）。端点名是 `shareschg` 而非 `restricts`，
> 强烈暗示还有其它 `type` 取值（如股本变动、回购），但本次抓包未覆盖。

### 13.2 字段字典

```jsonc
{
  "holder_name": "香港上海汇丰银行有限公司",
  "floatable_time": 1672761600000,          // 可流通日（解禁日）
  "floatable_shares_num": 3419511.9999999995, // 解禁数量（股）
  "float_shares_type": "定向增发机构配售股份"   // 解禁股份类型
}
```

| 字段 | 中文名 | 单位 |
| --- | --- | --- |
| `holder_name` | 股东名称 | — |
| `floatable_time` | 可流通日（解禁日） | 毫秒时间戳 |
| `floatable_shares_num` | 解禁数量 | **股**（⚠️ 带浮点噪声） |
| `float_shares_type` | 解禁股份类型 | 中文字符串 |

⚠️ `floatable_shares_num` 上游值带浮点噪声（`3419511.9999999995`），
投影时按需取整，但保留原始量级。

### 13.3 已见的 `float_shares_type` 取值

本样本**只出现一种**：`定向增发机构配售股份`（10/10 条）。

A 股实际还有「首发原股东限售股份」「股权激励限售股份」「首发战略配售股份」等，
**本样本未覆盖** —— 实现时按开放字符串处理，不要做枚举映射。

### 13.4 ⚠️ 同一解禁日会有多条记录

本样本 10 条中有 5 条 `floatable_time` 相同（`1672761600000`），
分属不同股东 —— 这是**同一批解禁按股东拆分**的记录。

> 算「某日解禁总量」必须**按 `floatable_time` 分组求和**，
> 不能取单条。这也意味着分页边界可能把同一批解禁劈开，
> 跨页合并后再聚合才准确。

---

## 14. 端点：高管增减持

```
GET https://stock.xueqiu.com/v5/stock/f10/cn/skholderchg.json
```

管理层行为分析的数据源。

### 14.1 入参

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `symbol` | string | ✅ | 标的代码 |
| `page` / `size` | number | ✅ | 分页，抓包 `size=10` |
| `extend` | boolean | — | 抓包恒为 `true` |

### 14.2 字段字典

```jsonc
{
  "symbol": "SZ300750",
  "name": "宁德时代",
  "share_changer_name": "黄世霖",           // 股份变动人
  "manage_name": "黄世霖",                  // 关联高管
  "rr_of_chgr_and_manage": "本人",          // 二者关系
  "duty": "董事、高管",                      // 职务
  "chg_date": 1654012800000,                // 变动日期
  "chg_shares_num": -311500,                // ⚠️ 负数=减持
  "trans_avg_price": 408.0,                 // 成交均价（元/股）
  "daily_shares_balance_otd": 258900700     // 变动后持股余额（股）
}
```

| 字段 | 中文名 | 说明 |
| --- | --- | --- |
| `share_changer_name` | 股份变动人 | 实际买卖的人 |
| `manage_name` | 关联高管 | 变动人若是高管亲属，此处是高管本人 |
| `rr_of_chgr_and_manage` | 变动人与高管的关系 | 本样本全为 `本人` |
| `duty` | 职务 | 如 `董事、高管` |
| `chg_date` | 变动日期 | 毫秒时间戳 |
| `chg_shares_num` | 变动股数 | 🔴 **负数=减持，正数=增持** |
| `trans_avg_price` | 成交均价 | 元/股 |
| `daily_shares_balance_otd` | **变动后**持股余额 | 股（otd = of the day） |

### 14.3 余额链已验证（5/6 精确吻合）

按时间倒序，`本期余额 − 本期变动 == 上期余额`：

```
259,212,300 − (−333,300) = 259,545,600  == 上期  ✅
259,545,600 − (−304,500) = 259,850,100  == 上期  ✅
259,850,100 − (−258,400) = 260,108,500  == 上期  ✅
260,108,500 − (−106,200) = 260,214,700  == 上期  ✅
260,214,700 − (−281,700) = 260,496,400  == 上期  ✅
```

这组等式确认了 `chg_shares_num` 的符号约定与 `daily_shares_balance_otd`
的「变动后」语义。

> ⚠️ **有 1 条差 100 股**（首行 `258,900,700 − (−311,500) = 259,212,200`
> vs 上期 `259,212,300`）。这是**同日多笔交易被合并**所致，不是字段语义问题。
> 实现时不要把余额链当成强校验，只作参考。

### 14.4 分析价值与注意事项

| 用途 | 说明 |
| --- | --- |
| 管理层信心 | 持续减持是负面信号；增持通常为正面 |
| 减持成本参考 | `trans_avg_price` 可与当期股价对比 |
| 减持规模 | `chg_shares_num` × `trans_avg_price` ≈ 套现金额 |

> ⚠️ **不要仅凭减持下结论**：高管减持可能出于个人资金需求、股权激励行权、
> 大宗减持计划等多种原因，需结合 `duty` 与减持比例判断。
> 回写时应作为**事实陈述**，不作投资判断（对齐 `rss-localization` 规则）。

---
