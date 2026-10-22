# 💬 社交媒体（social-media）

本分类共 **175** 条路由。

## 使用方式（给 AI）

1. 先在本页的「服务总览」定位目标站点/服务。
2. 打开对应服务的折叠块，选择与你要订阅的「Feed」最匹配的一条路由。
3. 将路由模板里的 `:参数` 替换为具体值；`?` 表示可选段。
4. 若标注了「反爬严格/需要登录/需要 Cookie」等标签，优先使用自建实例并配置相应环境变量或代理。

## 服务总览（渐进式入口）

| 服务 | 路由数 |
|---|---:|
| [Bilibili](#bilibili) | 33 |
| [Bluesky (bsky)的直接链接")](#bluesky-bsky的直接链接) | 2 |
| [Crossbell](#crossbell) | 4 |
| [Curius](#curius) | 1 |
| [Daily.dev](#dailydev) | 2 |
| [Discord](#discord) | 1 |
| [Fansly](#fansly) | 2 |
| [GETTR](#gettr) | 1 |
| [Instagram](#instagram) | 3 |
| [Keep](#keep) | 1 |
| [Lemmy](#lemmy) | 1 |
| [Lofter](#lofter) | 2 |
| [Mastodon](#mastodon) | 3 |
| [Misskey](#misskey) | 1 |
| [pixiv](#pixiv) | 6 |
| [Plurk](#plurk) | 7 |
| [Rattibha](#rattibha) | 1 |
| [Telegram](#telegram) | 3 |
| [Threads](#threads) | 1 |
| [TikTok](#tiktok) | 1 |
| [Twitter](#twitter) | 9 |
| [Vimeo](#vimeo) | 3 |
| [YouTube Live](#youtube-live) | 6 |
| [即刻](#即刻) | 3 |
| [唱吧](#唱吧) | 1 |
| [小红书](#小红书) | 1 |
| [微博绿洲](#微博绿洲) | 8 |
| [抖音直播](#抖音直播) | 2 |
| [新榜](#新榜) | 2 |
| [方格子](#方格子) | 2 |
| [知乎](#知乎) | 24 |
| [简书](#简书) | 3 |
| [腾讯新闻较真查证平台](#腾讯新闻较真查证平台) | 2 |
| [豆瓣](#豆瓣) | 26 |
| [酷安](#酷安) | 7 |

## 服务详情（按需展开）

### Bilibili
<a id="bilibili"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### B 站每周必看

- **路由**：`/bilibili/weekly/:disableEmbed?`
  - **示例**：https://rsshub.app/bilibili/weekly
  - **源代码**：`/bilibili/weekly-recommend.ts`
  - **作者**：@ttttmr

#### link 公告

- **路由**：`/bilibili/link/news/:product`
  - **示例**：https://rsshub.app/bilibili/weekly
  - **源代码**：`/bilibili/link-news.ts`
  - **作者**：@ttttmr

#### UP 主专栏

- **路由**：`/bilibili/user/article/:uid` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bilibili/link/news/live
  - **源代码**：`/bilibili/article.ts`
  - **作者**：@Qixingchen

#### UP 主关注用户

- **路由**：`/bilibili/user/followings/:uid/:loginUid` `⚙️ 需要配置` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bilibili/user/followings/2267573/3
  - **源代码**：`/bilibili/followings.ts`
  - **作者**：@Qixingchen

#### UP 主动态

- **路由**：`/bilibili/user/dynamic/:uid/:routeParams?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bilibili/user/coin/208259
  - **源代码**：`/bilibili/dynamic.ts`
  - **作者**：@DIYgod, @zytomorrow, @CaoMeiYouRen, @JimenezLi

#### UP 主投币视频

- **路由**：`/bilibili/user/coin/:uid/:disableEmbed?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bilibili/user/article/334958638
  - **源代码**：`/bilibili/coin.ts`
  - **作者**：@lengthmin, @Qixingchen

#### UP 主投稿

- **路由**：`/bilibili/user/video/:uid/:disableEmbed?` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bilibili/user/fav/2267573
  - **源代码**：`/bilibili/video.ts`
  - **作者**：@DIYgod

#### UP 主点赞视频

- **路由**：`/bilibili/user/like/:uid/:disableEmbed?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bilibili/user/like/208259
  - **源代码**：`/bilibili/like.ts`
  - **作者**：@ygguorun

#### UP 主粉丝

- **路由**：`/bilibili/user/followers/:uid/:loginUid` `⚙️ 需要配置` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bilibili/fav/756508/50948568
  - **源代码**：`/bilibili/followers.ts`
  - **作者**：@Qixingchen

#### UP 主非默认收藏夹

- **路由**：`/bilibili/fav/:uid/:fid/:disableEmbed?`
  - **示例**：https://rsshub.app/bilibili/fav/756508/50948568
  - **源代码**：`/bilibili/fav.ts`
  - **作者**：@Qixingchen

#### UP 主频道的合集

- **路由**：`/bilibili/user/collection/:uid/:sid/:disableEmbed?/:sortReverse?/:page?`
  - **示例**：https://rsshub.app/bilibili/user/channel/2267573/396050
  - **源代码**：`/bilibili/user-collection.ts`
  - **作者**：@weirongxu

#### UP 主频道的视频列表

- **路由**：`/bilibili/user/channel/:uid/:sid/:disableEmbed?`
  - **示例**：https://rsshub.app/bilibili/user/like/208259
  - **源代码**：`/bilibili/user-channel.ts`
  - **作者**：@ygguorun

#### UP 主默认收藏夹

- **路由**：`/bilibili/user/fav/:uid/:disableEmbed?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bilibili/user/fav/2267573
  - **源代码**：`/bilibili/user-fav.ts`
  - **作者**：@DIYgod

#### 专栏文集

- **路由**：`/bilibili/readlist/:listid`
  - **示例**：https://rsshub.app/bilibili/readlist/25611
  - **源代码**：`/bilibili/readlist.ts`
  - **作者**：@hoilc

#### 会员购作品

- **路由**：`/bilibili/mall/ip/:id`
  - **示例**：https://rsshub.app/bilibili/audio/10624
  - **源代码**：`/bilibili/mall-ip.ts`
  - **作者**：@LogicJake

#### 会员购新品上架

- **路由**：`/bilibili/mall/new/:category?`
  - **示例**：https://rsshub.app/bilibili/mall/ip/0_3000294
  - **源代码**：`/bilibili/mall-new.ts`
  - **作者**：@DIYgod

#### 会员购票务

- **路由**：`/bilibili/platform/:area?/:p_type?/:uid?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bilibili/platform/-1
  - **源代码**：`/bilibili/platform.ts`
  - **作者**：@nightmare-mio

#### 分区视频

- **路由**：`/bilibili/partion/:tid/:disableEmbed?`
  - **示例**：https://rsshub.app/bilibili/partion/ranking/171/3
  - **源代码**：`/bilibili/partion.ts`
  - **作者**：@lengthmin

#### 分区视频排行榜

- **路由**：`/bilibili/partion/ranking/:tid/:days?/:disableEmbed?`
  - **示例**：https://rsshub.app/bilibili/partion/ranking/171/3
  - **源代码**：`/bilibili/partion-ranking.ts`
  - **作者**：@lengthmin

#### 歌单

- **路由**：`/bilibili/audio/:id`
  - **示例**：https://rsshub.app/bilibili/audio/10624
  - **源代码**：`/bilibili/audio.ts`
  - **作者**：@LogicJake

#### 漫画更新

- **路由**：`/bilibili/manga/update/:comicid` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bilibili/manga/update/26009
  - **源代码**：`/bilibili/manga-update.ts`
  - **作者**：@hoilc

#### 热搜

- **路由**：`/bilibili/hot-search` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bilibili/manga/update/26009
  - **源代码**：`/bilibili/hot-search.ts`
  - **作者**：@hoilc

#### 用户关注专栏

- **路由**：`/bilibili/followings/article/:uid` `⚙️ 需要配置`
  - **示例**：https://rsshub.app/bilibili/followings/article/99800931
  - **源代码**：`/bilibili/followings-article.ts`
  - **作者**：@woshiluo

#### 用户关注动态

- **路由**：`/bilibili/followings/dynamic/:uid/:routeParams?` `⚙️ 需要配置`
  - **示例**：https://rsshub.app/bilibili/followings/dynamic/109937383
  - **源代码**：`/bilibili/followings-dynamic.ts`
  - **作者**：@TigerCubDen, @JimenezLi

#### 用户关注视频动态

- **路由**：`/bilibili/followings/video/:uid/:disableEmbed?` `⚙️ 需要配置`
  - **示例**：https://rsshub.app/bilibili/followings/video/2267573
  - **源代码**：`/bilibili/followings-video.ts`
  - **作者**：@LogicJake

#### 用户稍后再看

- **路由**：`/bilibili/watchlater/:uid/:disableEmbed?` `⚙️ 需要配置`
  - **示例**：https://rsshub.app/bilibili/user/bangumi/208259
  - **源代码**：`/bilibili/watchlater.ts`
  - **作者**：@JimenezLi

#### 用户追漫更新

- **路由**：`/bilibili/manga/followings/:uid/:limits?` `⚙️ 需要配置`
  - **示例**：https://rsshub.app/bilibili/manga/followings/26009
  - **源代码**：`/bilibili/manga-followings.ts`
  - **作者**：@yindaheng98

#### 用户追番列表

- **路由**：`/bilibili/user/bangumi/:uid/:type?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bilibili/user/bangumi/208259
  - **源代码**：`/bilibili/user-bangumi.ts`
  - **作者**：@wdssmq

#### 综合热门

- **路由**：`/bilibili/popular/all`
  - **示例**：https://rsshub.app/bilibili/readlist/25611
  - **源代码**：`/bilibili/popular.ts`
  - **作者**：@hoilc

#### 视频弹幕

- **路由**：`/bilibili/video/danmaku/:bvid/:pid?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bilibili/hot-search
  - **源代码**：`/bilibili/danmaku.ts`
  - **作者**：@CaoMeiYouRen

#### 视频搜索

- **路由**：`/bilibili/vsearch/:kw/:order?/:disableEmbed?/:tid?`
  - **示例**：https://rsshub.app/bilibili/video/reply/BV1vA411b7ip
  - **源代码**：`/bilibili/vsearch.ts`
  - **作者**：@Qixingchen

#### 视频评论

- **路由**：`/bilibili/video/reply/:bvid`
  - **示例**：https://rsshub.app/bilibili/video/page/BV1i7411M7N9
  - **源代码**：`/bilibili/reply.ts`
  - **作者**：@sxzz

#### 视频选集列表

- **路由**：`/bilibili/video/page/:bvid/:disableEmbed?`
  - **示例**：https://rsshub.app/bilibili/video/danmaku/BV1vA411b7ip/1
  - **源代码**：`/bilibili/page.ts`
  - **作者**：@Qixingchen

</details>

### Bluesky (bsky)的直接链接")
<a id="bluesky-bsky的直接链接"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Keywords

- **路由**：`/bsky/keyword/:keyword`
  - **示例**：https://rsshub.app/bilibili/popular/all
  - **源代码**：`/bsky/keyword.ts`
  - **作者**：@ziminliu

#### Post

- **路由**：`/bsky/profile/:handle` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bsky/keyword/hello
  - **源代码**：`/bsky/posts.ts`
  - **作者**：@untitaker

</details>

### Crossbell
<a id="crossbell"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Feeds of following

- **路由**：`/crossbell/feeds/following/:characterId`
  - **示例**：https://rsshub.app/bsky/profile/bsky.app
  - **源代码**：`/crossbell/feeds/following.ts`
  - **作者**：@TonyRL

#### Notes

- **路由**：`/crossbell/notes` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/crossbell/notes/character/10
  - **源代码**：`/crossbell/notes/index.ts`
  - **作者**：@DIYgod

#### Notes of character

- **路由**：`/crossbell/notes/character/:characterId` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/crossbell/feeds/following/10
  - **源代码**：`/crossbell/notes/character.ts`
  - **作者**：@DIYgod

#### Notes of source

- **路由**：`/crossbell/notes/source/:source` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/crossbell/notes
  - **源代码**：`/crossbell/notes/source.ts`
  - **作者**：@DIYgod

</details>

### Curius
<a id="curius"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### User

- **路由**：`/curius/links/:name` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/crossbell/notes/source/xlog
  - **源代码**：`/curius/links.ts`
  - **作者**：@Ovler-Young

</details>

### Daily.dev
<a id="dailydev"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Most Discussed

- **路由**：`/daily/discussed` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/curius/links/yuu-yuu
  - **源代码**：`/daily/discussed.ts`
  - **作者**：@Rjnishant530

#### Most upvoted

- **路由**：`/daily/upvoted` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/daily/discussed
  - **源代码**：`/daily/upvoted.ts`
  - **作者**：@Rjnishant530

</details>

### Discord
<a id="discord"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Channel Messages

- **路由**：`/discord/channel/:channelId` `⚙️ 需要配置` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/daily/upvoted
  - **源代码**：`/discord/channel.ts`
  - **作者**：@Rjnishant530

</details>

### Fansly
<a id="fansly"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Hashtag

- **路由**：`/fansly/tag/:tag` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/fansly/tag/free
  - **源代码**：`/fansly/tag.ts`
  - **作者**：@TonyRL

#### User Timeline

- **路由**：`/fansly/user/:username` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/fansly/tag/free
  - **源代码**：`/fansly/post.ts`
  - **作者**：@TonyRL

</details>

### GETTR
<a id="gettr"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### User timeline

- **路由**：`/gettr/user/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/fansly/user/AeriGoMoo
  - **源代码**：`/gettr/user.ts`
  - **作者**：@TonyRL

</details>

### Instagram
<a id="instagram"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### User Profile - Picuki

- **路由**：`/picuki/profile/:id/:functionalFlag?` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/picuki/profile/stefaniejoosten
  - **源代码**：`/picuki/profile.ts`
  - **作者**：@hoilc, @Rongronggg9, @devinmugen

#### User Profile / Hashtag

- **路由**：`/instagram/2/:category/:key` `🚨 反爬严格`
  - **示例**：https://rsshub.app/instagram/2/user/stefaniejoosten
  - **源代码**：`/instagram/web-api/index.ts`
  - **作者**：@TonyRL

#### User Profile / Hashtag - Private API

- **路由**：`/instagram/:category/:key` `🚨 反爬严格` `⚙️ 需要配置`
  - **示例**：https://rsshub.app/instagram/user/stefaniejoosten
  - **源代码**：`/instagram/private-api/index.ts`
  - **作者**：@oppilate, @DIYgod

</details>

### Keep
<a id="keep"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 运动日记

- **路由**：`/keep/user/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/keep/user/556b02c1ab59390afea671ea
  - **源代码**：`/keep/user.ts`
  - **作者**：@Dectinc, @DIYgod

</details>

### Lemmy
<a id="lemmy"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Community

- **路由**：`/lemmy/:community/:sort?` `⚙️ 需要配置`
  - **示例**：https://rsshub.app/keep/user/556b02c1ab59390afea671ea
  - **源代码**：`/lemmy/index.ts`
  - **作者**：@wb14123

</details>

### Lofter
<a id="lofter"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Tag

- **路由**：`/lofter/tag/:name?/:type?`
  - **示例**：https://rsshub.app/lofter/tag/cosplay/date
  - **源代码**：`/lofter/tag.ts`
  - **作者**：@hoilc, @nczitzk

#### User

- **路由**：`/lofter/user/:name?`
  - **示例**：https://rsshub.app/lofter/user/i
  - **源代码**：`/lofter/user.ts`
  - **作者**：@hondajojo, @nczitzk

</details>

### Mastodon
<a id="mastodon"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Instance timeline (federated)的直接链接")

- **路由**：`/mastodon/remote/:site/:only_media?`
  - **示例**：https://rsshub.app/mastodon/timeline/pawoo.net/true
  - **源代码**：`/mastodon/timeline-remote.ts`
  - **作者**：@hoilc

#### Instance timeline (local)的直接链接")

- **路由**：`/mastodon/timeline/:site/:only_media?`
  - **示例**：https://rsshub.app/mastodon/timeline/pawoo.net/true
  - **源代码**：`/mastodon/timeline-local.ts`
  - **作者**：@hoilc

#### User timeline

- **路由**：`/mastodon/acct/:acct/statuses/:only_media?`
  - **示例**：https://rsshub.app/mastodon/remote/pawoo.net/true
  - **源代码**：`/mastodon/acct.ts`
  - **作者**：@notofoe

</details>

### Misskey
<a id="misskey"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Featured Notes

- **路由**：`/misskey/notes/featured/:site`
  - **示例**：https://rsshub.app/misskey/notes/featured/misskey.io
  - **源代码**：`/misskey/featured-notes.ts`
  - **作者**：@Misaka13514

</details>

### pixiv
<a id="pixiv"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Following timeline

- **路由**：`/pixiv/user/illustfollows` `⚙️ 需要配置` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/misskey/notes/featured/misskey.io
  - **源代码**：`/pixiv/illustfollow.ts`
  - **作者**：@ClarkeCheng

#### Keyword

- **路由**：`/pixiv/search/:keyword/:order?/:mode?`
  - **示例**：https://rsshub.app/pixiv/user/illustfollows
  - **源代码**：`/pixiv/search.ts`
  - **作者**：@DIYgod

#### Rankings

- **路由**：`/pixiv/ranking/:mode/:date?`
  - **示例**：https://rsshub.app/pixiv/ranking/week
  - **源代码**：`/pixiv/ranking.ts`
  - **作者**：@EYHN

#### User Activity

- **路由**：`/pixiv/user/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/pixiv/user/novels/27104704
  - **源代码**：`/pixiv/user.ts`
  - **作者**：@TonyRL

#### User Bookmark

- **路由**：`/pixiv/user/bookmarks/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/pixiv/user/bookmarks/15288095
  - **源代码**：`/pixiv/bookmarks.ts`
  - **作者**：@EYHN

#### User Novels

- **路由**：`/pixiv/user/novels/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/pixiv/user/bookmarks/15288095
  - **源代码**：`/pixiv/novels.ts`
  - **作者**：@EYHN

</details>

### Plurk
<a id="plurk"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Anonymous

- **路由**：`/plurk/anonymous` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/pixiv/user/15288095
  - **源代码**：`/plurk/anonymous.ts`
  - **作者**：@TonyRL

#### Hotlinks

- **路由**：`/plurk/hotlinks` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/plurk/anonymous
  - **源代码**：`/plurk/hotlinks.ts`
  - **作者**：@TonyRL

#### Plurk News

- **路由**：`/plurk/news/:lang?` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/plurk/hotlinks
  - **源代码**：`/plurk/news.ts`
  - **作者**：@TonyRL

#### Search

- **路由**：`/plurk/search/:keyword` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/plurk/news/:lang?
  - **源代码**：`/plurk/search.ts`
  - **作者**：@TonyRL

#### Top

- **路由**：`/plurk/top/:category?/:lang?`
  - **示例**：https://rsshub.app/plurk/search/FGO
  - **源代码**：`/plurk/top.ts`
  - **作者**：@TonyRL

#### Topic

- **路由**：`/plurk/topic/:topic` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/plurk/topic/standwithukraine
  - **源代码**：`/plurk/topic.ts`
  - **作者**：@TonyRL

#### User

- **路由**：`/plurk/user/:user` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/plurk/topic/standwithukraine
  - **源代码**：`/plurk/user.ts`
  - **作者**：@TonyRL

</details>

### Rattibha
<a id="rattibha"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### User Threads

- **路由**：`/rattibha/user/:user` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/plurk/user/plurkoffice
  - **源代码**：`/rattibha/user.ts`
  - **作者**：@yshalsager

</details>

### Telegram
<a id="telegram"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Channel

- **路由**：`/telegram/channel/:username/:routeParams?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/rattibha/user/elonmusk
  - **源代码**：`/telegram/channel.ts`
  - **作者**：@DIYgod, @Rongronggg9

#### Sticker Pack

- **路由**：`/telegram/stickerpack/:name`
  - **示例**：https://rsshub.app/telegram/stickerpack/DIYgod
  - **源代码**：`/telegram/stickerpack.ts`
  - **作者**：@DIYgod

#### Telegram Blog

- **路由**：`/telegram/blog` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/telegram/stickerpack/DIYgod
  - **源代码**：`/telegram/blog.ts`
  - **作者**：@DIYgod

</details>

### Threads
<a id="threads"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### User timeline

- **路由**：`/threads/:user/:routeParams?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/telegram/blog
  - **源代码**：`/threads/index.ts`
  - **作者**：@fengkx

</details>

### TikTok
<a id="tiktok"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### User

- **路由**：`/tiktok/user/:user/:iframe?`
  - **示例**：https://rsshub.app/tiktok/user/@linustech/true
  - **源代码**：`/tiktok/user.ts`
  - **作者**：@TonyRL

</details>

### Twitter
<a id="twitter"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Collection

- **路由**：`/twitter/collection/:uid/:collectionId/:routeParams?` `⚙️ 需要配置`
  - **示例**：https://rsshub.app/twitter/collection/DIYgod/1527857429467172864
  - **源代码**：`/twitter/collection.ts`
  - **作者**：@TonyRL

#### Keyword

- **路由**：`/twitter/keyword/:keyword/:routeParams?` `⚙️ 需要配置` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/twitter/keyword/RSSHub
  - **源代码**：`/twitter/keyword.ts`
  - **作者**：@DIYgod, @yindaheng98, @Rongronggg9

#### List timeline

- **路由**：`/twitter/list/:id/:name/:routeParams?`
  - **示例**：https://rsshub.app/twitter/list/ladyleet/javascript
  - **源代码**：`/twitter/list.ts`
  - **作者**：@xyqfer

#### Trends

- **路由**：`/twitter/trends/:woeid?`
  - **示例**：https://rsshub.app/twitter/list/ladyleet/javascript
  - **源代码**：`/twitter/trends.ts`
  - **作者**：@xyqfer

#### Tweet Details

- **路由**：`/twitter/tweet/:id/status/:status/:original?` `⚙️ 需要配置`
  - **示例**：https://rsshub.app/twitter/trends/23424856
  - **源代码**：`/twitter/tweet.ts`
  - **作者**：@sakamossan

#### User following timeline

- **路由**：`/twitter/followings/:id/:routeParams?` `⚙️ 需要配置`
  - **示例**：https://rsshub.app/twitter/followings/DIYgod
  - **源代码**：`/twitter/followings.ts`
  - **作者**：@DIYgod

#### User likes

- **路由**：`/twitter/likes/:id/:routeParams?`
  - **示例**：https://rsshub.app/twitter/likes/DIYgod
  - **源代码**：`/twitter/likes.ts`
  - **作者**：@xyqfer

#### User media

- **路由**：`/twitter/media/:id/:routeParams?` `⚙️ 需要配置` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/twitter/likes/DIYgod
  - **源代码**：`/twitter/media.ts`
  - **作者**：@yindaheng98, @Rongronggg9

#### User timeline

- **路由**：`/twitter/user/:id/:routeParams?` `⚙️ 需要配置` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/twitter/user/DIYgod
  - **源代码**：`/twitter/user.ts`
  - **作者**：@DIYgod, @yindaheng98, @Rongronggg9

</details>

### Vimeo
<a id="vimeo"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Category

- **路由**：`/vimeo/category/:category/:staffpicks?`
  - **示例**：https://rsshub.app/vimeo/category/documentary/staffpicks
  - **源代码**：`/vimeo/category.ts`
  - **作者**：@MisteryMonster

#### Channel

- **路由**：`/vimeo/channel/:channel` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/vimeo/category/documentary/staffpicks
  - **源代码**：`/vimeo/channel.ts`
  - **作者**：@MisteryMonster

#### User Profile

- **路由**：`/vimeo/user/:username/:cat?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/vimeo/channel/bestoftheyear
  - **源代码**：`/vimeo/usr-videos.ts`
  - **作者**：@MisteryMonster

</details>

### YouTube Live
<a id="youtube-live"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Channel

- **路由**：`/youtube/channel/:id/:embed?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/youtube/channel/UCDwDMPOZfxVV0x_dz0eQ8KQ
  - **源代码**：`/youtube/channel.ts`
  - **作者**：@DIYgod

#### Community

- **路由**：`/youtube/community/:handle`
  - **示例**：https://rsshub.app/youtube/community/@JFlaMusic
  - **源代码**：`/youtube/community.ts`
  - **作者**：@TonyRL

#### Music Charts

- **路由**：`/youtube/charts/:category?/:country?/:embed?`
  - **示例**：https://rsshub.app/youtube/community/@JFlaMusic
  - **源代码**：`/youtube/charts.ts`
  - **作者**：@TonyRL

#### Playlist

- **路由**：`/youtube/playlist/:id/:embed?`
  - **示例**：https://rsshub.app/youtube/playlist/PLqQ1RwlxOgeLTJ1f3fNMSwhjVgaWKo_9Z
  - **源代码**：`/youtube/playlist.ts`
  - **作者**：@HenryQW

#### Subscriptions

- **路由**：`/youtube/subscriptions/:embed?` `⚙️ 需要配置` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/youtube/playlist/PLqQ1RwlxOgeLTJ1f3fNMSwhjVgaWKo_9Z
  - **源代码**：`/youtube/subscriptions.ts`
  - **作者**：@TonyRL

#### User

- **路由**：`/youtube/user/:username/:embed?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/youtube/user/JFlaMusic
  - **源代码**：`/youtube/user.ts`
  - **作者**：@DIYgod

</details>

### 即刻
<a id="即刻"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 圈子

- **路由**：`/jike/topic/:id/:showUid?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/jike/topic/text/553870e8e4b0cafb0a1bef68
  - **源代码**：`/jike/topic.ts`
  - **作者**：@HenryQW

#### 圈子 - 纯文字

- **路由**：`/jike/topic/text/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/vocus/user/tsetyan
  - **源代码**：`/jike/topic-text.ts`
  - **作者**：@HenryQW

#### 用户动态

- **路由**：`/jike/user/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/jike/topic/556688fae4b00c57d9dd46ee
  - **源代码**：`/jike/user.ts`
  - **作者**：@DIYgod, @prnake

</details>

### 唱吧
<a id="唱吧"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 用户

- **路由**：`/changba/:userid`
  - **示例**：https://rsshub.app/changba/skp6hhF59n48R-UpqO3izw
  - **源代码**：`/changba/user.ts`

</details>

### 小红书
<a id="小红书"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 专辑

- **路由**：`/xiaohongshu/board/:board_id`
  - **示例**：https://rsshub.app/xiaohongshu/board/5db6f79200000000020032df
  - **源代码**：`/xiaohongshu/board.ts`
  - **作者**：@lotosbin

</details>

### 微博绿洲
<a id="微博绿洲"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 个人时间线

- **路由**：`/weibo/timeline/:uid/:feature?/:routeParams?` `⚙️ 需要配置`
  - **示例**：https://rsshub.app/weibo/timeline/3306934123
  - **源代码**：`/weibo/timeline.ts`
  - **作者**：@zytomorrow, @DIYgod, @Rongronggg9

#### 关键词

- **路由**：`/weibo/keyword/:keyword/:routeParams?`
  - **示例**：https://rsshub.app/weibo/keyword/DIYgod
  - **源代码**：`/weibo/keyword.ts`
  - **作者**：@DIYgod, @Rongronggg9

#### 博主

- **路由**：`/weibo/user/:uid/:routeParams?` `🚨 反爬严格` `🔍 支持 Radar` `https://rsshub.app/weibo/user/1642909335/readable=1&authorNameBold=1&showAuthorInTitle=1&showAuthorInDesc=1&showAuthorAvatarInDesc=1&showEmojiForRetweet=1&showRetweetTextInTitle=0&addLinkForPics=1&showTimestampInDescription=1&showTimestampInDescription=1&heightOfPics=150`
  - **示例**：https://rsshub.app/weibo/user/1195230310
  - **源代码**：`/weibo/user.ts`
  - **作者**：@DIYgod, @iplusx, @Rongronggg9

#### 最新关注时间线

- **路由**：`/weibo/friends/:routeParams?` `⚙️ 需要配置` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/weibo/friends
  - **源代码**：`/weibo/friends.ts`
  - **作者**：@CaoMeiYouRen

#### 热搜榜

- **路由**：`/weibo/search/hot/:fulltext?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/weibo/keyword/DIYgod
  - **源代码**：`/weibo/search/hot.ts`
  - **作者**：@xyqfer, @shinemoon

#### 用户

- **路由**：`/weibo/oasis/user/:userid` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/weibo/oasis/user/1990895721
  - **源代码**：`/weibo/oasis/user.ts`
  - **作者**：@kt286

#### 自定义分组

- **路由**：`/weibo/group/:gid/:gname?/:routeParams?` `⚙️ 需要配置`
  - **示例**：https://rsshub.app/weibo/oasis/user/1990895721
  - **源代码**：`/weibo/group.ts`
  - **作者**：@kt286

#### 超话

- **路由**：`/weibo/super_index/:id/:type?/:routeParams?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/weibo/super_index/1008084989d223732bf6f02f75ea30efad58a9/sort_time
  - **源代码**：`/weibo/super-index.ts`
  - **作者**：@zengxs, @Rongronggg9

</details>

### 抖音直播
<a id="抖音直播"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 博主

- **路由**：`/douyin/user/:uid/:routeParams?` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/douyin/hashtag/1592824105719812
  - **源代码**：`/douyin/user.ts`
  - **作者**：@Max-Tortoise, @Rongronggg9

#### 标签

- **路由**：`/douyin/hashtag/:cid/:routeParams?` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/douyin/hashtag/1592824105719812
  - **源代码**：`/douyin/hashtag.ts`
  - **作者**：@TonyRL

</details>

### 新榜
<a id="新榜"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 微信公众号

- **路由**：`/newrank/wechat/:wxid` `🚨 反爬严格` `⚙️ 需要配置`
  - **示例**：https://rsshub.app/newrank/wechat/chijiread
  - **源代码**：`/newrank/wechat.ts`
  - **作者**：@lessmoe

#### 抖音短视频

- **路由**：`/newrank/douyin/:dyid` `🚨 反爬严格` `⚙️ 需要配置`
  - **示例**：https://rsshub.app/newrank/douyin/110266463747
  - **源代码**：`/newrank/douyin.ts`
  - **作者**：@lessmoe

</details>

### 方格子
<a id="方格子"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 出版專題

- **路由**：`/vocus/publication/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/douban/replied/xiaoyaxiaoya
  - **源代码**：`/vocus/publication.ts`
  - **作者**：@Maecenas

#### 用户个人文章

- **路由**：`/vocus/user/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/vocus/publication/bass
  - **源代码**：`/vocus/user.ts`
  - **作者**：@Maecenas

</details>

### 知乎
<a id="知乎"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Unknown

- **路由**：`/zhihu/xhu/topic/:topicId` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/zhihu/xhu/topic/19566035
  - **源代码**：`/zhihu/xhu/topic.ts`
  - **作者**：@JimenezLi

#### xhu - 收藏夹

- **路由**：`/zhihu/xhu/collection/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/zhihu/xhu/people/answers/246e6cf44e94cefbf4b959cb5042bc91
  - **源代码**：`/zhihu/xhu/collection.ts`
  - **作者**：@JimenezLi

#### xhu - 用户动态

- **路由**：`/zhihu/xhu/people/activities/:hexId` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/zhihu/xhu/topic/19566035
  - **源代码**：`/zhihu/xhu/activities.ts`
  - **作者**：@JimenezLi

#### xhu - 用户回答

- **路由**：`/zhihu/xhu/people/answers/:hexId` `🔍 支持 Radar` `xhu`
  - **示例**：https://rsshub.app/zhihu/xhu/people/answers/246e6cf44e94cefbf4b959cb5042bc91
  - **源代码**：`/zhihu/xhu/answers.ts`
  - **作者**：@JimenezLi

#### xhu - 用户文章

- **路由**：`/zhihu/xhu/people/posts/:hexId` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/zhihu/xhu/collection/26444956
  - **源代码**：`/zhihu/xhu/posts.ts`
  - **作者**：@JimenezLi

#### xhu - 问题

- **路由**：`/zhihu/xhu/question/:questionId/:sortBy?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/zhihu/xhu/people/posts/246e6cf44e94cefbf4b959cb5042bc91
  - **源代码**：`/zhihu/xhu/question.ts`
  - **作者**：@JimenezLi

#### xhu- 专栏

- **路由**：`/zhihu/xhu/zhuanlan/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/zhihu/xhu/question/264051433
  - **源代码**：`/zhihu/xhu/zhuanlan.ts`
  - **作者**：@JimenezLi

#### 专栏

- **路由**：`/zhihu/zhuanlan/:id` `🚨 反爬严格` `🔍 支持 Radar` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/zhihu/pin/hotlist
  - **源代码**：`/zhihu/zhuanlan.ts`
  - **作者**：@xyqfer

#### 收藏夹

- **路由**：`/zhihu/collection/:id/:getAll?` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/zhihu/topic/19828946
  - **源代码**：`/zhihu/collection.ts`
  - **作者**：@huruji, @Colin-XKL, @Fatpandac

#### 用户关注时间线

- **路由**：`/zhihu/timeline` `🚨 反爬严格` `⚙️ 需要配置`
  - **示例**：https://rsshub.app/zhihu/timeline
  - **源代码**：`/zhihu/timeline.ts`
  - **作者**：@SeanChao

#### 用户动态

- **路由**：`/zhihu/people/activities/:id` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/zhihu/question/59895982
  - **源代码**：`/zhihu/activities.ts`
  - **作者**：@DIYgod

#### 用户回答

- **路由**：`/zhihu/people/answers/:id` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/zhihu/people/activities/diygod
  - **源代码**：`/zhihu/answers.ts`
  - **作者**：@DIYgod

#### 用户想法

- **路由**：`/zhihu/people/pins/:id` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/zhihu/people/pins/kan-dan-45
  - **源代码**：`/zhihu/pin/people.ts`
  - **作者**：@xyqfer

#### 用户文章

- **路由**：`/zhihu/posts/:usertype/:id` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/zhihu/people/answers/diygod
  - **源代码**：`/zhihu/posts.ts`
  - **作者**：@DIYgod, @prnake

#### 知乎书店 - 新书

- **路由**：`/zhihu/bookstore/newest` `🚨 反爬严格` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/zhihu/weekly
  - **源代码**：`/zhihu/bookstore/newest.ts`
  - **作者**：@LogicJake

#### 知乎书店 - 知乎周刊

- **路由**：`/zhihu/weekly` `🚨 反爬严格` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/zhihu/hotlist
  - **源代码**：`/zhihu/weekly.ts`
  - **作者**：@DIYgod

#### 知乎分类热榜

- **路由**：`/zhihu/hot/:category?` `🚨 反爬严格` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/zhihu/daily
  - **源代码**：`/zhihu/hot.ts`
  - **作者**：@DHPO

#### 知乎想法 - 24 小时新闻汇总

- **路由**：`/zhihu/pin/daily` `🚨 反爬严格` `🔍 支持 Radar` `🚨 反爬严格`
  - **示例**：https://rsshub.app/zhihu/bookstore/newest
  - **源代码**：`/zhihu/pin/daily.ts`
  - **作者**：@xyqfer

#### 知乎想法热榜

- **路由**：`/zhihu/pin/hotlist` `🚨 反爬严格` `🔍 支持 Radar` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/zhihu/pin/daily
  - **源代码**：`/zhihu/pin/hotlist.ts`
  - **作者**：@xyqfer

#### 知乎日报

- **路由**：`/zhihu/daily` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/zhihu/daily/section/2
  - **源代码**：`/zhihu/daily.ts`
  - **作者**：@ccbikai

#### 知乎日报 - 合集

- **路由**：`/zhihu/daily/section/:sectionId` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/zhihu/people/pins/kan-dan-45
  - **源代码**：`/zhihu/daily-section.ts`
  - **作者**：@xyqfer

#### 知乎热榜

- **路由**：`/zhihu/hotlist` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/zhihu/hotlist
  - **源代码**：`/zhihu/hotlist.ts`
  - **作者**：@DIYgod

#### 话题

- **路由**：`/zhihu/topic/:topicId/:isTop?` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/zhihu/xhu/zhuanlan/githubdaily
  - **源代码**：`/zhihu/topic.ts`
  - **作者**：@JimenezLi

#### 问题

- **路由**：`/zhihu/question/:questionId/:sortBy?` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/zhihu/collection/26444956
  - **源代码**：`/zhihu/question.ts`

</details>

### 简书
<a id="简书"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 专题

- **路由**：`/jianshu/collection/:id` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/jianshu/home
  - **源代码**：`/jianshu/collection.ts`
  - **作者**：@DIYgod, @HenryQW, @JimenezLi

#### 作者

- **路由**：`/jianshu/user/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/jianshu/collection/xYuZYD
  - **源代码**：`/jianshu/user.ts`
  - **作者**：@DIYgod, @HenryQW, @JimenezLi

#### 首页

- **路由**：`/jianshu/home` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/jike/user/3EE02BC9-C5B3-4209-8750-4ED1EE0F67BB
  - **源代码**：`/jianshu/home.ts`
  - **作者**：@DIYgod, @HenryQW, @JimenezLi

</details>

### 腾讯新闻较真查证平台
<a id="腾讯新闻较真查证平台"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 用户作品列表

- **路由**：`/qq/kg/:userId`
  - **示例**：https://rsshub.app/qq/kg/reply/OhXHMdO1VxLWQOOm
  - **源代码**：`/qq/kg/user.ts`
  - **作者**：@zhangxiang012

#### 用户作品评论动态

- **路由**：`/qq/kg/reply/:playId`
  - **示例**：https://rsshub.app/coolapk/user/3177668/dynamic
  - **源代码**：`/qq/kg/reply.ts`
  - **作者**：@xizeyoupan

</details>

### 豆瓣
<a id="豆瓣"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Unknown

- **路由**：`/douban/book/latest`
  - **示例**：https://rsshub.app/douban/doulist/37716774
  - **源代码**：`/douban/other/latest-book.ts`
  - **作者**：@LogicJake, @honue
- **路由**：`/douban/doulist/:id`
  - **示例**：https://rsshub.app/douyin/user/MS4wLjABAAAARcAHmmF9mAG3JEixq_CdP72APhBlGlLVbN-1eBcPqao
  - **源代码**：`/douban/other/doulist.ts`
  - **作者**：@LogicJake, @honue

#### 一周口碑榜

- **路由**：`/douban/movie/weekly/:type?`
  - **示例**：https://rsshub.app/douban/commercialpress/latest
  - **源代码**：`/douban/other/weekly-best.ts`
  - **作者**：@xyqfer

#### 北美票房榜

- **路由**：`/douban/movie/ustop`
  - **示例**：https://rsshub.app/douban/book/latest
  - **源代码**：`/douban/other/ustop.ts`
  - **作者**：@fengkx

#### 即将上映的电影

- **路由**：`/douban/movie/later`
  - **示例**：https://rsshub.app/douban/topic/48823
  - **源代码**：`/douban/other/later.ts`
  - **作者**：@LogicJake

#### 商务印书馆新书速递

- **路由**：`/douban/commercialpress/latest`
  - **示例**：https://rsshub.app/douban/replies/xiaoyaxiaoya
  - **源代码**：`/douban/commercialpress/latest.ts`
  - **作者**：@nczitzk

#### 日记最新回应

- **路由**：`/douban/replies/:uid`
  - **示例**：https://rsshub.app/douban/event/hot/118172
  - **源代码**：`/douban/other/replies.ts`
  - **作者**：@xyqfer

#### 最新回应过的日记

- **路由**：`/douban/replied/:uid`
  - **示例**：https://rsshub.app/douban/music/latest/chinese
  - **源代码**：`/douban/other/replied.ts`
  - **作者**：@nczitzk

#### 最新增加的音乐

- **路由**：`/douban/music/latest/:area?`
  - **示例**：https://rsshub.app/douban/movie/playing
  - **源代码**：`/douban/other/latest-music.ts`
  - **作者**：@DIYgod

#### 正在上映的电影

- **路由**：`/douban/movie/playing,/movie/playing/:score`
  - **示例**：https://rsshub.app/douban/movie/playing
  - **源代码**：`/douban/other/playing.ts`
  - **作者**：@DIYgod
- **路由**：`/douban/movie/playing,/movie/playing/:score`
  - **示例**：https://rsshub.app/douban/movie/playing
  - **源代码**：`/douban/other/playing.ts`
  - **作者**：@DIYgod

#### 浏览发现

- **路由**：`/douban/explore`
  - **示例**：https://rsshub.app/douban/movie/later
  - **源代码**：`/douban/other/explore.ts`
  - **作者**：@DIYgod

#### 热门同城活动

- **路由**：`/douban/event/hot/:locationId`
  - **示例**：https://rsshub.app/douban/book/rank/fiction
  - **源代码**：`/douban/event/hot.ts`
  - **作者**：@xyqfer

#### 热门图书排行

- **路由**：`/douban/book/rank/:type?`
  - **示例**：https://rsshub.app/douban/book/rank/fiction
  - **源代码**：`/douban/book/rank.ts`
  - **作者**：@xyqfer, @queensferryme

#### 用户想看

- **路由**：`/douban/people/:userid/wish/:routeParams?`
  - **示例**：https://rsshub.app/douban/movie/weekly
  - **源代码**：`/douban/people/wish.ts`
  - **作者**：@exherb

#### 话题

- **路由**：`/douban/topic/:id/:sort?`
  - **示例**：https://rsshub.app/douban/topic/48823
  - **源代码**：`/douban/other/topic.ts`
  - **作者**：@LogicJake

#### 豆瓣书店

- **路由**：`/douban/bookstore`
  - **示例**：https://rsshub.app/douban/movie/ustop
  - **源代码**：`/douban/other/bookstore.ts`
  - **作者**：@DIYgod

#### 豆瓣小组

- **路由**：`/douban/group/:groupid/:type?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/douban/36328704/discussion
  - **源代码**：`/douban/other/group.ts`
  - **作者**：@nightmare-mio

#### 豆瓣招聘

- **路由**：`/douban/jobs/:type`
  - **示例**：https://rsshub.app/douban/group/648102
  - **源代码**：`/douban/other/jobs.ts`
  - **作者**：@DIYgod

#### 豆瓣榜单与集合

- **路由**：`/douban/list/:type?/:routeParams?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/douban/list/subject_real_time_hotest
  - **源代码**：`/douban/other/list.ts`
  - **作者**：@5upernova-heng, @honue

#### 豆瓣每月推荐片单

- **路由**：`/douban/recommended/:type?/:routeParams?`
  - **示例**：https://rsshub.app/douban/recommended/tv
  - **源代码**：`/douban/other/recommended.ts`
  - **作者**：@honue

#### 豆瓣电影人

- **路由**：`/douban/celebrity/:id/:sort?`
  - **示例**：https://rsshub.app/douban/bookstore
  - **源代码**：`/douban/other/celebrity.ts`
  - **作者**：@xyqfer

#### 豆瓣电影分类

- **路由**：`/douban/movie/classification/:sort?/:score?/:tags?`
  - **示例**：https://rsshub.app/douban/celebrity/1274261
  - **源代码**：`/douban/other/classification.ts`
  - **作者**：@minimalistrojan

#### 豆瓣读书论坛

- **路由**：`/douban/:id/discussion` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/douban/36328704/discussion
  - **源代码**：`/douban/other/discussion.ts`
  - **作者**：@nightmare-mio

#### 频道专题

- **路由**：`/douban/channel/:id/:nav?`
  - **示例**：https://rsshub.app/douban/channel/30168934/hot
  - **源代码**：`/douban/channel/topic.ts`
  - **作者**：@umm233

#### 频道书影音

- **路由**：`/douban/channel/:id/subject/:nav`
  - **示例**：https://rsshub.app/douban/explore
  - **源代码**：`/douban/channel/subject.ts`
  - **作者**：@clarkzsd

</details>

### 酷安
<a id="酷安"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 图文

- **路由**：`/coolapk/tuwen/:type?,/tuwen-xinxian`
  - **示例**：https://rsshub.app/coolapk/toutiao
  - **源代码**：`/coolapk/tuwen.ts`
  - **作者**：@xizeyoupan
- **路由**：`/coolapk/tuwen/:type?,/tuwen-xinxian`
  - **示例**：https://rsshub.app/coolapk/tuwen
  - **源代码**：`/coolapk/tuwen.ts`
  - **作者**：@xizeyoupan

#### 头条

- **路由**：`/coolapk/toutiao/:type?`
  - **示例**：https://rsshub.app/coolapk/toutiao
  - **源代码**：`/coolapk/toutiao.ts`
  - **作者**：@xizeyoupan

#### 热榜

- **路由**：`/coolapk/hot/:type?/:period?`
  - **示例**：https://rsshub.app/coolapk/dyh/1524
  - **源代码**：`/coolapk/hot.ts`
  - **作者**：@xizeyoupan

#### 用户

- **路由**：`/coolapk/user/:uid/dynamic`
  - **示例**：https://rsshub.app/coolapk/tuwen
  - **源代码**：`/coolapk/user-dynamic.ts`
  - **作者**：@xizeyoupan

#### 看看号

- **路由**：`/coolapk/dyh/:dyhId`
  - **示例**：https://rsshub.app/coolapk/huati/iPhone
  - **源代码**：`/coolapk/dyh.ts`
  - **作者**：@xizeyoupan

#### 话题

- **路由**：`/coolapk/huati/:tag`
  - **示例**：https://rsshub.app/jianshu/user/yZq3ZV
  - **源代码**：`/coolapk/huati.ts`
  - **作者**：@DIYgod, @HenryQW, @JimenezLi

</details>
