# TradingView（cn.tradingview.com）接口分析文档

> 抓包来源：`cn.tradingview.com.har`（2026-07-24，已登录会话，浏览器打开首页 → 搜索 `US10Y` → 打开 `TVC:US10Y` 详情页/收益率曲线页 → 打开 `NASDAQ:AAPL` 详情页，含期权链）。
> 抓包体量大（2458 条请求），本分析已剔除静态资源（`static.tradingview.com` JS/CSS/图标）、广告与埋点（`doubleclick`、`google.com/ccm|gmp`、`googletagmanager`、`analytics.google.com`、`snowplow-pixel`、`telemetry.tradingview.com`）与 symbol logo 图片（`s3-symbol-logo.tradingview.com`），只保留与行情/检索数据相关的请求。
>
> **⚠ 覆盖范围声明**：本次抓包只走了「搜索 → 债券/收益率曲线 → 个股（含期权）」这一条用户路径，尚未覆盖 K 线图表工具栏的完整交互（画线/指标/多图表联动）、期货合约链、加密货币特有字段、基本面财报页等。下文标注「待补抓」的部分需要针对性重新抓包才能补全字段/参数。
>
> **2026-07 补充实机验证**：针对"宏观利率/隔夜逆回购数据能否拼凑取得"这一具体需求，在已登录会话上做了直接的 WS/HTTP 探测（非仅静态分析 HAR），修正了此前基于 HAR 得出的一处错误结论（K 线历史翻页机制），并新增 §5 给出可直接落地的操作指南。技术指标（Study）协议当时做了两次尝试但未跑通，如实标注为待补抓项。
>
> **2026-07-29 补充抓包（技术指标专项，`【tick】cn.tradingview.com.har`）**：针对性抓取图表页手动添加内建技术指标的完整交互（8 个指标全流程验证），已**完全打通**此前卡住的技术指标协议，新增 **§8** 给出完整的 REST 编译 + WS 挂载两段式实现指南，含免费/付费边界的已验证与未验证部分的清晰区分（不臆造付费指标行为）。

---

## 1. 整体架构：三条链路，职责不重叠

TradingView 的数据获取**不是单一 REST API**，而是三条职责分离的链路，采集时必须按需选择，不能用一条链路硬凑另一条链路的数据：

| 链路 | 承载内容 | 协议 | 是否需要登录态 |
|---|---|---|---|
| **① 检索类 REST**（`symbol-search.tradingview.com`、`scanner.tradingview.com`） | 按关键词/条件查找标的（股票/债券/加密货币/外汇等），批量截面数据（IPO日历、财报日历、收益率曲线全景、相关标的） | HTTP GET/POST，JSON | ❌ 不需要 |
| **② 实时行情 + K 线 WebSocket**（`data.tradingview.com/socket.io/websocket`） | 单个标的的**实时报价全字段**（含基本面/技术指标/期权链）、**历史 K 线序列**、多标的批量报价（watchlist 场景） | WebSocket，自定义分帧协议 | 可选（登录后能拿到 `auth_token`，解锁付费数据字段；未登录用公共 session 也能拿基础行情） |
| **③ 用户态 REST**（`cn.tradingview.com/api/v1/*`、`pricealerts.tradingview.com`、`cn.tradingview.com/chats` 等） | 自选股列表、价格提醒、聊天、用户设置、Offer/试用状态 | HTTP GET/POST，JSON（表单为 `multipart/form-data`） | ✅ 需要 Cookie 会话 |

**采「全市场」数据的关键结论**：
- **没有一个 REST 端点能直接吐出"全市场实时行情"**。`scanner.tradingview.com/<market>/scan` 是**条件过滤后的批量截面查询**（一次性返回，不推送），可用它按 `filter`/`markets`/`preset` 圈定一批标的的**指定字段快照**（见 §3.2），这是最接近"全市场扫描"的能力。
- **真正的逐 tick 实时推送、K 线历史序列，必须走 WebSocket**（见 §4）。REST 的 `scanner.tradingview.com/symbol` 单标的端点（见 §3.3）只返回极少数字段，不能替代 WS。
- 抓包中未出现任何 `scanner.tradingview.com/<market>/scan` 返回"全市场无过滤"的调用——所有样本都带 `filter`/`markets`/`preset`，说明前端从不裸拉全市场，而是场景化过滤（IPO日历、财报日历、收益率曲线、相关标的）。若要做"全市场扫描"，需要自行构造更宽的 `filter`（本文档未抓到该类调用的完整 columns 字典，需要在 TradingView 官网"筛选器/Screener"页面单独抓包补充可用字段全集）。

---

## 2. 鉴权与会话

### 2.1 REST 请求（① + ③）

- 浏览器上下文自动携带 **Cookie**（`sessionid` 等），HAR 导出未落地 Cookie 明文（浏览器隐私策略），但所有 `cn.tradingview.com/api/v1/*`、`pricealerts.tradingview.com/*` 请求均依赖已登录会话——采集时必须在**已登录的浏览器页面上下文**内 `fetch`，不能凭空拼请求。
- `symbol-search.tradingview.com`、`scanner.tradingview.com` 的检索类接口**未见 Cookie 依赖**，公开可访问；但仍需带 `Origin: https://cn.tradingview.com` + `Referer: https://cn.tradingview.com/` 通过跨域校验（同源策略/防盗链），最稳做法仍是在浏览器页面上下文发起。
- 无 CSRF token 机制（不同于裁判文书网等站点）。

### 2.2 WebSocket 认证

连接建立后，客户端立即发送一组初始化消息（顺序不强制，但存在语义依赖）：

```jsonc
{"m":"set_data_quality","p":["low"]}
{"m":"set_auth_token","p":["<JWT>"]}
{"m":"set_locale","p":["zh-Hans","CN"]}
```

- `set_auth_token` 携带的 JWT 从页面 `initData`/前端全局状态中提取（**每次会话过期时间约 4 小时**，`exp`/`iat` 相差约 4 小时），JWT payload 携带账号权限位（`max_studies`/`max_charts`/`max_active_alerts`/`fields_permissions` 等），决定该会话能解锁哪些字段与功能上限。
- 未登录访客也可连接 WS 并拿到基础报价，但 `set_auth_token` 会传一个访客态 token（同样是 JWT，权限位更低）。
- 服务器握手后先推一帧「hello」，包含 `session_id`、`protocol`、`release` 等元信息（见 §4.2）。

### 2.3 二者关系

- 页面加载 → 拉 HTML（内嵌 `window.initData.symbolInfo` 等 SSR 数据，见 §3.5）→ 建立 WS 连接订阅实时数据 → 用户交互触发检索类 REST（搜索框）或用户态 REST（收藏、提醒）。
- **WS 的 `auth_token` 与 REST 的 Cookie 是两套独立的认证材料**，采集时若只需要检索/截面数据可以完全不碰 WS；若需要实时报价/K线，必须先拿到一个有效会话再建 WS。

---

## 3. REST 接口清单

机器可读契约见 [`api/openapi.yaml`](./api/openapi.yaml)（OpenAPI 3.1）。以下是人读导航 + 关键说明。

### 3.1 标的检索 `symbol-search.tradingview.com`

```
GET /symbol_search/v3/
```

| 参数 | 含义 | 取值示例 |
|---|---|---|
| `text` | 检索关键词（可为空=浏览全量，配合 `start` 分页） | `US10Y` / `AAPL` / 空字符串 |
| `hl` | 是否高亮匹配片段 | `1` |
| `exchange` | 限定交易所（空=不限） | `""` |
| `lang` | 界面语言，影响 `description` 语言 | `zh` |
| `search_type` | 限定标的类型；抓包见 `undefined`（不限）与 `bond`（仅债券） | `bond` |
| `domain` | 固定值 | `production` |
| `enable_grouping` | 是否把同一公司多交易所挂牌合并进 `grouped_symbols` | `true` |
| `sort_by_country` | 优先排序的国家代码 | `CN` |
| `promo` | 固定值 | `true` |
| `start` | 分页偏移（`text` 为空时用于"浏览全部"翻页，步长 50） | `50`/`100`/`150`/`200` |

**响应**：`{ symbols_remaining: number, symbols: SymbolSearchItem[] }`。`symbols_remaining` 是**尚未返回的剩余匹配数**（不是总数），可用于判断是否需要继续翻页。

`SymbolSearchItem` 关键字段：`symbol`（代码）、`description`（名称）、`type`（`stock`/`bond`/`fund`/`futures`/`forex`/`spot`/`commodity`/`index`/`dr`/`swap` 等，抓包实测枚举见 openapi）、`exchange`（交易所代码）、`typespecs`（细分标签数组，如 `["government","yield","benchmark"]` 标记基准国债收益率）、`isin`/`cusip`/`cik_code`（证券标识码，仅部分标的有）、`currency_code`、`country`、`logoid`（图标 ID，配合 `s3-symbol-logo.tradingview.com/<logoid>.svg` 取图标，本文档不展开）、`grouped_symbols`（同公司其他交易所挂牌，`enable_grouping=true` 时出现，结构同顶层）。

> **股票代码格式**：TradingView 全局用 `EXCHANGE:SYMBOL` 组合标识一个标的（如 `NASDAQ:AAPL`、`TVC:US10Y`），单独的 `symbol` 字段不足以定位，**所有下游接口（scanner、WS）都要求这个组合形式**。

### 3.2 批量截面扫描 `scanner.tradingview.com/<market>/scan`

```
POST /global/scan
POST /china/scan
POST /bonds/scan
POST /bond/scan          ← 抓包中与 /bonds/scan 并存，用途不同（见下）
```

`<market>` 路径段圈定扫描范围（`global`=全市场不分国别、`china`=仅 A 股、`bonds`=债券收益率曲线族、`bond` 单数用于"个股关联债券"场景）。Query string 里的 `label-product` 是前端埋点标签（标识调用来源模块），**不影响业务逻辑，可省略**。

请求体（`application/json`，但 `Content-Type` 头抓包实际是 `text/plain;charset=UTF-8`，注意别按 JSON Content-Type 硬校验）核心结构：

