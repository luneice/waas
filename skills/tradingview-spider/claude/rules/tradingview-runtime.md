# tradingview-spider · 运行环境前置（差异部分）

> Chrome 远程调试端口前置、端口失败处置、风控熔断通用流程、`--raw` 开关见
> `rules/spider-runtime.md`（随包安装）。本文件只写本包特有约束。

## 1. 必须是已登录会话

四个 Skill 全部在**页面上下文**内发起请求（继承 Origin / Referer / Cookie）：

- HTTP 链路（tv-search / tv-scan）：检索接口**缺 Origin 直接 403**
- 行情链路（tv-quote / tv-history）：WS 握手同样要求 Origin

**未登录不会报错，而是静默降级字段权限** —— 部分付费字段返回 null。
若发现字段大面积为 null，先检查 `127.0.0.1:4444` 的会话是否仍登录。

### 1.1 技术指标是硬性要求（会明确报错，不是静默降级）

`tv-indicator` **必须**有真实登录态，这是与其它 Skill 的关键差异：

| Skill | 未登录时的表现 |
|---|---|
| tv-search / tv-scan / tv-quote / tv-history / tv-indicator-list | 可用（部分付费字段为 null） |
| **tv-indicator** | **直接失败**，返回 `not-logged-in` |

实测行为：未登录时指标的 HTTP 编译步骤**能成功**（能拿到指标名与 plots），
但 WS 挂载被上游拒绝（`Study not allowed in this connection`）。
本包已做建连后前置检查，一次性给出「请先登录」而非逐个标的失败。

处置：在 `127.0.0.1:4444` 的浏览器窗口内完成站点登录后重试。**不要代登录。**

（实现上 token 只在页面内读取并使用，Node 侧全程看不到它 —— 凭据不出页面。）


## 2. 三个域名的可达性要分别确认

本包用到三个上游域名，**可能只通其中一部分**（实测遇到过）：

| 域名 | 服务 | 用于 |
|---|---|---|
| `symbol-search` / `scanner` | HTTP | tv-search / tv-scan |
| `data`（WebSocket） | 长连接 | tv-quote / tv-history / tv-indicator（第②段） |
| 指标编译服务 | HTTP | tv-indicator-list / tv-indicator（第①段） |

若 tv-search 正常但 tv-quote 报 `endpoint-timeout` / `endpoint-http`，
优先排查**代理/VPN 分流规则**是否拦了 WS 域名，而不是怀疑代码。

**tv-indicator 跨两个域名**：编译走 HTTP、取数走 WS，任一不可达都会失败。
报错含「未能取到可执行产物」= 编译域名不通或指标不存在；
报错含「计算失败」= WS 域名可达但上游拒绝了指标请求。

## 3. 行情链路的耗时预期

| 操作 | 典型耗时 |
|---|---|
| tv-quote（多标的） | 数秒（等首批快照到齐） |
| tv-history（单标的、不翻页） | 数秒 |
| tv-history（长历史、多轮翻页） | 数十秒 |
| tv-indicator-list（首次拉分组） | 数秒（fundamental 分组 700KB+，更久） |
| tv-indicator（单标的） | 数秒（编译 + 等上游算完指标） |

长历史请求**不要**误判为卡死；确实需要中断时调小 `maxRounds`。
指标请求同理，`bars` 给很大时上游计算耗时也会上升。
