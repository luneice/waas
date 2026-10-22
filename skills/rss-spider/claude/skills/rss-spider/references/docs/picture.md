# 🖼️ 图片（picture）

本分类共 **30** 条路由。

## 使用方式（给 AI）

1. 先在本页的「服务总览」定位目标站点/服务。
2. 打开对应服务的折叠块，选择与你要订阅的「Feed」最匹配的一条路由。
3. 将路由模板里的 `:参数` 替换为具体值；`?` 表示可选段。
4. 若标注了「反爬严格/需要登录/需要 Cookie」等标签，优先使用自建实例并配置相应环境变量或代理。

## 服务总览（渐进式入口）

| 服务 | 路由数 |
|---|---:|
| [500px 摄影社区](#500px-摄影社区) | 2 |
| [8KCosplay](#8kcosplay) | 2 |
| [ArtStation](#artstation) | 1 |
| [Booru](#booru) | 1 |
| [E-Hentai](#e-hentai) | 3 |
| [Fantia](#fantia) | 2 |
| [Google](#google) | 2 |
| [MM 范](#mm-范) | 3 |
| [NASA Astronomy Picture of the Day](#nasa-astronomy-picture-of-the-day) | 3 |
| [Pixabay](#pixabay) | 1 |
| [wallhaven](#wallhaven) | 2 |
| [北京天文馆](#北京天文馆) | 1 |
| [喷嚏](#喷嚏) | 2 |
| [国家地理](#国家地理) | 1 |
| [奇葩买家秀](#奇葩买家秀) | 1 |
| [极品性感美女](#极品性感美女) | 3 |

## 服务详情（按需展开）

### 500px 摄影社区
<a id="500px-摄影社区"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 摄影师作品

- **路由**：`/500px/user/works/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/500px/tribe/set/f5de0b8aa6d54ec486f5e79616418001
  - **源代码**：`/500px/user.ts`
  - **作者**：@TonyRL

#### 部落影集

- **路由**：`/500px/tribe/set/:id`
  - **示例**：https://rsshub.app/500px/tribe/set/f5de0b8aa6d54ec486f5e79616418001
  - **源代码**：`/500px/tribe-set.ts`
  - **作者**：@TonyRL

</details>

### 8KCosplay
<a id="8kcosplay"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 最新

- **路由**：`/8kcos/` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/8kcos/tag/cosplay
  - **源代码**：`/8kcos/latest.ts`
  - **作者**：@KotoriK

#### 标签

- **路由**：`/8kcos/tag/:tag` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/500px/user/works/hujunli
  - **源代码**：`/8kcos/tag.ts`
  - **作者**：@KotoriK

</details>

### ArtStation
<a id="artstation"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Artist Profolio

- **路由**：`/artstation/:handle` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/8kcos/
  - **源代码**：`/artstation/user.ts`
  - **作者**：@KotoriK

</details>

### Booru
<a id="booru"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### MMDArchive 标签查询

- **路由**：`/booru/mmda/tags/:tags?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/artstation/wlop
  - **源代码**：`/booru/mmda.ts`
  - **作者**：@N78Wy

</details>

### E-Hentai
<a id="e-hentai"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Favorites

- **路由**：`/ehentai/favorites/:favcat?/:order?/:page?/:routeParams?` `🚨 反爬严格`
  - **示例**：https://rsshub.app/ehentai/favorites/0/posted/1
  - **源代码**：`/ehentai/favorites.ts`
  - **作者**：@yindaheng98, @syrinka

#### Search

- **路由**：`/ehentai/search/:params?/:page?/:routeParams?` `🚨 反爬严格`
  - **示例**：https://rsshub.app/ehentai/search/f_search=artist%3Amana%24/1
  - **源代码**：`/ehentai/search.ts`
  - **作者**：@yindaheng98, @syrinka

#### Tag

- **路由**：`/ehentai/tag/:tag/:page?/:routeParams?` `🚨 反爬严格`
  - **示例**：https://rsshub.app/ehentai/search/f_search=artist%3Amana%24/1
  - **源代码**：`/ehentai/tag.ts`
  - **作者**：@yindaheng98, @syrinka

</details>

### Fantia
<a id="fantia"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Search

- **路由**：`/fantia/search/:type?/:caty?/:period?/:order?/:rating?/:keyword?`
  - **示例**：https://rsshub.app/ehentai/tag/language:chinese/1
  - **源代码**：`/fantia/search.ts`

#### User Posts

- **路由**：`/fantia/user/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/fantia/user/3498
  - **源代码**：`/fantia/user.ts`
  - **作者**：@nczitzk

</details>

### Google
<a id="google"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Public Albums

- **路由**：`/google/album/:id`
  - **示例**：https://rsshub.app/fantia/user/3498
  - **源代码**：`/google/album.ts`
  - **作者**：@nczitzk

#### Update

- **路由**：`/google/doodles/:language?`
  - **示例**：https://rsshub.app/google/album/msFFnAzKmQmWj76EA
  - **源代码**：`/google/doodles.ts`
  - **作者**：@hoilc

</details>

### MM 范
<a id="mm-范"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 分类

- **路由**：`/95mm/tab/:tab?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/95mm/tag/黑丝
  - **源代码**：`/95mm/tab.ts`
  - **作者**：@nczitzk

#### 标签

- **路由**：`/95mm/tag/:tag` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/google/doodles/zh-CN
  - **源代码**：`/95mm/tag.ts`
  - **作者**：@nczitzk

#### 集合

- **路由**：`/95mm/category/:category` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/95mm/category/1
  - **源代码**：`/95mm/category.ts`
  - **作者**：@nczitzk

</details>

### NASA Astronomy Picture of the Day
<a id="nasa-astronomy-picture-of-the-day"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Cheng Kung University Mirror

- **路由**：`/nasa/apod-ncku` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/nasa/apod-ncku
  - **源代码**：`/nasa/apod-ncku.ts`
  - **作者**：@nczitzk, @williamgateszhao

#### NASA

- **路由**：`/nasa/apod` `🔍 支持 Radar` `NASA 中文`
  - **示例**：https://rsshub.app/nasa/apod-cn
  - **源代码**：`/nasa/apod.ts`
  - **作者**：@nczitzk, @williamgateszhao

#### NASA 中文

- **路由**：`/nasa/apod-cn` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/nasa/apod-ncku
  - **源代码**：`/nasa/apod-cn.ts`
  - **作者**：@nczitzk, @williamgateszhao

</details>

### Pixabay
<a id="pixabay"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Search

- **路由**：`/pixabay/search/:q/:order?` `⚙️ 需要配置` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/nasa/apod
  - **源代码**：`/pixabay/search.ts`
  - **作者**：@nczitzk, @williamgateszhao

</details>

### wallhaven
<a id="wallhaven"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Search

- **路由**：`/wallhaven/search/:filter?/:needDetails?,/:filter?/:needDetails?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/wallhaven/search/categories=110&purity=110&sorting=date_added&order=desc
  - **源代码**：`/wallhaven/index.ts`
  - **作者**：@nczitzk, @Fatpandac
- **路由**：`/wallhaven/search/:filter?/:needDetails?,/:filter?/:needDetails?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/wallhaven/search/categories=110&purity=110&sorting=date_added&order=desc
  - **源代码**：`/wallhaven/index.ts`
  - **作者**：@nczitzk, @Fatpandac

</details>

### 北京天文馆
<a id="北京天文馆"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 每日一图

- **路由**：`/bjp/apod` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bjp/apod
  - **源代码**：`/bjp/apod.ts`
  - **作者**：@HenryQW

</details>

### 喷嚏
<a id="喷嚏"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 主题

- **路由**：`/dapenti/subject/:id`
  - **示例**：https://rsshub.app/dapenti/tugua
  - **源代码**：`/dapenti/subject.ts`
  - **作者**：@tgly307

#### 图卦

- **路由**：`/dapenti/tugua`
  - **示例**：https://rsshub.app/jpxgmn/search/candy
  - **源代码**：`/dapenti/tugua.ts`
  - **作者**：@Urabartin

</details>

### 国家地理
<a id="国家地理"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 每日一图

- **路由**：`/natgeo/dailyphoto` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bjp/apod
  - **源代码**：`/natgeo/dailyphoto.ts`
  - **作者**：@HenryQW

</details>

### 奇葩买家秀
<a id="奇葩买家秀"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Unknown

- **路由**：`/qipamaijia/:cate?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/dapenti/subject/184
  - **源代码**：`/qipamaijia/index.ts`
  - **作者**：@Fatpandac, @nczitzk

</details>

### 极品性感美女
<a id="极品性感美女"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 分类

- **路由**：`/jpxgmn/tab/:tab?` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/jpxgmn/weekly
  - **源代码**：`/jpxgmn/tab.ts`
  - **作者**：@Urabartin

#### 搜索

- **路由**：`/jpxgmn/search/:kw` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/jpxgmn/tab
  - **源代码**：`/jpxgmn/search.ts`
  - **作者**：@Urabartin

#### 本周热门

- **路由**：`/jpxgmn/weekly` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/natgeo/dailyphoto
  - **源代码**：`/jpxgmn/weekly.ts`
  - **作者**：@LogicJake, @OrangeEd1t, @TonyRL

</details>