```jsonc
{
  "columns": ["logo","name","description",...],   // 要返回哪些字段，见下
  "filter": [{"left":"字段名","operation":"equal|in_range|nempty|has|match","right":"值或数组"}],
  "filter2": {"operator":"or|and","operands":[{"expression":{...}}]},  // 复杂条件的嵌套形式
  "sort": {"sortBy":"字段名","sortOrder":"asc|desc"},
  "range": [0, 10],          // 分页：起止下标
  "markets": ["china"],      // 可选，覆盖 URL 路径的 market 限定
  "preset": "ipo_calendar",  // 可选，服务端预置查询模板（免手写 filter）
  "symbols": {"tickers": ["NASDAQ:AAPL", ...]},       // 可选，直接指定标的列表（不做条件过滤）
  "index_filters": [{"name":"...", "values":[...]}],  // 可选，按索引维度过滤（如"某股票关联的债券"）
  "options": {"lang":"zh"},
  "ignore_unknown_fields": false
}
```

**响应**：`{ totalCount: number, data: ScanRow[], params: {...} }`。`params` 回显服务端最终生效的查询条件（含预置模板展开后的完整 filter），`data[]` 每项：

```jsonc
{ "s": "TVC:US01MY", "d": [值1, 值2, ...] }
```

**`d` 是与请求 `columns` 数组严格按下标对应的位置数组**（不是键值对象）！采集时必须在请求侧记住自己传的 `columns` 顺序，响应侧按同一顺序解包，否则字段全部错位。抓包实测样本：

| 场景 | `columns` | 用途 |
|---|---|---|
| IPO 日历 | `logo,name,description,typespecs,type,exchange,market,ipo_offer_time,ipo_offer_price_usd,ipo_offer_status,...` | 未来/近期 IPO 列表 |
| 财报日历 | `earnings_release_next_date,earnings_release_date,earnings_per_share_fq,...` | A 股财报发布日期 |
| 收益率曲线全景 | `pricescale,minmov,maturity_date,term-to-maturity,close,close_30_days_back,close_365_days_back,...` | 美债收益率曲线各期限点位 |
| 全球国债截面 | `maturity_date,close,coupon,typespecs,pricescale,fractional,minmov,minmove2,term-to-maturity,days_to_maturity,country_code_fund` | 多国国债横向对比 |
| 个股关联债券 | `yield_to_maturity,maturity_date`（配合 `index_filters` 按 `bond_issuer_cr_parent_stock_symbol` 定位） | 查某公司发行的债券 |
| 同期限跨国收益率 | `name,type,typespecs,exchange,description,logo,country_code,maturity_date,yield_to_maturity,root,close,current_coupon,coupon_type_general` | 详情页"相关标的"面板 |

> **`filter` 的 `operation` 枚举**（抓包实测，2026-07-29 补充抓包新增 2 个）：`equal`（相等）、`in_range`（区间，`right` 为二元数组，常用于日期/数值范围，**也用于枚举型字段的"属于以下取值之一"**，如 `{"left":"sector","operation":"in_range","right":["Health Services"]}` 筛选某个行业板块、`{"left":"AnalystRating","operation":"in_range","right":["Sell"]}` 筛选分析师评级）、`nempty`（非空）、`has`（数组包含，`right` 可为单值或数组）、`has_none_of`（数组不包含任一值，`has` 的反义，如 `{"left":"typespecs","operation":"has_none_of","right":["etf","mutual"]}` 排除 ETF/公募基金）、`match`（正则匹配，`right` 为正则字符串）、`greater`（大于，`right` 为单个数值，如 `{"left":"dividends_yield_current","operation":"greater","right":15}` 筛选股息率大于 15%）。`filter2` 用于跨字段的 `or`/`and` 复合逻辑，`expression` 内层结构与 `filter` 单项相同。**未见 `less`/`greater_or_equal` 等对称写法出现在本次样本，但符合命名惯例，未验证不代表不存在，不要假设只有以上 6 种就是全集。**
>
> **`filter.left` 支持逗号拼接的复合字段**（本次新确认）：如 `"left":"dividend_ex_date_recent,dividend_ex_date_upcoming"` 配合 `operation:"in_range"`，语义是"这两个字段任一落在区间内即命中"（用于分红日历场景，同时兼容"近期已分红"和"即将分红"两种口径）。财报日历同理用 `"earnings_release_date,earnings_release_next_date"`。这是一种此前文档未记录的字段引用写法，采集实现遇到时不要当成非法字段名报错。
>
> **"按类型过滤标的"的标准写法**（2026-07-29 新抓包，来自 A 股筛选器页面 22 次不同筛选条件交互的共同底座，用户切换任何筛选条件时该部分保持不变）：TradingView 官方筛选器页面**恒定携带**如下 `filter2`，用来把"标的类型"限定为筛选器语境下的"正常可交易证券"（排除认股权证、优先股以外的其它衍生品、未上市 pre-IPO）：
>
> ```jsonc
> {
>   "filter2": {
>     "operator": "and",
>     "operands": [
>       {
>         "operation": {
>           "operator": "or",
>           "operands": [
>             { "operation": { "operator": "and", "operands": [
>               { "expression": {"left":"type","operation":"equal","right":"stock"} },
>               { "expression": {"left":"typespecs","operation":"has","right":["common"]} }
>             ]}},
>             { "operation": { "operator": "and", "operands": [
>               { "expression": {"left":"type","operation":"equal","right":"stock"} },
>               { "expression": {"left":"typespecs","operation":"has","right":["preferred"]} }
>             ]}},
>             { "operation": { "operator": "and", "operands": [
>               { "expression": {"left":"type","operation":"equal","right":"dr"} }
>             ]}},
>             { "operation": { "operator": "and", "operands": [
>               { "expression": {"left":"type","operation":"equal","right":"fund"} },
>               { "expression": {"left":"typespecs","operation":"has_none_of","right":["etf","mutual"]} }
>             ]}}
>           ]
>         }
>       },
>       { "expression": {"left":"typespecs","operation":"has_none_of","right":["pre-ipo"]} }
>     ]
>   }
> }
> ```
>
> 逐条翻译：`type=stock` 且 `typespecs` 含 `common`（普通股）**或** `type=stock` 且含 `preferred`（优先股）**或** `type=dr`（存托凭证）**或** `type=fund` 且 `typespecs` 不含 `etf`/`mutual`（非 ETF/非公募基金的其它基金类型），**且**全局排除 `typespecs` 含 `pre-ipo`（未上市）的标的。这是筛选器场景下"按类型过滤"的官方参考写法——`filter2` 的 4 层嵌套（`operator: and/or` 交替 + `expression`/`operation` 判别）正是 §3.2 上方核心结构里 `filter2` 字段的完整展开范例，之前文档只给了字段定义没给实例，这是首次给出可直接照抄的完整可用样本。同时也印证了 `is_primary`（`{"left":"is_primary","operation":"equal","right":true}`，恒定携带在 `filter` 数组里）用于排除同一公司在多个市场的非主要挂牌，避免重复计数。
>
> **筛选器页面额外用到的支撑端点**（本次抓包确认存在，但响应体因抓包工具捕获缺失全部丢失，只保留了端点存在性与请求参数）：
>
> | 端点 | 推测用途 | 已确认信息 |
> |---|---|---|
> | `GET scanner.tradingview.com/<market>/metainfo` | 该市场筛选器的字段元信息/可用范围（如 `china/metainfo`） | 无 query 参数（除 `label-product`），响应 148/3835 字节两种大小均出现过（可能对应不同缓存状态），响应体未能抓到 |
> | `GET scanner.tradingview.com/enum/ordered?id=<逗号分隔字段名>&lang=<语言>` | 批量取多个枚举字段的可选值字典（本次请求 `id` 携带 `index,country,top_revenue_country_code,exchange,industry,sector,submarket,currency_id,analyst_rating,technical_rating,cfi_code,candlestick_patterns` 共 12 个字段） | 响应体 3796397 字节（约 3.8MB，说明枚举值字典体量巨大），未能抓到内容 |
> | `GET scanner-backend.tradingview.com/enum/ordered?id=metrics_full_name,metrics&...` | 债券收益率相关指标（YTM/YTC/YTP/YTW/Price）的枚举字典 | **唯一一条响应体被成功捕获**：`{"metrics":[{"id":"ytm","name":"YTM",...},...],"metrics_full_name":[{"id":"ytm","name":"Yield to maturity",...},...]}`，共 5 个指标，`options` 字段均为空对象，用途未进一步展开 |
>
> **这三个端点合起来才是官方"股票筛选器"页面的完整字段发现链路**——`metainfo` 给该市场可用字段范围，`enum/ordered` 给具体某个枚举字段的可选值文案（中英对照），`china/scan` 才是真正执行筛选。此前文档"需要专门针对官方筛选器页面重新抓包"的缺口，**这次已经抓到了请求形态，但响应体因抓包工具限制大批量丢失**（22 次 `china/scan` 筛选请求、2 次 `metainfo`、1 次 `enum/ordered` 全部丢失响应体，只有一次 `scanner-backend` 的枚举请求侥幸留存），完整字段字典仍待专项重新抓包补全，不应臆造响应内容。
>
> **`markets` 完整取值**（本次从日历类 `global/scan` 请求中确认，36 个国家/地区代码，此前文档只提到 `china`/`global` 等少数场景值）：`america`、`argentina`、`australia`、`belgium`、`brazil`、`canada`、`china`、`cyprus`、`germany`、`denmark`、`estonia`、`spain`、`finland`、`france`、`greece`、`hungary`、`indonesia`、`india`、`italy`、`japan`、`korea`、`lithuania`、`latvia`、`luxembourg`、`mexico`、`netherlands`、`poland`、`portugal`、`russia`、`romania`、`ksa`、`sweden`、`slovakia`、`turkey`、`uk`、`rsa`。这是**上游定义的枚举**（见文档 CLAUDE.md 规范 §3.6 的判据），采集实现不应据此收窄成白名单拦截，只做形状校验，未列出的国家代码仍应透传给上游由其判定。
>
> **`preset` 已知取值补充**：除已记录的 `ipo_calendar`、`stocks_related_bonds`、`earning`（财报日历）外，本次确认**分红日历场景不使用 `preset`**，而是纯手写 `filter`（`{"left":"dividend_ex_date_recent,dividend_ex_date_upcoming","operation":"in_range","right":[起始时间戳,结束时间戳]}`），说明 `preset` 只是"免手写 filter 的便利参数"而非必须项，同一类日历场景可以有 `preset` 快捷方式，也可以自己拼完整 `filter`。
>
> **完整可用 `columns` 字段字典未抓全**——TradingView 官方"股票筛选器"页面暴露的可选字段有数千个（涵盖基本面/技术面全指标，与 §4.3.1 WS 侧的 `quote_set_fields` 字段体系高度重叠但不完全相同的命名空间），需要专门针对筛选器页面的字段选择器交互重新抓包才能穷举。**不要把 §4.3.1 的 WS 字段名直接套用到 scanner 的 `columns`**——两套命名空间大部分字段名相同但未经逐一验证，遇到 `ignore_unknown_fields:false` 时传入不存在字段会导致请求报错或该字段被静默丢弃。本次新抓包在筛选器场景额外确认了这些 `columns`/`filter.left` 字段可用：`AnalystRating`（含 `.tr` 后缀取中文文案变体）、`Perf.YTD`、`dividends_yield_current`、`price_earnings_ttm`、`total_revenue_yoy_growth_ttm`、`relative_volume_10d_calc`、`sector`（含 `.tr` 变体）、`market_cap_basic`、`fundamental_currency_code`，可作为已验证取值补充进现有清单，但仍只是数千字段中的极小一部分。

