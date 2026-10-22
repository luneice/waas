# 参考手册

> 快速上手见 [SKILL.md](../SKILL.md)，调用示例见 [examples.md](./examples.md)。

## rss-intelligence 完整参数

| 参数               | 类型    | 必填 | 默认值       | 说明                                                                                                                                     |
| ------------------ | ------- | ---- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `url`              | string  | 否   | —            | 直接 RSS/Atom/JSON feed 地址（与 `route` / `googleQuery` 三选一，优先级最高）。若为普通网页 URL，自动通过 Discovery 检测对应 RSSHub 路由 |
| `route`            | string  | 否   | —            | RSSHub 路由路径（如 `/bilibili/user/video/2267573`）                                                                                     |
| `rsshubBase`       | string  | 否   | env 配置     | RSSHub 实例地址（仅 `route` 模式生效）                                                                                                   |
| `googleQuery`      | string  | 否   | —            | Google News 搜索关键词（如 `AI site:techcrunch.com when:7d`）                                                                            |
| `googleLocale`     | object  | 否   | 英文国际版   | Google News 地区配置 `{ hl, gl, ceid }`                                                                                                  |
| `googleSource`     | string  | 否   | —            | 限定 Google News 来源域名（如 `techcrunch.com`、`36kr.com`），仅 `googleQuery` 模式生效                                                  |
| `googleWhen`       | string  | 否   | —            | Google News 时间范围筛选：`1h`（1小时）、`1d`（1天）、`7d`（7天）、`30d`（30天）、`1y`（1年），仅 `googleQuery` 模式生效                 |
| `maxItems`         | number  | 否   | `15`         | 最大深入爬取条数，限制对不完整条目进行内容补全的数量。Feed 列表始终返回全部条目                                                          |
| `summary`          | boolean | 否   | `false`      | 摘要模式：只返回 title + link + pubDate + author，省略 description                                                                       |
| `skipEnrichment`   | boolean | 否   | `false`      | 跳过内容补全（仅获取 feed 原始数据）                                                                                                     |
| `minContentLength` | number  | 否   | env 配置     | description 纯文本最小字符数，低于此值触发补全                                                                                           |
| `maxEnrichItems`   | number  | 否   | env 配置     | 最大补全条数                                                                                                                             |
| `concurrency`      | number  | 否   | env 配置     | 详情页并发数                                                                                                                             |
| `format`           | string  | 否   | `"markdown"` | 输出正文格式：`"markdown"` 或 `"html"`                                                                                                   |
| `detailSelectors`  | object  | 否   | —            | 详情页自定义 CSS 选择器 `{ content, title, author, time }`                                                                               |

> `url`、`route`、`googleQuery` 至少提供一个，`url` 优先。

### route 模式默认地址优先级

1. 调用参数中的 `rsshubBase`
2. 环境变量 `RSSHUB_BASE_URL`
3. 项目内默认内嵌地址 `rsshub://embedded`

## route-discover 完整参数

| 参数             | 类型    | 必填 | 默认值  | 说明                                                                                                        |
| ---------------- | ------- | ---- | ------- | ----------------------------------------------------------------------------------------------------------- |
| `url`            | string  | 否   | —       | 网页 URL — 自动检测该 URL 对应的 RSSHub 路由（如 `https://www.bilibili.com/video/BV1xx` → `/bilibili/...`） |
| `query`          | string  | 否   | —       | 关键词搜索（按命名空间名称和路由路径模糊匹配，如 `bilibili` / `github`）                                    |
| `namespace`      | string  | 否   | —       | 指定命名空间，列出其下所有路由（如 `bilibili`）                                                             |
| `listNamespaces` | boolean | 否   | `false` | 设为 `true` 时列出所有可用命名空间（忽略其他参数）                                                          |

> `url`、`query`、`namespace`、`listNamespaces` 至少提供一个。路由发现基于 RSSHub 路由注册表，无需浏览器。

## list-extract 完整参数

| 参数        | 类型   | 必填 | 默认值 | 说明                                                     |
| ----------- | ------ | ---- | ------ | -------------------------------------------------------- |
| `url`       | string | 是   | —      | 列表页地址                                               |
| `selectors` | object | 否   | —      | 自定义 CSS 选择器 `{ item, title, link, time, summary }` |

