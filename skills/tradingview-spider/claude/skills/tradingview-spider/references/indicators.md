# 指标类 Skill · 完整参数

技术指标链路是本包**唯一的两段式链路**：先走 HTTP 编译，再走行情长连接挂载。
两段都必须成功才有数据，且失败点常在第二段（见 §两段式原理）。

## tv-indicator-list — 指标目录检索

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `categories` | array | ❌ | `["standard","candlestick"]` | 目录分组，见下表。取值**不做白名单拦截** |
| `keyword` | string | ❌ | — | **本地**关键词过滤（上游无搜索接口），匹配名称/简称/pineId/标签，不区分大小写 |
| `access` | string | ❌ | — | `free` / `restricted` / `unknown`，留空不筛。**建议传 free** |
| `kind` | string | ❌ | — | `study`（指标）/ `strategy`（策略），留空都返回 |
| `limit` | number | ❌ | `60` | 返回条数上限（1–500），免费的排前面 |

**目录分组**（实测条目数与免费占比，2026-07-29）：

| 分组 | 条目数 | 免费/付费 | 内容 |
|---|---|---|---|
| `standard` | 145 | 142 免费 / 3 付费 | 常规技术指标库（MA/RSI/MACD/布林带/ATR/Aroon…） |
| `candlestick` | 45 | **全部免费** | K 线形态识别（吞没/十字星/锤子线…） |
| `fundamental` | 1442 | **全部付费** | 财务科目当指标用（营收/EPS/负债率…） |
| `saved` | 0（本次样本） | — | 当前账号自建脚本，需登录态 |

**关键词建议传英文短词**：指标名多为英文，`RSI` / `MACD` / `moving average` / `bollinger` / `aroon` 命中率高。

**输出要点**：
- `items[].pineId` 是下游 tv-indicator 的唯一入参来源
- `meta.categoryCounts` 给出各分组过滤前的原始条目数
- `meta.truncatedCount > 0` 说明还有符合条件的条目未返回（调大 limit 或收窄 keyword）
- insights 直接列出免费指标的 `pineId → 名称`，可直接从中挑

---

## tv-indicator — 指标数值序列

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `symbols` | array | ✅ | — | 标的清单，1–5 个，共用一条连接（每个标的单独建会话并等上游算完） |
| `pineId` | string | ✅ | — | 指标标识，**来自 tv-indicator-list**，形如 `STD;RSI` |
| `version` | string | ❌ | 最新版 | 指标版本，来自 tv-indicator-list 的 `items[].version` |
| `resolution` | string | ❌ | `1D` | 指标基于此周期计算，取值同 tv-history |
| `bars` | number | ❌ | `300` | 父 K 线根数，**指标在这个范围内计算**（1–20000） |
| `timezone` | string | ❌ | `Etc/UTC` | K 线时区 |
| `inputs` | object | ❌ | 上游默认值 | 覆盖指标参数，键名必须是 `in_0` / `in_1` … |
| `includePoints` | boolean | ❌ | `true` | 设为 false 只回末值与元信息，省上下文 |

### ⚠️ 需要登录态

指标是本包**唯一需要登录态**的 Skill。未登录时会返回 `not-logged-in`：

```
技术指标需要已登录的会话 —— 当前调试浏览器未登录目标站点…
```

实测行为：未登录时 HTTP 编译步骤**能成功**（能拿到指标名与 plots），
但 WS 挂载被上游拒绝（`Study not allowed in this connection`）。
本 Skill 已做前置检查，一次说清而不是逐个标的失败。

（token 只在**页面内**读取并使用，Node 侧全程看不到它 —— 符合「凭据不出页面」。）

### 想要更长的指标序列 → 调大 `bars`

指标**不支持翻页**（不像 tv-history 有 `from` + `request_more_data`）。
上游一次把父 series 覆盖范围内的全部取值推完，所以要更长序列只能加大 `bars`。

**注意长周期指标需要足够前置数据**：如 200 日均线在 `bars=100` 时全是 null。
经验值：`bars` 至少给指标最长周期参数的 2–3 倍。

### 调参：先跑默认，再按编号覆盖

`in_N` 的编号对应上游 inputs 数组的**位置**，不同指标含义不同。推荐流程：