### 3.3 单标的轻量快照 `scanner.tradingview.com/symbol`

```
GET /symbol?symbol=<EXCHANGE:CODE>&fields=<逗号分隔字段名>&no_404=true&label-product=<来源标签>
```

用于详情页"表现"面板等轻量场景，一次性返回请求 `fields` 中的字段（键值对象，非位置数组）：

```jsonc
{ "High.1M": 4.714, "Low.1M": 4.361, "Perf.1M": 4.14, "Perf.3M": 8.11, ... }
```

字段名沿用 TradingView 技术指标命名惯例（`Perf.<周期>`=区间涨跌幅、`price_52_week_high/low`=52周高低点、`Recommend.All`=综合技术评级、`average_volume_10d_calc`=10日均量、期权相关 `iv`/`delta`/`gamma`/`theta`/`vega`/`rho`/`theoPrice` 仅期权类标的非 null）。抓包字段无值时返回 `null`，**空值语义是"该类型标的不适用此字段"**（如债券没有 `iv`），不代表数据缺失。

### 3.4 用户态 REST（③，需登录）

| 接口 | 方法 | 用途 | 响应要点 |
|---|---|---|---|
| `cn.tradingview.com/api/v1/symbols_list/active/` | GET | 当前激活的自选股列表（返回**单个**列表对象，非数组） | `{id,type:"custom",name,symbols:[],active,shared,color,description,created,modified}` |
| `cn.tradingview.com/api/v1/symbols_list/custom/` | GET | 全部自定义自选股列表（**数组**，含未激活的） | 同上结构包成数组 |
| `cn.tradingview.com/api/v1/symbols_list/custom/<id>` | GET | 按 ID 取单个自选股列表 | 同上单对象 |
| `cn.tradingview.com/api/v1/symbols_list/colored/` | GET | 按颜色分组的自选股（红/橙/绿等预置分组，本次样本均为空） | 数组，`{id:null,type:"colored",color,symbols:[]}` |
| `cn.tradingview.com/api/v1/offers/` | GET | 当前账号的付费试用/优惠状态 | `{trial:{available_for_anons,is_available,length,expert_trial_length,...}}` |
| `cn.tradingview.com/check_language/` | POST | 按 IP 判定的地区/语言偏好 | `{country_code,locale,is_in_european_union}` |
| `cn.tradingview.com/chats/get/?limit=30` | GET | 私信/社区聊天列表（本次样本为空） | 数组 |
| `cn.tradingview.com/textnotes/getall/` | GET | 图表文字笔记（本次样本为空） | 数组 |
| `cn.tradingview.com/savesettings/` | POST | 保存 UI 布局/偏好设置（`multipart/form-data`，与行情数据无关） | 无采集价值，仅记录存在 |
| `pricealerts.tradingview.com/list_alerts` | GET | 已设置的价格提醒列表 | `{s:"ok",id,r:[]}`，`r` 为提醒明细数组（本次样本为空） |
| `pricealerts.tradingview.com/get_offline_fires` | POST | 离线期间触发过的提醒 | 同上结构 |
| `pricealerts.tradingview.com/get_offline_fire_controls` | POST | 离线提醒的控制状态 | 同上结构 |

> `pricealerts.*` 三个接口 query string 携带 `log_username`（当前登录用户名）、`user_id`（数字用户 ID）——采集前需先知道当前登录账号信息（可从 `check_language` 同源页面的 SSR 数据里拿，或从 WS 的 `set_auth_token` JWT payload 的 `user_id` 字段拿）。

### 3.5 页面 SSR 内嵌数据（非独立接口，但是重要数据源）

`cn.tradingview.com/symbols/<EXCHANGE-CODE>/` 详情页 HTML 内嵌 `window.initData.symbolInfo`，一次性给出该标的的静态元信息（无需等 WS 推送）：

```jsonc
{
  "resolved_symbol": "TVC:US10Y",
  "short_description": "US 10Y yield",
  "description": "United States 10 Year Government Bonds Yield",
  "type": "bond", "typespecs": ["government","benchmark","yield"],
  "exchange": "TVC", "timezone": "America/New_York",
  "source2": {...}, "financial_indicator_id": "10YGBY", "flag": "us", ...
}
```

**采集策略**：若只需要标的的静态元数据（名称/类型/交易所/时区），直接请求详情页 HTML 并正则提取 `window.initData.symbolInfo = {...}` 即可，比建 WS 连接轻量得多；只有需要**实时价格**或**历史K线**时才需要 WS。

---

## 4. WebSocket 实时协议（`data.tradingview.com/socket.io/websocket`）

这是 TradingView 数据能力的核心，承载**实时报价（含全量基本面/技术面字段）**与**历史K线**。

### 4.1 连接与分帧协议

```
GET wss://data.tradingview.com/socket.io/websocket?from=<来源路径>&date=<ISO时间>&auth=sessionid
```

- `from` 是发起连接的页面路径（如 `symbols/TVC-US10Y/`），仅用于服务端日志/统计，不影响数据内容。
- `auth=sessionid` 是固定字面量（不是真实 session 值），真正的鉴权靠连接建立后发送的 `set_auth_token` 消息（JWT）。
- 每个页面可能同时开多个 WS 连接（抓包样本中一个 US10Y 详情页开了 3 个连接：主连接、K线图连接、收益率曲线子图连接），彼此独立但共享同一 `auth_token`。

**分帧格式**（Socket.IO 风格但为 TradingView 自定义，非标准 Socket.IO 协议）：

```
~m~<字节长度>~m~<JSON payload>
```

一次 WS frame 可能拼接多条消息（`~m~N~m~{...}~m~M~m~{...}`），解析时需要按 `~m~数字~m~` 循环切片，不能假设一帧一条消息。消息体统一结构：

```jsonc
{ "m": "<方法名>", "p": [<会话ID>, ...其余参数] }
```

服务端偶尔发送心跳帧 `~m~N~m~~h~<序号>`（无 JSON，`~h~` 前缀），需要原样回传作为心跳应答（keep-alive），采集实现中不能把它当业务消息解析。

### 4.2 握手

连接建立后服务端**主动推送**一帧「hello」（无需客户端先发消息）：

```jsonc
{
  "session_id": "0.225778393.0_lax1-charts-free-4-tvbs-mnda6-6",
  "timestamp": 1784961600, "timestampMs": 1784961600815,
  "release": "release_209-20",
  "protocol": "json",
  "auth_scheme_vsn": 2,
  "via": "23.19.148.72:443"
}
```

紧接着客户端发送初始化三件套（见 §2.2）。此后才能创建业务会话（quote / chart）。

### 4.3 两类业务会话：`quote_session` 与 `chart_session`

WS 连接内可并存多个**独立会话**，每个会话有客户端自生成的会话 ID（前缀区分用途，纯约定非协议强制）：

- `qs_*`（quote session）：订阅一批标的的**实时报价字段**推送。
- `cs_*`（chart session）：订阅**单个标的的K线序列**（含历史 + 实时增量）。

同一 WS 连接里能同时开多个 quote session（抓包样本一个连接内并存 `qs_multiplexer_simple_*`、`qs_multiplexer_full_*`、`qs_multiplexer_watchlist_*`、`qs_snapshoter_basic-symbol-quotes_*`、`qs_snapshoter_session-resolver_*`、`qs_snapshoter_crypto-asset_*` 六个会话——**前端按用途拆分字段集合**：`simple` 拿轻量字段供顶部指数条用，`full` 拿全量字段供详情页用，`snapshoter_*` 是一次性取值不需要持续订阅的辅助查询）。这是前端自己的组织习惯，采集时**不需要照抄这套多会话拆分**，用一个 quote session 订阅所有需要的标的+字段即可。

#### 4.3.1 Quote Session 生命周期

```jsonc
{"m":"quote_create_session","p":["<qs_id>"]}
{"m":"quote_set_fields","p":["<qs_id>","字段1","字段2",...]}
{"m":"quote_add_symbols","p":["<qs_id>","EXCHANGE:CODE"]}   // 每个标的单独一条消息
// ... 服务端持续推送 qsd（见下）...
{"m":"quote_fast_symbols","p":["<qs_id>","CODE1","CODE2",...]}  // 请求这些标的的"快速"字段子集（一次性）
{"m":"quote_remove_symbols","p":["<qs_id>","EXCHANGE:CODE"]}    // 取消订阅单个标的
{"m":"quote_hibernate_all","p":["<qs_id>"]}                     // 挂起整个会话（页面不可见时省流量）
```

服务端推送：

```jsonc
{"m":"qsd","p":["<qs_id>",{"n":"EXCHANGE:CODE","s":"ok","v":{ /* 增量字段 */ }}]}
{"m":"quote_completed","p":["<qs_id>","EXCHANGE:CODE"]}   // 该标的首批全量字段已推送完毕
```

**`qsd` 是增量推送**——同一标的会在短时间内收到多条 `qsd`，每条 `v` 只包含变化/新到达的字段子集（如先推 `{"metrics_loaded":false}`，再推 `{"lp":333.02,"lp_time":...}`），**采集实现必须在客户端按 `n`（标的）做字段合并（merge），不能只取最后一条当全量**。`quote_completed` 标志首批快照结束，之后的 `qsd` 是实时增量更新（`update_mode:"streaming"` 的标的会持续推送逐 tick 变化）。

