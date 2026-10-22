# rss-spider 多 Agent 架构蓝图

本蓝图把 `rss-spider` 从“RSS 情报采集技能集”升级为“个人情报分析中心”的 Claude 层方案。

底层能力不改动 TypeScript，仅复用现有 4 个 Skill：

- `rss-intelligence`
- `route-discover`
- `list-extract`
- `page-extract`

Claude 层负责把采集能力编排成稳定的情报生命周期。

## 1. 设计原则

`xhs-spider` 适合按平台能力域拆 Agent；`rss-spider` 更适合按情报生命周期拆 Agent。

核心链路：

```text
源发现 -> 摘要扫描 -> 深度取证 -> 信号研判 -> 简报产出 -> 预警推送 -> 归档记忆
```

## 2. 方案 A：Claude 层 7 Agent

| # | Agent | 中文职责 | 主输入 | 主输出 |
|---|---|---|---|---|
| 1 | `rss-source-cartographer` | 情报源地图员 | 主题 / 站点 / URL | SourceDescriptor 源目录 |
| 2 | `rss-scan-dispatcher` | 扫描调度员 | 源目录 / 主题包 | 去重摘要 + DeepReadQueue |
| 3 | `rss-deep-reader` | 深读取证员 | DeepReadQueue | Evidence 证据对象 |
| 4 | `rss-signal-analyst` | 信号研判员 | Evidence 列表 | SignalCard 信号卡 |
| 5 | `rss-briefing-editor` | 情报简报主编 | SignalCard / Evidence | 日报 / 周报 / 专题报告 |
| 6 | `rss-watch-sentinel` | 预警哨兵 | 主题 / 实体 / 网页 | WatchRule 预警规则 |
| 7 | `rss-archive-librarian` | 档案馆员 | 源、主题、别名、规则 | memory 更新建议 |

## 3. 通信契约

Agent 之间传递尽量使用结构化对象，而不是自然语言。

### 3.1 SourceDescriptor

```jsonc
{
  "sourceId": "gov-miit-news",
  "sourceName": "工信部新闻",
  "sourceType": "official",
  "access": {
    "kind": "rsshub-route",
    "route": "/..."
  },
  "topics": ["政策", "AI"],
  "entities": ["工信部"],
  "locale": "zh-CN",
  "timezone": "Asia/Shanghai",
  "reliability": "A",
  "cadence": "daily",
  "requiresLogin": false,
  "selectors": {}
}
```

### 3.2 Evidence

```jsonc
{
  "evidenceId": "ev_20260522_source_001",
  "sourceId": "gov-miit-news",
  "title": "...",
  "link": "...",
  "publishedAt": "...",
  "fetchedAt": "...",
  "topics": ["政策"],
  "entities": ["人工智能"],
  "quotes": ["原文短引文"],
  "claims": [
    {
      "claim": "可被证据支持的事实陈述",
      "quote": "支撑 claim 的原文片段",
      "confidence": 0.82
    }
  ]
}
```

### 3.3 SignalCard

```jsonc
{
  "signalType": "policy-change",
  "title": "...",
  "summary": "...",
  "whyItMatters": "...",
  "affectedEntities": ["..."],
  "confidence": 0.82,
  "urgency": "medium",
  "evidenceIds": ["ev_20260522_source_001"],
  "recommendedAction": "..."
}
```

### 3.4 WatchRule

```jsonc
{
  "watchId": "watch_policy_ai_001",
  "name": "AI 政策监管预警",
  "sources": ["gov-miit-news"],
  "entities": ["人工智能"],
  "keywords": ["征求意见", "备案", "处罚"],
  "schedule": "daily@09:00 Asia/Shanghai",
  "priorityRules": {
    "P0": "A 级来源出现正式发布/处罚/暂停",
    "P1": "A/B 级来源出现征求意见/试点/标准",
    "P2": "C/D 级来源出现讨论升温"
  },
  "notification": "markdown"
}
```

## 4. 斜杠命令

| 命令 | 端到端任务 |
|---|---|
| `/情报源建档` | 为主题建立源目录并验证可用性 |
| `/每日情报简报` | 多源摘要扫描、选择性深读、输出日报 |
| `/主题追踪` | 围绕主题做周期追踪和信号聚类 |
| `/政策监管雷达` | 官方/监管/标准类来源扫描和影响分析 |
| `/公司竞品监控` | 公司、产品、价格、招聘、开源、合作动态监控 |
| `/网页变更预警` | 为无 RSS 页面设计 WatchRule |
| `/情报源健康检查` | 检查源可用性、重复率和维护风险 |

## 5. 始终生效规则

| 文件 | 作用 |
|---|---|
| `rules/rss-call-protocol.md` | Skill 调用方式、摘要优先、错误处置 |
| `rules/rss-evidence-protocol.md` | Evidence、claim、引文、置信度 |
| `rules/rss-output-format.md` | 日报、报告、分批输出格式 |
| `rules/rss-source-policy.md` | 来源等级、源目录字段、国内来源策略 |
| `rules/rss-localization.md` | 中文、时区、实体别名、主题包和风险表达 |

## 6. 主题包建议

首批默认主题包：

1. 政策监管。
2. AI/开源技术。
3. 公司竞品。
4. 金融公告。
5. 舆情热点。

## 7. 后续阶段

### 方案 B：状态层

新增轻量存储，用于保存 sources、runs、items、evidence、signals、alerts、feedback。

### 方案 C：调度和预警

增加定时任务、diff 存储、通知渠道，优先对接飞书卡片。

### 方案 D：情报中心 API

提供全文搜索、实体图谱、主题看板和 MCP/API，让外部 Agent 可以查询历史情报。

## 8. 实施记录

- 2026-05-22：方案 A 初版落地，Claude 层文件位于 `skills/rss-spider/claude/`。
