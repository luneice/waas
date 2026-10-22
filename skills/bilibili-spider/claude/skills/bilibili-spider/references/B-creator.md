# 能力 B · 创作者枚举（6 Skill）

> **何时**：已知 UP 的 `mid`（或主页 URL），要列出该 UP 的某类作品。
> **入口**：建议先 `bili-creator` 拿名片 + `detail.moduleCounts`（各模块条目数），据此决定调哪些枚举 Skill、预估翻页量。
> **站点**：全部锁定 `space.bilibili.com/{mid}`（携带登录态 Cookie）。
> **共享约定**（mid 归一 / 翻页范式 / WBI / 隐私墙）见 [conventions.md](conventions.md)。

---

## 全景

| Skill | 底层接口 | WBI | 翻页范式 | 去重键 |
|---|---|---|---|---|
| `bili-creator` | acc/info + relation/stat + upstat + navnum + notice + masterpiece | 部分 | 无（聚合一次） | — |
| `bili-creator-videos` | `/x/space/wbi/arc/search` | ✅ | page/maxPages | `aid` |
| `bili-creator-articles` | `/x/polymer/web-dynamic/v1/opus/feed/space` | ✅ | offset 游标 | — |
| `bili-creator-audios` | `/audio/music-service/web/song/upper` | ✗ | page/maxPages | `auid` |
| `bili-creator-channels` | `/x/polymer/web-space/seasons_series_list` | ✗ | page/maxPages | `kind:id` |
| `bili-creator-feed` | `/x/polymer/web-dynamic/v1/feed/space` | ✅ | offset 游标 | — |

> 两种翻页范式见 [conventions.md §翻页范式](conventions.md)：
> - **page/maxPages**：一次抓 `page..page+maxPages-1` 连续页并去重（videos/audios/channels）。
> - **offset 游标**：单次抓一页，结果带 `meta.nextOffset`/`meta.hasMore`，调用方携带 `offset` 续取（articles/feed）。

---

## 共享参数

所有 B 模块 Skill：`mid`（必填，接受纯数字 / 主页 URL / `space.bilibili.com/{mid}`，内部归一）。

page/maxPages 类还有：`page`(默认 1) / `maxPages`(默认 1，上限见各 Skill) / `pageSize`。
offset 游标类还有：`offset`（首页留空，续取传上次 `nextOffset`）。

---

## 各 Skill 参数

### `bili-creator`
仅 `mid`。聚合输出（单对象信封，明细在 `detail`）：基础资料、认证/大会员、关注粉丝、累计播放获赞、各模块条目数 `moduleCounts`、空间公告、代表作 `masterpiece`。
> `detail.moduleCounts` 字段（上游 `navnum` 投影后的名字）：`video`/`opus`(图文)/`audio`/`album`/`favourite`/`season_num`(合集数)/`bangumi`。**先看 moduleCounts 再决定下游**——计数为 0 的模块跳过，省请求。

### `bili-creator-videos` — 投稿视频（WBI）
| 参数 | 默认 | 说明 |
|---|---|---|
| `order` | `pubdate` | `pubdate`(最新) / `click`(最多播放) / `stow`(最多收藏) |
| `tid` | `0` | 分区筛选，0=全部 |
| `keyword` | — | 在该 UP 稿件内检索 |
| `page` | `1` | 起始页 |
| `maxPages` | `1` | 连续页数，上限 20，按 `aid` 去重 |
| `pageSize` | `25` | 接口 ps，1-50 |

输出：`items[]`（aid/bvid/title/cover/url/duration/play/comment…）+ `total`(page.count) + `partitions`(分区统计)。

### `bili-creator-articles` — 图文动态（WBI · offset）
| 参数 | 默认 | 说明 |
|---|---|---|
| `offset` | — | 翻页游标，首页留空 |

输出：`items[]` + `meta.nextOffset` + `meta.hasMore`。续取：把 `meta.nextOffset` 回填到入参 `offset` 再调一次。
> 这是 UP 的**图文/专栏动态列表**（只 opus）。要单篇正文+配图落盘 → `bili-article`（C 模块）。

### `bili-creator-audios` — 投稿音频
| 参数 | 默认 | 说明 |
|---|---|---|
| `page` | `1` | 起始页 |
| `maxPages` | `1` | 连续页数，按 `auid` 去重 |
| `pageSize` | `42` | 接口 ps |

输出：`items[]`（auid/title/cover/bvid/播放·收藏·评论·分享统计）。

### `bili-creator-channels` — 合集与系列目录
| 参数 | 默认 | 说明 |
|---|---|---|
| `page` | `1` | 起始页 |
| `maxPages` | `1` | 连续页数，1-20，按 `kind:id` 去重 |
| `pageSize` | `20` | page_size，1-50 |

输出：`items[]`，每项 `{ kind: "season"|"series", id, name, cover, total, url, previews[] }`。
> `previews` 是**预览级稿件（非全量）**。要某合集的**全量稿件** → 取该项 `kind`+`id`，调 `bili-channel`（C 模块）。

### `bili-creator-feed` — 动态时间线（WBI · offset）
| 参数 | 默认 | 说明 |
|---|---|---|
| `offset` | — | 翻页游标，首页留空 |

输出：`items[]` + `meta.nextOffset` + `meta.hasMore`。每项以 `kind` 标注大类：`archive`(视频) / `opus`(图文) / `forward`(转发) / `word`(纯文本)。
> **混合时间线**——要纯视频清单用 `bili-creator-videos`；要纯图文用 `bili-creator-articles`。

---

## 关键陷阱

1. **隐私墙 code=53013**：部分模块（如关注列表）UP 设私密时返回 `data=null`，当空集容错，**不要报错**。见 [conventions.md §隐私墙](conventions.md)。
2. **WBI 必需**：videos/articles/feed 走 WBI 签名，由 Goal 内部 `fetchNav` 取 key 并逐页重签，调用方无感；失败属上游改版（`upstream-shape-changed`）。
3. **offset vs page 别混**：articles/feed 没有 `page`/`maxPages`，传了无效；videos/audios/channels 没有 `offset`。
4. `moduleCounts` 是目录而非内容——它只给计数，拿明细仍需调对应枚举 Skill。
5. 投稿视频的 `maxPages` 上限 20；合集目录上限 20。一次别贪多页，按 `total` 估算。

完整 UP 画像串联 → [cookbook.md#1](cookbook.md)。实现依据 → `docs/space-extract-analysis.md`。