**字段规模**：本次抓包所有 `qsd.v` 字段并集约 **1500+ 个**，大致分四类：

| 类别 | 数量级 | 示例字段 | 说明 |
|---|---|---|---|
| 实时报价核心 | ~15 个 | `lp`（最新价）、`lp_time`、`ch`（涨跌额）、`chp`（涨跌幅%）、`bid`/`ask`/`bid_size`/`ask_size`、`volume`、`open_price`/`high_price`/`low_price`/`prev_close_price` | 几乎所有标的都有 |
| 标的元信息 | ~30 个 | `description`、`exchange`、`type`/`typespecs`、`currency_code`、`timezone`、`session`/`subsessions`、`pricescale`/`minmov`（价格精度换算用） | 与 §3.5 SSR 数据部分重叠 |
| 基本面财务 | **1000+ 个** | `*_fq`（单季）/`*_fy`（年度）/`*_ttm`（滚动12月）后缀族，如 `earnings_per_share_fq`、`total_revenue`、`accounts_payable_fy`，及对应 `*_h` 历史序列变体 | 仅股票类标的返回，量级最大，命名规律为"指标名+口径后缀" |
| 技术面/衍生 | ~10 个 | `recommendation_buy`/`sell`/`hold`/`total`（分析师评级统计）、`beta_1_year`/`beta_5_year` 等 | 覆盖率因标的类型而异 |
| 期权链（`options-info`） | 单标的一个大对象 | `options-info.families[].series[]`：每个到期日的行权价 `strikes[]` 列表 | 仅正股类标的（如 AAPL）携带，行权价按到期日分组，未含具体 Greeks（Greeks 走 §3.3 的 `scanner/symbol` 端点按 `symbol=EXCHANGE:CODE;ROOT;EXPIRY` 格式单独查） |

> 基本面字段字典体量巨大且随标的类型（行业/资产类别）动态变化，**本文档不逐一穷举**（openapi.yaml 中仅收录实时报价核心字段 + 结构性字段，基本面字段作为 `additionalProperties` 开放对象处理）。如需完整基本面字段字典，建议对着 TradingView "基本面数据"页面的字段选择器单独抓包。

#### 4.3.2 Chart Session 生命周期（K线数据）

```jsonc
{"m":"chart_create_session","p":["<cs_id>","disable_statistics"]}
{"m":"switch_timezone","p":["<cs_id>","Etc/UTC"]}
{"m":"resolve_symbol","p":["<cs_id>","<sds_sym_N>","<EXCHANGE:CODE 或特殊 symbol 表达式>"]}
{"m":"create_series","p":["<cs_id>","<sds_N>","s1","<sds_sym_N>","<周期>",<初始条数或范围>,"<会话标签>"]}
{"m":"set_future_tickmarks_mode","p":["<cs_id>","full_single_session"]}
{"m":"modify_series","p":["<cs_id>","<sds_N>","s1","<sds_sym_N>","<周期>","<会话标签>"]}
{"m":"series_timeframe","p":["<cs_id>","<sds_N>","s1",<起始下标>,<结束下标>,"<周期>",<是否追加更多历史:bool>]}
```

服务端推送：

```jsonc
{"m":"symbol_resolved","p":["<cs_id>","<sds_sym_N>",{ /* 同 §3.5 SSR symbolInfo 结构，外加 pointvalue/pricescale/minmov 换算参数 */ }]}
{"m":"timescale_update","p":["<cs_id>",{"<sds_N>":{"s":[{"i":<序号>,"v":[time,open,high,low,close,volume?]},...]}}]}
{"m":"series_completed","p":["<cs_id>","<sds_N>","streaming","s1",{"rt_update_period":5,"data_completed":"end"}]}
```

**K线数组格式**：`v` 是位置数组 `[time, open, high, low, close, volume]`，**`volume` 字段并非总是存在**——债券收益率等无成交量概念的标的只返回 5 元素 `[time,o,h,l,c]`（抓包实测 `TVC:US10Y`/`FX_IDC:USDCNY`/`TVC:CN10Y` 均为 5 元素，`CRYPTOCAP:TOTAL` 为 6 元素）。`time` 为 **Unix 秒级时间戳**（部分历史早期数据点为负数，代表 1970 年之前，需注意不要按无符号处理）。`i` 是服务端维护的序号（用于后续 `series_timeframe` 请求增量翻页，非时间戳）。

**已观测到的 `resolve_symbol` 标的表达式变体**：
- 普通标的：直接 `"EXCHANGE:CODE"`（如 `"SSE:000001"`）
- 特殊指标表达式：`"={\"metric\":\"ytm\",\"symbol\":\"TVC:CN10Y\"}"`（JSON 字符串套娃，用于取某标的的衍生指标序列，本例为"到期收益率"，`metric` 具体枚举未穷举）
- 内部合成标的：`"INTERNAL:SEASONALS"`（配合另一条 `resolve_symbol` 传入 `"ss_1"` + 真实标的 `"NASDAQ:AAPL"`，用于季节性图表这类需要"合成序列+参照标的"的场景）

##### 扩展 symbol 与复权口径（2026-08-03 补充，已实机验证）

上面的「JSON 字符串套娃」不是 `metric` 专用，而是**通用的扩展 symbol 编码**。
前端 bundle 里的编码函数与可修饰维度：

```js
// 编码：等号 + 键按字典序排序后的 JSON
function a(e){ return "=" + JSON.stringify(l(e)) }
function l(e){ return Object.keys(e).sort().reduce(...) }

// 可修饰的维度（bundle 常量，逐字节核对）
const b = ["symbol","session","unit-id","currency-id","metric",
           "adjustment","backadjustment","settlement-as-close"];

// 默认值
const n = "regular",  // DEFAULT_SESSION
      i = "splits",   // ★ DEFAULT_ADJUSTMENT
      s = !0;         // DEFAULT_SETTLEMENT_AS_CLOSE
```

> **键必须按字典序排列** —— 服务端拿编码串当缓存键，乱序会命中不同的键。

**`adjustment` 是本次最重要的发现：发裸 ticker 时服务端按 `splits` 计算，
即「仅按拆股/送转/配股复权，不含现金分红」。**

已验证取值（**非白名单**，上游可能有未列出的取值）：

| 取值 | 含义 |
|---|---|
| `splits`（默认） | 前复权，仅资本行为调整，**不含现金分红** |
| `dividends` | 前复权，含现金分红（总回报口径） |
| `none` | 不复权，原始成交价 |

`symbol_resolved` 会回显两个相关字段：
- `adjustment`：**生效**口径（注意：实测 A 股个股常**不回显**该字段，只能按请求值理解）
- `allowed_adjustment`：`"any"` = 支持复权；`"none"` = 该标的无复权概念（指数/汇率/利率），
  此时请求任何口径都会被静默忽略，价格恒为原始值

**实机验证数据**（`SSE:601398` 工商银行，`1M`，`from=2007-01-01`）：

| 口径 | 首根收盘（2006-10） | 期间涨幅 |
|---|---|---|
| `splits` | 3.242877 | +142.99% |
| `dividends` | 1.28429766 | +514.34% |

差的 371 个百分点即股息再投。另 `SZSE:000651` 格力 2005-07 首根开盘：
`splits` 0.7756 / `none` 9.98（当年真实盘面）——可见 `splits` 确实做了送转复权，
但幅度只对得上资本行为，对不上累计分红。

> ⚠️ **这个默认口径与 A 股行情软件说的「前复权」不是一回事**（后者通常含分红）。
> 用它算价格涨跌幅没问题，算**总回报会系统性低估**。

**已观测到的周期（`resolution`）取值**：`"1"`（1分钟）、`"1M"`（月线）、`"1D"`（日线）、`"12M"`（年线，用于季节性图）——TradingView 周期字符串惯例：纯数字=分钟，`D`/`W`/`M` 后缀=日/周/月，本次样本未覆盖小时线（通常为 `60`/`120`/`240` 等分钟数）。

`create_series` 第 6 个参数既可以是**整数**（初始加载的 bar 数量，从最新数据向前取），也可以是数组 `["bar_count", <毫秒时间戳>, <数量>]`（季节性图等场景使用，用于把序列对齐到某个锚点日期用于同比展示）。

> **⚠ 已实机验证纠正**：`["bar_count", <时间戳>, N]` 这个锚点**不会**把返回窗口移动到该时间戳附近——实测把锚点设为 `2015-06-01` 请求 `TVC:US10Y`，服务端仍然返回**最新的 10 根日线**（2026年数据），锚点被忽略。真正能把数据拉到指定历史区间的机制是 **`request_more_data`**（见下）。

**获取指定时间范围历史数据的正确方式**：

```jsonc
{"m":"create_series","p":["<cs_id>","<sds_N>","s1","<sds_sym_N>","<周期>",<初始条数，如300>,""]}
// 等待 series_completed 后：
{"m":"request_more_data","p":["<cs_id>","<sds_N>",<本次要向前追加的条数，如5000>]}
// 服务端推送新的 timescale_update，s[].i 变为负数（相对首批数据向前偏移），并追加更早的 bar
// 循环 request_more_data 直到覆盖目标起始日期，或 series_completed 的 p[4] 携带 "data_completed":"end"（已到最早数据边界，不必再翻）
```

实测样本（`FRED:RRPONTSYAWARD`，`1D` 周期，初始 300 根 + 一次 `request_more_data(5000)`）：初始窗口最早到 2025-05，翻页后一次性追加到 **2013-09**（`i:-2826`），且响应的 `series_completed` 携带 `"data_completed":"end"`，说明该序列的可用历史就到此为止（隔夜逆回购这个操作工具本身是 2013 年才创设的，边界符合业务事实）。**判断"是否已取到指定范围最早点"，应看 `data_completed==="end"` 或当前最早一根 bar 的时间已早于目标起始日期，二者任一满足即可停止翻页**，不要死等 `request_more_data` 无限追加。

---

## 5. 宏观/利率类数据实操指南（已实机验证）

> 本节结论均来自对已登录会话的**实时探测**（非仅 HAR 静态分析）：直接建立 WS 连接、发送协议消息、观察真实响应。验证时间：2026-07。

