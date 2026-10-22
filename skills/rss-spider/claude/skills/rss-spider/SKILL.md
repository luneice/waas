---
name: rss-spider
description: RSS 情报采集技能集，以"获取详细情报信息"为导向，提供 4 个需求驱动的 Skill，统一输出 RssFeed / RssItem 结构。
---

# rss-spider — RSS 情报采集技能集

以**获取详细情报信息**为核心目标，一次调用即可获得最终结果。

| Skill              | 来源                    | 核心能力                                                    |
| ------------------ | ----------------------- | ----------------------------------------------------------- |
| `rss-intelligence` | RSS/Atom/JSON feed      | 获取 Feed → 完整性评估 → 两级策略链自动补全 → 输出完整 Feed |
| `route-discover`   | URL / 关键词 / 命名空间 | 基于 RSSHub 路由注册表，自动发现 URL 对应的 RSSHub 路由     |
| `list-extract`     | 任意网页列表页          | Puppeteer 自动探测/提取文章列表                             |
| `page-extract`     | 单个网页                | Puppeteer 提取正文（Readability → Markdown）                |

## Feed 来源

`rss-intelligence` 支持三种 Feed 来源（Provider），通过参数自动分发：

| 来源        | 参数          | 说明                                                                                           |
| ----------- | ------------- | ---------------------------------------------------------------------------------------------- |
| 直接 URL    | `url`         | HTTP 获取 RSS/Atom/JSON feed；若 URL 为普通网页，自动通过 Discovery 检测是否有对应 RSSHub 路由 |
| RSSHub 路由 | `route`       | 委托内嵌 RSSHub runtime 获取（首次调用自动初始化，无需显式启动）                               |
| Google News | `googleQuery` | Puppeteer 访问 Google News RSS 接口，获取完整搜索结果                                      |

### 常用路由快速参考

从社交/内容平台 URL 直接取 ID 拼成路由：

| 平台    | URL 示例                        | 路由                                |
| ------- | ------------------------------- | ----------------------------------- |
| B站视频 | `space.bilibili.com/1039025435` | `/bilibili/user/video/1039025435`   |
| B站图文 | `space.bilibili.com/1039025435` | `/bilibili/user/article/1039025435` |
| 微博    | `m.weibo.cn/profile/2656274875` | `/weibo/user/2656274875`            |
| HN Best | `news.ycombinator.com/best`     | `/hackernews/best`                  |

> ID 不明确时先用 `route-discover` 检测，直接传入原始页面 URL 即可自动匹配。

## 内容补全机制

当 Feed 条目正文不完整时，自动启动两级策略链补全：

**item 级**（用什么手段获取全文）：

1. **RSSHub Enricher**（优先）— Discovery 检测条目 URL → 有匹配路由则通过 RSSHub 获取结构化全文
2. **Browser Enricher**（回退）— Puppeteer 打开详情页，逐策略提取内容

**page 级**（从页面中用什么方式提取）：

1. **Readability Extractor**（优先）— Mozilla Readability 提纯 + Turndown 转 Markdown，质量不达标则放弃
2. **Custom Extractor**（回退）— CSS 选择器 / 启发式规则提取

## list-extract 使用场景

`list-extract` 是 RSS feed 之外的**兜底来源**，适用于以下场景：

- **目标网站没有 RSS feed**，也不在 RSSHub 2000+ 路由覆盖范围内
- **需要从 HTML 列表页直接提取文章目录**，如博客首页、新闻列表页、论坛帖子列表
- **已知页面结构**，可通过自定义 `selectors` 精确匹配列表项

典型用法：先尝试 `route-discover` 检测是否有 RSSHub 路由，如果没有，再用 `list-extract` 从列表页"造"出 feed 结构。

**自动探测限制**：探测逻辑基于 `article`、`[class*="item"]`、`li:has(a)` 等语义选择器，对 `<table>` 行式布局（如 Hacker News）**无法自动探测**，必须提供自定义 `selectors`。

## 前置条件

- `rss-intelligence`：可访问的 feed URL、RSSHub route 或 Google News 搜索词（三选一）
- `route-discover`：无特殊依赖（基于 RSSHub 路由注册表，纯计算）
- `list-extract` / `page-extract`：Chrome 远程调试端口（环境变量 `BROWSER_URL`，默认 `http://127.0.0.1:4444`）
- 所有需要浏览器的组件共享同一个 Chrome 实例（带登录态），通过 `IBrowserSessionProvider` 统一管理

**登录态复用**：`page-extract` 和 `rss-intelligence`（浏览器补全）均复用已登录 Chrome 的 Cookie，可直接访问付费/登录墙内容（如 B 站充电专属动态、需登录的微博）。无需额外配置，前提是目标账号已在 Chrome 中保持登录。

## 标准工作流

情报采集**必须**遵循以下三阶段工作流，禁止一次性获取全量正文：

**阶段一：摘要扫描** — 先用 `summary: true` 获取标题列表，掌握全局视图。拿到摘要后列出全部条目索引，按主题/来源/时间分组，标注值得深入阅读的条目。

**阶段二：选择性深入** — 根据用户关注方向，对筛选出的条目用 `page-extract` 逐条获取完整正文，提炼核心观点，记录关键事实与引用，保留原始链接作为信源。所有深入获取的条目都必须被完整分析。

**阶段三：综合产出** — 输出完整条目清单（按时间或主题分组）、跨条目趋势总结、重点条目标注。

## 关键规则

1. **禁止跳过摘要阶段**：不要直接调用不带 `summary` 的 `rss-intelligence`，除非用户明确要求或条目极少（<10 条）
2. **禁止丢弃正文**：获取了 `description` 就必须分析其内容，不能只看标题
3. **禁止默默省略**：如果条目多，分批输出并标注"第 X/Y 批"，绝不因上下文空间而丢弃
4. **必须分析 description**：这是情报的核心字段，包含完整正文/摘要，每条都要提炼观点
5. **route-discover 搜索不支持分词**：关键词是对命名空间/路径的 `includes` 精确匹配，`"hacker news"`（含空格）无法匹配 `"hackernews"`，须用无空格形式搜索
6. **调用与数据提取规则**：一次一条命令、禁止命令拼接、只用 `jq`/`rq` 提取、禁止临时脚本等强约束见 `rules/spider-core.md`（随包安装）；rss 输出契约见 `rules/rss-output-format.md`

## 参考文档

| 文档                                      | 内容                                         |
| ----------------------------------------- | -------------------------------------------- |
| [examples.md](./references/examples.md)   | CLI 调用示例、Google News 搜索规律           |
| [reference.md](./references/reference.md) | 完整参数表、环境变量、输出类型定义、内部行为 |
| [路由指南](./references/README.md)        | RSSHub 2000+ 路由分类索引，渐进式三步查找    |
