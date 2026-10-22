---
name: bilibili-spider
description: Bilibili 数据采集技能集，提供 3 类能力共 11 个 Skill：①「发现」按关键词全站搜索视频/番剧/影视/直播/专栏/用户（bili-search）；②「创作者枚举」已知 mid 后列出该 UP 的名片、投稿视频、图文、音频、合集系列、动态时间线（bili-creator 等 6 个）；③「内容提取」已知单条 ID 后下载视频、提取专栏正文配图、拉取合集/系列全量稿件、抓取视频/专栏/图文的评论（bili-video / bili-article / bili-channel / bili-comments）。当用户问"B 站搜 XX""看某 UP 主页有哪些视频/合集""下载这个 B 站视频""保存这篇 B 站专栏""拉取这个合集的全部视频""看这个视频/专栏的评论"等场景时必须使用。
argument-hint: <skill-id> '<params-json>'
allowed-tools: Bash(node *)
tools: AskUserQuestion, CallSkill
---

# bilibili-spider — 路由入口

> 本文件是**入口与路由层**——回答"该调哪个 Skill / 怎么传参 / 怎么读结果"。
>
> **始终生效的约束**抽离到 `claude/rules/bili-*.md`（运行环境、调用协议、输出契约），由 Claude Code 自动加载，**本文件不重复**。
>
> 复杂细节（每个 Skill 完整参数、字段语义、翻页范式、ID 命名空间、决策树）按需加载 `references/`。

---

## 0. 决策三步法

收到用户提问后按顺序问自己：

1. **意图归到哪类能力？**（发现 / 枚举 / 提取）→ 见 §1
2. **该 Skill 需要什么 ID？我有了吗？** mid / BV / opusId / (kind+season_id) → 没有先走上游拿（搜索或创作者枚举）。
3. **是否落入同名歧义陷阱？** → 见 §2，不确定时加载 [disambiguation.md](references/disambiguation.md)。

> 三类能力是**正交**的：发现=全站找 ID；枚举=已知 mid 列作品；提取=已知单条 ID 取全量/落盘。

---

## 1. 意图路由（11 Skill）

### A · 发现（1）— 按关键词全站找内容/UP · [详见](references/A-search.md)

| 用户意图 | Skill | 入口 |
|---|---|---|
| 搜视频 / 番剧 / 影视 / 直播 / 专栏 / 用户 | `bili-search` | `keyword` + `kind` |

> 产出 `items[]`，含 `type/id/title/url/author`——是拿 `bvid`、`mid`、`opusId` 的起点。

### B · 创作者枚举（6）— 已知 `mid` 列出该 UP 的作品 · [详见](references/B-creator.md)

| 用户意图 | Skill | 翻页范式 |
|---|---|---|
| UP 名片（资料 + 各模块条目数 moduleCounts + 代表作） | `bili-creator` | 无（单次聚合） |
| UP 投稿**视频**列表（可排序/分区/站内搜） | `bili-creator-videos` | page/maxPages 去重 |
| UP **图文**动态列表 | `bili-creator-articles` | offset 游标 |
| UP **音频**投稿列表 | `bili-creator-audios` | page/maxPages 去重 |
| UP **合集与系列目录**（含预览稿件） | `bili-creator-channels` | page/maxPages 去重 |
| UP **动态时间线**（视频/图文/转发/纯文本混合） | `bili-creator-feed` | offset 游标 |

> 没有 `mid`？先 `bili-search '{"kind":"bili_user","keyword":"昵称"}'`，或把主页 URL 直接喂给任一 B 模块（内部会归一）。
> `bili-creator` 的 `detail.moduleCounts`（video/opus/audio/season_num 计数）可决定是否调用后续枚举 Skill、预估翻页量。

### C · 内容提取（4）— 已知单条 ID 取全量 / 落盘 · [详见](references/C-extract.md)

| 用户意图 | Skill | 入口 ID | 副作用 |
|---|---|---|---|
| 下载 / 解析单个视频 | `bili-video` | BV / av / 视频 URL | 落盘 mp4 + 字幕 json（视频/字幕各自可关） |
| 提取单篇专栏正文 + 配图 | `bili-article` | opus/cv URL / opusId / cvId | 落盘 article.md + images/ |
| 拉合集/系列**全量稿件** | `bili-channel` | `kind`(season/series) + `id` + `mid` | 无 |
| 抓视频/专栏/图文的**评论**（文字 + 配图） | `bili-comments` | BV/av · cv · opusId · 内容 URL · oid+type | 落盘 comments.md + images/ |

> `bili-channel` 的 `kind`+`id` 由 `bili-creator-channels` 提供；`bvid`/`opusId` 由 `bili-search` 或 B 模块列表提供。
> `bili-comments` 评论区按 `(oid,type)` 定位，与内容形态解耦——任一内容入口（bvid/av/cv/opusId/URL）都能自动解析到评论区。