### 5.1 核心结论：宏观数据分两套独立命名空间，覆盖面互补但不完全重叠

TradingView 把"利率"“隔夜逆回购"这类宏观经济数据当作**普通标的**对待，与股票、债券使用同一套 `symbol_resolved`/`create_series`/`qsd` 协议，但背后有两套数据供应商命名空间：

| 命名空间 | 数据源 | 覆盖范围 | 能否用 `symbol_search` 枚举 | 能否用 `scanner/scan` 批量截面 | 能否用 WS 建 K 线 |
|---|---|---|---|---|---|
| `FRED:*` | 美联储圣路易斯联储 FRED 数据库 | 美国及部分跨国宏观序列（`RRPONTSYAWARD`=隔夜逆回购利率、`SOFR`=担保隔夜融资利率、`EFFR`=有效联邦基金利率、`IORB`=准备金利率等） | ✅（`search_type` 不必特指，或用 `search_type=economic`） | ❌（实测 `scanner.tradingview.com/global/scan` 及其他 market 路径均返回空集，`FRED:*` 不在 scanner 索引里） | ✅（`chart_session` 与 `quote_session` 均可正常订阅） |
| `ECONOMICS:*` | TradingView 自建的全球宏观数据库（各国央行/统计局） | 全球各国口径对齐的宏观指标（`USINTR`/`CNINTR`/`JPINTR`/`EUINTR`/`GBINTR`/`AUINTR` 等"XX国家 Interest Rate"，及 `CNRRR`/`INRRR`/`SARRR` 等各国逆回购利率） | ✅ | ✅（实测可用，见 §5.3） | ✅（`chart_session` 与 `quote_session` 均可正常订阅） |

**采集策略**：
- **需要批量横向对比多国同类指标的快照**（如"一次性拿到中美日欧英澳六国当前利率"）→ 优先用 `ECONOMICS:*`，可以走 `scanner/scan`（一次 HTTP 请求，见 §5.3）。
- **需要美联储体系细分工具的数据**（隔夜逆回购、SOFR、有效联邦基金利率这类只有 FRED 才有一手统计的指标）→ 只能用 `FRED:*`，且**只能走 WS**（`quote_session` 拿实时值，`chart_session` 拿历史序列），**不能指望 `scanner/scan` 批量拉取**。
- 两套命名空间在 `symbol_search` 里都能枚举到（用关键词或 `search_type=economic` 过滤），**枚举阶段可以混用，但下游批量截面查询阶段必须按命名空间分流**（`FRED:*` 走 WS 逐个建会话，`ECONOMICS:*` 可以合并进一次 `scanner` 请求）。

### 5.2 用 `symbol_search` 枚举一类宏观指标（不需要预先知道确切代码）

```
GET /symbol_search/v3/?text=<关键词>&search_type=economic&...
```

实测样本（`search_type=economic` + 关键词 `interest rate`）返回 2816 个匹配（`symbols_remaining` 递减翻页可取全）：

```jsonc
{"symbol":"USINTR","description":"United States Interest Rate","exchange":"ECONOMICS","type":"economic"}
{"symbol":"AUINTR","description":"Australia Interest Rate","exchange":"ECONOMICS","type":"economic"}
{"symbol":"INTDSRCNM193N","description":"Interest Rates, Discount Rate for China","exchange":"FRED","type":"economic"}
```

关键词 `reverse repo` 命中 `ECONOMICS:CNRRR`（中国）、`ECONOMICS:INRRR`（印度）、`ECONOMICS:CN14RRR`（中国14天逆回购）等十余个国家的逆回购利率；关键词 `overnight` 命中 `FRED:RRPONTSYD`（隔夜逆回购国债规模）、`FRED:RPONTSYD`（隔夜正回购国债规模）、`FRED:OBFR`（隔夜银行融资利率）等。**`type` 字段固定为 `economic`**，`exchange` 字段区分数据源（`FRED` / `ECONOMICS`，及少数第三方如 `CBOE`/`NASDAQ` 提供的相关指数）。

**建议流程**：先用宽泛关键词（如 `interest rate`/`repo`/`overnight`/国家名）批量枚举出候选标的列表并记录 `exchange:symbol`，人工/规则过滤出真正需要的指标，再按 §5.1 的命名空间分流去查数据——不要尝试穷举 `ECONOMICS:*`/`FRED:*` 的完整代码字典（无官方索引页，只能靠关键词检索逼近）。

### 5.3 `ECONOMICS:*` 批量截面（一次 HTTP 请求拿多国数据）

```jsonc
POST https://scanner.tradingview.com/global/scan
{
  "columns": ["name", "description", "close", "change"],
  "symbols": { "tickers": ["ECONOMICS:USINTR","ECONOMICS:CNINTR","ECONOMICS:JPINTR","ECONOMICS:EUINTR","ECONOMICS:GBINTR","ECONOMICS:AUINTR"] },
  "options": { "lang": "zh" }
}
```

实测响应（2026-07）：

```jsonc
{"totalCount":6,"data":[
  {"s":"ECONOMICS:USINTR","d":["USINTR","United States Interest Rate",3.75,0]},
  {"s":"ECONOMICS:CNINTR","d":["CNINTR","China Interest Rate",3,0]},
  {"s":"ECONOMICS:JPINTR","d":["JPINTR","Japan Interest Rate",1,33.33]},
  {"s":"ECONOMICS:EUINTR","d":["EUINTR","Euro Area Interest Rate",2.4,0]},
  {"s":"ECONOMICS:GBINTR","d":["GBINTR","United Kingdom Interest Rate",3.75,0]},
  {"s":"ECONOMICS:AUINTR","d":["AUINTR","Australia Interest Rate",4.35,0]}
]}
```

`close` 即当前利率值（`change` 是相对上一次发布的变动，此处按前端惯例可能是百分点或百分比，具体口径未在响应中显式标注，采集时建议以 WS `chart_session` 拉到的历史序列做二次校验）。这一步只能拿**最新值的截面快照**，要拿历史序列仍需转到 WS。

### 5.4 WS 拿指定分辨率 + 指定时间范围的历史序列（通用于 `FRED:*` 和 `ECONOMICS:*`）

```jsonc
{"m":"chart_create_session","p":["cs_x","disable_statistics"]}
{"m":"resolve_symbol","p":["cs_x","sym_x","FRED:RRPONTSYAWARD"]}      // 或 "ECONOMICS:CNINTR"
{"m":"create_series","p":["cs_x","sds_x","s1","sym_x","<周期>",300,""]}
```

**分辨率（周期）实测均支持** `1D`（日线）、`1W`（周线）、`1M`（月线），三种分辨率对同一 `FRED:RRPONTSYAWARD` 标的均返回合理的对应粒度序列（月度数据点之间间隔约 30 天，周度约 7 天，日度按 `data_frequency` 字段标注的原始发布频率来，隔夜逆回购利率本身是"值变化时才有新点"的阶梯状序列，同一利率水平会重复出现在多个连续交易日）。

`symbol_resolved` 里的 `data_frequency` 字段（如 `"D"`）标注该指标的**原始发布频率**——请求比原始频率更细的分辨率（如对月度发布的宏观指标请求 `1D`）不会报错，但会得到"阶梯状重复值"而非插值/无效数据，采集时不必因此认为数据错误。

**指定时间范围**：按 §4.3.2 已修正的方式，用 `create_series` 拿最新一批 + `request_more_data` 循环向前翻页，直到最早的 bar 时间早于目标起始日期，或 `series_completed` 返回 `data_completed:"end"`（数据边界，如隔夜逆回购工具本身 2013 年才设立，翻到底自然停在这里）。

### 5.5 技术指标（Study/Indicator）协议——已跑通，完整链路见 §8

> **2026-07-29 更新**：此前"两次尝试均未成功"的结论已被推翻。新抓包（`【tick】cn.tradingview.com.har`，图表页 `TVC:GOLD` + 副图 `TVC:US10Y`，含手动添加 8 个内建技术指标的完整交互）证实 **`create_study` 协议本身完全可用**，此前失败的原因是**凭空猜测了 `pineId`/`pineVersion`/`in_0..in_N` 参数**，而这些参数必须来自专门的 `pine-facade.*` 编译服务，无法凭经验或逆向资料硬凑。
>
> 完整协议细节、免费/付费边界、请求响应格式见新增的 **§8 技术指标（Study）完整协议**。本节保留作为历史记录索引。


---

## 6. 采集"全市场"数据的建议策略

结合以上三条链路，针对不同目标给出建议路径：

| 目标 | 建议链路 | 说明 |
|---|---|---|
| 按名称/代码模糊查找标的，拿到 `EXCHANGE:CODE` | ① `symbol_search/v3` | 支持 `search_type` 限定资产类别；`text=""` + `start` 翻页可"扫描"整个标的库（抓包显示总量近万，`symbols_remaining` 递减到 0 即拉完） |
| 按条件批量筛选一批标的的指定字段快照（如"筛出所有市值>100亿的科技股"） | ① `scanner.tradingview.com/<market>/scan` | 需要自行构造 `filter`；`columns` 字段字典需要针对性补抓（本文档未穷举，见 §3.2 末尾说明） |
| 单个标的的完整实时行情（含基本面） | ② WS `quote_session` | 一次 `quote_add_symbols` + 持续消费 `qsd` 增量合并 |
| 单个标的的历史K线（指定分辨率、指定时间范围） | ② WS `chart_session` | `resolve_symbol` + `create_series` 拿最新一批，`request_more_data` 循环向前翻页直到覆盖目标起始日期或命中 `data_completed:"end"`（见 §4.3.2 / §5.4，`series_timeframe` 消息在本次实测中未被证实是必需步骤） |
| 批量标的的实时价格（watchlist 场景，多个标的但字段较少） | ② WS 同一个 `quote_session` 内 `quote_add_symbols` 多次 | 不需要为每个标的开单独会话 |
| 标的静态元数据（名称/类型/交易所） | ①③ 页面 SSR `window.initData.symbolInfo` 或 WS `symbol_resolved` | 二选一，前者更轻量（不需要建 WS） |
| 自选股列表、价格提醒 | ③ 用户态 REST | 需登录会话 |
| **宏观利率/隔夜逆回购/央行政策利率**（含指定分辨率、指定时间范围） | 见 **§5** | `symbol_search`(`search_type=economic`) 枚举候选 → `ECONOMICS:*` 可走 `scanner/scan` 批量截面，`FRED:*` 必须走 WS；历史序列两者都走 §5.4 的 WS 流程 |
| **技术指标**（MA/RSI/MACD 等派生计算值，官方免费部分） | `pine-facade.*` REST 编译 + WS `create_study` | **已跑通**，完整两段式流程见 **§8** |
| **社区指标/策略**（第三方发布的自定义脚本） | `pubscripts-library.*`（发现）+ 理论上同 `pine-facade` 编译流程 | **发现阶段已确认**，`translate`+`create_study` 全链路**未验证**，见 §8.2 |

