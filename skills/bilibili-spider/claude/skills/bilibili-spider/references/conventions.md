# 通用约定（conventions）

> 跨能力共享的入口归一、翻页范式、WBI 签名、ID 命名空间、错误码、输出结构、隐私墙。能力文档不重复，只引用。

---

## 1. 入口 ID 归一

### 1.1 `mid`（B 模块 + bili-channel）
接受三种写法，内部统一归一为数字串：
- 纯数字：`2`
- 主页 URL：`https://space.bilibili.com/2`
- `space.bilibili.com/2` 片段

解析不出报 `invalid-params`。**没有 mid** → 先 `bili-search '{"kind":"bili_user","keyword":"昵称"}'` 取 `items[].id`。

### 1.2 视频 ID（bili-video）
任一：`url`(/video/BV… 或 /video/av…) / `bvid`(BV…) / `aid`(数字) / `id`(简写，自动识别 BV/av/纯数字)。

### 1.3 专栏 ID（bili-article）
任一：`url`(/opus/{id} 或 /read/cv{id}) / `opusId`(长数字串，实测约 19 位) / `cvId`(纯数字或 cvXXXX) / `id`(简写)。
> opus 与 cv 用位数区分（opus ≥16 位）；cv 链接 302 到 opus 后统一按 opus 解析。

### 1.4 合集/系列 ID（bili-channel）
`kind`(`season`/`series`) + `id`(season_id/series_id，即详情页 `?sid=` 的值) + `mid`，**三者必填**。
来源：`bili-creator-channels` 输出 `items[].kind` / `items[].id`。

---

## 2. 翻页范式（两类，勿混用）

### 2.1 page / maxPages（连续抓取去重）
适用：`bili-search`(部分分类) / `bili-creator-videos` / `bili-creator-audios` / `bili-creator-channels` / `bili-channel`。
- 一次请求抓 `page .. page+maxPages-1` 连续页，跨页按主键去重（`aid`/`auid`/`kind:id`）。
- `maxPages` 有上限（多为 20，channel 为 50）；`pageSize` 各 Skill 默认不同。
- 翻页统计一律**拍平**在 `meta`：`meta.total` / `meta.pagesFetched` / `meta.returnedCount`，去重类另有 `meta.duplicatesRemoved`（**无** `meta.page.*` 嵌套）。`bili-search` 另给 `meta.totalPages` / `meta.pageStart` 与 `meta.pagination`（策略与逐页轨迹）。
- 适合"我要前 N 页"的批量场景。

### 2.2 offset 游标（单页续取）
适用：`bili-creator-articles` / `bili-creator-feed`。
- 单次只抓一页，输出含 `meta.nextOffset` + `meta.hasMore`。
- 续取：把上次 `meta.nextOffset` 回填到入参 `offset` 再调一次；`hasMore=false` 即到底。
- **没有 `page`/`maxPages`**——传了无效。

> `bili-comments` 是**混合式**：`maxPages` 控制单次连拓页数（上限 20），抓完仍给 `meta.nextOffset`/`meta.hasMore` 供跨批续取。

> `bili-search` 的 video/live/bili_user 用 `dynamic_offset`（步长 24）内部翻页，对调用方仍表现为 page/maxPages。

---

## 3. WBI 签名

- 必需的接口：搜索、`arc/search`(投稿视频)、`opus/feed/space`(图文)、`feed/space`(动态)、名片 `acc/info` 等。
- 由 Goal 内部 `fetchNav` 取 `wbi_img` key、node 侧 md5 签名、**逐页重签**（wts 变），最终请求在浏览器页内带登录态 Cookie 发出。**调用方无感**。
- 缺 key / 改版 → `upstream-shape-changed`，报告维护者。
- 无 WBI 的接口：音频 `song/upper`、合集目录 `seasons_series_list`、合集/系列详情、专栏 SSR。

---

## 4. ID 命名空间矩阵 ⚠️ 防止"看名字喂错坑"

各 Skill 产出的 ID 只能喂给匹配入参，**严格按命名空间**：

| Namespace | 产出 | 可投喂入参 |
|---|---|---|
| `mid` | `bili-search(bili_user).items[].id`、各列表 `author.mid` | 所有 B 模块的 `mid`、`bili-channel.mid` |
| `bvid` / `aid` | `bili-search(video).items[].id`、`bili-creator-videos.items[].bvid`、合集 `items[].bvid` | `bili-video` 的 `bvid`/`aid`/`url` |
| `opusId` / `cvId` | `bili-search(article).items[].url`、`bili-creator-articles.items[]` | `bili-article` 的 `opusId`/`cvId`/`url` |
| `season_id` / `series_id` (+`kind`) | `bili-creator-channels.items[].id` (+`.kind`) | `bili-channel` 的 `id`(+`kind`) |
| `oid` + `type` | 评论区二元组（`bili-comments.meta.source`） | `bili-comments` 的 `oid`+`type`（成对直传；一般用 bvid/cv/opusId 自动解析即可） |
| `offset` 游标 | `bili-creator-articles/feed`、`bili-comments` 的 `meta.nextOffset` | **同一 Skill** 的 `offset`（不跨 Skill 通用） |

> ⚠️ 番剧/影视/直播（`media_bangumi`/`media_ft`/`live`）是 PGC/直播，**没有 bvid**，不能喂 `bili-video`。
> ⚠️ `offset` 游标与具体 Skill + mid 绑定，不可跨 Skill / 跨 UP 拼接。

---

## 5. 错误码

统一错误码表与处置见 `rules/spider-runtime.md §3`（始终加载）；bilibili 特例（WBI key 缺失、隐私墙 53013）见 `rules/bili-call-protocol.md §4` 与本文档 §7。

---

## 6. 输出结构

通用信封与消费规则见 `rules/spider-runtime.md §4`；bilibili 特有形态（顶层 `items[]`、`artifacts`）见 `rules/bili-output-format.md`。

---

## 7. 隐私墙（code=53013）

- UP 把某模块设为私密时，接口返回 `code=53013`「用户隐私设置未公开」、`data=null`。
- **当空集容错**——返回空 `items[]` + 提示，**不要抛错、不要重试**。
- 常见于关注列表、部分动态。这是正常业务态，非平台改版。

---

## 8. 站点与登录态

- B 模块锁 `space.bilibili.com/{mid}`，A 锁 `search.bilibili.com`，video/article 锁 `www.bilibili.com`，channel 锁 `space.bilibili.com`。
- 所有请求在**已登录的真实浏览器页内**发出（thrall 范式），自动带 Cookie。运行环境前置见 `claude/rules/bili-runtime.md`。
