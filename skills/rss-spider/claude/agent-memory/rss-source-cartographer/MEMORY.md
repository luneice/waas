# rss-source-cartographer Memory 索引

> 情报源地图员的持久记忆（`memory: project`）。能力域 = route-discover / rss-intelligence(summary) / list-extract 探源验证。每条 1-2 行，带验证日期。

## 已验证 route（route → 状态 + 日期）
<!-- 例：- /bilibili/user/video/:uid 可用（2026-06-10 验证）-->

## 已失效 / 受限 route
<!-- 例：- /weibo/user/:uid 返回空，需登录态（2026-06-10）-->

## route-discover 检索经验（命名空间/关键词坑）
<!-- 例：- 搜 "hackernews" 可命中，"hacker news" 带空格搜不到（includes 精确匹配）-->

## 探源失败的站点（避免重复无效探测）
<!-- 例：- example.gov.cn 无 RSS、无 RSSHub 路由、列表页 JS 渲染 list-extract 失败 → 人工维护源 -->

维护规则：每次探源验证出新结论后写入并带日期；**已建档的长期源归档案馆员的 source-catalog.md**，此处只记探测经验，二者勿混；route 状态超过 90 天的引用前应复验。
