# 🎨️ 二次元（anime）

本分类共 **76** 条路由。

## 使用方式（给 AI）

1. 先在本页的「服务总览」定位目标站点/服务。
2. 打开对应服务的折叠块，选择与你要订阅的「Feed」最匹配的一条路由。
3. 将路由模板里的 `:参数` 替换为具体值；`?` 表示可选段。
4. 若标注了「反爬严格/需要登录/需要 Cookie」等标签，优先使用自建实例并配置相应环境变量或代理。

## 服务总览（渐进式入口）

| 服务 | 路由数 |
|---|---:|
| [AcFun](#acfun) | 2 |
| [ACG17](#acg17) | 1 |
| [AGE 动漫](#age-动漫) | 2 |
| [CCC 創作集](#ccc-創作集) | 1 |
| [CnGal](#cngal) | 2 |
| [Comicat](#comicat) | 1 |
| [Comics Kingdom](#comics-kingdom) | 1 |
| [DLsite](#dlsite) | 3 |
| [Eventernote](#eventernote) | 1 |
| [Gogoanimehd](#gogoanimehd) | 1 |
| [Hpoi 手办维基](#hpoi-手办维基) | 6 |
| [IDOLY PRIDE 偶像荣耀](#idoly-pride-偶像荣耀) | 1 |
| [iwara](#iwara) | 1 |
| [Kemono](#kemono) | 1 |
| [lovelive-anime](#lovelive-anime) | 2 |
| [Mox.moe](#moxmoe) | 1 |
| [nhentai](#nhentai) | 2 |
| [QooApp](#qooapp) | 8 |
| [Rawkuma](#rawkuma) | 1 |
| [THBWiki](#thbwiki) | 1 |
| [VCB-Studio](#vcb-studio) | 1 |
| [X 漫画](#x-漫画) | 1 |
| [アニメ新番組](#アニメ新番組) | 9 |
| [俺の 3D エロ動画 (oreno3d)的直接链接")](#俺の-3d-エロ動画-oreno3d的直接链接) | 5 |
| [动漫之家](#动漫之家) | 1 |
| [動漫狂](#動漫狂) | 1 |
| [包子漫画](#包子漫画) | 1 |
| [巴哈姆特電玩資訊站](#巴哈姆特電玩資訊站) | 4 |
| [拷贝漫画](#拷贝漫画) | 1 |
| [月幕 Galgame](#月幕-galgame) | 2 |
| [来漫画](#来漫画) | 1 |
| [番组放送](#番组放送) | 1 |
| [看漫画](#看漫画) | 3 |
| [禁漫天堂](#禁漫天堂) | 4 |
| [腾讯新闻较真查证平台](#腾讯新闻较真查证平台) | 1 |
| [风之动漫](#风之动漫) | 1 |

## 服务详情（按需展开）

### AcFun
<a id="acfun"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 文章

- **路由**：`/acfun/article/:categoryId/:sortType?/:timeRange?`
  - **示例**：https://rsshub.app/acfun/bangumi/5022158
  - **源代码**：`/acfun/article.ts`
  - **作者**：@TonyRL

#### 番剧

- **路由**：`/acfun/bangumi/:id`
  - **示例**：https://rsshub.app/acfun/bangumi/5022158
  - **源代码**：`/acfun/bangumi.ts`
  - **作者**：@xyqfer

</details>

### ACG17
<a id="acg17"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 全部文章

- **路由**：`/acg17/post/all` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/acg17/post/all
  - **源代码**：`/acg17/post.ts`
  - **作者**：@SunBK201

</details>

### AGE 动漫
<a id="age-动漫"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 最近更新

- **路由**：`/agefans/update` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/agefans/detail/20200035
  - **源代码**：`/agefans/update.ts`
  - **作者**：@s2marine

#### 番剧详情

- **路由**：`/agefans/detail/:id` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/acg17/post/all
  - **源代码**：`/agefans/detail.ts`
  - **作者**：@SunBK201

</details>

### CCC 創作集
<a id="ccc-創作集"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 漫畫

- **路由**：`/creative-comic/book/:id/:coverOnly?/:quality?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/comicskingdom/pardon-my-planet
  - **源代码**：`/creative-comic/book.ts`
  - **作者**：@TonyRL

</details>

### CnGal
<a id="cngal"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 制作者 / 游戏新闻

- **路由**：`/cngal/entry/:id` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/cngal/weekly
  - **源代码**：`/cngal/entry.ts`
  - **作者**：@chengyuhui

#### 每周速报

- **路由**：`/cngal/weekly` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/agefans/update
  - **源代码**：`/cngal/weekly.ts`
  - **作者**：@nczitzk

</details>

### Comicat
<a id="comicat"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 搜索关键词

- **路由**：`/comicat/search/:keyword`
  - **示例**：https://rsshub.app/cngal/entry/2693
  - **源代码**：`/comicat/search.ts`
  - **作者**：@Cyang39

</details>

### Comics Kingdom
<a id="comics-kingdom"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Archive

- **路由**：`/comicskingdom/:name` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/comicat/search/喵萌奶茶屋+跃动青春+720P+简日
  - **源代码**：`/comicskingdom/index.ts`
  - **作者**：@stjohnjohnson

</details>

### DLsite
<a id="dlsite"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Ci-en Creators' Article

- **路由**：`/dlsite/ci-en/:id/article` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/dlsite/ci-en/7400/article
  - **源代码**：`/dlsite/ci-en/article.ts`
  - **作者**：@nczitzk

#### Current Release

- **路由**：`/dlsite/new/:type`
  - **示例**：https://rsshub.app/creative-comic/book/117
  - **源代码**：`/dlsite/new.ts`
  - **作者**：@cssxsh

#### Discounted Works

- **路由**：`/dlsite/campaign/:type/:free?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/dlsite/ci-en/7400/article
  - **源代码**：`/dlsite/campaign.ts`
  - **作者**：@nczitzk

</details>

### Eventernote
<a id="eventernote"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 声优活动及演唱会

- **路由**：`/eventernote/actors/:name/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/eventernote/actors/三森すずこ/2634
  - **源代码**：`/eventernote/actors.ts`
  - **作者**：@KTachibanaM

</details>

### Gogoanimehd
<a id="gogoanimehd"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Recent Releases

- **路由**：`/gogoanimehd/recent-releases` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/gogoanimehd/recent-releases
  - **源代码**：`/gogoanimehd/recent-releases.ts`
  - **作者**：@user4302

</details>

### Hpoi 手办维基
<a id="hpoi-手办维基"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 作品周边

- **路由**：`/hpoi/items/work/:id/:order?`
  - **示例**：https://rsshub.app/hpoi/items/work/4117491
  - **源代码**：`/hpoi/work.ts`
  - **作者**：@DIYgod

#### 情报

- **路由**：`/hpoi/info/:type?`
  - **示例**：https://rsshub.app/hpoi/info/all
  - **源代码**：`/hpoi/info.ts`
  - **作者**：@sanmmm

#### 所有周边

- **路由**：`/hpoi/items/all/:order?` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/hpoi/bannerItem
  - **源代码**：`/hpoi/all.ts`
  - **作者**：@DIYgod

#### 热门推荐

- **路由**：`/hpoi/bannerItem` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/hpoi/bannerItem
  - **源代码**：`/hpoi/banner-item.ts`
  - **作者**：@DIYgod

#### 用户动态

- **路由**：`/hpoi/user/:user_id/:caty`
  - **示例**：https://rsshub.app/hpoi/items/all
  - **源代码**：`/hpoi/user.ts`
  - **作者**：@DIYgod, @luyuhuang

#### 角色周边

- **路由**：`/hpoi/items/character/:id/:order?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/gogoanimehd/recent-releases
  - **源代码**：`/hpoi/character.ts`
  - **作者**：@user4302

</details>

### IDOLY PRIDE 偶像荣耀
<a id="idoly-pride-偶像荣耀"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### News

- **路由**：`/idolypride/news` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/idolypride/news
  - **源代码**：`/idolypride/news.ts`
  - **作者**：@Mingxia1

</details>

### iwara
<a id="iwara"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### User Subscriptions

- **路由**：`/iwara/subscriptions` `⚙️ 需要配置` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/idolypride/news
  - **源代码**：`/iwara/subscriptions.ts`
  - **作者**：@Mingxia1

</details>

### Kemono
<a id="kemono"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Posts

- **路由**：`/kemono/:source?/:id?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/kemono
  - **源代码**：`/kemono/index.ts`
  - **作者**：@nczitzk

</details>

### lovelive-anime
<a id="lovelive-anime"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Love Live Official Website Categories Topics

- **路由**：`/lovelive-anime/topics/:abbr/:category?/:option?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/lovelive-anime/news
  - **源代码**：`/lovelive-anime/topics.ts`
  - **作者**：@axojhf

#### Love Live! Official Website Latest NEWS

- **路由**：`/lovelive-anime/news/:option?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/lovelive-anime/news
  - **源代码**：`/lovelive-anime/news.ts`
  - **作者**：@axojhf

</details>

### Mox.moe
<a id="moxmoe"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 首頁

- **路由**：`/mox/:category?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/mox
  - **源代码**：`/mox/index.ts`
  - **作者**：@nczitzk

</details>

### nhentai
<a id="nhentai"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Advanced Search

- **路由**：`/nhentai/search/:keyword/:mode?` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/nhentai/search/language%3Ajapanese+-scat+-yaoi+-guro+-"mosaic+censorship"
  - **源代码**：`/nhentai/search.ts`
  - **作者**：@MegrezZhu, @hoilc

#### Filter

- **路由**：`/nhentai/:key/:keyword/:mode?` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/nhentai/search/language%3Ajapanese+-scat+-yaoi+-guro+-"mosaic+censorship"
  - **源代码**：`/nhentai/other.ts`
  - **作者**：@MegrezZhu, @hoilc

</details>

### QooApp
<a id="qooapp"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Game Store - Article

- **路由**：`/qoo-app/apps/:lang?/post/:id`
  - **示例**：https://rsshub.app/qoo-app/apps/en/note/7675
  - **源代码**：`/qoo-app/apps/post.ts`
  - **作者**：@TonyRL

#### Game Store - Cards

- **路由**：`/qoo-app/apps/:lang?/card/:id`
  - **示例**：https://rsshub.app/nhentai/language/chinese
  - **源代码**：`/qoo-app/apps/card.ts`
  - **作者**：@TonyRL

#### Game Store - Notes

- **路由**：`/qoo-app/apps/:lang?/note/:id`
  - **示例**：https://rsshub.app/qoo-app/apps/en/note/7675
  - **源代码**：`/qoo-app/apps/note.ts`
  - **作者**：@TonyRL

#### Game Store - Review

- **路由**：`/qoo-app/apps/:lang?/comment/:id`
  - **示例**：https://rsshub.app/qoo-app/apps/en/card/7675
  - **源代码**：`/qoo-app/apps/comment.ts`
  - **作者**：@TonyRL

#### News

- **路由**：`/qoo-app/news/:lang?`
  - **示例**：https://rsshub.app/qoo-app/apps/en/post/7675
  - **源代码**：`/qoo-app/news.ts`
  - **作者**：@TonyRL

#### Note Comments

- **路由**：`/qoo-app/notes/:lang?/note/:id`
  - **示例**：https://rsshub.app/qoo-app/news/en
  - **源代码**：`/qoo-app/notes/note.ts`
  - **作者**：@TonyRL

#### User Game Comments

- **路由**：`/qoo-app/user/:lang?/appComment/:uid`
  - **示例**：https://rsshub.app/qoo-app/notes/en/user/35399143
  - **源代码**：`/qoo-app/user/app-comment.ts`
  - **作者**：@TonyRL

#### User Notes

- **路由**：`/qoo-app/notes/:lang?/user/:uid`
  - **示例**：https://rsshub.app/qoo-app/notes/en/note/2329113
  - **源代码**：`/qoo-app/notes/user.ts`
  - **作者**：@TonyRL

</details>

### Rawkuma
<a id="rawkuma"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Manga

- **路由**：`/rawkuma/manga/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/rawkuma/manga/tensei-shitara-dai-nana-ouji-dattanode-kimamani-majutsu-o-kiwamemasu
  - **源代码**：`/rawkuma/manga.ts`
  - **作者**：@nczitzk

</details>

### THBWiki
<a id="thbwiki"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Calendar

- **路由**：`/thwiki/calendar/:before?/:after?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/rawkuma/manga/tensei-shitara-dai-nana-ouji-dattanode-kimamani-majutsu-o-kiwamemasu
  - **源代码**：`/thwiki/index.ts`
  - **作者**：@aether17

</details>

### VCB-Studio
<a id="vcb-studio"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 分类文章

- **路由**：`/vcb-s/category/:cate` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/vcb-s/category/works
  - **源代码**：`/vcb-s/category.ts`
  - **作者**：@cxfksword

</details>

### X 漫画
<a id="x-漫画"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 最新动态

- **路由**：`/xmanhua/:uid` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/xmanhua/73xm
  - **源代码**：`/xmanhua/index.ts`
  - **作者**：@Ye11

</details>

### アニメ新番組
<a id="アニメ新番組"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Unknown

- **路由**：`/bangumi/online` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bangumi/online
  - **源代码**：`/bangumi/online/online.ts`
  - **作者**：@devinmugen

#### 小组话题

- **路由**：`/bangumi/tv/group/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bangumi/tv/topic/367032
  - **源代码**：`/bangumi/tv/group/topic.ts`
  - **作者**：@ylc395

#### 小组话题的新回复

- **路由**：`/bangumi/tv/topic/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bangumi/tv/person/32943
  - **源代码**：`/bangumi/tv/group/reply.ts`
  - **作者**：@ylc395

#### 成员关注动画榜

- **路由**：`/bangumi/tv/followrank` `🔍 支持 Radar` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bangumi/online
  - **源代码**：`/bangumi/tv/other/followrank.ts`
  - **作者**：@devinmugen

#### 放送列表

- **路由**：`/bangumi/tv/calendar/today` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bangumi/tv/followrank
  - **源代码**：`/bangumi/tv/calendar/today.ts`
  - **作者**：@honue

#### 条目的通用路由格式

- **路由**：`/bangumi/tv/subject/:id/:type?/:showOriginalName?` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bangumi/tv/calendar/today
  - **源代码**：`/bangumi/tv/subject/index.ts`
  - **作者**：@magic-akari

#### 现实人物的新作品

- **路由**：`/bangumi/tv/person/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bangumi/tv/person/32943
  - **源代码**：`/bangumi/tv/person/index.ts`
  - **作者**：@ylc395

#### 用户想看

- **路由**：`/bangumi/tv/user/wish/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bangumi/tv/user/blog/sai
  - **源代码**：`/bangumi/tv/user/wish.ts`
  - **作者**：@nczitzk

#### 用户日志

- **路由**：`/bangumi/tv/user/blog/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bangumi/tv/group/boring
  - **源代码**：`/bangumi/tv/user/blog.ts`
  - **作者**：@SettingDust

</details>

### 俺の 3D エロ動画 (oreno3d)的直接链接")
<a id="俺の-3d-エロ動画-oreno3d的直接链接"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Author Search

- **路由**：`/oreno3d/authors/:authorid/:sort/:pagelimit?,/characters/:characterid/:sort/:pagelimit?,/origins/:originid/:sort/:pagelimit?,/search/:keyword/:sort/:pagelimit?,/tags/:tagid/:sort/:pagelimit?`
  - **示例**：https://rsshub.app/oreno3d/authors/3189/latest/1
  - **源代码**：`/oreno3d/main.ts`
  - **作者**：@xueli_sherryli
- **路由**：`/oreno3d/authors/:authorid/:sort/:pagelimit?,/characters/:characterid/:sort/:pagelimit?,/origins/:originid/:sort/:pagelimit?,/search/:keyword/:sort/:pagelimit?,/tags/:tagid/:sort/:pagelimit?`
  - **示例**：https://rsshub.app/oreno3d/authors/3189/latest/1
  - **源代码**：`/oreno3d/main.ts`
  - **作者**：@xueli_sherryli
- **路由**：`/oreno3d/authors/:authorid/:sort/:pagelimit?,/characters/:characterid/:sort/:pagelimit?,/origins/:originid/:sort/:pagelimit?,/search/:keyword/:sort/:pagelimit?,/tags/:tagid/:sort/:pagelimit?`
  - **示例**：https://rsshub.app/oreno3d/authors/3189/latest/1
  - **源代码**：`/oreno3d/main.ts`
  - **作者**：@xueli_sherryli
- **路由**：`/oreno3d/authors/:authorid/:sort/:pagelimit?,/characters/:characterid/:sort/:pagelimit?,/origins/:originid/:sort/:pagelimit?,/search/:keyword/:sort/:pagelimit?,/tags/:tagid/:sort/:pagelimit?`
  - **示例**：https://rsshub.app/oreno3d/authors/3189/latest/1
  - **源代码**：`/oreno3d/main.ts`
  - **作者**：@xueli_sherryli
- **路由**：`/oreno3d/authors/:authorid/:sort/:pagelimit?,/characters/:characterid/:sort/:pagelimit?,/origins/:originid/:sort/:pagelimit?,/search/:keyword/:sort/:pagelimit?,/tags/:tagid/:sort/:pagelimit?`
  - **示例**：https://rsshub.app/oreno3d/authors/3189/latest/1
  - **源代码**：`/oreno3d/main.ts`
  - **作者**：@xueli_sherryli

</details>

### 动漫之家
<a id="动漫之家"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 新闻站

- **路由**：`/dmzj/news/:category?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/baozimh/comic/guowangpaiming-shiricaofu
  - **源代码**：`/dmzj/news.ts`
  - **作者**：@vzz64

</details>

### 動漫狂
<a id="動漫狂"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 漫画更新

- **路由**：`/cartoonmad/comic/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/cartoonmad/comic/5827
  - **源代码**：`/cartoonmad/comic.ts`
  - **作者**：@KellyHwong

</details>

### 包子漫画
<a id="包子漫画"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 订阅漫画

- **路由**：`/baozimh/comic/:name` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/gamer/hot/47157
  - **源代码**：`/baozimh/index.ts`
  - **作者**：@Fatpandac

</details>

### 巴哈姆特電玩資訊站
<a id="巴哈姆特電玩資訊站"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### GNN 新聞

- **路由**：`/gamer/gnn/:category?`
  - **示例**：https://rsshub.app/oreno3d/authors/3189/latest/1
  - **源代码**：`/gamer/gnn-index.ts`
  - **作者**：@xueli_sherryli

#### 動畫瘋 - 動畫

- **路由**：`/gamer/ani/anime/:sn`
  - **示例**：https://rsshub.app/gamer/ani/anime/36868
  - **源代码**：`/gamer/ani/anime.ts`

#### 動畫瘋 - 最後更新

- **路由**：`/gamer/ani/new_anime` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/gamer/ani/anime/36868
  - **源代码**：`/gamer/ani/new-anime.ts`

#### 熱門推薦

- **路由**：`/gamer/hot/:bsn` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/gamer/ani/new_anime
  - **源代码**：`/gamer/hot.ts`

</details>

### 拷贝漫画
<a id="拷贝漫画"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 漫画更新

- **路由**：`/copymanga/comic/:id/:chapterCnt?`
  - **示例**：https://rsshub.app/copymanga/comic/dianjuren/5
  - **源代码**：`/copymanga/comic.ts`
  - **作者**：@btdwv, @marvolo666, @yan12125

</details>

### 月幕 Galgame
<a id="月幕-galgame"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 文章

- **路由**：`/ymgal/article/:type?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/ymgal/game/release
  - **源代码**：`/ymgal/article.ts`
  - **作者**：@SunBK201

#### 本月新作

- **路由**：`/ymgal/game/release` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/ymgal/game/release
  - **源代码**：`/ymgal/game.ts`
  - **作者**：@SunBK201

</details>

### 来漫画
<a id="来漫画"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 漫画列表

- **路由**：`/laimanhua/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/laimanhua/tiandikangzhanjiVERSUS
  - **源代码**：`/laimanhua/index.ts`
  - **作者**：@TonyRL

</details>

### 番组放送
<a id="番组放送"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 开播提醒

- **路由**：`/bgmlist/onair/:lang?`
  - **示例**：https://rsshub.app/cartoonmad/comic/5827
  - **源代码**：`/bgmlist/onair.ts`
  - **作者**：@KellyHwong

</details>

### 看漫画
<a id="看漫画"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 漫画个人订阅

- **路由**：`/manhuagui/subscribe` `⚙️ 需要配置` `🔍 支持 Radar` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/manhuagui/comic/22942/5
  - **源代码**：`/manhuagui/subscribe.ts`
  - **作者**：@MegrezZhu

#### 漫画更新

- **路由**：`/manhuagui/comic/:id/:chapterCnt?,/:domain?/comic/:id/:chapterCnt?` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/manhuagui/comic/22942/5
  - **源代码**：`/manhuagui/comic.ts`
  - **作者**：@MegrezZhu
- **路由**：`/manhuagui/comic/:id/:chapterCnt?,/:domain?/comic/:id/:chapterCnt?` `🚨 反爬严格` `🔍 支持 Radar` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/manhuagui/comic/22942/5
  - **源代码**：`/manhuagui/comic.ts`
  - **作者**：@MegrezZhu

</details>

### 禁漫天堂
<a id="禁漫天堂"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 专辑

- **路由**：`/18comic/album/:id` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/18comic/album/292282
  - **源代码**：`/18comic/album.ts`
  - **作者**：@nczitzk

#### 成人 A 漫

- **路由**：`/18comic/:category?/:time?/:order?/:keyword?` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/18comic
  - **源代码**：`/18comic/index.ts`
  - **作者**：@nczitzk

#### 搜索

- **路由**：`/18comic/search/:option?/:category?/:keyword?/:time?/:order?` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/18comic/search/photos/all/NTR
  - **源代码**：`/18comic/search.ts`

#### 文庫

- **路由**：`/18comic/blogs/:category?` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/18comic/blogs
  - **源代码**：`/18comic/blogs.ts`
  - **作者**：@nczitzk

</details>

### 腾讯新闻较真查证平台
<a id="腾讯新闻较真查证平台"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 排行榜

- **路由**：`/qq/ac/rank/:type?/:time?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/laimanhua/tiandikangzhanjiVERSUS
  - **源代码**：`/qq/ac/rank.ts`
  - **作者**：@nczitzk

</details>

### 风之动漫
<a id="风之动漫"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 在线漫画

- **路由**：`/fffdm/manhua/:id/:cdn?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bgmlist/onair/zh-Hans
  - **源代码**：`/fffdm/manhua/manhua.ts`
  - **作者**：@zytomorrow

</details>
