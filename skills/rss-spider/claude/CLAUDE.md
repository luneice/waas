---
name: rss-intelligence-center
description: RSS 情报分析中心行为指南。把 rss-spider 从采集技能升级为源发现、摘要扫描、深度取证、信号研判、简报产出、预警和归档的多 Agent 系统。
license: MIT
---

# rss-spider 情报分析中心

本目录是 rss-spider 的 Claude 层。底层采集能力由 `rss-spider` Skill 提供，Claude 层负责把能力编排成稳定的情报工作流。

## 总目标

把任意 RSS / RSSHub / Google News / 普通网页列表源转化为可追踪、可引用、可复盘的个人情报系统。

核心链路：

```text
源发现 -> 摘要扫描 -> 深度取证 -> 信号研判 -> 简报产出 -> 预警推送 -> 归档记忆
```

## Agent 分工

| Agent | 职责 | 使用时机 |
|---|---|---|
| `rss-source-cartographer` | 情报源建档、RSSHub 路由发现、源质量判断 | 新主题、新站点、新来源包 |
| `rss-scan-dispatcher` | 多源摘要扫描、去重、初筛 | 每日扫描、主题扫描第一步 |
| `rss-deep-reader` | 对选中条目补全文、提取事实和引文 | 需要深入阅读和证据 |
| `rss-signal-analyst` | 聚类、趋势、异常、风险机会研判 | 已有多条证据后 |
| `rss-briefing-editor` | 日报、周报、专题简报、行动建议 | 需要交付报告 |
| `rss-watch-sentinel` | 关键词/实体/网页变更预警 | 需要持续监控 |
| `rss-archive-librarian` | 归档、标签、源健康、记忆维护 | 工作流结束或周期复盘 |

## 能力边界

Claude 层只负责编排和分析，不重新实现采集逻辑。需要采集时调用 `rss-spider` 的 4 个 Skill：

- `rss-intelligence`：获取 feed，必要时补全正文。
- `route-discover`：发现 RSSHub 路由、搜索命名空间。
- `list-extract`：普通网页列表页兜底提取。
- `page-extract`：单篇正文提取。

## 默认工作方式

1. 新任务先识别用户要的是源建档、扫描、深读、研判、简报、预警还是归档。
2. 未知来源先走 `route-discover`，不要直接猜 route。
3. 情报扫描默认先用 `rss-intelligence` 的 `summary:true`，除非条目少于 10 条或用户明确要求全文。
4. 只有被选中的重点条目才进入 `page-extract` 或全文补全。
5. 所有判断必须绑定来源链接、发布时间、抓取时间和证据片段。
6. 输出要区分事实、判断、猜测和建议。
7. 需要长期复用的源目录、别名、主题偏好交 `rss-archive-librarian` 沉淀到其 agent memory（`.claude/agent-memory/rss-archive-librarian/`），一次性查询结果不要写入。
8. 一次一条命令、只用 `jq`/`rq` 提取、禁止临时脚本等通用规则见 `rules/spider-core.md`（随包安装）。

## 目录导航

| 目录 | 用途 |
|---|---|
| `agents/` | 7 个专业 Agent 的职责、边界和交接规则 |
| `commands/` | 面向用户的端到端斜杠命令工作流 |
| `rules/` | 始终生效的调用、证据、输出、源策略、本土化规则 |
| `agent-memory/` | 各 Agent 的持久记忆种子（`memory: project`，首装播种、永不覆盖） |
| `skills/rss-spider/` | 底层 Skill 文档与参数参考 |
