# 多步组合食谱（cookbook）

> 跨 Skill 的端到端链路。每条给出**调用序列 + ID 传递点**。
> 命令前缀统一 `node ${CLAUDE_SKILL_DIR}/scripts/index.js`（下文简记 `RUN`）。
> 取值用 jq（见 `claude/rules/bili-output-format.md`），勿写临时脚本。

---

## 1. 关键词 → UP 全画像

目标：只知昵称，产出该 UP 的资料 + 代表作 + 视频/合集/动态。

```bash
# ① 昵称→mid
RUN bili-search '{"kind":"bili_user","keyword":"老番茄"}'
#   取 .data.items[0].id  → MID

# ② 名片（先看 moduleCounts 决定后续抓哪些）
RUN bili-creator '{"mid":<MID>}'
#   .data.detail.moduleCounts.{video,opus,audio,season_num} 计数为 0 的模块跳过

# ③ 按需枚举
RUN bili-creator-videos   '{"mid":<MID>,"order":"click","maxPages":2}'
RUN bili-creator-channels '{"mid":<MID>}'
RUN bili-creator-feed     '{"mid":<MID>}'
```

---

## 2. 合集深挖 → 全量稿件 → 批量下载

目标：拿到某 UP 某合集里的全部视频并下载。

```bash
# ① 列目录，定位合集
RUN bili-creator-channels '{"mid":<MID>}'
#   取某项 .kind 与 .id  → KIND, SID

# ② 拉该合集全量稿件（翻页）
RUN bili-channel '{"kind":"<KIND>","id":<SID>,"mid":<MID>,"maxPages":5}'
#   取 .data.items[].bvid  → BVID 列表

# ③ 逐条下载（一次一条）
RUN bili-video '{"bvid":"<BVID>","qn":80,"preferCodec":"avc"}'
```

> series 的 `meta` 为空，合集名从步骤①的 `items[].name` 取。

---

## 3. 搜视频 → 下载

```bash
RUN bili-search '{"keyword":"原神 4.0 PV","kind":"video"}'
#   取 .data.items[0].id (bvid) 或 .url  → BVID
RUN bili-video  '{"bvid":"<BVID>","download":false}'   # 先探画质
RUN bili-video  '{"bvid":"<BVID>","qn":80}'            # 再正式下载
```

> 注意：搜到的若是番剧/影视/直播（kind 非 video），**没有 bvid**，不能下载。

---

## 4. 搜专栏 → 存档

```bash
RUN bili-search  '{"keyword":"机器学习入门","kind":"article"}'
#   取 .data.items[0].url（/opus 或 /read/cv）  → URL
RUN bili-article '{"url":"<URL>","downloadImages":true}'
#   落盘 <outputDir>/articles/<id>-<title>/{article.md,meta.json,images/}
```

---

## 5. UP 投稿批量存档

```bash
RUN bili-creator-videos '{"mid":<MID>,"order":"pubdate","maxPages":4}'
#   取 .data.items[].bvid  → 列表
# 逐条（一次一条）
RUN bili-video '{"bvid":"<BVID>"}'
```

---

## 6. UP 图文批量提取（offset 游标翻页）

```bash
# 首页
RUN bili-creator-articles '{"mid":<MID>}'
#   取 .data.items[].url → 待存档；取 .data.meta.nextOffset → OFFSET, .data.meta.hasMore
# 续页（hasMore 为真时重复，回填 offset）
RUN bili-creator-articles '{"mid":<MID>,"offset":"<OFFSET>"}'
# 逐篇正文落盘
RUN bili-article '{"url":"<URL>"}'
```

---

## 7. 内容 → 评论存档（文字 + 配图）

目标：抓某视频/专栏/图文下的评论，含图片，落盘 Markdown。

```bash
# 视频评论（bvid 自动解析评论区 oid/type）
RUN bili-comments '{"bvid":"<BVID>","mode":3,"maxPages":3}'
#   .data.meta.{total,returnedCount,nextOffset,hasMore}；.data.items[] 主楼、.data.topItems[] 置顶楼（两个数组分开读，别合并）

# 专栏 / 图文评论（同一入口，传 cv / opusId / 内容 URL 均可）
RUN bili-comments '{"opusId":"<OPUS_ID>"}'
RUN bili-comments '{"url":"https://www.bilibili.com/read/cv<ID>"}'

# 续抓更多（hasMore 为真时回填 nextOffset）
RUN bili-comments '{"bvid":"<BVID>","offset":"<NEXT_OFFSET>"}'

# 需要完整楼中楼时
RUN bili-comments '{"bvid":"<BVID>","includeReplies":true,"repliesLimit":20}'
```

> 落盘 `<outputDir>/comments/<type>-<oid>/{comments.md,meta.json,images/}`；配图自动本地化。
> 评论区由内容入口自动解析为 `(oid,type)`，无需手动算。

---

## 通用提示
- **ID 命名空间**：bvid↔video、mid↔creator/channel、opusId↔article、(kind+id)↔channel、(oid+type)↔comments，别错配（见 [conventions.md §ID 命名空间矩阵](conventions.md)）。
- **一次一条**：批量下载/提取串行执行，便于错误定位与重试。
- **先 moduleCounts 后枚举**：用 `bili-creator` 的 `detail.moduleCounts` 计数省掉空模块请求。
- **隐私墙**：返回空集是正常态（code=53013），不重试。