**已实机验证、可以放心依赖的结论**：
- 全球主要经济体的政策利率可通过 `ECONOMICS:*` 命名空间一次 HTTP 请求批量拿到截面快照，且同一命名空间也能在 WS 上拿多分辨率历史序列（见 §5）。
- 美联储体系细分工具（隔夜逆回购、SOFR、有效联邦基金利率等）只在 `FRED:*` 命名空间下有，且只能走 WS（`scanner/scan` 对 `FRED:*` 返回空集，已实测排除误用可能，见 §5）。
- K 线历史翻页的真正机制是 `request_more_data`，此前基于 HAR 静态分析得出的 `["bar_count", 时间戳, N]` 锚点结论已被实机测试证伪并更正（见 §4.3.2）。
- **免费技术指标的完整协议已打通**：`pine-facade.tradingview.com` 的 `list`/`translate` 两个 REST 端点 + WS `create_study` 三步即可拿到任意免费指标（含常规技术指标库 142/145 条、K 线形态识别 45/45 条）的历史序列与解码规则（见 §8）。此前"两次尝试均未跑通"的根因是凭空猜测 `pineId`/`inputs.text`，而非协议本身有缺陷。
- **`scanner/scan` 的"按类型过滤标的"完整参考写法已确认**：官方筛选器页面恒定携带的 `filter2` 嵌套结构（`type`+`typespecs` 组合判定 stock/dr/fund 等类型，`has_none_of` 排除 ETF/公募基金/未上市标的）已拿到完整可用样本，`operation` 枚举新增 `greater`/`has_none_of` 两个此前未记录的取值，`filter.left` 支持逗号拼接的复合字段引用（见 §3.2）。

**尚未验证、需要额外抓包才能确认的部分**（不要臆造）：
- `scanner.tradingview.com` 的 `columns` 完整字段字典（股票/基金等资产类别的技术面+基本面筛选字段，量级预计上千）——**本次已确认三个支撑端点的存在与请求形态**（`<market>/metainfo`、`enum/ordered`、22 次不同 `filter` 组合的 `china/scan`，见 §3.2），但**响应体因抓包工具捕获缺失全部丢失**（仅 1 条 `scanner-backend` 枚举请求侥幸留存），完整字段字典仍需专项重新抓包才能穷举。
- **付费技术指标 / 基本面 study（`closed_no_auth`，标准指标库 3 条 + 基本面全部 1442 条）的 `translate` 编译端点真实行为**：本次抓包该场景仅 1 条样本且被抓包工具丢失响应体（`content.text=null` 但 `content.size=21608`，与同一份 HAR 里其它明显应有内容却同样 `text=null` 的条目是同一类工具捕获缺失，**不能**据此判定"付费指标编译失败并返回 null"），需要用付费账号重新抓包才能确认真实响应（成功/403/降级三选一），见 §8.5。
- `is_auth_to_get` 端点的确切语义（是否真的按权限位判断，还是恒定返回 `true` 的占位检查）——本次样本全部是免费指标，无法排除后者，见 §8.5。
- **社区脚本（`PUB;` 前缀）能否走通 `translate`+`create_study` 完整链路**，本次仅确认了发现阶段（`pubscripts-library` 三个端点），未实际编译/挂载过任何一条社区脚本，见 §8.2/§8.5。
- **按关键词搜索指标的服务端接口是否存在**：本次抓包窗口内在图表"添加指标"对话框输入关键词时未观测到任何独立的搜索类请求，初步判断是纯前端本地过滤，但不排除是操作路径未触发到该请求（如需要更长输入才触发防抖搜索）——如需确认，应针对性抓包并观察输入关键词瞬间是否有新请求发出，见 §8.2。
- `news-mediator.tradingview.com`、`economic-calendar.tradingview.com`、`options-charting.tradingview.com` 三类接口：本次抓包请求已发出且部分返回 `200`，但响应体未被抓包工具落地（`content.text` 为空），**接口存在但响应结构未知**，需要重新抓包补全（经济日历尤其数据量大，`size=1124053` 字节，值得单独定向抓包）。
- 期货合约链、加密货币交易对特有字段、财报详情页专属接口——本次抓包路径未覆盖。


---

## 8. 技术指标（Study/Indicator）完整协议

> 本节基于 `【tick】cn.tradingview.com.har`（2026-07-29，已登录会话，`cn.tradingview.com/chart/?symbol=TVC:GOLD` 图表页，手动给主图添加 Aroon Oscillator / Chandelier Exit / ENV / SMMA / LSMA / Divergence Indicator / Bars Up Dn Strategy 六个可编译指标 + Dividends / Splits / Earnings / Overlay / BookerReversal 五个内建指标 + 副图 `TVC:US10Y` 的 Seasonals 指标，抓取完整 REST + WS 交互）撰写。

### 8.1 核心结论：两条完全独立的技术指标路径

TradingView 图表里"添加指标"这一个用户动作，背后走的是**两条协议完全不同的路径**，这是此前尝试凭猜测 `pineId` 屡屡失败的根本原因：

| 路径 | 触发的指标类型 | `create_study` 的 `pineIdFull` 参数形态 | 是否需要先调 REST 编译 |
|---|---|---|---|
| **A. 原生内建指标** | 股息/拆股/财报标注、K 线叠加层、合约展期日、季节性图、部分策略类（Booker 系列等） | 直接是"指标名@库名-版本号"，如 `Dividends@tv-basicstudies-274`、`Overlay@tv-basicstudies-274`、`Seasonals@tv-basicstudies-238!` | ❌ 不需要，客户端 JS bundle 内置了这些指标的计算逻辑，`inputs` 直接是业务参数（如 `{"symbol":"..."}`） |
| **B. Pine 脚本类指标**（绝大多数常见技术指标：MA/RSI/MACD/Aroon/ATR/BB 等） | 几乎所有"标准技术指标库"里能在 Pine 编辑器里看到源码的指标 | **固定壳** `Script@tv-scripting-101!`（策略类是 `StrategyScript@tv-scripting-101!`），真实指标标识完全不出现在这个字符串里 | ✅ **必须**，见 §8.3 |

**这正是此前文档"两次尝试均未跑通"的根因**：旧尝试直接拼 `pineId: "STD;SMA"` 或猜测 `"Moving Average@tv-basicstudies-241"` 传给 `create_study`，但 B 类指标的 `create_study` 请求体里，*真正标识指标身份的字段根本不是 `pineIdFull`*，而是内层 `inputs.pineId`/`inputs.pineVersion`——且 `inputs.text` 还必须是一段**服务端编译好的、按用户当前输入参数序列化的密文**，客户端自己完全无法生成，必须先请求 `pine-facade` 编译服务拿到这段密文。

### 8.2 指标发现：官方目录 vs 社区脚本库——两套完全独立的清单，均无关键词全文搜索

> **补充说明（首版遗漏，现补齐）**：首版分析只覆盖了 §8.3 的 `pine-facade/list`（TradingView 官方内建指标目录），遗漏了图表"指标"对话框里同样重要的**第二个标签页——社区发布脚本库**。两者是完全独立的两个后端服务，`scriptIdPart` 命名空间也不同（官方用 `STD;`，社区用 `PUB;<32位十六进制哈希>`），采集时不能只查一个就当作"已覆盖全部指标"。

**官方指标目录**（`pine-facade.tradingview.com`，见 §8.3）：闭合的 145+45+1442 条固定清单，`scriptIdPart` 前缀 `STD;`，本次抓包 8 个已验证案例全部走这条。

**社区脚本库**（`cn.tradingview.com/pubscripts-library/*`，本次新确认）：用户在 Pine 编辑器发布并共享的第三方指标/策略，数量级远超官方库（仅 `sort=top` 单页就出现了 15 万+ 点赞的 `LuxAlgo` 脚本），`scriptIdPart` 前缀 `PUB;`：

```
GET https://cn.tradingview.com/pubscripts-library/?offset=<偏移>&count=<每页条数>&sort=<top|trending>&type=<1|2>
GET https://cn.tradingview.com/pubscripts-library/editors-picks/?
GET https://cn.tradingview.com/pubscripts-get/personal-access/
```

| 端点 | 用途 | 关键参数 |
|---|---|---|
| `pubscripts-library/` | 分页浏览社区脚本 | `sort`：实测枚举 `top`（按热度/点赞数）、`trending`（趋势上升）；`type`：`1`=指标（study）、`2`=策略（strategy），省略则混合返回；`offset`+`count` 翻页，响应体 `next` 字段直接是下一页完整相对 URL（形如 `/pubscripts-library/?count=20&offset=20`），**无 `total` 计数字段**，翻页需自行判断 `results` 为空或 `next` 缺失时停止 |
| `pubscripts-library/editors-picks/` | TradingView 编辑精选（无分页参数，一次性返回） | 无 |
| `pubscripts-get/personal-access/` | 当前账号已购买/被授权访问的付费社区脚本清单 | 需登录会话；本次样本 `{"default":[],"paid_package":[]}` 为空（账号未购买任何付费脚本） |

**⚠ 两个格式陷阱**：
1. `pubscripts-library/` 与 `pubscripts-get/` 两个端点的响应**编码不一致**——前者抓包中直接是明文 JSON，`editors-picks/` 这一条响应体是 **base64 编码**（HAR 里 `response.content.encoding: "base64"`），采集实现必须按 `content.encoding` 字段判断是否需要先 base64 解码，不能对所有 `pubscripts-*` 响应一视同仁直接当 JSON 解析。
2. `pubscripts-library/` **未见 Cookie 依赖**（HAR 中该请求 `request.cookies` 为空数组），可无登录态访问；但 `pubscripts-get/personal-access/` 语义上必须知道"当前账号"，需要登录会话。