```bash
# ① 先跑默认，从 items[].inputs 看每个参数的 name / value / defaultValue
tv-indicator '{"symbols":["NASDAQ:AAPL"],"pineId":"STD;RSI"}'

# ② 再按编号覆盖（假设 in_0 是 Length）
tv-indicator '{"symbols":["NASDAQ:AAPL"],"pineId":"STD;RSI","inputs":{"in_0":21}}'
```

参数类型（`items[].inputs[].type`）：`integer` / `float` / `text` / `bool` /
`source`（数据源，如 `close`/`open`/`hl2`）/ `resolution`（时间框架，空串=跟随图表周期）。

### ★ 解码 `points[].v`：必须配合 `plots`

`v` 是**位置数组**，不带字段名，只有 `items[].plots` 能说明每个位置是什么：

```jsonc
"plots": [
  { "id": "plot_0", "type": "line",    "title": "RSI",          "target": null },
  { "id": "plot_1", "type": "line",    "title": "RSI-based MA",  "target": null },
  { "id": "plot_2", "type": "colorer", "title": null,            "target": "plot_0" }
],
"points": [
  { "t": 1785000000, "v": [56.2, 54.8, 1] }   // v[0]→plot_0, v[1]→plot_1, v[2]→plot_2
]
```

**通道类型决定怎么读**：

| type | 含义 | 对应 `v[i]` |
|---|---|---|
| `line` | 普通数值线 | 直接是指标计算值 |
| `colorer` | 为其它通道染色 | **调色板索引，不是业务数值**（勿当数据用） |
| `shapes` | 图形标记（背离箭头等） | 通常是 bool/枚举，标记该根是否出现形态 |
| `alertcondition` | 仅用于提醒规则 | 不参与绘图，可忽略 |

`items[].latest` 已把每个数值型通道的**末值**算好（自动跳过末尾的 null），
Agent 问「现在 RSI 多少」直接读它即可，不必自己遍历 points。

### `null` 的语义

`v` 中的 `null` = **该通道在这根 K 线上无值**，典型场景：
- 均线/布林带在序列头部还没形成（前 N 根必然是 null）
- 背离类指标只在特定 K 线上出条件

**这不是数据缺失、也不是采集失败。** 上游用 `1e+100` 表示它（约占全部数值的 20%），
本包已归一为 `null`（若当成真实数值会把 min/max 统计污染成天文数字）。

### repaint 类指标

`studyMeta.historyMayRepaint === true` 表示该指标的历史值**可能随数据增补被上游重算**，
不同时间取到的同一根 K 线的值可能不同。做回测或需要结果可复现时要留意，insights 会告警。

---

## 两段式原理（排查失败时看这里）

```
① HTTP 编译   指标编译服务 /translate/{pineId}/{version}
              → 拿到 ilTemplate（可执行产物）+ plots（解码键）+ inputs（参数规格）
② WS 挂载     行情长连接 create_study(inputs.text = ilTemplate)
              → study_loading → du（数值批量推来）→ study_completed
```

**第 ① 步不可省**：`inputs.text` 是服务端编译产物，客户端无法凭空生成。
历史上试过跳过编译、直接猜 pineId 传给 WS，一律被拒。

**失败点判别**：

| 现象 | 失败在 | 处置 |
|---|---|---|
| 报错含「未能取到可执行产物」 | ① 编译 | 核对 pineId/version（用 tv-indicator-list），或该指标需付费 |
| 报错 `not-logged-in` | 建连前置检查 | 在调试浏览器内登录站点 |
| 报错含「计算失败」+ 上游原因 | ② 挂载 | 看上游原因；付费指标/参数越界都可能 |
| 有 plots 但 points 全空 | ② 挂载 | 常见于 bars 太小导致指标算不出值，调大 bars |

---

## 已知边界（未验证，勿臆测）

- **策略类（`kind=strategy`）不在支持范围内**：抓包证据显示策略走另一个脚本外壳且带回测参数，
  其响应形态未验证。传策略类 pineId 可能失败或只拿到部分数据。
- **付费指标（`access=restricted`）能否取到数据未验证**：抓包样本的响应体被工具丢失，
  无法判断上游是拒绝、降级还是正常返回。不要假设一定失败，也不要假设一定成功。
- **社区脚本（`PUB;` 前缀）未验证**：形状校验放行，但未实测走通完整链路。
