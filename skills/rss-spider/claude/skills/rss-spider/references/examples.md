# 调用示例

> 工作流约束见 [SKILL.md](../SKILL.md)，完整参数见 [reference.md](./reference.md)。

## rss-intelligence

### 基础用法

```bash
# RSSHub 路由
node scripts/index.js rss-intelligence '{"route":"/github/trending/daily/javascript"}'

# 使用项目内默认内嵌 runtime 验证普通 route
node scripts/index.js rss-intelligence '{"route":"/github/branches/microsoft/vscode","summary":true}'

# 显式覆盖到外部 RSSHub 实例
node scripts/index.js rss-intelligence '{"route":"/github/branches/microsoft/vscode","rsshubBase":"http://remote-rsshub:1200","summary":true}'

# 直接 URL — 自动判断 + 补全
node scripts/index.js rss-intelligence '{"url":"https://news.google.com/rss/search?q=AI&hl=zh-CN&gl=CN"}'

# 普通网页 URL — 自动通过 Discovery 检测对应 RSSHub 路由
node scripts/index.js rss-intelligence '{"url":"https://www.bilibili.com/v/tech/science"}'

# Google News 搜索（中文）
node scripts/index.js rss-intelligence '{"googleQuery":"remote sensing site:sciencedirect.com when:90d","googleLocale":{"hl":"zh-CN","gl":"CN","ceid":"CN:zh-Hans"}}'

# Google News — 使用独立参数筛选来源和时间（等效于上面的搜索语法，但对 Agent 更友好）
node scripts/index.js rss-intelligence '{"googleQuery":"remote sensing","googleSource":"sciencedirect.com","googleWhen":"90d","googleLocale":{"hl":"zh-CN","gl":"CN","ceid":"CN:zh-Hans"}}'

# Google News — 只筛选来源
node scripts/index.js rss-intelligence '{"googleQuery":"人工智能","googleSource":"36kr.com","googleLocale":{"hl":"zh-CN","gl":"CN","ceid":"CN:zh-Hans"}}'

# Google News — 只筛选时间（最近7天）
node scripts/index.js rss-intelligence '{"googleQuery":"AI","googleWhen":"7d"}'
```

### 控制行为

```bash
# 跳过补全（仅获取 feed 原始数据）
node scripts/index.js rss-intelligence '{"url":"https://example.com/rss.xml","skipEnrichment":true}'

# 自定义阈值 + 限制补全条数
node scripts/index.js rss-intelligence '{"url":"https://example.com/rss.xml","minContentLength":100,"maxEnrichItems":10}'

# 限制返回条数 — 仅补全最新 5 条
node scripts/index.js rss-intelligence '{"url":"https://example.com/rss.xml","maxItems":5}'
```

### 摘要模式

```bash
# 摘要模式 — 先浏览列表（只返回 title+link+pubDate，不含正文）
node scripts/index.js rss-intelligence '{"url":"https://example.com/rss.xml","summary":true}'

# 摘要 + 限量 — 快速扫描最新 10 条标题，再对感兴趣的调 page-extract
node scripts/index.js rss-intelligence '{"url":"https://example.com/rss.xml","summary":true,"maxItems":10}'

# 浏览器依赖 route 示例（是否可用取决于站点策略；默认 runtime 会尝试复用 BROWSER_URL 对应的浏览器能力）
node scripts/index.js rss-intelligence '{"route":"/weibo/user/1245732825","summary":true}'
```

### 实测可用路由

以下路由经本地验证，直接可用：

```bash
# B站 UP 主投稿视频列表（取 space.bilibili.com/ 后的 uid）
node scripts/index.js rss-intelligence '{"route":"/bilibili/user/video/1039025435","summary":true}'

# B站 UP 主图文/动态列表（同 uid）
node scripts/index.js rss-intelligence '{"route":"/bilibili/user/article/1039025435","summary":true}'

# 微博用户时间线（取 weibo.cn/profile/ 或 weibo.com/ 后的 uid）
node scripts/index.js rss-intelligence '{"route":"/weibo/user/2656274875","summary":true}'

# Hacker News Best
node scripts/index.js rss-intelligence '{"route":"/hackernews/best","summary":true}'
```