**单条 `results[]` 结构**（与 §8.3 `pine-facade/list` 的 `PineListItem` 字段大体对应但不完全相同）：

```jsonc
{
  "scriptName": "Smart Money Concepts (SMC) [LuxAlgo]",
  "title": "Smart Money Concepts [LuxAlgo]",
  "scriptSource": "",              // 抓包样本恒为空字符串，源码同样不在这个端点下发
  "type": 1,                       // 1=study，2=strategy，与请求参数 type 同义
  "access": 1,                     // 实测枚举 1/2/3，含义未验证（见下）
  "scriptIdPart": "PUB;6daafb2cabe6419d98ae25229d2327f8",   // ★ 后续 translate 的路径参数
  "version": "7",
  "extra": { "is_price_study": true, "kind": "study", "originalScriptId": "USER;...", "sourceInputsCount": 0, "stats": {...} },
  "agreeCount": 154644,            // 点赞/认同数，sort=top 的排序依据
  "isRecommended": true,
  "editorsPick": true,             // 仅 editors-picks 端点的样本携带
  "author": { "id": 7293294, "username": "LuxAlgo", "is_broker": false }
}
```

**`access` 字段语义未经验证，不要臆造**：本次抓包实测 `sort=top` 单页 20 条里出现 17 条 `access:1`、1 条 `access:2`、2 条 `access:3`，且 `access:2`/`access:3` 的条目 `scriptSource` 同样是空字符串（与 `access:1` 无区别，无法从响应内容本身判断差异），比对了两条 `access:3` 样本名称含 "Suite"/"Signals & Overlays™" 字样，**推测**可能与免费/付费或"需邀请码"相关，但**没有实测走通任意一条 `PUB;` 脚本的完整 `translate`+`create_study` 链路**（本次 8 个已验证案例全部是官方 `STD;` 指标），无法确认 `access:2/3` 的社区脚本能否正常编译、编译后 `create_study` 是否会挂载成功——这是继 §8.5 官方付费指标之后**第二处未验证的付费/权限边界**，见 §8.5 补充说明。

**核心结论：本次抓包未发现任何关键词全文搜索接口**——无论是官方指标目录（`pine-facade/list` 只支持按 `filter` 分类，不支持传关键词过滤）还是社区脚本库（`pubscripts-library/` 只支持按 `sort`/`type` 排序过滤，同样没有 `q=`/`query=` 之类的搜索参数），图表"添加指标"对话框里用户实际输入关键词过滤的行为，在本次抓包窗口内**没有触发任何独立的搜索类网络请求**——最合理的解释是前端对已拉取到本地的列表做纯客户端过滤（`filter=standard` 一次性 145 条、`pubscripts-library` 分页拉取后缓存），而非每次按键都发请求。**这意味着采集侧若要实现"按关键词找指标"，只能自己拉全量列表后在本地做字符串匹配，不存在服务端关键词搜索端点可用**——与 §3.1 `symbol_search/v3`（标的检索，服务端真支持关键词）是完全不同的能力形态，不要混淆。

### 8.3 Pine 脚本类指标（B 路径）：四步 REST 编译 + WS 挂载

这是覆盖面最广、也是用户最关心的"技术指标"类型（MA/RSI/MACD/BOLL/ATR/Aroon 等）的完整链路。全部端点在 `pine-facade.tradingview.com`（独立域名，与 §3 检索类、§4 行情类均不同）：

```
GET https://pine-facade.tradingview.com/pine-facade/list?filter=standard      # 可选：发现"有哪些指标"
GET https://pine-facade.tradingview.com/pine-facade/list?filter=candlestick   # 可选：K线形态类指标
GET https://pine-facade.tradingview.com/pine-facade/list?filter=fundamental   # 可选：基本面类"指标"（财务字段）
GET https://pine-facade.tradingview.com/pine-facade/list?filter=saved         # 可选：当前账号自存的脚本

GET https://pine-facade.tradingview.com/pine-facade/versions/{scriptIdPart}/last
GET https://pine-facade.tradingview.com/pine-facade/is_auth_to_get/{scriptIdPart}/{version}
GET https://pine-facade.tradingview.com/pine-facade/translate/{scriptIdPart}/{version}   # ★ 核心：编译出可执行密文
```

**采集/实现建议流程**：

1. **发现阶段**（可选，若已知 `scriptIdPart` 可跳过）：调 `list?filter=standard`（145 条，含指标名 `scriptName`、`scriptIdPart`、`version`、`scriptAccess`）、`filter=candlestick`（45 条，K 线形态识别类）、`filter=fundamental`（1442 条，财务科目当作"study"暴露，全部 `closed_no_auth`，见 §8.5）、`filter=saved`（当前账号自建脚本，本次样本为空数组）。**这四个 filter 互相独立、无需登录态即可访问**（HAR 中该请求无 Cookie，仅带 `Origin`/`Referer`）。
2. **确认版本**（可选，`translate` 内部会自带 last 语义）：`versions/{scriptIdPart}/last` 返回 `[{created, version}]`，通常只需 `list` 里的 `version` 字段即可，不必单独调。
3. **鉴权探测**（可选，纯信息性）：`is_auth_to_get/{scriptIdPart}/{version}` 返回布尔值 `true`/`false`。实测本次抓包全部 8 个已验证指标（均为 `open_no_auth`）该端点均返回 `true`。**该端点语义未完全验证**——是"该账号是否有权限拿到这个指标"还是恒定为 `true` 的健康检查，需要用付费指标 + 免费账号重新抓包才能区分（见 §8.5 的未验证声明）。
4. **★ 编译**（核心步骤）：`translate/{scriptIdPart}/{version}` 返回：

```jsonc
{
  "success": true,
  "result": {
    "IL": "<base64/自定义编码的字节码，与 ilTemplate 存在差异，用途未明>",
    "ilTemplate": "<与下发给 WS create_study 的 inputs.text 完全一致的字符串>",
    "metaInfo": {
      "id": "Script$STD;Aroon_Oscillator@tv-scripting-101",
      "description": "Aroon Oscillator",       // 完整名称
      "shortDescription": "Aroon Osc",          // 图表上显示的简称
      "is_price_study": false,                  // true=叠加在主图价格上；false=独立副图
      "inputs": [ /* 见下方 §8.4，含隐藏字段 text/pineId/pineVersion/pineFeatures + 可见参数 in_0.. */ ],
      "plots": [ /* 见 §8.4，声明输出通道及类型 */ ],
      "styles": { /* plot 的默认展示样式（标题/直方图基线等），采集时可忽略 */ },
      "palettes": { /* colorer 类型 plot 的调色板定义，见 §8.4 */ },
      "defaults": { /* inputs/styles/palettes 的默认值快照 */ },
      "_metainfoVersion": "...",
      "isTVScript": true
    }
  }
}
```

**实测验证（node 逐字节比对）**：`result.ilTemplate` **完全等于** `result.metaInfo.inputs` 中 `id:"text"` 那一项的 `defval` 字段，也**完全等于**本次 WS `create_study` 消息里 `inputs.text` 的取值——三处字符串逐字节相同（8 个样本，字符串长度从 730 到 20418 不等，均验证通过）。**`result.IL` 与 `ilTemplate` 不同**（前 9 字节相同，此后完全发散，`IL` 用途本次未探明，采集时只需要 `ilTemplate`，可忽略 `IL`）。

### 8.4 WS 挂载：`create_study` 请求体的精确结构

> **⚠️ 2026-07-30 实机补充（实现阶段发现，HAR 静态分析看不出来）：连接必须带 `type=chart`**
>
> WS 建连 URL **必须**携带 `type=chart`，否则 `create_study` 恒被拒：
>
> ```
> ✅ wss://data.tradingview.com/socket.io/websocket?from=chart%2F&type=chart&date=…&auth=sessionid
> ❌ wss://data.tradingview.com/socket.io/websocket?from=&date=…&auth=sessionid
>    → {"m":"study_error","p":[…,"Study not allowed in this connection",…]}
> ```
>
> A/B 对照实测（同一已登录会话、同一 ilTemplate、同一 inputs）：
>
> | 组合 | 结果 |
> |---|---|
> | 带 `type=chart`（无论 `from` 取值） | ✅ 拿到数据 |
> | 只改 `from=chart/`、不带 `type` | ❌ 仍被拒 |
> | 无 `set_data_quality` / `chart_create_session` 第二参改 `""` | 与本参数无关，单独改动无效 |
>
> **起作用的只有 `type`**。错误信息里的「this **connection**」是字面意思——
> 授权按**连接类型**判定，与登录态、账号档位、初始化消息序列均无关（未登录也是这个报错，
> 因此极易误判成"缺登录态"或"协议实现错误"）。报价与 K 线不受此参数影响，可恒定携带。
>
> 顺带修正一处此前的推测：**指标不要求真实 JWT**。HAR 里页面发的是真 JWT，
> 但实测用固定字面量 `unauthorized_user_token` + `type=chart` 同样能取到指标数据
> （免费指标）。所以 §8.5 里"付费边界"与"登录态"是两个独立维度，不要混为一谈。


拿到 `ilTemplate` 后，在已建立的 `chart_session` 内发送：

```jsonc
{
  "m": "create_study",
  "p": [
    "<cs_id>",           // chart_session ID
    "<study_id>",        // 客户端自生成的 study 短 ID（本次样本形如 6 位随机字母数字，如 "N1QUyp"）
    "st1",                // 固定字面量（本次全部样本均为 st1/st2，含义类似"该 study 挂在哪个 study-tree 位置"，多个 study 叠加时递增 st2/st3...）
    "<parent_series_id>", // 挂载到哪个 series，即 create_series 时用的 sds_N（如 "sds_1"）
    "Script@tv-scripting-101!",   // ★固定壳，B 路径恒为此值（策略类为 StrategyScript@tv-scripting-101!）
    {
      "text": "<translate 返回的 ilTemplate，原样透传>",
      "pineId": "STD;Aroon_Oscillator",      // 真实指标标识，取自请求 translate 时用的 scriptIdPart
      "pineVersion": "1.0",                   // 取自 translate 请求路径里的 version
      "pineFeatures": { "v": "{...}", "f": true, "t": "text" },  // 原样取自 metaInfo.inputs 里 id="pineFeatures" 的 defval，无需理解内容
      "in_0": { "v": 14, "f": true, "t": "integer" },             // 用户可调参数，键名 in_N 对应 metaInfo.inputs 里 id="in_N" 的那一项
      "in_1": { "v": "", "f": true, "t": "resolution" },
      "__fast_calc": { "v": false, "f": true, "t": "bool" },      // 固定携带，取自 metaInfo.inputs 同名项的 defval
      "__profile": { "v": false, "f": true, "t": "bool" }
    }
  ]
}
```

