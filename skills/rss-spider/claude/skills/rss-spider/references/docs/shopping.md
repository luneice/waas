# 🛍️ 购物（shopping）

本分类共 **52** 条路由。

## 使用方式（给 AI）

1. 先在本页的「服务总览」定位目标站点/服务。
2. 打开对应服务的折叠块，选择与你要订阅的「Feed」最匹配的一条路由。
3. 将路由模板里的 `:参数` 替换为具体值；`?` 表示可选段。
4. 若标注了「反爬严格/需要登录/需要 Cookie」等标签，优先使用自建实例并配置相应环境变量或代理。

## 服务总览（渐进式入口）

| 服务 | 路由数 |
|---|---:|
| [0818 团](#0818-团) | 1 |
| [Arcteryx](#arcteryx) | 3 |
| [Bellroy](#bellroy) | 1 |
| [Furstar](#furstar) | 3 |
| [Gumroad](#gumroad) | 1 |
| [hotukdeals](#hotukdeals) | 2 |
| [IKEA](#ikea) | 5 |
| [MyFigureCollection](#myfigurecollection) | 2 |
| [MyMusicSheet](#mymusicsheet) | 1 |
| [Patagonia](#patagonia) | 1 |
| [ShopBack](#shopback) | 1 |
| [Snow Peak](#snow-peak) | 1 |
| [Uniqlo](#uniqlo) | 1 |
| [Zagg](#zagg) | 1 |
| [上海东方艺术中心](#上海东方艺术中心) | 1 |
| [上海文化广场](#上海文化广场) | 1 |
| [中国养猪网](#中国养猪网) | 1 |
| [京东](#京东) | 1 |
| [什么值得买](#什么值得买) | 6 |
| [多抓鱼](#多抓鱼) | 1 |
| [大麦网](#大麦网) | 1 |
| [小米](#小米) | 1 |
| [小米有品](#小米有品) | 2 |
| [摩点](#摩点) | 1 |
| [消费者报道](#消费者报道) | 1 |
| [淘宝众筹](#淘宝众筹) | 1 |
| [特斯拉中国](#特斯拉中国) | 2 |
| [秀动网](#秀动网) | 4 |
| [逛丢](#逛丢) | 4 |

## 服务详情（按需展开）

### 0818 团
<a id="0818-团"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 分类

- **路由**：`/0818tuan/:listId?`
  - **示例**：https://rsshub.app/0818tuan
  - **源代码**：`/0818tuan/index.ts`
  - **作者**：@TonyRL

</details>

### Arcteryx
<a id="arcteryx"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### New Arrivals

- **路由**：`/arcteryx/new-arrivals/:country/:gender` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/arcteryx/new-arrivals/us/mens
  - **源代码**：`/arcteryx/new-arrivals.ts`
  - **作者**：@EthanWng97

#### Outlet

- **路由**：`/arcteryx/outlet/:country/:gender` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/arcteryx/outlet/us/mens
  - **源代码**：`/arcteryx/outlet.ts`
  - **作者**：@EthanWng97

#### Regear New Arrivals

- **路由**：`/arcteryx/regear/new-arrivals` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/arcteryx/regear/new-arrivals
  - **源代码**：`/arcteryx/regear-new-arrivals.ts`
  - **作者**：@EthanWng97

</details>

### Bellroy
<a id="bellroy"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### New Releases

- **路由**：`/bellroy/new-releases` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/arcteryx/regear/new-arrivals
  - **源代码**：`/bellroy/new-releases.ts`
  - **作者**：@EthanWng97

</details>

### Furstar
<a id="furstar"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 已经出售的角色列表

- **路由**：`/furstar/archive/:lang?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/furstar/artists/cn
  - **源代码**：`/furstar/archive.ts`
  - **作者**：@NeverBehave

#### 最新售卖角色列表

- **路由**：`/furstar/characters/:lang?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/furstar/archive/cn
  - **源代码**：`/furstar/index.ts`
  - **作者**：@NeverBehave

#### 画师列表

- **路由**：`/furstar/artists/:lang?` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bellroy/new-releases
  - **源代码**：`/furstar/artists.ts`
  - **作者**：@EthanWng97

</details>

### Gumroad
<a id="gumroad"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Products

- **路由**：`/gumroad/:username/:products`
  - **示例**：https://rsshub.app/furstar/characters/cn
  - **源代码**：`/gumroad/index.ts`
  - **作者**：@NeverBehave

</details>

### hotukdeals
<a id="hotukdeals"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### hottest

- **路由**：`/hotukdeals/hottest` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/hotukdeals/hottest
  - **源代码**：`/hotukdeals/hottest.ts`
  - **作者**：@DIYgod

#### thread

- **路由**：`/hotukdeals/:type` `🚨 反爬严格` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/hotukdeals/hottest
  - **源代码**：`/hotukdeals/index.ts`
  - **作者**：@DIYgod

</details>

### IKEA
<a id="ikea"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### UK - New Product Release

- **路由**：`/ikea/gb/new` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/hotukdeals/hot
  - **源代码**：`/ikea/gb/new.ts`
  - **作者**：@HenryQW

#### UK - Offers

- **路由**：`/ikea/gb/offer` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/ikea/gb/new
  - **源代码**：`/ikea/gb/offer.ts`
  - **作者**：@HenryQW

#### 中国 - 会员特惠

- **路由**：`/ikea/cn/family_offers` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/ikea/gb/offer
  - **源代码**：`/ikea/cn/family-offers.ts`
  - **作者**：@HenryQW

#### 中国 - 低价优选

- **路由**：`/ikea/cn/low_price` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/ikea/cn/family_offers
  - **源代码**：`/ikea/cn/low-price.ts`
  - **作者**：@jzhangdev

#### 中国 - 当季新品推荐

- **路由**：`/ikea/cn/new` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/ikea/cn/low_price
  - **源代码**：`/ikea/cn/new.ts`
  - **作者**：@jzhangdev

</details>

### MyFigureCollection
<a id="myfigurecollection"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Activity

- **路由**：`/myfigurecollection/activity/:category?/:language?/:latestAdditions?/:latestEdits?/:latestAlerts?/:latestPictures?` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/ikea/cn/new
  - **源代码**：`/myfigurecollection/activity.ts`
  - **作者**：@jzhangdev

#### 圖片

- **路由**：`/myfigurecollection/:category?/:language?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/myfigurecollection/potd
  - **源代码**：`/myfigurecollection/index.ts`
  - **作者**：@nczitzk

</details>

### MyMusicSheet
<a id="mymusicsheet"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### User Sheets

- **路由**：`/mymusicsheet/user/sheets/:username/:iso?/:freeOnly?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/mymusicsheet/user/sheets/HalcyonMusic/USD/1
  - **源代码**：`/mymusicsheet/usersheets.ts`
  - **作者**：@Freddd13

</details>

### Patagonia
<a id="patagonia"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### New Arrivals

- **路由**：`/patagonia/new-arrivals/:category`
  - **示例**：https://rsshub.app/patagonia/new-arrivals/mens
  - **源代码**：`/patagonia/new-arrivals.ts`

</details>

### ShopBack
<a id="shopback"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Store

- **路由**：`/shopback/:store` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/shopback/shopee-mart
  - **源代码**：`/shopback/store.ts`
  - **作者**：@nczitzk

</details>

### Snow Peak
<a id="snow-peak"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### New Arrivals(USA)的直接链接")

- **路由**：`/snowpeak/us/new-arrivals` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/shopback/shopee-mart
  - **源代码**：`/snowpeak/us-new-arrivals.ts`
  - **作者**：@EthanWng97

</details>

### Uniqlo
<a id="uniqlo"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### New Arrivals

- **路由**：`/uniqlo/new/:country/:category` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/snowpeak/us/new-arrivals
  - **源代码**：`/uniqlo/new.ts`
  - **作者**：@EthanWng97

</details>

### Zagg
<a id="zagg"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### New Arrivals

- **路由**：`/zagg/new-arrivals/:query?`
  - **示例**：https://rsshub.app/uniqlo/new/sg/men
  - **源代码**：`/zagg/new-arrivals.ts`
  - **作者**：@EthanWng97

</details>

### 上海东方艺术中心
<a id="上海东方艺术中心"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 演出月历

- **路由**：`/shoac/recent-show` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/shcstheatre/programs
  - **源代码**：`/shoac/recent-show.ts`
  - **作者**：@fuzy112

</details>

### 上海文化广场
<a id="上海文化广场"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 节目列表

- **路由**：`/shcstheatre/programs` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/shcstheatre/programs
  - **源代码**：`/shcstheatre/programs.ts`
  - **作者**：@fuzy112

</details>

### 中国养猪网
<a id="中国养猪网"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Unknown

- **路由**：`/zhuwang/zhujia` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/zhuwang/zhujia
  - **源代码**：`/zhuwang/index.ts`

</details>

### 京东
<a id="京东"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 商品价格

- **路由**：`/jd/price/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/guangdiu/rank
  - **源代码**：`/jd/price.ts`
  - **作者**：@fatpandac

</details>

### 什么值得买
<a id="什么值得买"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 关键词

- **路由**：`/smzdm/keyword/:keyword`
  - **示例**：https://rsshub.app/shoac/recent-show
  - **源代码**：`/smzdm/keyword.ts`
  - **作者**：@TonyRL

#### 好文

- **路由**：`/smzdm/haowen/:day?`
  - **示例**：https://rsshub.app/smzdm/haowen/1
  - **源代码**：`/smzdm/haowen.ts`
  - **作者**：@LogicJake

#### 好文分类

- **路由**：`/smzdm/haowen/fenlei/:name/:sort?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/smzdm/keyword/女装
  - **源代码**：`/smzdm/haowen-fenlei.ts`
  - **作者**：@DIYgod, @MeanZhang

#### 排行榜

- **路由**：`/smzdm/ranking/:rank_type/:rank_id/:hour`
  - **示例**：https://rsshub.app/smzdm/haowen/1
  - **源代码**：`/smzdm/ranking.ts`
  - **作者**：@LogicJake

#### 用户文章

- **路由**：`/smzdm/article/:uid` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/smzdm/article/6902738986
  - **源代码**：`/smzdm/article.ts`
  - **作者**：@xfangbao

#### 用户爆料

- **路由**：`/smzdm/baoliao/:uid` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/smzdm/article/6902738986
  - **源代码**：`/smzdm/baoliao.ts`
  - **作者**：@xfangbao

</details>

### 多抓鱼
<a id="多抓鱼"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 搜索结果

- **路由**：`/duozhuayu/search/:wd` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/duozhuayu/search/JavaScript
  - **源代码**：`/duozhuayu/search.ts`
  - **作者**：@fengkx

</details>

### 大麦网
<a id="大麦网"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 票务更新

- **路由**：`/damai/activity/:city/:category/:subcategory/:keyword?`
  - **示例**：https://rsshub.app/zagg/new-arrivals/brand=164&cat=3038,3041
  - **源代码**：`/damai/activity.ts`
  - **作者**：@hoilc

</details>

### 小米
<a id="小米"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 小米众筹

- **路由**：`/mi/crowdfunding` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/ccreports/article
  - **源代码**：`/mi/crowdfunding.ts`
  - **作者**：@EsuRt, @Fatpandac

</details>

### 小米有品
<a id="小米有品"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 小米有品众筹

- **路由**：`/xiaomiyoupin/crowdfunding` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/mi/crowdfunding
  - **源代码**：`/xiaomiyoupin/crowdfunding.ts`
  - **作者**：@DIYgod

#### 小米有品每日上新

- **路由**：`/xiaomiyoupin/latest` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/xiaomiyoupin/crowdfunding
  - **源代码**：`/xiaomiyoupin/latest.ts`
  - **作者**：@bigfei

</details>

### 摩点
<a id="摩点"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 众筹

- **路由**：`/modian/zhongchou/:category?/:sort?/:status?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/modian/zhongchou
  - **源代码**：`/modian/zhongchou.ts`
  - **作者**：@nczitzk

</details>

### 消费者报道
<a id="消费者报道"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 要闻

- **路由**：`/ccreports/article` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/ccreports/article
  - **源代码**：`/ccreports/index.ts`
  - **作者**：@EsuRt, @Fatpandac

</details>

### 淘宝众筹
<a id="淘宝众筹"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 众筹项目

- **路由**：`/taobao/zhongchou/:type?`
  - **示例**：https://rsshub.app/smzdm/baoliao/7367111021
  - **源代码**：`/taobao/zhongchou.ts`
  - **作者**：@nczitzk

</details>

### 特斯拉中国
<a id="特斯拉中国"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 价格

- **路由**：`/tesla/price` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/tesla/price
  - **源代码**：`/tesla/price/index.ts`
  - **作者**：@xiaokyo

#### 权益中心

- **路由**：`/tesla/cx/:category?/:city?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/tesla/price
  - **源代码**：`/tesla/cx.ts`
  - **作者**：@xiaokyo

</details>

### 秀动网
<a id="秀动网"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 厂牌 - 演出更新

- **路由**：`/showstart/brand/:id` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/xiaomiyoupin/latest
  - **源代码**：`/showstart/brand.ts`
  - **作者**：@xyqfer, @DIYgod, @bigfei

#### 演出搜索

- **路由**：`/showstart/search/:type/:keyword?`
  - **示例**：https://rsshub.app/showstart/search/live
  - **源代码**：`/showstart/search.ts`
  - **作者**：@lchtao26

#### 演出更新

- **路由**：`/showstart/event/:cityCode/:showStyle?`
  - **示例**：https://rsshub.app/showstart/brand/34707
  - **源代码**：`/showstart/event.ts`
  - **作者**：@lchtao26

#### 音乐人 - 演出更新

- **路由**：`/showstart/artist/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/showstart/search/live
  - **源代码**：`/showstart/artist.ts`
  - **作者**：@lchtao26

</details>

### 逛丢
<a id="逛丢"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 一小时风云榜

- **路由**：`/guangdiu/rank` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/guangdiu/cheaps/k=clothes
  - **源代码**：`/guangdiu/rank.ts`
  - **作者**：@fatpandac

#### 九块九

- **路由**：`/guangdiu/cheaps/:query?`
  - **示例**：https://rsshub.app/guangdiu/k=daily
  - **源代码**：`/guangdiu/cheaps.ts`
  - **作者**：@fatpandac

#### 关键字搜索

- **路由**：`/guangdiu/search/:query?`
  - **示例**：https://rsshub.app/duozhuayu/search/JavaScript
  - **源代码**：`/guangdiu/search.ts`
  - **作者**：@fengkx

#### 国内折扣 / 海外折扣

- **路由**：`/guangdiu/:query?`
  - **示例**：https://rsshub.app/guangdiu/search/k=百度网盘
  - **源代码**：`/guangdiu/index.ts`
  - **作者**：@Huzhixin00

</details>