---

## 2. 同名歧义速判（高频混淆）

> AI 误路由的最大风险源。完整决策树 + 反例见 [disambiguation.md](references/disambiguation.md)。

| 易混对 | 判定关键词 | 选哪个 |
|---|---|---|
| `bili-search` vs `bili-creator-*` | **全站**找 vs **指定 UP** 列举 | 找做 X 的→search；看某 UP 有啥→creator-* |
| `bili-creator-videos` vs `bili-creator-feed` | 纯**投稿视频** vs **混合动态**（含转发/图文/文字） | 只要视频→videos；要时间线全貌→feed |
| `bili-creator-articles` vs `bili-creator-feed` | 只**图文** vs **全类型**动态 | 只图文→articles；全部→feed |
| `bili-creator-channels` vs `bili-channel` | 合集**目录**（有哪些） vs 单合集**全量稿件** | 列目录→channels；取某合集全部→channel |
| `bili-creator-videos` vs `bili-video` | 视频**列表(元数据)** vs **下载/解析单个** | 列清单→videos；要文件/流→video |
| `bili-creator-articles` vs `bili-article` | 图文**列表** vs 单篇**正文落盘** | 列清单→articles；要正文+配图→article |
| `bili-search(article)` vs `bili-article` | 搜专栏**列表** vs 提取**单篇**正文 | 找哪些→search；要这篇内容→article |
| `bili-article` vs `bili-comments` | 专栏**正文** vs 该内容下的**评论** | 要文章本身→article；要读者评论→comments |
| `bili-video` vs `bili-comments` | 视频**文件/流** vs 视频下的**评论** | 要视频→video；要评论→comments |

---

## 3. 调用方式（速查）

> 通用调用形式 / 错误码 / 输出信封见 `rules/spider-core.md` + `rules/spider-runtime.md`；bili 特有约束见 `rules/bili-*.md`（均已自动加载）。

```bash
node ${CLAUDE_SKILL_DIR}/scripts/index.js bili-search '{"keyword":"搞笑","kind":"video","maxPages":1}'
node ${CLAUDE_SKILL_DIR}/scripts/index.js bili-creator '{"mid":"https://space.bilibili.com/2"}'
node ${CLAUDE_SKILL_DIR}/scripts/index.js bili-creator-videos '{"mid":2,"order":"click","maxPages":2}'
node ${CLAUDE_SKILL_DIR}/scripts/index.js bili-channel '{"kind":"season","id":12345,"mid":2,"maxPages":3}'
node ${CLAUDE_SKILL_DIR}/scripts/index.js bili-video '{"bvid":"BV1Ty5L6bE3X","download":false}'          # 只要字幕+元数据
node ${CLAUDE_SKILL_DIR}/scripts/index.js bili-article '{"url":"https://www.bilibili.com/opus/1204763696927080471"}'
node ${CLAUDE_SKILL_DIR}/scripts/index.js bili-comments '{"bvid":"BV1Ty5L6bE3X","maxPages":2}'
```

---

## 4. 多步组合

端到端 recipe 见 [cookbook.md](references/cookbook.md)：

1. **关键词 → UP 全画像** — `bili-search(bili_user)` → `bili-creator` → `bili-creator-videos`/`-channels`/`-feed`
2. **合集深挖** — `bili-creator-channels` → 取 kind+id → `bili-channel`（全量稿件）→ 逐条 `bili-video`
3. **搜视频 → 下载** — `bili-search(video)` → 取 bvid → `bili-video`
4. **搜专栏 → 存档** — `bili-search(article)` → 取 url/opusId → `bili-article`
5. **UP 投稿批量存档** — `bili-creator-videos`(翻页) → 逐条 `bili-video`
6. **内容 → 评论存档** — `bili-search`/`bili-creator-*` 取 bvid/opusId/cv → `bili-comments`（文字 + 配图落盘）

---

## 5. 文档导航（按需加载）

| 何时加载 | 文档 |
|---|---|
| 操作发现能力 | [A-search.md](references/A-search.md) |
| 操作创作者枚举 | [B-creator.md](references/B-creator.md) |
| 操作内容提取 | [C-extract.md](references/C-extract.md) |
| 不确定 mid 归一 / 翻页 / WBI / ID 命名空间 / 错误码 / 隐私墙 | [conventions.md](references/conventions.md) |
| 同名歧义不确定 | [disambiguation.md](references/disambiguation.md) |
| 多步串联 | [cookbook.md](references/cookbook.md) |
| 接口/字段/HAR 抓包等实现依据（维护者向） | `docs/*.md` |

## 6. 数据呈现

通用呈现约束（markdown 排版 / 表格 / 视觉层次）见 `rules/spider-runtime.md §6`。bili 特有：列表表头建议含序号（方便对话指代）、日期、标题、互动数据。
