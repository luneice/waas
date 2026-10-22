# 同名歧义决策树（disambiguation）

> 10 个 Skill 里有大量"听起来相近"的名字，AI 误路由的最大风险源。SKILL.md §2 是速判表，这里给完整决策树 + 反例。
> 共享术语（翻页范式 / ID 命名空间）见 [conventions.md](conventions.md)。

---

## 第一刀：全站找 vs 指定 UP vs 单条提取

```
用户给了什么？
├─ 只有关键词/话题，要"找"          → A 发现（bili-search）
├─ 有某个 UP（mid/主页/昵称），列其作品 → B 创作者枚举
└─ 有某条具体内容的 ID/URL，要全量或落盘 → C 内容提取
```

---

## 陷阱 1 · `bili-search` vs `bili-creator-*`
- **全站**范围找做某事的内容/人 → `bili-search`。
  - 例：「搜 B 站做 Rust 教程的视频」「找美食区的 UP」。
- 范围**锁定在一个已知 UP** → `bili-creator-*`。
  - 例：「@老番茄 都发过哪些视频」。
- 判据：句子里有没有"某个具体 UP"。有 → creator；没有 → search。

## 陷阱 2 · `bili-creator-videos` vs `bili-creator-feed`
- 只要**投稿视频**（稿件），干净的视频清单 → `bili-creator-videos`（可排序/分区/站内搜）。
- 要 UP 的**动态全貌**（转发、图文、纯文字、视频混排时间线）→ `bili-creator-feed`。
- 判据："视频列表/投稿"→videos；"动态/最近在干嘛/发了什么"→feed。

## 陷阱 3 · `bili-creator-articles` vs `bili-creator-feed`
- 只要**图文/专栏动态**清单 → `bili-creator-articles`。
- 要含图文在内的**全类型动态** → `bili-creator-feed`（项带 `kind`）。
- 判据：明确"专栏/图文"→articles；泛指"动态"→feed。

## 陷阱 4 · `bili-creator-channels` vs `bili-channel` ⚠️最易错
- 要知道 UP **有哪些合集/系列**（目录，每项带少量预览稿件）→ `bili-creator-channels`。
- 要某**一个**合集/系列里的**全部稿件**（翻页）→ `bili-channel`（需 `kind`+`id`+`mid`）。
- 链路：先 `channels` 拿 `items[].kind`+`items[].id`，再喂 `bili-channel`。
- 判据："有哪些合集"→channels；"这个合集里所有视频"→channel。

## 陷阱 5 · `bili-creator-videos` vs `bili-video`
- 要 UP 视频**清单/元数据**（不下载）→ `bili-creator-videos`。
- 要把**某一个视频**下载/解析成文件或流 → `bili-video`。
- 判据："列出/有哪些"→videos；"下载/保存/这个视频"→video。

## 陷阱 6 · `bili-creator-articles` vs `bili-article`
- 列 UP 的**图文清单** → `bili-creator-articles`。
- 取**单篇**专栏正文 + 配图落盘 → `bili-article`。
- 判据："有哪些专栏"→articles；"保存/读这篇"→article。

## 陷阱 7 · `bili-search(article)` vs `bili-article`
- 全站搜专栏**列表** → `bili-search '{"kind":"article",...}'`。
- 提取某**一篇**专栏内容 → `bili-article`。
- 判据："找专栏"→search；"这篇专栏内容"→article。

---

## 快速对照

| 关键词信号 | 路由 |
|---|---|
| 搜 / 找 / 全站 / 哪些人在做 | `bili-search` |
| 某 UP + 视频列表 | `bili-creator-videos` |
| 某 UP + 动态/最近 | `bili-creator-feed` |
| 某 UP + 专栏/图文列表 | `bili-creator-articles` |
| 某 UP + 有哪些合集 | `bili-creator-channels` |
| 这个合集里全部视频 | `bili-channel` |
| 下载/保存这个视频 | `bili-video` |
| 保存/读这篇专栏 | `bili-article` |
| 某 UP 是谁/资料/概况 | `bili-creator` |