**`in_N` 参数构造规则**：`metaInfo.inputs` 数组按顺序过一遍，跳过 `id` 为 `text`/`pineId`/`pineVersion`/`pineFeatures` 的固定项，剩余每一项对应一个 `in_N`（`N` 从 0 开始按数组顺序编号，**不是**按 `id` 字符串排序），取该项的 `type` 字段填入 `t`，取用户想要的值（不改参数就用 `defval`）填入 `v`，`f` 固定传 `true`。`__fast_calc`/`__profile` 两个下划线开头的控制位固定携带、取值抄 `defval` 即可（`false`/`false`）。

**输入类型（`type`/`t`）实测枚举**：`integer`（整数步进）、`float`（浮点）、`text`（含未开放下拉的自由文本）、`bool`（布尔开关）、`source`（K 线数据源，如 `"close"`/`"open"`/`"hl2"`，实测恒定字符串，未见下拉候选值列表随指标变化）、`resolution`（周期/时间框架，空字符串 `""` 表示"跟随图表主周期"）。

**响应**：

```jsonc
{"m":"study_loading","p":["<cs_id>","<study_id>","s1_st1"]}      // 开始计算
{"m":"study_completed","p":["<cs_id>","<study_id>","s1_st1"]}    // 首批计算完成（历史指标类，本次 8/8 样本均秒级完成）
{"m":"du","p":["<cs_id>",{"<study_id>":{"st":[{"i":<序号>,"v":[<time>,<plot_0值>,<plot_1值>,...]}],"ns":{...},"t":"s1_st1"}}]}
```

**`du.st[].v` 解码规则（实测逐条验证）**：`v[0]` 恒为 Unix 秒级时间戳，`v[1]` 起与 `metaInfo.plots` 数组**按下标严格对应**（`v[1]` ↔ `plots[0]`，`v[2]` ↔ `plots[1]`，以此类推）。样本核对：`Divergence_Indicator` 的 `plots` 长度为 17，实测 `v` 数组长度为 18（时间戳 + 17 个 plot 值），完全吻合。

**`plots[]` 的 `type` 字段决定如何解读对应位置的数值**：

| `type` | 含义 | 对应 `v[i]` 的语义 |
|---|---|---|
| `line` | 普通线图数值 | 直接是该 bar 的指标计算值 |
| `colorer` | 为另一个 `plot`/`fill` 染色，不单独绘制 | 数值是 `palettes.palette_N.valToIndex` 里的 **key**，查表得调色板下标（如 `palette_0.valToIndex` 里 `"0"→0, "1"→1`，即该值本身通常已是 0/1 这类小整数，直接查 `colors` 表拿颜色名） |
| `shapes` | 图形标记（箭头/圆点等背离指标常见） | 通常是 bool/枚举，标记该 bar 是否出现形态 |
| `alertcondition` | 仅用于提醒规则，不绘制 | 与常规数值绘图无关，采集/展示时可忽略 |

**关键哨兵值**：`1e+100` **跨链路存在**（实机补充）——除指标的 `du.st[].v` 外，
报价 `qsd.v` 里也会出现（实测 `FRED:SOFR` 的 `volume` 就是 `1e+100`，表示"利率类标的
无成交量概念"）。采集实现应在**取数入口**统一归一，而非在各链路末端分别处理。
它表示"该 plot 在这个 bar 上无值"（NaN 的替代表示，非真实数值 1e100），**采集时必须显式判断并转换为 `null`，不能当真实数值参与计算**（如 `Overlay@tv-basicstudies-274` 的历史早期数据大量出现 `1e+100`，含义是"该叠加标的当时尚未上市/无对应交易日数据"）。

**指标移除**：`{"m":"remove_study","p":["<cs_id>","<study_id>"]}`，服务端回 `{"m":"study_deleted","p":["<cs_id>","<study_id>","s1_st1"]}`。

### 8.5 免费 vs 付费边界（用户最关心的问题，如实标注置信度）

**已高置信度验证的部分**：

- `pine-facade/list` 四个 filter 返回的每个条目都带 `scriptAccess` 字段，实测仅两种取值：`open_no_auth`（免费/公开）与 `closed_no_auth`（需要付费/特定权限）。
- `filter=standard`（145 条常规技术指标）中 **142 条 `open_no_auth`，3 条 `closed_no_auth`**（`Auto Key Levels`、`Auto Trend Detector`、`RelativeValue`——均为较新/高级形态识别类指标）。
- `filter=candlestick`（45 条 K 线形态识别）**全部 45 条 `open_no_auth`**。
- `filter=fundamental`（1442 条，逐个财务科目当作"study"暴露，如 `Total revenue`/`Accounts payable`）**全部 1442 条 `closed_no_auth`**——即"基本面数据当指标使用"这条路径在免费账号下**全军覆没**，与 §3.5/§4.3.1 中"基本面字段可以从 WS `qsd` 免费拿到部分"是**两条不同的数据获取路径**，不能混为一谈（`qsd` 基本面字段与这里的 `Fund_*` study 是否同源、免费额度是否互通，本次未验证）。
- 本次抓包实测走完整 REST+WS 全链路验证成功的 8 个指标（Aroon Oscillator / Chandelier Exit / ENV / Smoothed Moving Average / Least Squares Moving Average / Divergence Indicator / 24-hour Volume / Bars Up Dn Strategy）**全部是 `open_no_auth`**，`create_study` 全程无 `study_error`，`is_auth_to_get` 均返回 `true`。

**未验证、不能臆造的部分（如实标注，勿假装已确认）**：

- **`closed_no_auth` 指标的 `translate` 端点实际行为未被证实**。本次抓包唯一一条 `translate/STD;Fund_total_revenue_fq/last` 请求，HTTP 200，`response.content.size=21608` 字节（说明服务端确实返回了实质内容），但 HAR 导出文件里该条目的 `response.content.text` 字段是 JSON 字面量 `null`——**这是抓包工具对该次响应体的捕获缺失**（同一份 HAR 里还有其它多条明显应有内容但 `text` 同样为 `null` 的条目，如 `list?filter=fundamental` 的第一次请求、`news-mediator`、`options-charting` 等，且 `list?filter=fundamental` 有第二次重复请求成功捕获可以印证前一次是工具丢失而非接口真返回空），**不是**"付费指标编译请求被服务端拒绝并返回 null"的证据。真实行为（是否返回 403/权限错误 JSON、还是返回内容但打了水印/降级、或登录付费账号后能正常拿到）**需要重新抓包才能确认**，不应据此臆造"付费指标编译会失败"的结论。
- `is_auth_to_get` 端点的确切语义未验证——本次样本全部是免费指标且全部返回 `true`，无法排除它是"恒定返回 true 的占位健康检查"还是"确实按账号权限位判断"，需要用付费指标账号交叉验证。
- 付费指标若能拿到 `ilTemplate`，`create_study` 挂载后是否会正常推送数据、或是否会收到 `study_error`（如旧版本文档记录的 `"Study not allowed in this connection"`）——本次样本未覆盖，**这仍是唯一"卡住"的环节**，且现在已明确卡点具体位置：不在协议本身（协议对免费指标完全打通），而在"付费指标能否拿到可用的 `ilTemplate`"这一步。
- `scriptAccess` 是否还有第三种取值（如 `open_with_auth`，需登录但不需付费）——本次两个账号态样本（均为免费账号）不足以穷举。
- **社区脚本库（`PUB;` 前缀）的 `access` 字段（1/2/3）语义、以及 `PUB;` 脚本能否走通完整 `translate`+`create_study` 链路，本次完全未验证**（见 §8.2）——本次 8 个已验证案例全部是官方 `STD;` 指标，没有一条社区脚本被实际编译/挂载过。`PUB;` 的 `scriptIdPart` 格式（32 位十六进制哈希）与 `STD;` 差异较大，`translate`/`is_auth_to_get` 两个端点是否对 `PUB;` 前缀同样适用（而非需要走专门的社区脚本端点）也未经验证，不要假设两者可以直接套用同一套流程。

**给下游实现者的建议**：

1. **免费技术指标（含 K 线形态识别）已可完整实现**，按 §8.3-§8.4 的四步流程即可，无需登录态即可探测指标目录与编译（`list`/`translate` 均未见 Cookie 依赖），只有 WS `create_study` 挂载步骤需要在已建立的 `chart_session` 内进行（继承前述 `set_auth_token`，游客态 token 应该也可以，未专门验证游客态）。
2. **付费技术指标 + 基本面 study 全集（1442 条）暂不可实现**，如需支持，第一步应该是用付费账号重新抓包，专门核实 `translate` 端点在付费场景下的真实响应（成功/失败/降级三选一），而不是复用本次免费账号的结论。
3. **不要把 `pine-facade` 的 `scriptIdPart` 命名空间与 §3.2 `scanner/scan` 的 `columns` 字段名混淆**——两者部分同名（如财务科目命名风格接近）但分属不同服务、不同数据形状（前者是"研究报告选中即渲染一条曲线"的 study 输出，后者是"批量标的的单值截面"），未做逐一验证前不要假设可以互换。
4. **需要覆盖社区脚本（`PUB;`）时，先补一次针对性抓包**：手动在图表里从"社区脚本"标签页搜索并添加一个具体的第三方指标（如 LuxAlgo 的某个免费脚本），完整抓取该次 `translate`（确认端点路径是否与官方指标一致）与 `create_study`（确认 `pineIdFull`/`pineId` 格式是否仍是 `Script@tv-scripting-101!` 固定壳），不要凭 §8.2/§8.3 的官方指标结论直接套用。
5. **"按关键词找指标"没有服务端搜索接口可用**（见 §8.2）——若需要这个能力，只能自行拉取 `pine-facade/list` 全量（145+45+1442 条）与 `pubscripts-library` 分页全量后在本地做字符串匹配，评估好数据量（社区库无 `total` 字段、翻页上限未知，全量拉取前建议先探几页评估规模）。