`selectors` 各字段均为相对于列表项容器的 CSS 选择器，省略时自动探测。

## page-extract 完整参数

| 参数        | 类型   | 必填 | 默认值       | 说明                                                                                                    |
| ----------- | ------ | ---- | ------------ | ------------------------------------------------------------------------------------------------------- |
| `url`       | string | 是   | —            | 详情页地址                                                                                              |
| `selectors` | object | 否   | —            | 自定义 CSS 选择器 `{ content, title, author, time }`                                                    |
| `format`    | string | 否   | `"markdown"` | `"markdown"`（Readability + Turndown）或 `"html"`（Readability 提纯）。失败时 fallback 到原始 innerHTML |

## 环境变量

所有可配置项通过 `.env` 管理：

| 变量                           | 默认值                  | 说明                                                                       |
| ------------------------------ | ----------------------- | -------------------------------------------------------------------------- |
| `RSSHUB_BASE_URL`              | `rsshub://embedded`     | RSSHub route 执行模式默认地址；改成 `http(s)://...` 可切到外部 RSSHub 实例 |
| `RSSHUB_PUPPETEER_WS_ENDPOINT` | 空                      | 显式提供给内嵌 RSSHub runtime 复用的浏览器 WebSocket 端点                  |
| `RSSHUB_CACHE_TYPE`            | `memory`                | 内嵌 RSSHub 缓存类型（`memory` / `redis` / 空字符串禁用缓存）              |
| `RSSHUB_MEMORY_MAX`            | `256`                   | 内嵌 RSSHub 内存缓存上限                                                   |
| `RSSHUB_REQUEST_TIMEOUT`       | `30000`                 | 内嵌 RSSHub route 请求超时（毫秒）                                         |
| `BROWSER_URL`                  | `http://127.0.0.1:4444` | Chrome 远程调试地址（Puppeteer CDP）                                       |
| `FEED_FETCH_TIMEOUT`           | `30000`                 | Feed HTTP 请求超时（毫秒）                                                 |
| `PAGE_NAVIGATION_TIMEOUT`      | `90000`                 | 页面导航超时（毫秒）                                                       |
| `PAGE_CONTENT_TIMEOUT`         | `60000`                 | 页面内容等待超时（毫秒）                                                   |
| `BROWSER_CONNECT_TIMEOUT`      | `30000`                 | Puppeteer 连接超时（毫秒）                                                 |
| `MIN_CONTENT_LENGTH`           | `200`                   | 完整性判断阈值（纯文本字符数）                                             |
| `MAX_FEED_ITEMS`               | `0`（不限）             | 最大返回条数                                                               |
| `MAX_ENRICH_ITEMS`             | `20`                    | 最大补全条数                                                               |
| `ENRICH_CONCURRENCY`           | `3`                     | 补全并发数                                                                 |
| `GLOBAL_TIMEOUT`               | `300000`                | CLI 全局超时（毫秒）                                                       |

## 故障提示说明

- `路由不可用:` route 无效、暂不支持或当前无法返回 feed
- `浏览器能力不可用:` 浏览器依赖 route 缺少可复用浏览器能力

> 说明：内嵌模式使用当前仓库安装的 `rsshub` 包版本，首次调用时自动初始化，无需显式启动。若某个较新的官方 route 尚未包含在该版本中，可通过 `rsshubBase` 或 `RSSHUB_BASE_URL` 切换到外部 RSSHub 实例。

## 输出类型定义

### RssResult（rss-intelligence 输出）

```typescript
interface RssResult {
  feed: RssFeed;
  report: EnrichReport | null; // 跳过补全时为 null
}

interface EnrichReport {
  enriched: number; // 成功补全条数
  failed: number; // 失败条数
  skipped: number; // 跳过条数
  errors: Array<{ url: string; error: string }>;
}
```

### RouteDiscoverResult（route-discover 输出）

