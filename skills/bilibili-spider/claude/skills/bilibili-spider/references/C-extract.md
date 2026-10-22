# 能力 C · 内容提取（4 Skill）

> **何时**：已知单条内容 ID，要取全量稿件 / 下载文件 / 提取正文落盘。
> **入口 ID 哪来**：`bvid`/`opusId` 来自 A `bili-search` 或 B 列表；`kind`+`season_id`/`series_id` 来自 `bili-creator-channels`。
> **共享约定**（错误码 / 输出 / 落盘）见 [conventions.md](conventions.md)。

---

## 全景

| Skill | 入口 ID | 底层 | 副作用 |
|---|---|---|---|
| `bili-video` | BV / av / 视频 URL | `view` + `playurl` + `player/wbi/v2`/`subtitle/web/view`(字幕) + DASH 分片 + ffmpeg | 落盘 mp4 + 字幕 json（各自可关） |
| `bili-article` | opus/cv URL / opusId / cvId | 详情页 SSR `__INITIAL_STATE__.detail` + 配图 | 落盘 article.md + images/ |
| `bili-channel` | `kind`+`id`+`mid` | season=seasons_archives_list / series=x/series/archives | 无 |
| `bili-comments` | BV/av · cv · opusId · 内容 URL · oid+type | `/x/v2/reply/wbi/main`（WBI）+ 配图下载 | 落盘 comments.md + images/ |

---

## `bili-video` — 视频下载/解析

入口（任一）：`url`(/video/BV… 或 /video/av…) / `bvid` / `aid` / `id`(简写)。

| 参数 | 默认 | 说明 |
|---|---|---|
| `part` | `1` | 多 P 页码，1-based |
| `partMode` | `selected` | `selected`=仅下载 part；`all`=全部分 P |
| `qn` | `80` | 期望清晰度，80=1080P |
| `preferCodec` | `avc` | 编码偏好：`avc` / `hevc` / `av1` / `best` |
| `download` | `true` | 是否下载**媒体**（视频/音频）。`false`=只解析 playurl + 选流，不落媒体（仍可单独下字幕） |
| `subtitle` | `true` | 是否下载**字幕**。与 `download` 相互独立 |
| `merge` | `true` | 是否 ffmpeg 合并音视频 |
| `outputDir` | `storageRoot/bilibili` | 输出目录 |

输出：`meta`(source / video(aid/bvid/title/owner) / requested / outputDir / **files 落盘汇总**) + `insights` + `content.pages[]`(每分 P 选流、字幕与产物文件)；落盘文件同时进入顶层 `artifacts`。

`meta.files` 的计数口径：

| 字段 | 口径 |
|---|---|
| `mediaCount` | 音/视频**分片**数，**不含**合并成品 |
| `mergedCount` | ffmpeg **合并成品**数 |
| `subtitleCount` | 字幕文件数 |
| `totalBytes` | 全部落盘文件字节和；每个文件恰好计一次（合并成品不与分片重复计） |

> 三个计数互不重叠，落盘文件总数 = `mediaCount + mergedCount + subtitleCount`。默认 `merge:true` 合并后**仍保留分片**，故两个计数通常同时 > 0；`mergedCount=0` 而 `mediaCount>0` 说明没合成（多为缺 ffmpeg）。

> **依赖**：下载/合并需要本机 `ffmpeg`（见 `claude/rules/bili-runtime.md`）；只下字幕不需 ffmpeg。
> **先探后下**：不确定画质/编码时先 `download:false` 看 `content.pages[].selected`（video/audio 两路选流），再正式下载。
> **字幕与视频解耦**：`download`（媒体）与 `subtitle`（字幕）互不影响，三种组合任选：
>   - 默认（都不传）：视频 + 字幕一起下。
>   - 只要视频：`{"subtitle":false}`。
>   - 只要字幕：`{"download":false}`（不落媒体、不需 ffmpeg）。
> **字幕来源**：`subtitle:true` 时先拉 `player/wbi/v2` 的 `subtitle.subtitles[]`（明文 URL，Node 直拉）；每条字幕 JSON 与视频落到**同一视图目录**（`P01.<段名>.<lan>.json`，如 `ai-zh`/`ai-en`）。**视频无字幕时静默跳过**，字幕单条失败只记 warning。
> **付费/未购买视频**：`player/wbi/v2` 对付费 upower 视频返回空字幕，此时自动回退到 `GET /x/v2/subtitle/web/view`（protobuf），**离线还原**被混淆的真实 `aisubtitle.hdslb.com` 地址后 Node 直拉，字幕仍可**全量获取**（详见 `docs/video-download-analysis.md` 第 9 节）。
> **流不可用不致命**：付费未购买只返回 durl 预览、或新稿未转码无 DASH 时，不再整体报错——`success:true`，加 `stream-unavailable` warning，跳过视频/音频但字幕等其它数据照常获取。
> **不接受关键词**：要从关键词找视频先 `bili-search`，取 `bvid` 再来。

---

## `bili-article` — 专栏正文提取

入口（任一）：`url`(/opus/{id} 或 /read/cv{id}) / `opusId`(数字串) / `cvId`(纯数字或 cvXXXX) / `id`(简写)。

| 参数 | 默认 | 说明 |
|---|---|---|
| `downloadImages` | `true` | `false`=正文保留远程原图 URL，不下载 |
| `includeLinkCards` | `false` | `true`=在 Markdown 渲染链接卡/商品卡为引用行 |
| `outputDir` | `storageRoot/bilibili` | 输出目录 |
| `imageTimeoutMs` | `30000` | 单图下载超时（毫秒，≥1000） |

