# 💬️ 论坛（bbs）

本分类共 **64** 条路由。

## 使用方式（给 AI）

1. 先在本页的「服务总览」定位目标站点/服务。
2. 打开对应服务的折叠块，选择与你要订阅的「Feed」最匹配的一条路由。
3. 将路由模板里的 `:参数` 替换为具体值；`?` 表示可选段。
4. 若标注了「反爬严格/需要登录/需要 Cookie」等标签，优先使用自建实例并配置相应环境变量或代理。

## 服务总览（渐进式入口）

| 服务 | 路由数 |
|---|---:|
| [19 楼](#19-楼) | 1 |
| [8264](#8264) | 1 |
| [Dcard](#dcard) | 1 |
| [Discourse](#discourse) | 2 |
| [Elastic 中文社区](#elastic-中文社区) | 1 |
| [LearnKu](#learnku) | 1 |
| [Meteor](#meteor) | 2 |
| [NGA](#nga) | 2 |
| [Pikabu](#pikabu) | 1 |
| [PKMer](#pkmer) | 1 |
| [PLAYNO.1 玩樂達人](#playno1-玩樂達人) | 2 |
| [Saraba1st](#saraba1st) | 2 |
| [The Ring of Wonder](#the-ring-of-wonder) | 1 |
| [V2EX](#v2ex) | 3 |
| [ZodGame](#zodgame) | 1 |
| [Zuvio](#zuvio) | 2 |
| [一亩三分地](#一亩三分地) | 6 |
| [丁香园](#丁香园) | 2 |
| [司机社](#司机社) | 2 |
| [品葱](#品葱) | 2 |
| [威锋](#威锋) | 1 |
| [小特社区](#小特社区) | 1 |
| [恩山无线论坛](#恩山无线论坛) | 1 |
| [斗鱼直播](#斗鱼直播) | 2 |
| [火线](#火线) | 1 |
| [牛客网](#牛客网) | 5 |
| [电鸭社区](#电鸭社区) | 2 |
| [百度](#百度) | 6 |
| [直播吧](#直播吧) | 3 |
| [第一会所](#第一会所) | 1 |
| [虎扑](#虎扑) | 3 |
| [通信人家园](#通信人家园) | 1 |
| [集思录](#集思录) | 1 |

## 服务详情（按需展开）

### 19 楼
<a id="19-楼"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 头条

- **路由**：`/19lou/:city?`
  - **示例**：https://rsshub.app/19lou/jiaxing
  - **源代码**：`/19lou/index.ts`
  - **作者**：@nczitzk

</details>

### 8264
<a id="8264"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 列表

- **路由**：`/8264/list/:id?`
  - **示例**：https://rsshub.app/8264/list/751
  - **源代码**：`/8264/list.ts`
  - **作者**：@nczitzk

</details>

### Dcard
<a id="dcard"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 板塊帖子

- **路由**：`/dcard/:section/:type?` `🚨 反爬严格`
  - **示例**：https://rsshub.app/dcard/funny/popular
  - **源代码**：`/dcard/section.ts`
  - **作者**：@HenryQW

</details>

### Discourse
<a id="discourse"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Latest posts

- **路由**：`/discourse/:configId/posts` `⚙️ 需要配置`
  - **示例**：https://rsshub.app/discourse/0/posts
  - **源代码**：`/discourse/posts.ts`
  - **作者**：@dzx-dzx

#### Notifications

- **路由**：`/discourse/:configId/notifications/:fulltext?` `⚙️ 需要配置`
  - **示例**：https://rsshub.app/discourse/0/notifications
  - **源代码**：`/discourse/notifications.ts`

</details>

### Elastic 中文社区
<a id="elastic-中文社区"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 发现

- **路由**：`/elasticsearch-cn/:params?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/elasticsearch-cn
  - **源代码**：`/elasticsearch-cn/index.ts`
  - **作者**：@nczitzk

</details>

### LearnKu
<a id="learnku"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 社区

- **路由**：`/learnku/:community/:category?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/learnku/laravel/qa
  - **源代码**：`/learnku/topic.ts`
  - **作者**：@kayw-geek

</details>

### Meteor
<a id="meteor"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 看板

- **路由**：`/meteor/:board?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/meteor/boards
  - **源代码**：`/meteor/index.ts`
  - **作者**：@TonyRL

#### 看板列表

- **路由**：`/meteor/boards` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/meteor/boards
  - **源代码**：`/meteor/boards.ts`
  - **作者**：@TonyRL

</details>

### NGA
<a id="nga"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 分区帖子

- **路由**：`/nga/forum/:fid/:recommend?`
  - **示例**：https://rsshub.app/meteor/all
  - **源代码**：`/nga/forum.ts`
  - **作者**：@TonyRL

#### 帖子

- **路由**：`/nga/post/:tid/:authorId?`
  - **示例**：https://rsshub.app/nga/forum/489
  - **源代码**：`/nga/post.ts`
  - **作者**：@xyqfer

</details>

### Pikabu
<a id="pikabu"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### User

- **路由**：`/pikabu/user/:name` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/pikabu/user/@bula.dragon
  - **源代码**：`/pikabu/user.ts`
  - **作者**：@TonyRL

</details>

### PKMer
<a id="pkmer"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 最近更新

- **路由**：`/pkmer/recent` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/pikabu/user/@bula.dragon
  - **源代码**：`/pkmer/recent.ts`
  - **作者**：@Gnoyong

</details>

### PLAYNO.1 玩樂達人
<a id="playno1-玩樂達人"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### AV

- **路由**：`/playno1/av/:catid?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/pkmer/recent
  - **源代码**：`/playno1/av.ts`
  - **作者**：@Gnoyong

#### 情趣

- **路由**：`/playno1/st/:catid?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/playno1/st
  - **源代码**：`/playno1/st.ts`
  - **作者**：@TonyRL

</details>

### Saraba1st
<a id="saraba1st"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 帖子

- **路由**：`/saraba1st/thread/:tid`
  - **示例**：https://rsshub.app/saraba1st/digest/forum-75-1
  - **源代码**：`/saraba1st/thread.ts`
  - **作者**：@shinemoon

#### 论坛摘要

- **路由**：`/saraba1st/digest/:tid`
  - **示例**：https://rsshub.app/saraba1st/digest/forum-75-1
  - **源代码**：`/saraba1st/digest.ts`
  - **作者**：@shinemoon

</details>

### The Ring of Wonder
<a id="the-ring-of-wonder"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 首页更新

- **路由**：`/trow/portal` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/trow/portal
  - **源代码**：`/trow/portal.ts`
  - **作者**：@shiningdracon

</details>

### V2EX
<a id="v2ex"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 帖子

- **路由**：`/v2ex/post/:postid` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/v2ex/tab/hot
  - **源代码**：`/v2ex/post.ts`
  - **作者**：@liyefox

#### 最热 / 最新主题

- **路由**：`/v2ex/topics/:type` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/v2ex/post/584403
  - **源代码**：`/v2ex/topics.ts`
  - **作者**：@kt286

#### 标签

- **路由**：`/v2ex/tab/:tabid` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/trow/portal
  - **源代码**：`/v2ex/tab.ts`
  - **作者**：@shiningdracon

</details>

### ZodGame
<a id="zodgame"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### forum

- **路由**：`/zodgame/forum/:fid?` `⚙️ 需要配置`
  - **示例**：https://rsshub.app/v2ex/topics/latest
  - **源代码**：`/zodgame/forum.ts`
  - **作者**：@FeCCC

</details>

### Zuvio
<a id="zuvio"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 校園話題

- **路由**：`/zuvio/student5/:board?`
  - **示例**：https://rsshub.app/zuvio/student5/boards
  - **源代码**：`/zuvio/student5.ts`
  - **作者**：@TonyRL

#### 看板列表

- **路由**：`/zuvio/student5/boards`
  - **示例**：https://rsshub.app/zuvio/student5/boards
  - **源代码**：`/zuvio/boards.ts`
  - **作者**：@TonyRL

</details>

### 一亩三分地
<a id="一亩三分地"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 分区

- **路由**：`/1point3acres/section/:id?/:type?/:order?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/1point3acres/section/345
  - **源代码**：`/1point3acres/section.ts`
  - **作者**：@nczitzk

#### 博客

- **路由**：`/1point3acres/blog/:category?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/1point3acres/blog
  - **源代码**：`/1point3acres/blog.ts`
  - **作者**：@nczitzk

#### 录取结果

- **路由**：`/1point3acres/offer/:year?/:major?/:school?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/1point3acres/offer/12/null/CMU
  - **源代码**：`/1point3acres/offer.ts`
  - **作者**：@EthanWng97

#### 标签

- **路由**：`/1point3acres/category/:id?/:type?/:order?` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/xiaote/news
  - **源代码**：`/1point3acres/category.ts`
  - **作者**：@wxsimon

#### 用户主题帖

- **路由**：`/1point3acres/user/:id/threads` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/1point3acres/user/1/posts
  - **源代码**：`/1point3acres/user/thread.ts`
  - **作者**：@Maecenas

#### 用户回帖

- **路由**：`/1point3acres/user/:id/posts` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/1point3acres/user/1/posts
  - **源代码**：`/1point3acres/user/post.ts`
  - **作者**：@Maecenas

</details>

### 丁香园
<a id="丁香园"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 专题

- **路由**：`/dxy/bbs/special/:specialId` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/dxy/bbs/profile/thread/8335054
  - **源代码**：`/dxy/special.ts`
  - **作者**：@TonyRL

#### 个人帖子

- **路由**：`/dxy/bbs/profile/thread/:userId` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/eleduck/jobs
  - **源代码**：`/dxy/profile/thread.ts`
  - **作者**：@sfyumi

</details>

### 司机社
<a id="司机社"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 排行榜

- **路由**：`/xsijishe/rank/:type`
  - **示例**：https://rsshub.app/xsijishe/forum/51
  - **源代码**：`/xsijishe/rank.ts`
  - **作者**：@akynazh

#### 论坛

- **路由**：`/xsijishe/forum/:fid`
  - **示例**：https://rsshub.app/pincong/hot
  - **源代码**：`/xsijishe/forum.ts`
  - **作者**：@zphw

</details>

### 品葱
<a id="品葱"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 发现

- **路由**：`/pincong/category/:category?/:sort?` `🚨 反爬严格`
  - **示例**：https://rsshub.app/pincong/category/1/new
  - **源代码**：`/pincong/index.ts`
  - **作者**：@zphw

#### 精选

- **路由**：`/pincong/hot/:category?` `🚨 反爬严格`
  - **示例**：https://rsshub.app/pincong/hot
  - **源代码**：`/pincong/hot.ts`
  - **作者**：@zphw

</details>

### 威锋
<a id="威锋"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 社区

- **路由**：`/feng/forum/:id/:type?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/feng/forum/1
  - **源代码**：`/feng/forum.ts`
  - **作者**：@TonyRL

</details>

### 小特社区
<a id="小特社区"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 首页帖子

- **路由**：`/xiaote/news` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/xiaote/news
  - **源代码**：`/xiaote/index.ts`
  - **作者**：@wxsimon

</details>

### 恩山无线论坛
<a id="恩山无线论坛"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 板块

- **路由**：`/right/forum/:id?`
  - **示例**：https://rsshub.app/douyu/post/631737151576473201
  - **源代码**：`/right/forum.ts`
  - **作者**：@nczitzk

</details>

### 斗鱼直播
<a id="斗鱼直播"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 鱼吧帖子

- **路由**：`/douyu/group/:id/:sort?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/dxy/bbs/special/72
  - **源代码**：`/douyu/group.ts`
  - **作者**：@nczitzk

#### 鱼吧跟帖

- **路由**：`/douyu/post/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/douyu/post/631737151576473201
  - **源代码**：`/douyu/post.ts`
  - **作者**：@nczitzk

</details>

### 火线
<a id="火线"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Zone

- **路由**：`/huoxian/zone`
  - **示例**：https://rsshub.app/hupu/bbs/topic-daily
  - **源代码**：`/huoxian/zone.ts`
  - **作者**：@LogicJake, @nczitzk

</details>

### 牛客网
<a id="牛客网"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 实习广场 & 社招广场

- **路由**：`/nowcoder/jobcenter/:recruitType?/:city?/:type?/:order?/:latest?` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/nowcoder/recommend
  - **源代码**：`/nowcoder/jobcenter.ts`
  - **作者**：@junfengP

#### 校招日程

- **路由**：`/nowcoder/schedule/:propertyId?/:typeId?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/nowcoder/schedule
  - **源代码**：`/nowcoder/schedule.ts`
  - **作者**：@junfengP

#### 求职推荐

- **路由**：`/nowcoder/recommend` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/nowcoder/recommend
  - **源代码**：`/nowcoder/recommend.ts`
  - **作者**：@junfengP

#### 讨论区

- **路由**：`/nowcoder/discuss/:type/:order`
  - **示例**：https://rsshub.app/nowcoder/discuss/2/4
  - **源代码**：`/nowcoder/discuss.ts`
  - **作者**：@LogicJake

#### 面经

- **路由**：`/nowcoder/experience/:tagId` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/nowcoder/experience/639?order=3&companyId=665&phaseId=0
  - **源代码**：`/nowcoder/experience.ts`
  - **作者**：@huyyi

</details>

### 电鸭社区
<a id="电鸭社区"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 分类文章

- **路由**：`/eleduck/posts/:id?`
  - **示例**：https://rsshub.app/sis001/forum/322
  - **源代码**：`/eleduck/posts.ts`

#### 工作机会

- **路由**：`/eleduck/jobs` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/eleduck/jobs
  - **源代码**：`/eleduck/jobs.ts`
  - **作者**：@sfyumi

</details>

### 百度
<a id="百度"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 帖子动态

- **路由**：`/baidu/tieba/post/:id,/tieba/post/lz/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/baidu/tieba/forum/good/女图
  - **源代码**：`/baidu/tieba/post.ts`
  - **作者**：@u3u
- **路由**：`/baidu/tieba/post/:id,/tieba/post/lz/:id` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/baidu/tieba/post/686961453
  - **源代码**：`/baidu/tieba/post.ts`
  - **作者**：@u3u

#### 用户帖子

- **路由**：`/baidu/tieba/user/:uid`
  - **示例**：https://rsshub.app/baidu/tieba/user/斗鱼游戏君
  - **源代码**：`/baidu/tieba/user.ts`
  - **作者**：@igxlin, @nczitzk

#### 精品帖子

- **路由**：`/baidu/tieba/forum/good/:kw/:cid?/:sortBy?,/tieba/forum/:kw/:sortBy?`
  - **示例**：https://rsshub.app/zuvio/student5/34
  - **源代码**：`/baidu/tieba/forum.ts`
  - **作者**：@TonyRL
- **路由**：`/baidu/tieba/forum/good/:kw/:cid?/:sortBy?,/tieba/forum/:kw/:sortBy?`
  - **示例**：https://rsshub.app/baidu/tieba/forum/good/女图
  - **源代码**：`/baidu/tieba/forum.ts`
  - **作者**：@u3u

#### 贴吧搜索

- **路由**：`/baidu/tieba/search/:qw/:routeParams?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/baidu/tieba/post/686961453
  - **源代码**：`/baidu/tieba/search.ts`
  - **作者**：@u3u

</details>

### 直播吧
<a id="直播吧"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Unknown

- **路由**：`/zhibo8/more/:category?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/1point3acres/user/1/threads
  - **源代码**：`/zhibo8/more.ts`
  - **作者**：@nczitzk

#### 回帖

- **路由**：`/zhibo8/post/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/zhibo8/more/nba
  - **源代码**：`/zhibo8/post.ts`
  - **作者**：@nczitzk

#### 子论坛

- **路由**：`/zhibo8/forum/:id`
  - **示例**：https://rsshub.app/zhibo8/post/3050708
  - **源代码**：`/zhibo8/forum.ts`
  - **作者**：@LogicJake

</details>

### 第一会所
<a id="第一会所"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 子版块

- **路由**：`/sis001/forum/:id?`
  - **示例**：https://rsshub.app/baidu/tieba/user/斗鱼游戏君
  - **源代码**：`/sis001/forum.ts`

</details>

### 虎扑
<a id="虎扑"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 热帖

- **路由**：`/hupu/all/:id?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/right/forum/31
  - **源代码**：`/hupu/all.ts`
  - **作者**：@nczitzk

#### 社区

- **路由**：`/hupu/bbs/:id?/:order?,/bxj/:id?/:order?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/hupu/bbs/topic-daily
  - **源代码**：`/hupu/bbs.ts`
  - **作者**：@LogicJake, @nczitzk
- **路由**：`/hupu/bbs/:id?/:order?,/bxj/:id?/:order?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/hupu/bbs/topic-daily
  - **源代码**：`/hupu/bbs.ts`
  - **作者**：@LogicJake, @nczitzk

</details>

### 通信人家园
<a id="通信人家园"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 论坛 频道

- **路由**：`/txrjy/fornumtopic/:channel?`
  - **示例**：https://rsshub.app/xsijishe/rank/weekly
  - **源代码**：`/txrjy/fornumtopic.ts`
  - **作者**：@akynazh

</details>

### 集思录
<a id="集思录"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 广场

- **路由**：`/jisilu/:category?/:sort?/:day?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/huoxian/zone
  - **源代码**：`/jisilu/index.ts`
  - **作者**：@p7e4

</details>
