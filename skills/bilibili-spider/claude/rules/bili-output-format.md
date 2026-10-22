# bilibili-spider · 输出契约（差异部分）

> 顶层信封、AI-Ready 信封消费规则、jq 标准提取、`--raw`、回写约束见 `rules/spider-runtime.md §4-§6`（随包安装）。本文件只写 bilibili 特有形态。

## 1. `.data` 一律是 AI-Ready 信封

全部 11 个 Skill 的 `.data` 都是 `{ meta, insights, <body> }`。**先读 `meta.semantics` + `insights`** 做摘要与决策，明细再按 body 下钻。

`meta` 固定含 `skill` / `semantics` / `crawledAt`，多数还带 `units`（数值单位字典，如 `{ view: "次" }`）。**回写给用户时只能用 `meta.semantics` 给的口径，不要自造统计词。**

## 2. body 字段名按 Skill 区分（不是全都叫 `items`）

| body       | Skill                                                                                                   | 说明 |
|------------|---------------------------------------------------------------------------------------------------------|---|
| `items`    | `bili-search` / `bili-creator-videos` / `-articles` / `-audios` / `-channels` / `-feed` / `bili-channel` | 列表型 |
| `detail`   | `bili-creator`                                                                                            | 单对象（UP 主名片） |
| `content`  | `bili-article`（段落数组） / `bili-video`（`content.pages[]`）                                              | 提取型 |
| `items` + `topItems` | `bili-comments`                                                                                 | 置顶楼与普通楼分开，**别合并**——混在一起会让热度排序失真 |

## 3. 翻页元数据也在 `meta`

- **page 类**（`bili-search` / `-videos` / `-channels` / `-audios` / `bili-channel`）：`meta.total` / `meta.pagesFetched` / `meta.returnedCount`，部分带 `meta.duplicatesRemoved`。
- **游标类**（`bili-creator-feed` / `-articles` / `bili-comments`）：`meta.nextOffset` + `meta.hasMore`，续取时把 `nextOffset` 原样传回 `offset`。

## 4. 落盘产物两处都有

提取类（`bili-video` mp4+字幕、`bili-article` md+images、`bili-comments` md+images）：

- **顶层 `artifacts`** —— 框架统一的 Artifact 清单（含 `path` / `role` / `contentType`）。
- **`data.meta.files` / `data.meta.outputDir`** —— 该 Skill 自己的落盘摘要。`bili-video` 给的是计数汇总（`mediaCount` / `mergedCount` / `subtitleCount` / `totalBytes`），另两个给文件相对路径。

图片在明细里统一给 `src`：已本地化时指向落盘文件，未下载时回退远程 URL，配 `localized` 布尔位可判断。字幕（`bili-video` 的 `content.pages[].subtitles[]`）给 `path` / `absolutePath`，一律为已落盘文件。

## 5. 空结果

空结果包含隐私墙 53013 场景（UP 关闭了该模块），**不是错误**。回写时说明「该 UP 此模块无公开数据」，不要自动放宽筛选重试。

## 6. jq 提取

```bash
jq '.data.insights[]'                                  result.json   # ★ 优先读要点
jq '.data.meta | {semantics, returnedCount, hasMore}'  result.json   # 口径与翻页态
jq '.data.items[] | {bvid, title, play: .stats.play}'  result.json   # 列表明细（creator 系列主键 bvid）
jq -r '.data.items[].id'                               result.json   # bili-search 取 ID 喂下游（creator 系列用 .bvid）
jq '.data.detail | {name, relation, moduleCounts}'     result.json   # bili-creator 名片
jq '.data.content.pages[] | {page, files, subtitles}'  result.json   # bili-video 分 P 产物
jq '.data.content[] | select(.type=="text") | .text'   result.json   # bili-article 正文
jq '.data.topItems[], .data.items[] | {message, like}' result.json   # bili-comments
jq '.artifacts'                                        result.json   # 落盘清单
```