```typescript
interface RouteDiscoverResult {
  /** 匹配模式 */
  matchMode: "radar" | "search" | "namespace" | "list-namespaces";
  /** Radar 检测结果（仅 url 模式） */
  radarDetections?: DetectionResult[];
  /** 搜索 / 列举的路由列表 */
  routes?: RouteInfo[];
  /** 命名空间列表（仅 listNamespaces 模式） */
  namespaces?: string[];
  /** 结果数量 */
  count: number;
}

interface DetectionResult {
  route: RouteInfo;
  confidence: number; // 0-1 匹配置信度
  extractedParams: Record<string, string>;
  resolvedPath: string; // 可直接传给 rss-intelligence 的 route 参数
}

interface RouteInfo {
  path: string; // 路由模板，如 /bilibili/user/video/:uid
  namespace: string; // 命名空间，如 bilibili
  params: string[]; // 必填参数名列表
  optionalParams: string[]; // 可选参数名列表
}
```

### RssFeed

```typescript
interface RssFeed {
  title: string;
  link: string;
  description: string;
  items: RssItem[];
}
```

### RssItem

```typescript
interface RssItem {
  title: string;
  link: string;
  pubDate?: string;
  description?: string;
  author?: string;
  category?: string[];
}
```

## rss-intelligence 内部行为

### 三步执行流程

1. **Acquire Feed** — `FeedProviderFactory` 根据参数选择 Provider（URL / RSSHub / Google News），获取 Feed
2. **Assess** — 纯函数 `assessCompleteness()` 按 `minContentLength` 将条目分为 complete / incomplete / unenrichable
3. **Enrich** — `EnrichmentChain` 对 incomplete 条目执行两级策略链补全

### 补全策略链

**item 级**（由 `EnrichmentChain` 按优先级编排）：

| 顺序 | Enricher        | 触发条件                                    | 行为                             |
| ---- | --------------- | ------------------------------------------- | -------------------------------- |
| 1    | RsshubEnricher  | Discovery 检测到条目 URL 有对应 RSSHub 路由 | 通过 RSSHub 获取结构化全文       |
| 2    | BrowserEnricher | 上一策略返回 null / 失败                    | Puppeteer 打开详情页，逐策略提取 |

**page 级**（`BrowserEnricher` 打开页面后按优先级尝试）：

| 顺序 | Extractor            | 行为                                    | 放弃条件                        |
| ---- | -------------------- | --------------------------------------- | ------------------------------- |
| 1    | ReadabilityExtractor | Readability 提纯 + Turndown 转 Markdown | 纯文本长度 < `minContentLength` |
| 2    | CustomExtractor      | CSS 选择器 / 启发式规则提取             | 未找到内容容器                  |

### Feed 来源自动检测

当 `url` 参数为普通网页（非 RSS feed）时，`FeedProviderFactory` 内部调用 `Discovery.detect(url)` 自动查找对应的 RSSHub 路由：

- 有匹配路由 → 自动切换为 RSSHub Provider
- 无匹配 → 尝试作为 RSS feed 直接解析（兜底）

### 浏览器共享

所有需要浏览器的组件（Google News Provider / RSSHub Runtime / Browser Enricher）共享同一个 Chrome 实例，通过 `IBrowserSessionProvider` 统一管理。RSSHub 通过 `getWSEndpoint()` 获取 WebSocket 端点来复用同一浏览器。

### 错误行为

- 浏览器不可达但只是正文补全过程失败 → 返回原始 feed + 补全报告，不会崩溃
- 每次补全均生成 `EnrichReport`（成功/失败/跳过计数 + 失败明细）
- 错误分类对齐 `@spider/core` 的 `SkillFailureKind`：`browser-unavailable` / `no-results` / `missing-context`

### 故障提示说明

- `[browser-unavailable]`：Chrome 远程调试端口不可达
- `[no-results]`：RSSHub 路由无返回或 Feed 为空
- `[missing-context]`：参数不足（未提供 url / route / googleQuery）

> 说明：内嵌模式使用当前仓库安装的 `rsshub` 包版本，首次调用时自动初始化，无需显式启动。若某个较新的官方 route 尚未包含在该版本中，可通过 `rsshubBase` 或 `RSSHUB_BASE_URL` 切换到外部 RSSHub 实例。
