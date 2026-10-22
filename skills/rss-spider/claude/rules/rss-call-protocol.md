# rss-spider · 调用协议（始终生效 · 差异部分）

> 通用调用形式、一次一条命令、jq 提取、错误码表见 `rules/spider-core.md` / `rules/spider-runtime.md`（随包安装）。本文件只写 rss 特有约束。

## 1. 入口选择

| 用户输入 | 第一选择 | 兜底 |
|---|---|---|
| 已知 RSS/Atom/JSON Feed URL | `rss-intelligence` with `url` | 无 |
| 普通网页 URL | `route-discover` with `url` | `list-extract` |
| 已知 RSSHub route | `rss-intelligence` with `route` | `route-discover` 搜索命名空间 |
| 关键词新闻检索 | `rss-intelligence` with `googleQuery` | 补充 `googleSource` / `googleWhen` |
| 单篇文章链接 | `page-extract` | 自定义 `selectors` |
| 列表页但无 RSS | `list-extract` | 自定义 `selectors` |

## 2. 摘要优先

情报扫描默认第一步使用：

```json
{"summary": true}
```

只有满足以下条件之一，才允许直接拉全文：

- 用户明确要求全文。
- 条目数量少于 10 条。
- 来源本身是短消息流，`description` 已经是完整内容。
- 正在执行 `rss-deep-reader` 的深读取证步骤。

## 3. Google News 参数

中文新闻默认使用：

```json
{"googleLocale":{"hl":"zh-CN","gl":"CN","ceid":"CN:zh-Hans"}}
```

优先使用结构化参数：

- `googleQuery`：主题词。
- `googleSource`：来源域名。
- `googleWhen`：`1h` / `1d` / `7d` / `30d` / `1y`。

不要把所有语法都塞进自然语言；需要站点和时间时尽量显式传参。

## 4. 错误表特例（对通用错误码的补充）

| 错误 | 处置 |
|---|---|
| `missing-context` | 检查是否缺少 `url` / `route` / `googleQuery` |
| `no-results` | 换 route、缩小命名空间或改用 Google News / list-extract |
| `browser-unavailable` | 告知需要可用 Chrome 远程调试端口，仍可保留摘要扫描结果 |
| route 返回空 | 回到 `route-discover` 或源目录，确认 route 是否过期 |
| 正文太短 | 用 `page-extract` + selectors 深读，或标记为证据不足 |

## 5. 并发与节制（覆盖通用 ≤5 路建议）

- 深读最多建议 3 路并发。
- 同一站点连续深读要控制数量，优先读取高价值条目。
- 对登录态站点、公众号、社交平台要低频、选择性读取。
