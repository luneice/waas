# rss-spider · 输出格式（差异部分）

> 顶层信封、jq 提取范式、回写约束见 `rules/spider-core.md` / `rules/spider-runtime.md`（随包安装）。本文件只写 rss 特有的 `.data` 形态与简报格式。

## 1. `.data` 主体（按 Skill 区分）

| Skill | 主要数据路径 | 说明 |
|---|---|---|
| `rss-intelligence` | `.data.feed.items[]` | Feed 条目，正文在 `description` |
| `rss-intelligence` | `.data.report` | 补全报告和错误明细 |
| `route-discover` | `.data.radarDetections[]` | URL 检测结果，`resolvedPath` 可直接作为 route |
| `route-discover` | `.data.routes[]` | query / namespace 搜索到的路由模板 |
| `route-discover` | `.data.namespaces[]` | 可用命名空间 |
| `list-extract` | `.data.items[]` | 从网页列表页提取出的条目 |
| `page-extract` | `.data` | 单篇 `RssItem`，正文在 `.data.description` |

## 2. rss 特有 jq 取值

```bash
jq '.data.feed.items[] | {title, link, pubDate, author, category}' result.json   # 摘要条目
jq '.data.feed.items[] | select((.description // "") | length > 0) | {title, link, description}' result.json   # 有正文条目
jq '.data.report' result.json                                                    # 补全报告
jq '.data.radarDetections[] | {route:.resolvedPath, confidence, params:.extractedParams}' result.json   # 可用 route
jq '.data.routes[] | {path, namespace, params, optionalParams}' result.json      # 路由模板
jq '{title:.data.title, link:.data.link, description:.data.description}' result.json   # page-extract 单篇
```

若现有 JSON 结构不便于稳定提取，应回到 Skill 输出契约或 Agent 提示词中改结构，而不是临时解析。

## 3. 默认结构

除非用户要求原始数据，面向用户的输出默认使用：

```text
一句话结论

重点信号
| 信号 | 证据 | 影响 | 置信度 | 建议 |

重要条目
| 时间 | 来源 | 标题 | 摘要 | 链接 |

待跟进
- ...
```

## 4. 简报结构

日报 / 周报 / 专题报告使用：

1. **今日最重要的 3 件事**：每件事 2-4 句，必须带来源。
2. **分主题扫描**：按主题或来源分组。
3. **信号研判**：趋势、异常、风险、机会。
4. **行动建议**：明确下一步做什么。
5. **证据清单**：保留标题、来源、时间、链接。

## 5. 表格字段

常用字段统一命名：

| 字段 | 含义 |
|---|---|
| 时间 | `publishedAt`，未知时用抓取时间并标注 |
| 来源 | `sourceName` 或 feed title |
| 主题 | 归一化主题标签 |
| 实体 | 公司、机构、人物、产品、地区 |
| 证据 | 原文短引文或摘要 |
| 置信度 | 高 / 中 / 低，必要时附数值 |
| 建议 | 用户可执行动作 |

## 6. 不要这样输出

- 不要只列标题，不分析 `description`。
- 不要省略低置信度来源的限定词。
- 不要在没有证据时写“可以看出”“说明”。
- 不要把同一条转载重复写成多个独立信号。
- 不要暴露 Cookie、登录态、私密页面参数或原始凭据。

## 7. 分批输出

分批输出通用规则见 `rules/spider-runtime.md §6`；rss 简报建议按主题分批（如「第 1/3 批：政策与监管」）。
