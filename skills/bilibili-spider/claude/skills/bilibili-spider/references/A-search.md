# 能力 A · 发现（1 Skill）

> **何时**：用户给的是**关键词**而非具体 ID，需要全站找视频/番剧/影视/直播/专栏/用户。
> **产出**：标准化 `items[]`，是拿 `bvid` / `mid` / `opusId` 喂给 B/C 模块的起点。
> **共享约定**（翻页/WBI/错误码/输出）见 [conventions.md](conventions.md)。

---

## `bili-search`

底层：`GET /x/web-interface/wbi/search/type`（WBI 签名 + qvId 会话）。

### 参数

必填：`keyword`。

| 参数 | 默认 | 说明 |
|---|---|---|
| `kind` | `video` | 搜索分类，见下表（接受别名） |
| `page` | `1` | 起始页码 |
| `maxPages` | `1` | 连续抓取页数；**动态偏移分类**（video/live/bili_user）按主键去重 |
| `pageSize` | 分类默认 | 覆盖 `page_size`；默认 video/live=42, bili_user=36, article=20, PGC=12 |
| `order` | 分类默认 | 排序值，按分类透传（见下） |
| `qvId` | 自动 | 搜索会话 ID；不传自动生成并在连续翻页中复用 |
| `offsetStep` | `24` | 动态偏移分页步长，与 PC 搜索页 HAR 一致 |

视频专用：`duration`（0/空=不限，1-4 时长区间）、`tids`（分区 ID）、`pubtimeBeginS`/`pubtimeEndS`（发布时间秒级时间戳）。
专栏专用：`categoryId`（专栏分区，0=全部）、`pubtimeBeginS`/`pubtimeEndS`。
用户专用：`orderSort`（0=降序/1=升序）、`userType`（0=全部/1=UP/2=普通/3=认证）。

### `kind` 取值（含别名）

| kind | 别名 | 含义 | 默认 pageSize |
|---|---|---|---|
| `video` | — | 视频 | 42 |
| `media_bangumi` | `bangumi` | 番剧 | 12 |
| `media_ft` | `pgc` | 影视 | 12 |
| `live` | — | 直播 | 42 |
| `article` | — | 专栏 | 20 |
| `bili_user` | `upuser` | 用户/UP | 36 |

### `order` 取值（按分类透传）

- 视频：`click`(最多播放) / `pubdate`(最新) / `dm`(最多弹幕) / `stow`(最多收藏)
- 专栏：`totalrank` / `pubdate` / `click` / `attention` / `scores`
- 用户：`fans`(粉丝数) / `level`(等级)

### 翻页与去重

- **video / live / bili_user**：用 `dynamic_offset`（步长 24）翻页，跨页按主键去重，`maxPages` 控制连续抓取页数。
- **article / 番剧 / 影视**：普通 page 翻页。
- 详见 [conventions.md §翻页范式](conventions.md) 与 `docs/search-pagination-analysis.md`（HAR 实证）。

### 输出

AI-ready 信封：
- `meta`：关键词 / 分类 / 翻页汇总 / 上游总量
- `insights`：抓取摘要（中文要点）
- `items[]`：标准化结果，统一形状 `{ rank, type, id, title, url, cover, author, stats, publishedAt, duration, extra }`

`meta` 的翻页统计是**拍平字段**（无 `meta.page.*` 嵌套）：

| 字段 | 含义 |
|---|---|
| `meta.total` | 上游可见结果总数；部分分类不给，为 `null` |
| `meta.totalPages` | 上游可见总页数；同样可能为 `null` |
| `meta.pageStart` | 本次抓取的起始页码（回显入参 `page`） |
| `meta.pagesFetched` | 实际抓取页数 |
| `meta.returnedCount` | 去重后返回条数 |
| `meta.duplicatesRemoved` | 跨页去重移除的重复条数 |

翻页策略与逐页轨迹另在 `meta.pagination.{strategy,note,pages}`（`strategy` = `dynamic_offset` / `page`）。

> 取下游 ID：视频→`items[].id`(bvid 或 aid) / `items[].url`；用户→`items[].id`(mid)；专栏→`items[].url`(/opus 或 /read/cv)。

### 陷阱

1. 番剧/影视/直播无 `bvid`，不能直接喂 `bili-video`——它们是 PGC/直播，非普通稿件。
2. 搜出的"专栏"要拿正文 → `bili-article`（取 `items[].url`）；要拿某 UP 全部专栏 → 先取 `author.mid` 再 `bili-creator-articles`。
3. 搜"用户"只为拿 `mid`，深挖该 UP 走 B 模块。
