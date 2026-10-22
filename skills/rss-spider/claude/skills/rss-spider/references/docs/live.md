# 🎥 直播（live）

本分类共 **15** 条路由。

## 使用方式（给 AI）

1. 先在本页的「服务总览」定位目标站点/服务。
2. 打开对应服务的折叠块，选择与你要订阅的「Feed」最匹配的一条路由。
3. 将路由模板里的 `:参数` 替换为具体值；`?` 表示可选段。
4. 若标注了「反爬严格/需要登录/需要 Cookie」等标签，优先使用自建实例并配置相应环境变量或代理。

## 服务总览（渐进式入口）

| 服务 | 路由数 |
|---|---:|
| [Bilibili](#bilibili) | 3 |
| [LiSA](#lisa) | 2 |
| [Twitch](#twitch) | 3 |
| [Yoasobi Official](#yoasobi-official) | 3 |
| [YouTube Live](#youtube-live) | 1 |
| [抖音直播](#抖音直播) | 1 |
| [斗鱼直播](#斗鱼直播) | 1 |
| [浪 Play 直播](#浪-play-直播) | 1 |

## 服务详情（按需展开）

### Bilibili
<a id="bilibili"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 直播分区

- **路由**：`/bilibili/live/area/:areaID/:order`
  - **示例**：https://rsshub.app/bilibili/live/area/207/online
  - **源代码**：`/bilibili/live-area.ts`
  - **作者**：@Qixingchen

#### 直播开播

- **路由**：`/bilibili/live/room/:roomID` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bilibili/live/room/3
  - **源代码**：`/bilibili/live-room.ts`
  - **作者**：@Qixingchen

#### 直播搜索

- **路由**：`/bilibili/live/search/:key/:order` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bilibili/live/room/3
  - **源代码**：`/bilibili/live-search.ts`
  - **作者**：@Qixingchen

</details>

### LiSA
<a id="lisa"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Latest Discography

- **路由**：`/lxixsxa/disco` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/lxixsxa/disco
  - **源代码**：`/lxixsxa/discography.ts`
  - **作者**：@Kiotlin

#### News

- **路由**：`/lxixsxa/info` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/lxixsxa/disco
  - **源代码**：`/lxixsxa/information.ts`
  - **作者**：@Kiotlin

</details>

### Twitch
<a id="twitch"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Channel Video

- **路由**：`/twitch/video/:login/:filter?` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/lxixsxa/info
  - **源代码**：`/twitch/video.ts`
  - **作者**：@Kiotlin

#### Live

- **路由**：`/twitch/live/:login`
  - **示例**：https://rsshub.app/twitch/live/riotgames
  - **源代码**：`/twitch/live.ts`
  - **作者**：@hoilc

#### Stream Schedule

- **路由**：`/twitch/schedule/:login` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/twitch/live/riotgames
  - **源代码**：`/twitch/schedule.ts`
  - **作者**：@hoilc

</details>

### Yoasobi Official
<a id="yoasobi-official"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Live

- **路由**：`/yoasobi-music/live` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/twitch/schedule/riotgames
  - **源代码**：`/yoasobi-music/live.ts`
  - **作者**：@Kiotlin

#### Media

- **路由**：`/yoasobi-music/media` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/yoasobi-music/live
  - **源代码**：`/yoasobi-music/media.ts`
  - **作者**：@Kiotlin

#### News & Biography

- **路由**：`/yoasobi-music/info/:category?` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/yoasobi-music/media
  - **源代码**：`/yoasobi-music/info.ts`
  - **作者**：@Kiotlin

</details>

### YouTube Live
<a id="youtube-live"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Live

- **路由**：`/youtube/live/:username/:embed?`
  - **示例**：https://rsshub.app/yoasobi-music/info/news
  - **源代码**：`/youtube/live.ts`

</details>

### 抖音直播
<a id="抖音直播"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 直播间开播

- **路由**：`/douyin/live/:rid` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/douyin/live/685317364746
  - **源代码**：`/douyin/live.ts`
  - **作者**：@TonyRL

</details>

### 斗鱼直播
<a id="斗鱼直播"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 直播间开播

- **路由**：`/douyu/room/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/douyin/live/685317364746
  - **源代码**：`/douyu/room.ts`
  - **作者**：@DIYgod

</details>

### 浪 Play 直播
<a id="浪-play-直播"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Unknown

- **路由**：`/lang/live/room/:id` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/douyu/room/24422
  - **源代码**：`/lang/room.ts`
  - **作者**：@MittWillson

</details>
