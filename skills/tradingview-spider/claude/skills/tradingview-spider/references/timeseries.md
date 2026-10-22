# 行情类 Skill · 完整参数

两个 Skill 都走**行情推送通道**（长连接），覆盖面比 tv-scan 全（含 `FRED:` 等扫描索引外的标的）。

## tv-quote — 实时报价快照

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `symbols` | array | ✅ | — | 标的清单，1–50 个，共用一条连接与一个会话 |
| `fields` | array | ❌ | 内置核心集（23 个） | 要订阅的行情字段 |
| `timeoutMs` | number | ❌ | `15000` | 等待首批完整快照的最长时间（1000–120000） |
| `includeRawFields` | boolean | ❌ | `false` | 在 `items[].raw` 附带未投影的原始字段（排查用，显著增大输出） |

**默认字段集**（实测可用）：`lp`(最新价) / `lp_time` / `ch`(涨跌额) / `chp`(涨跌幅%) / `bid` / `ask` / `bid_size` / `ask_size` / `volume` / `open_price` / `high_price` / `low_price` / `prev_close_price` / `description` / `short_name` / `exchange` / `type` / `typespecs` / `currency_code` / `timezone` / `pricescale` / `minmov` / `update_mode`

**输出要点**：
- 上游是**增量推送**（同一标的分多条推来不同字段），已按标的合并为完整快照
- `updateMode !== "streaming"` 的标的会在 insights 中告警（延迟行情/已收盘，勿当实时价用）
- insights 自带涨跌分布与涨跌幅极值

---

## tv-history — 历史 K 线序列

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `symbols` | array | ✅ | — | 标的清单，1–8 个，共用一条连接 |
| `resolution` | string | ❌ | `1D` | 实测可用 `1D`/`1W`/`1M`；分钟线传纯数字（`1`/`60`/`240`，未逐一实测） |
| `adjustment` | string | ❌ | `splits` | 复权口径，见下节。**默认不含现金分红** |
| `from` | string | ❌ | — | 起始时间：`YYYY-MM-DD` 或 Unix 秒。**给了就自动翻页直到覆盖** |
| `to` | string | ❌ | 至今 | 结束时间，格式同 from |
| `bars` | number | ❌ | `300` | 首批取数根数（1–20000） |
| `pageBars` | number | ❌ | `5000` | 每轮向前追加的根数（1–50000） |
| `maxRounds` | number | ❌ | `10` | 翻页轮数上限（1–50，安全阀） |
| `timezone` | string | ❌ | `Etc/UTC` | K 线时区，默认 UTC 避免跨市场换算歧义 |
| `includeBars` | boolean | ❌ | `true` | 设为 false 只回区间统计与元信息，省上下文 |

### 复权口径（adjustment）

**价格字段的含义完全取决于它，回写给用户时必须带上。**

| 取值 | 含义 | 适用 |
|---|---|---|
| `splits`（默认） | 前复权，仅按拆股/送转/配股调整，**不含现金分红** | 价格涨跌幅、技术分析 |
| `dividends` | 前复权，含现金分红与拆股/送转（总回报口径） | 长期总回报、跨资产收益对比 |
| `none` | 不复权，历史价位为当时真实盘面 | 核对历史成交价、还原当年行情 |

⚠️ **默认的 `splits` 与 A 股行情软件说的「前复权」不是一回事**（后者通常含分红）。
上游可能有未列出的取值，本参数只校验形状不做白名单拦截。

**实测差异**（`SSE:601398` 工商银行 `1M` `from=2007-01-01`）：

| 口径 | 首根收盘 | 期间涨幅 |
|---|---|---|
| `splits` | 3.242877 | +142.99% |
| `dividends` | 1.28429766 | +514.34% |
| `none` | — | 原始盘面价 |

差的这 371 个百分点就是股息再投。**用 `splits` 算总回报会系统性低估。**

每个 `items[]` 都带 `adjustment` 块：

```jsonc
{
  "requested": "dividends",     // 请求的口径
  "effective": "dividends",     // 服务端回显的生效口径；null = 上游未回显
  "allowed":   "any",           // 该标的允许的口径；"none" = 无复权概念
  "semantics": "前复权（含现金分红与拆股/送转，即总回报口径）",
  "ignored":   false            // true = 请求未被采纳，价格是未复权原值
}
```

**指数 / 汇率 / 利率类标的没有复权概念**（`allowed: "none"`），传任何口径都会被忽略，
此时 `ignored: true` 且 insights 会显式告警——不要按请求口径解释这些标的的价格。


### 翻页机制

上游用 `request_more_data` 向前追加历史，**不是**靠时间戳锚点定位（锚点形式实测无效，会被服务端忽略并仍返回最新数据）。

终止条件三选一：
1. 上游返回数据边界 → `dataCompleted: true`
2. 最早 bar 已覆盖到 `from` → 正常收口
3. 达到 `maxRounds` → `truncatedByMaxRounds: true`，**insights 明确告知未覆盖完**

**实测样例**：`FRED:RRPONTSYAWARD` `1D` `from=2014-01-01` → 3126 根，覆盖 2013-09-23 ~ 至今，2 轮翻页，`dataCompleted: true`（该工具 2013 年才创设，边界符合业务事实）。

### bar 结构

紧凑格式，**不逐根附 ISO 时间串**（5000 根 × 8 标的会让 payload 翻倍且零信息量）：

```jsonc
{ "t": 1388534400, "o": 1.0, "h": 1.2, "l": 0.9, "c": 1.1, "v": null }
```

`meta.barSchema` 声明布局，`items[].range.fromISO/toISO` 给人读锚点。
`v: null` = 该类标的无成交量概念（利率/收益率），与真实 `0` 不同。
`o/h/l/c` 是**复权后**价格，口径见 `items[].adjustment`。

### 多标的行为

多个标的**共用一条连接**（逐个建会话），单个标的失败不拖垮整批：失败项 `status: "error"` + `errorReason`，其余正常返回，同时落一条 warning。

---

## 超时调参

| 场景 | 建议 |
|---|---|
| 标的多 / 网络慢导致 tv-quote 拿不全 | 调大 `timeoutMs`（上限 120000） |
| 长历史未覆盖到 from | 调大 `maxRounds` 或 `pageBars` |
| 只要统计不要明细 | `includeBars: false` |

## 并发纪律

两个 Skill 都建长连接，**不要并行跑多个 WS Skill**（详见 `rules/tradingview-call-protocol.md`）。多标的请用单次调用的 `symbols` 数组，而非并发多次调用。
