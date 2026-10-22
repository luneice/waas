# rss-spider · 来源策略

本规则用于判断来源优先级、源目录字段和本土环境采集策略。

## 1. 来源等级

| 等级 | 来源类型 | 用途 |
|---|---|---|
| A | 官方、监管、交易所、公司公告、一手文件 | 可作为事实依据 |
| B | 主流媒体、行业媒体、研究机构 | 可作为可靠报道或解读 |
| C | 垂直社区、论坛、开发者平台、招聘页 | 可作为早期信号 |
| D | 社交媒体、搜索结果、转载聚合 | 只能作为舆情或待核验线索 |

## 2. 源目录字段

每个长期源建议记录：

```jsonc
{
  "sourceId": "unique-slug",
  "sourceName": "来源中文名",
  "sourceType": "official|media|social|forum|company|search|custom-page",
  "access": {
    "kind": "url|rsshub-route|google-news|list-page",
    "url": "https://...",
    "route": "/..."
  },
  "topics": ["政策", "AI"],
  "entities": ["工信部"],
  "locale": "zh-CN",
  "timezone": "Asia/Shanghai",
  "reliability": "A|B|C|D",
  "cadence": "hourly|daily|weekly|on-demand",
  "requiresLogin": false,
  "selectors": {}
}
```

## 3. 国内来源默认策略

- 政策/监管：优先官方站点、交易所、地方政府、行业协会。
- 公司竞品：官网新闻、公告、招聘、开发者文档、应用商店、公众号。
- 金融公告：交易所、巨潮、公司公告、监管处罚、评级公告。
- 技术开源：GitHub、Release、HN、官方博客、开发者社区。
- 舆情：微博、B 站、知乎、论坛只能作为信号，不直接作为事实结论。

## 4. RSS 不存在时

按顺序处理：

1. `route-discover` 检查 RSSHub。
2. Google News 作为二次索引。
3. `list-extract` 从列表页提取。
4. 为列表页补 selectors。
5. 仍失败则标记为人工维护源。

## 5. 源健康

周期性检查：

- 连续失败次数。
- 最近成功抓取时间。
- 重复率。
- 有效条目比例。
- 是否需要登录态。
- 是否需要 selectors 更新。
