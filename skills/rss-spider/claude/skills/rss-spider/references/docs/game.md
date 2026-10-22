# 🎮 游戏（game）

本分类共 **67** 条路由。

## 使用方式（给 AI）

1. 先在本页的「服务总览」定位目标站点/服务。
2. 打开对应服务的折叠块，选择与你要订阅的「Feed」最匹配的一条路由。
3. 将路由模板里的 `:参数` 替换为具体值；`?` 表示可选段。
4. 若标注了「反爬严格/需要登录/需要 Cookie」等标签，优先使用自建实例并配置相应环境变量或代理。

## 服务总览（渐进式入口）

| 服务 | 路由数 |
|---|---:|
| [3DMGame](#3dmgame) | 1 |
| [4Gamers](#4gamers) | 2 |
| [5EPLAY](#5eplay) | 1 |
| [Blizzard](#blizzard) | 1 |
| [Dorohedoro](#dorohedoro) | 1 |
| [Epic Games Store](#epic-games-store) | 1 |
| [FINAL FANTASY XIV 最终幻想 14](#final-fantasy-xiv-最终幻想-14) | 4 |
| [Fortnite](#fortnite) | 1 |
| [Gamer Secret](#gamer-secret) | 1 |
| [HoYoLAB](#hoyolab) | 1 |
| [indienova 独立游戏](#indienova-独立游戏) | 3 |
| [itch.io](#itchio) | 2 |
| [JUMP](#jump) | 1 |
| [Liquipedia](#liquipedia) | 1 |
| [Minecraft](#minecraft) | 1 |
| [Modrinth](#modrinth) | 1 |
| [Nintendo](#nintendo) | 4 |
| [osu!](#osu) | 1 |
| [PlayStation Store](#playstation-store) | 2 |
| [PRINCESS CONNECT! Re Dive プリンセスコネクト！Re Dive](#princess-connect-re-dive-プリンセスコネクトre-dive) | 1 |
| [SEGA](#sega) | 2 |
| [TapTap 中国](#taptap-中国) | 5 |
| [War Thunder](#war-thunder) | 1 |
| [ファミ通](#ファミ通) | 1 |
| [二柄 APP](#二柄-app) | 1 |
| [完美世界电竞](#完美世界电竞) | 1 |
| [少女前线](#少女前线) | 1 |
| [旅法师营地](#旅法师营地) | 2 |
| [明日方舟](#明日方舟) | 3 |
| [游戏基因](#游戏基因) | 1 |
| [游戏打折情报](#游戏打折情报) | 1 |
| [游戏日报](#游戏日报) | 1 |
| [游研社](#游研社) | 2 |
| [游讯网](#游讯网) | 2 |
| [王者荣耀](#王者荣耀) | 1 |
| [盒心光环](#盒心光环) | 1 |
| [米哈游](#米哈游) | 7 |
| [网易公开课](#网易公开课) | 1 |
| [英雄联盟](#英雄联盟) | 1 |
| [遊戲基地 Gamebase](#遊戲基地-gamebase) | 1 |

## 服务详情（按需展开）

### 3DMGame
<a id="3dmgame"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 新闻中心

- **路由**：`/3dmgame/news/:category?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/3dmgame/news
  - **源代码**：`/3dmgame/news-center.ts`
  - **作者**：@zhboner

</details>

### 4Gamers
<a id="4gamers"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 主題

- **路由**：`/4gamers/topic/:topic` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/4gamers/tag/限時免費
  - **源代码**：`/4gamers/topic.ts`
  - **作者**：@hoilc

#### 标签

- **路由**：`/4gamers/tag/:tag` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/4gamers/tag/限時免費
  - **源代码**：`/4gamers/tag.ts`
  - **作者**：@hoilc

</details>

### 5EPLAY
<a id="5eplay"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 新闻列表

- **路由**：`/5eplay/article` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/4gamers/topic/gentlemen-topic
  - **源代码**：`/5eplay/index.ts`
  - **作者**：@Dlouxgit

</details>

### Blizzard
<a id="blizzard"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### News

- **路由**：`/blizzard/news/:language?/:category?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/5eplay/article
  - **源代码**：`/blizzard/news.ts`
  - **作者**：@Dlouxgit

</details>

### Dorohedoro
<a id="dorohedoro"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### News

- **路由**：`/dorohedoro/news` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/dorohedoro/news
  - **源代码**：`/dorohedoro/news.ts`
  - **作者**：@nczitzk

</details>

### Epic Games Store
<a id="epic-games-store"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Free games

- **路由**：`/epicgames/freegames/:locale?/:country?` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/dorohedoro/news
  - **源代码**：`/epicgames/index.ts`
  - **作者**：@nczitzk

</details>

### FINAL FANTASY XIV 最终幻想 14
<a id="final-fantasy-xiv-最终幻想-14"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### FINAL FANTASY XIV (The Lodestone)的直接链接")

- **路由**：`/ff14/global/:lang/:type?,/ff14_global/:lang/:type?`
  - **示例**：https://rsshub.app/epicgames/freegames
  - **源代码**：`/ff14/ff14-global.ts`
  - **作者**：@chengyuhui
- **路由**：`/ff14/global/:lang/:type?,/ff14_global/:lang/:type?`
  - **示例**：https://rsshub.app/ff14/global/na/all
  - **源代码**：`/ff14/ff14-global.ts`
  - **作者**：@chengyuhui

#### 最终幻想 14 国服

- **路由**：`/ff14/zh/:type?,/ff14_zh/:type?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/ff14/zh/news
  - **源代码**：`/ff14/ff14-zh.ts`
  - **作者**：@Kiotlin, @ZeroClad, @15x15G
- **路由**：`/ff14/zh/:type?,/ff14_zh/:type?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/ff14/zh/news
  - **源代码**：`/ff14/ff14-zh.ts`
  - **作者**：@Kiotlin, @ZeroClad, @15x15G

</details>

### Fortnite
<a id="fortnite"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### News

- **路由**：`/fortnite/news/:options?`
  - **示例**：https://rsshub.app/ff14/zh/news
  - **源代码**：`/fortnite/news.ts`
  - **作者**：@lyqluis

</details>

### Gamer Secret
<a id="gamer-secret"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Category

- **路由**：`/gamersecret/:type?/:category?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/gamersecret
  - **源代码**：`/gamersecret/index.ts`
  - **作者**：@nczitzk

</details>

### HoYoLAB
<a id="hoyolab"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Official Announcement

- **路由**：`/hoyolab/news/:language/:gids/:type`
  - **示例**：https://rsshub.app/hoyolab/news/zh-cn/2/2
  - **源代码**：`/hoyolab/news.ts`
  - **作者**：@ZenoTian

</details>

### indienova 独立游戏
<a id="indienova-独立游戏"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Unknown

- **路由**：`/indienova/:type`
  - **示例**：https://rsshub.app/indienova/article
  - **源代码**：`/indienova/article.ts`
  - **作者**：@GensouSakuya, @kt286

#### 专题

- **路由**：`/indienova/column/:columnId` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/indienova/usergames
  - **源代码**：`/indienova/column.ts`
  - **作者**：@TonyRL

#### 会员开发游戏库

- **路由**：`/indienova/usergames` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/indienova/article
  - **源代码**：`/indienova/usergames.ts`
  - **作者**：@GensouSakuya, @kt286

</details>

### itch.io
<a id="itchio"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Developer Logs

- **路由**：`/itch/devlog/:user/:id`
  - **示例**：https://rsshub.app/itch/devlog/teamterrible/the-baby-in-yellow
  - **源代码**：`/itch/devlog.ts`
  - **作者**：@nczitzk

#### Posts

- **路由**：`/itch/posts/:topic/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/itch/posts/9539/introduce-yourself
  - **源代码**：`/itch/posts.ts`
  - **作者**：@nczitzk

</details>

### JUMP
<a id="jump"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 游戏折扣

- **路由**：`/jump/discount/:platform/:filter?/:countries?`
  - **示例**：https://rsshub.app/itch/posts/9539/introduce-yourself
  - **源代码**：`/jump/discount.ts`
  - **作者**：@zytomorrow

</details>

### Liquipedia
<a id="liquipedia"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Dota2 战队最近比赛结果

- **路由**：`/liquipedia/dota2/matches/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/liquipedia/dota2/matches/Team_Aster
  - **源代码**：`/liquipedia/dota2-matches.ts`
  - **作者**：@wzekin

</details>

### Minecraft
<a id="minecraft"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Java Game Update

- **路由**：`/minecraft/version` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/liquipedia/dota2/matches/Team_Aster
  - **源代码**：`/minecraft/version.ts`
  - **作者**：@TheresaQWQ

</details>

### Modrinth
<a id="modrinth"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Project versions

- **路由**：`/modrinth/project/:id/versions/:routeParams?` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/minecraft/version
  - **源代码**：`/modrinth/versions.ts`
  - **作者**：@TheresaQWQ

</details>

### Nintendo
<a id="nintendo"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### News（Hong Kong only）

- **路由**：`/nintendo/news` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/nintendo/direct
  - **源代码**：`/nintendo/news.ts`
  - **作者**：@HFO4

#### Nintendo Direct

- **路由**：`/nintendo/direct` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/nintendo/direct
  - **源代码**：`/nintendo/direct.ts`
  - **作者**：@HFO4

#### Switch System Update（Japan）

- **路由**：`/nintendo/system-update` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/nintendo/news
  - **源代码**：`/nintendo/system-update.ts`
  - **作者**：@HFO4

#### 首页资讯（中国）

- **路由**：`/nintendo/news/china` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/nintendo/system-update
  - **源代码**：`/nintendo/news-china.ts`
  - **作者**：@hoilc

</details>

### osu!
<a id="osu"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Beatmap Packs

- **路由**：`/osu/packs/:type?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/nintendo/news/china
  - **源代码**：`/osu/beatmaps/packs.ts`
  - **作者**：@NeverBehave

</details>

### PlayStation Store
<a id="playstation-store"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### PlayStation Monthly Games

- **路由**：`/ps/monthly-games` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/priconne-redive/news
  - **源代码**：`/ps/monthly-games.ts`
  - **作者**：@SayaSS

#### PlayStation Network user trophy

- **路由**：`/ps/trophy/:id` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/ps/monthly-games
  - **源代码**：`/ps/trophy.ts`
  - **作者**：@justjustCC

</details>

### PRINCESS CONNECT! Re Dive プリンセスコネクト！Re Dive
<a id="princess-connect-re-dive-プリンセスコネクトre-dive"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 日服公告

- **路由**：`/priconne-redive/news` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/osu/packs
  - **源代码**：`/priconne-redive/news.ts`
  - **作者**：@SayaSS

</details>

### SEGA
<a id="sega"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### maimai DX Japanese Ver. News

- **路由**：`/sega/maimaidx/news` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/ps/trophy/DIYgod_
  - **源代码**：`/sega/maimaidx.ts`
  - **作者**：@randompasser

#### 世界计划 多彩舞台 ｜ ProjectSekai ｜ プロセカ

- **路由**：`/sega/pjsekai/news` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/sega/maimaidx/news
  - **源代码**：`/sega/pjsekai.ts`
  - **作者**：@randompasser

</details>

### TapTap 中国
<a id="taptap-中国"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 游戏更新

- **路由**：`/taptap/changelog/:id/:lang?,/intl/changelog/:id/:lang?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/sega/pjsekai/news
  - **源代码**：`/taptap/changelog.ts`
  - **作者**：@hoilc, @ETiV
- **路由**：`/taptap/changelog/:id/:lang?,/intl/changelog/:id/:lang?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/taptap/changelog/60809/en_US
  - **源代码**：`/taptap/changelog.ts`
  - **作者**：@hoilc, @ETiV

#### 游戏论坛

- **路由**：`/taptap/topic/:id/:type?/:sort?/:lang?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/taptap/review/142793/hot
  - **源代码**：`/taptap/topic.ts`
  - **作者**：@hoilc, @TonyRL

#### 游戏评价

- **路由**：`/taptap/review/:id/:order?/:lang?,/intl/review/:id/:order?/:lang?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/taptap/changelog/60809/en_US
  - **源代码**：`/taptap/review.ts`
  - **作者**：@hoilc, @TonyRL
- **路由**：`/taptap/review/:id/:order?/:lang?,/intl/review/:id/:order?/:lang?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/taptap/review/142793/hot
  - **源代码**：`/taptap/review.ts`
  - **作者**：@hoilc, @TonyRL

</details>

### War Thunder
<a id="war-thunder"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### News

- **路由**：`/warthunder/news` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/warthunder/news
  - **源代码**：`/warthunder/news.ts`
  - **作者**：@axojhf

</details>

### ファミ通
<a id="ファミ通"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Category

- **路由**：`/famitsu/category/:category?`
  - **示例**：https://rsshub.app/famitsu/category/new-article
  - **源代码**：`/famitsu/category.ts`
  - **作者**：@TonyRL

</details>

### 二柄 APP
<a id="二柄-app"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 新闻

- **路由**：`/diershoubing/news` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/warthunder/news
  - **源代码**：`/diershoubing/news.ts`
  - **作者**：@axojhf

</details>

### 完美世界电竞
<a id="完美世界电竞"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 资讯列表

- **路由**：`/wmpvp/news/:type`
  - **示例**：https://rsshub.app/wmpvp/news/1
  - **源代码**：`/wmpvp/index.ts`
  - **作者**：@tssujt

</details>

### 少女前线
<a id="少女前线"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 情报局

- **路由**：`/gf-cn/news/:category?` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/arknights/japan
  - **源代码**：`/gf-cn/news.ts`
  - **作者**：@ofyark

</details>

### 旅法师营地
<a id="旅法师营地"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 首页

- **路由**：`/lfsyd/home` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/xboxfan/news
  - **源代码**：`/lfsyd/home.ts`
  - **作者**：@XXY233

#### 首页（旧版）

- **路由**：`/lfsyd/old_home` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/lfsyd/home
  - **源代码**：`/lfsyd/old-home.ts`
  - **作者**：@auto-bot-ty

</details>

### 明日方舟
<a id="明日方舟"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### アークナイツ (日服新闻)的直接链接")

- **路由**：`/arknights/japan` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/arknights/news
  - **源代码**：`/arknights/japan.ts`
  - **作者**：@Astrian

#### 游戏公告与新闻

- **路由**：`/arknights/news` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/arknights/news
  - **源代码**：`/arknights/news.ts`
  - **作者**：@Astrian

#### 游戏内公告

- **路由**：`/arknights/announce/:platform?/:group?`
  - **示例**：https://rsshub.app/arknights/announce
  - **源代码**：`/arknights/announce.ts`
  - **作者**：@swwind

</details>

### 游戏基因
<a id="游戏基因"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 资讯

- **路由**：`/gamegene/news` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/gamegene/news
  - **源代码**：`/gamegene/news.ts`
  - **作者**：@lone1y-51

</details>

### 游戏打折情报
<a id="游戏打折情报"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 游戏折扣

- **路由**：`/yxdzqb/:type` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/yxdzqb/popular_cn
  - **源代码**：`/yxdzqb/index.ts`
  - **作者**：@LogicJake, @nczitzk

</details>

### 游戏日报
<a id="游戏日报"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 分类

- **路由**：`/yxrb/:category?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/yxrb/info
  - **源代码**：`/yxrb/home.ts`
  - **作者**：@TonyRL

</details>

### 游研社
<a id="游研社"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 游研社 - 全部文章

- **路由**：`/yystv/docs` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/yystv/docs
  - **源代码**：`/yystv/docs.ts`
  - **作者**：@HaitianLiu

#### 游研社 - 分类文章

- **路由**：`/yystv/category/:category`
  - **示例**：https://rsshub.app/yystv/category/recommend
  - **源代码**：`/yystv/category.ts`
  - **作者**：@LightStrawberry

</details>

### 游讯网
<a id="游讯网"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 精彩推荐

- **路由**：`/yxdown/recommend` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/gamegene/news
  - **源代码**：`/yxdown/recommend.ts`
  - **作者**：@lone1y-51

#### 资讯

- **路由**：`/yxdown/news/:category?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/yxdown/recommend
  - **源代码**：`/yxdown/news.ts`
  - **作者**：@nczitzk

</details>

### 王者荣耀
<a id="王者荣耀"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 新闻中心

- **路由**：`/tencent/pvp/newsindex/:type`
  - **示例**：https://rsshub.app/tencent/pvp/newsindex/all
  - **源代码**：`/tencent/pvp/newsindex.ts`
  - **作者**：@Jeason0228, @HenryQW

</details>

### 盒心光环
<a id="盒心光环"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 资讯

- **路由**：`/xboxfan/news` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/diershoubing/news
  - **源代码**：`/xboxfan/news.ts`
  - **作者**：@wushijishan

</details>

### 米哈游
<a id="米哈游"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 原神

- **路由**：`/mihoyo/ys/:location?/:category?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/mihoyo/bbs/user-post/77005350
  - **源代码**：`/mihoyo/ys/news.ts`
  - **作者**：@CaoMeiYouRen

#### 崩坏：星穹铁道

- **路由**：`/mihoyo/sr/:location?/:category?` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/lfsyd/old_home
  - **源代码**：`/mihoyo/sr/news.ts`
  - **作者**：@auto-bot-ty

#### 米游社 - 同人榜

- **路由**：`/mihoyo/bbs/img-ranking/:game/:routeParams?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/mihoyo/bbs/follow-list/77005350
  - **源代码**：`/mihoyo/bbs/img-ranking.ts`
  - **作者**：@CaoMeiYouRen

#### 米游社 - 官方公告

- **路由**：`/mihoyo/bbs/official/:gids/:type?/:page_size?/:last_id?`
  - **示例**：https://rsshub.app/mihoyo/bbs/official/2/3/20/
  - **源代码**：`/mihoyo/bbs/official.ts`
  - **作者**：@CaoMeiYouRen

#### 米游社 - 用户关注

- **路由**：`/mihoyo/bbs/follow-list/:uid`
  - **示例**：https://rsshub.app/mihoyo/bbs/follow-list/77005350
  - **源代码**：`/mihoyo/bbs/follow-list.ts`
  - **作者**：@CaoMeiYouRen

#### 米游社 - 用户关注动态

- **路由**：`/mihoyo/bbs/timeline` `⚙️ 需要配置` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/mihoyo/bbs/timeline
  - **源代码**：`/mihoyo/bbs/timeline.ts`
  - **作者**：@CaoMeiYouRen

#### 米游社 - 用户帖子

- **路由**：`/mihoyo/bbs/user-post/:uid`
  - **示例**：https://rsshub.app/mihoyo/bbs/timeline
  - **源代码**：`/mihoyo/bbs/user-post.ts`
  - **作者**：@CaoMeiYouRen

</details>

### 网易公开课
<a id="网易公开课"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 用户发帖

- **路由**：`/163/ds/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/163/ds/63dfbaf4117741daaf73404601165843
  - **源代码**：`/163/ds.ts`
  - **作者**：@luyuhuang

</details>

### 英雄联盟
<a id="英雄联盟"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 台服新闻

- **路由**：`/loltw/news/:category?`
  - **示例**：https://rsshub.app/163/ds/63dfbaf4117741daaf73404601165843
  - **源代码**：`/loltw/news.ts`
  - **作者**：@luyuhuang

</details>

### 遊戲基地 Gamebase
<a id="遊戲基地-gamebase"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 新聞

- **路由**：`/gamebase/news/:type?/:category?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/yystv/docs
  - **源代码**：`/gamebase/news.ts`
  - **作者**：@HaitianLiu

</details>