正文来自详情页主文档内联 `window.__INITIAL_STATE__.detail`（SSR），**不走独立接口，无需 WBI**。
落盘结构：`<outputDir>/articles/<opusId 或 cvId>-<安全标题>/{article.md, meta.json, images/}`。

输出：`meta`(opusId/cvId/title/author/stat/段落计数/warnings) + `insights` + `content`(结构化段落) + `files`；落盘文件进入顶层 `artifacts`。

> cv 链接会 302 到 opus，归一后统一按 opus 解析。单图失败记 warning 不中断，正文保留远程 URL。

---

## `bili-channel` — 合集/系列全量稿件

与 `bili-creator-channels`（目录+预览）**正交**：这里按 `id` 拉单个合集/系列内的**全量稿件**并翻页。

入口（全必填）：`kind`(`season`/`series`) + `id`(season_id/series_id) + `mid`。

| 参数 | 默认 | 说明 |
|---|---|---|
| `kind` | — | `season`(合集) / `series`(系列) |
| `id` | — | season_id 或 series_id（合集/系列详情页 `?sid=` 的值） |
| `mid` | — | UP mid（两类接口均必填） |
| `page` | `1` | 起始页 |
| `maxPages` | `1` | 连续页数，1-50，按 `aid` 去重 |
| `pageSize` | `30` | 每页条数，1-50 |

底层：`kind=season` → `/x/polymer/web-space/seasons_archives_list`（page_num/page_size）；`kind=series` → `/x/series/archives`（pn/ps）。均**无 WBI**。

输出：`{ kind, id, mid, meta, total, pagesFetched, returnedCount, items[], crawledAt }`。
- season 的 `meta` 含合集名/封面/简介；**series 接口不返回 meta，`meta` 字段留空**（系列名需另查，或从 `bili-creator-channels` 的目录项取 `name`）。
- `items[]`：aid/bvid/title/cover/duration/pubdate/url/view/danmaku。

> 典型链路：`bili-creator-channels` 拿到某项 `{kind:"season", id:12345, ...}` → `bili-channel '{"kind":"season","id":12345,"mid":2}'`。

---

## `bili-comments` — 评论提取（文字 + 配图）

评论区按 `(oid,type)` 二元组定位，与内容形态解耦（视频/专栏/图文共用同一接口）。传任一内容入口即可，内部自动解析为评论区。

入口（任一，优先级 oid+type > 视频 > cv > opus > URL）：

| 入口 | 定位方式（策略） | 结果 oid/type |
|---|---|---|
| `bvid` | `/x/web-interface/view?bvid=` 换 aid | oid=aid, type=1 |
| `aid` | 直接 | oid=aid, type=1 |
| `cvId` | 纯解析 | oid=cvId, type=12 |
| `opusId` | `/x/polymer/web-dynamic/v1/detail` 取 `basic.comment_id_str/comment_type` | oid/type 动态 |
| `url` | 识别 /video、/opus、/read/cv | 同上 |
| `oid`+`type` | 直传（调试/已知评论区） | 原样 |

| 参数 | 默认 | 说明 |
|---|---|---|
| `mode` | `3` | 排序：3=热度 / 2=时间 |
| `maxPages` | `3` | 主楼连拓页数，硬上限 20；offset 游标逐页去重 |
| `offset` | `""` | 跨 maxPages 续取游标；首次留空，续取传上次 `nextOffset` |
| `includeReplies` | `false` | `true`=为每条主楼追加完整楼中楼（默认仅用内嵌热门子回复） |
| `repliesLimit` | `10` | includeReplies=true 时每条主楼最多追加子回复数 |
| `downloadImages` | `true` | `false`=保留远程原图 URL，不下载 |
| `outputDir` | `storageRoot/bilibili` | 输出目录 |
| `imageTimeoutMs` | `30000` | 单图下载超时（毫秒，≥1000） |

接口：`GET /x/v2/reply/wbi/main`（**WBI 签名**，游标 `pagination_str={"offset":""}`）；主楼内嵌 `.replies[]` 含少量热门子回复，默认直接保留。`includeReplies=true` 另走 `/x/v2/reply/reply` 补全楼中楼（失败降级告警，保留内嵌）。
落盘结构：`<outputDir>/comments/<type>-<oid>/{comments.md, meta.json, images/}`。

输出：`meta`(source/total/pagesFetched/returnedCount/nextOffset/hasMore/outputDir/files) + `insights` + `topItems`(置顶) + `items`(主楼含楼中楼)；落盘文件进入顶层 `artifacts`。每条评论含 `rpid/user/message/images/like/publishedAt/location/replyCount/replies`。

> `topItems` 与 `items` 是**两个独立数组**，别合并——置顶楼由 UP/管理员置顶，不参与热度排序，混进 `items` 会让排序失真。两者元素形状一致。

> 抓不完？`hasMore=true` 时携带 `nextOffset` 续取。要从关键词找内容先 `bili-search`。

---

## 关键陷阱

1. `bili-channel` 三个 ID 缺一报 `invalid-params`；`kind` 只接受 `season`/`series`。
2. `bili-video` 番剧/影视/直播不是普通稿件，没有 `bvid`，不要把搜索里的 PGC 结果喂进来。
3. `bili-article` 与 `bili-creator-articles` 别混：前者取**单篇正文落盘**，后者列**UP 图文清单**。
4. 提取类副作用落盘，注意 `outputDir`；`download:false` / `downloadImages:false` 可做纯解析探测。
5. `bili-comments` 与 `bili-article`/`bili-video` 别混：前者取**读者评论**，后者取内容本身。opus 图文评论需一次额外请求解析 oid/type，已自动处理。

合集深挖 + 批量下载 → [cookbook.md#2](cookbook.md)。实现依据 → `docs/video-download-analysis.md` / `docs/article-extract-analysis.md` / `docs/comment-extract-analysis.md`。
