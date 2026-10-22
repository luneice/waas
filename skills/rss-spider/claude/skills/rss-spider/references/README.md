# rss-spider 文档索引（渐进式阅读指引）

本目录文档遵循**渐进式披露**结构：先读 L1 快速上手，有需要时再按层级深入。

## 文档层级

| 层级 | 文件 | 用途 |
|---|---|---|
| L2 示例 | [examples.md](./examples.md) | 各场景调用示例、Google News 搜索规律 |
| L3 参考 | [reference.md](./reference.md) | 完整参数表、环境变量、类型定义、内部行为 |
| L4 路由 | [RSSHub_Skill_渐进式路由指南/README.md](./RSSHub_Skill_渐进式路由指南/README.md) | RSSHub 2000+ 路由分类索引，渐进式三步查找 |

## 推荐阅读路径

```
../SKILL.md（入口）
  ├─ 需要更多示例？→ references/examples.md
  ├─ 需要查参数？  → references/reference.md
  └─ 需要发现路由？→ references/RSSHub_Skill_渐进式路由指南/README.md
                              └─ 按分类 → 各分类.md → 选路由模板
```

---

> 以下为 RSSHub 路由分类速查（完整交互式指引见 L4 子目录）。

## 快速使用（给 AI）

1. 先从下面「分类总目录」选择最可能的分类文件。
2. 进入分类后，通过「服务总览」找到站点/服务。
3. 在服务详情里选一条路由模板，并按参数说明填值。
4. 输出给 Skill 的关键字段通常是：`route`（字符串）以及（可选）`params`/`path`/`query`（取决于你 Skill 的封装方式）。

## 分类总目录

| 分类 | slug | 路由数 | 文件 |
|---|---|---:|---|
| 💬 社交媒体 | `social-media` | 175 | [social-media.md](social-media.md) |
| 📱 新媒体 | `new-media` | 261 | [new-media.md](new-media.md) |
| 📰 传统媒体 | `traditional-media` | 120 | [traditional-media.md](traditional-media.md) |
| 💬️ 论坛 | `bbs` | 64 | [bbs.md](bbs.md) |
| 🖊️️ 博客 | `blog` | 41 | [blog.md](blog.md) |
| 💻 编程 | `programming` | 108 | [programming.md](programming.md) |
| 🎨️ 设计 | `design` | 13 | [design.md](design.md) |
| 🎥 直播 | `live` | 15 | [live.md](live.md) |
| 🔊 音视频 | `multimedia` | 3 | [multimedia.md](multimedia.md) |
| 🖼️ 图片 | `picture` | 30 | [picture.md](picture.md) |
| 🎨️ 二次元 | `anime` | 76 | [anime.md](anime.md) |
| 🔄 程序更新 | `program-update` | 56 | [program-update.md](program-update.md) |
| 🎓 大学通知 | `university` | 263 | [university.md](university.md) |
| ❗️ 预报预警 | `forecast` | 24 | [forecast.md](forecast.md) |
| 🛫 出行旅游 | `travel` | 13 | [travel.md](travel.md) |
| 🛍️ 购物 | `shopping` | 52 | [shopping.md](shopping.md) |
| 🎮 游戏 | `game` | 67 | [game.md](game.md) |
| 📚 阅读 | `reading` | 32 | [reading.md](reading.md) |
| 📢 政务消息 | `government` | 3 | [government.md](government.md) |
| 📖 学习 | `study` | 27 | [study.md](study.md) |
| 🔬 科学期刊 | `journal` | 41 | [journal.md](journal.md) |
| 💰 金融 | `finance` | 92 | [finance.md](finance.md) |
| 🔍 其他 | `other` | 433 | [other.md](other.md) |

## 说明与约定

- 文档来源：RSSHub 官方中文路由文档（离线抓取缓存）。
- `:param` 表示路径参数；尾部 `?` 表示该段可选（例如 `:source?`）。
- 若路由说明里提到 Cookie、登录、代理、Puppeteer、反爬严格等，通常需要自建 RSSHub 实例并按要求配置环境变量。
- **内容政策**：对「其他」分类中疑似成人内容相关条目已做跳过处理（仅影响文档，不影响你的实际 RSSHub 实例能力）。