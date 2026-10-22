# bilibili-spider · 调用协议（始终生效 · 差异部分）

> 通用调用形式、一次一条命令、jq 提取、错误码表、`--raw`、并行化见 `rules/spider-core.md` / `rules/spider-runtime.md`（随包安装）。本文件只写 bilibili 特有约束。

## 1. ID 来源表（严禁猜测）

`mid` / `aid` / `season_id` / `series_id` 等都是数字（`bvid` 形如 `BV…`），**严禁传中文名或编造**。没有 ID 先走上游：

| 入参 | 来源 | ❌ | ✅ |
|---|---|---|---|
| `mid` | `bili-search(bili_user).items[].id` / 列表 `author.mid` / 主页 URL | `"老番茄"` | `546195` |
| `bvid` / `aid` | `bili-search(video)` / `bili-creator-videos` / `bili-channel` 的 items | `"某视频"` | `"BV1xx411c7mD"` |
| `opusId` / `cvId` | `bili-search(article)` / `bili-creator-articles` 的 items | 自编 | `1204763696927080471` |
| `season_id`/`series_id`(+`kind`) | `bili-creator-channels.items[].id`(+`.kind`) | 猜 | `12345` |
| `offset` 游标 | **同一 Skill** 上次输出的 `nextOffset` | 自编 | `"..."` |

> ID 命名空间矩阵见 `references/conventions.md §4`。番剧/影视/直播无 `bvid`，不能喂 `bili-video`。

## 2. 入口归一可放宽

`mid` 接受纯数字 / 主页 URL / `space.bilibili.com/{mid}`；视频/专栏接受 URL 或 ID（内部归一）。详见 `references/conventions.md §1`。

## 3. 翻页范式别混用

- page/maxPages 类（search 部分 / creator-videos / -audios / -channels / channel）：传 `page`+`maxPages`。
- offset 游标类（creator-articles / -feed）：传 `offset`，读 `nextOffset`/`hasMore` 续取，**无** `page`/`maxPages`。

## 4. 错误表特例（对通用错误码的补充）

- `upstream-shape-changed` 还可能由 **WBI key 缺失**触发 → 报告维护者。
- `code=53013` 隐私墙**不是错误**（见 `bili-runtime.md`）。