## route-discover

```bash
# 从网页 URL 自动发现 RSSHub 路由
node scripts/index.js route-discover '{"url":"https://www.bilibili.com/video/BV1xx411c7mD"}'

# 从 space.bilibili.com 用户主页发现路由
node scripts/index.js route-discover '{"url":"https://space.bilibili.com/1039025435"}'

# 从微博用户主页发现路由
node scripts/index.js route-discover '{"url":"https://m.weibo.cn/profile/2656274875"}'

# 按关键词搜索路由（注意：不支持空格分词，"hackernews" 而非 "hacker news"）
node scripts/index.js route-discover '{"query":"hackernews"}'
node scripts/index.js route-discover '{"query":"bilibili"}'

# 列出命名空间下所有路由
node scripts/index.js route-discover '{"namespace":"bilibili"}'

# 列出所有可用命名空间
node scripts/index.js route-discover '{"listNamespaces":true}'
```

> `route-discover` 无需浏览器，基于 RSSHub 路由注册表纯计算。发现路由后可将 `resolvedPath` 直接传给 `rss-intelligence` 的 `route` 参数。

## list-extract

```bash
# 自动探测列表结构（适用于 article/li 等语义标签布局）
node scripts/index.js list-extract '{"url":"https://example.com/blog"}'

# 自定义选择器（对 <table> 行式布局等自动探测失败的页面，必须提供 selectors）
node scripts/index.js list-extract '{"url":"https://example.com/news","selectors":{"item":"article","title":"h2","link":"a"}}'

# Hacker News 示例（<table> 布局，必须自定义选择器）
node scripts/index.js list-extract '{"url":"https://news.ycombinator.com/best","selectors":{"item":"tr.athing","title":".titleline > a","link":".titleline > a"}}'
```

> 如需每条完整正文，可对提取到的链接逐个调用 `page-extract`。

## page-extract

```bash
# 自动提取
node scripts/index.js page-extract '{"url":"https://example.com/blog/post-1"}'

# 自定义选择器
node scripts/index.js page-extract '{"url":"https://example.com/article/123","selectors":{"content":".article-body","author":".byline"}}'

# 读取需登录的内容（复用已登录 Chrome 的 Cookie，如 B 站充电专属动态）
node scripts/index.js page-extract '{"url":"https://www.bilibili.com/opus/1189502295119757334"}'
```

---

## Google News RSS 搜索规律

当目标站点没有 RSS 时，可使用 Google 新闻 RSS 搜索作为"二次索引"。

### URL 模板

```
https://news.google.com/rss/search?hl=<界面语言>&gl=<国家/地区>&ceid=<地区:语言>&oc=3&q=<查询>&filter=0
```

### 参数说明

| 参数     | 说明                             | 示例                             |
| -------- | -------------------------------- | -------------------------------- |
| `hl`     | 界面语言                         | `zh-CN`                          |
| `gl`     | 国家/地区代码                    | `CN`                             |
| `ceid`   | 版本标识（需 URL 编码）          | `CN:zh-Hans` → `CN%3Azh-Hans`    |
| `oc`     | 输出控制（固定值）               | `3`                              |
| `q`      | 搜索查询（支持 Google 搜索语法） | `AI site:techcrunch.com when:7d` |
| `filter` | `0` 不过滤相似报道               | `0`                              |

### 搜索语法

- 关键词：`remote sensing`
- 站点限定：`site:sciencedirect.com`（等效于独立参数 `googleSource`）
- 时间限定：`when:90d`（近 90 天，等效于独立参数 `googleWhen`）
- 组合：空格分隔，整体 URL 编码

> **推荐**：优先使用独立参数 `googleSource` / `googleWhen`，无需记忆搜索语法，对 Agent 更友好。两种方式可混用 — 独立参数会自动追加到 `googleQuery` 中。

### 注意

- Google News 条目通常只含标题/摘要，`rss-intelligence` 会自动补全正文
- `googleQuery` 参数可直接传入搜索语法，Skill 自动构建完整 URL
- 搜索中文新闻时用中文 locale，搜索国际站点时用默认英文 locale
