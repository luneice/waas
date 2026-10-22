# 💰 金融（finance）

本分类共 **92** 条路由。

## 使用方式（给 AI）

1. 先在本页的「服务总览」定位目标站点/服务。
2. 打开对应服务的折叠块，选择与你要订阅的「Feed」最匹配的一条路由。
3. 将路由模板里的 `:参数` 替换为具体值；`?` 表示可选段。
4. 若标注了「反爬严格/需要登录/需要 Cookie」等标签，优先使用自建实例并配置相应环境变量或代理。

## 服务总览（渐进式入口）

| 服务 | 路由数 |
|---|---:|
| [AInvest](#ainvest) | 2 |
| [BigQuant](#bigquant) | 1 |
| [Bloomberg](#bloomberg) | 1 |
| [DT 财经](#dt-财经) | 2 |
| [Finology Insider](#finology-insider) | 4 |
| [finviz](#finviz) | 2 |
| [Followin](#followin) | 5 |
| [FX Markets](#fx-markets) | 1 |
| [Paradigm](#paradigm) | 1 |
| [Seeking Alpha](#seeking-alpha) | 1 |
| [Stock Edge](#stock-edge) | 1 |
| [TokenInsight](#tokeninsight) | 3 |
| [Unusual Whales](#unusual-whales) | 1 |
| [上海证券交易所](#上海证券交易所) | 5 |
| [东方财富](#东方财富) | 3 |
| [中国人民银行](#中国人民银行) | 3 |
| [中国货币网](#中国货币网) | 1 |
| [中证网](#中证网) | 1 |
| [乌拉邦](#乌拉邦) | 2 |
| [前瞻网](#前瞻网) | 2 |
| [北京证券交易所](#北京证券交易所) | 1 |
| [华储网](#华储网) | 1 |
| [国家金融与发展实验室](#国家金融与发展实验室) | 1 |
| [巴伦周刊中文版](#巴伦周刊中文版) | 1 |
| [律动](#律动) | 1 |
| [智通财经网](#智通财经网) | 1 |
| [有知有行](#有知有行) | 1 |
| [格隆汇](#格隆汇) | 6 |
| [每经网](#每经网) | 2 |
| [汇通网](#汇通网) | 1 |
| [法布财经](#法布财经) | 3 |
| [淘股吧](#淘股吧) | 2 |
| [深圳证券交易所](#深圳证券交易所) | 4 |
| [深潮 TechFlow](#深潮-techflow) | 2 |
| [百度](#百度) | 1 |
| [老虎社区](#老虎社区) | 1 |
| [证券时报网](#证券时报网) | 1 |
| [财经网](#财经网) | 1 |
| [财联社](#财联社) | 3 |
| [金十数据](#金十数据) | 2 |
| [金色财经](#金色财经) | 3 |
| [雪球](#雪球) | 10 |
| [麦肯锡](#麦肯锡) | 1 |

## 服务详情（按需展开）

### AInvest
<a id="ainvest"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Latest Article

- **路由**：`/ainvest/article` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/ainvest/article
  - **源代码**：`/ainvest/article.ts`
  - **作者**：@TonyRL

#### Latest News

- **路由**：`/ainvest/news` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/ainvest/article
  - **源代码**：`/ainvest/news.ts`
  - **作者**：@TonyRL

</details>

### BigQuant
<a id="bigquant"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 专题报告

- **路由**：`/bigquant/collections` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/ainvest/news
  - **源代码**：`/bigquant/collections.ts`
  - **作者**：@TonyRL

</details>

### Bloomberg
<a id="bloomberg"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Authors

- **路由**：`/bloomberg/authors/:id/:slug/:source?` `🚨 反爬严格` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bigquant/collections
  - **源代码**：`/bloomberg/authors.ts`
  - **作者**：@nczitzk

</details>

### DT 财经
<a id="dt-财经"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 数据侠专栏

- **路由**：`/dtcj/datahero/:category?`
  - **示例**：https://rsshub.app/bloomberg/authors/ARbTQlRLRjE/matthew-s-levine
  - **源代码**：`/dtcj/datahero.ts`
  - **作者**：@nczitzk

#### 数据洞察

- **路由**：`/dtcj/datainsight/:id?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/dtcj/datainsight
  - **源代码**：`/dtcj/datainsight.ts`
  - **作者**：@nczitzk

</details>

### Finology Insider
<a id="finology-insider"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Bullets

- **路由**：`/finology/bullets` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/finology/bullets
  - **源代码**：`/finology/bullets.ts`
  - **作者**：@Rjnishant530

#### Category

- **路由**：`/finology/:category,/tag/:topic` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/finology/bullets
  - **源代码**：`/finology/tag.ts`
  - **作者**：@Rjnishant530
- **路由**：`/finology/:category,/tag/:topic` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/finology/success-stories
  - **源代码**：`/finology/tag.ts`
  - **作者**：@Rjnishant530

#### Most Viewed

- **路由**：`/finology/most-viewed/:time` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/finology/most-viewed/monthly
  - **源代码**：`/finology/most-viewed.ts`
  - **作者**：@Rjnishant530

</details>

### finviz
<a id="finviz"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### News

- **路由**：`/finviz/:category?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/finology/most-viewed/monthly
  - **源代码**：`/finviz/news.ts`
  - **作者**：@nczitzk

#### US Stock News

- **路由**：`/finviz/news/:ticker`
  - **示例**：https://rsshub.app/finviz
  - **源代码**：`/finviz/quote.ts`
  - **作者**：@HenryQW

</details>

### Followin
<a id="followin"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Home

- **路由**：`/followin/:categoryId?/:lang?`
  - **示例**：https://rsshub.app/finviz/news/AAPL
  - **源代码**：`/followin/index.ts`
  - **作者**：@HenryQW

#### KOL

- **路由**：`/followin/kol/:kolId/:lang?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/followin/kol/4075592991
  - **源代码**：`/followin/kol.ts`
  - **作者**：@TonyRL

#### News

- **路由**：`/followin/news/:lang?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/followin/kol/4075592991
  - **源代码**：`/followin/news.ts`
  - **作者**：@TonyRL

#### Tag

- **路由**：`/followin/tag/:tagId/:lang?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/followin/news
  - **源代码**：`/followin/tag.ts`
  - **作者**：@TonyRL

#### Topic

- **路由**：`/followin/topic/:topicId/:lang?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/followin/tag/177008
  - **源代码**：`/followin/topic.ts`
  - **作者**：@TonyRL

</details>

### FX Markets
<a id="fx-markets"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Channel

- **路由**：`/fx-markets/:channel`
  - **示例**：https://rsshub.app/followin/topic/40
  - **源代码**：`/fx-markets/channel.ts`

</details>

### Paradigm
<a id="paradigm"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Writing

- **路由**：`/paradigm/writing` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/paradigm/writing
  - **源代码**：`/paradigm/writing.ts`
  - **作者**：@Fatpandac

</details>

### Seeking Alpha
<a id="seeking-alpha"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Summary

- **路由**：`/seekingalpha/:symbol/:category?` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/paradigm/writing
  - **源代码**：`/seekingalpha/index.ts`
  - **作者**：@Fatpandac

</details>

### Stock Edge
<a id="stock-edge"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Daily Updates News

- **路由**：`/stockedge/daily-updates/news` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/stockedge/daily-updates/news
  - **源代码**：`/stockedge/daily-news.ts`
  - **作者**：@Rjnishant530

</details>

### TokenInsight
<a id="tokeninsight"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Blogs

- **路由**：`/tokeninsight/blog/:lang?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/stockedge/daily-updates/news
  - **源代码**：`/tokeninsight/blog.ts`
  - **作者**：@fuergaosi233

#### Latest

- **路由**：`/tokeninsight/bulletin/:lang?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/tokeninsight/blog/en
  - **源代码**：`/tokeninsight/bulletin.ts`
  - **作者**：@fuergaosi233

#### Research

- **路由**：`/tokeninsight/report/:lang?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/tokeninsight/bulletin/en
  - **源代码**：`/tokeninsight/report.ts`

</details>

### Unusual Whales
<a id="unusual-whales"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### News Flow

- **路由**：`/unusualwhales/news` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/unusualwhales/news
  - **源代码**：`/unusualwhales/news.ts`
  - **作者**：@TonyRL

</details>

### 上海证券交易所
<a id="上海证券交易所"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 上市公司信息最新公告披露

- **路由**：`/sse/disclosure/:query?`
  - **示例**：https://rsshub.app/sse/convert/beginDate=2018-08-18&endDate=2019-08-18&companyCode=603283&title=股份
  - **源代码**：`/sse/disclosure.ts`
  - **作者**：@kt286

#### 可转换公司债券公告

- **路由**：`/sse/convert/:query?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/sse/renewal
  - **源代码**：`/sse/convert.ts`
  - **作者**：@Jeason0228

#### 本所业务指南与流程

- **路由**：`/sse/lawandrules/:slug?`
  - **示例**：https://rsshub.app/sse/lawandrules
  - **源代码**：`/sse/lawandrules.ts`
  - **作者**：@nczitzk

#### 监管问询

- **路由**：`/sse/inquire` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/sse/inquire
  - **源代码**：`/sse/inquire.ts`
  - **作者**：@Jeason0228

#### 科创板项目动态

- **路由**：`/sse/renewal` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/sse/inquire
  - **源代码**：`/sse/renewal.ts`
  - **作者**：@Jeason0228

</details>

### 东方财富
<a id="东方财富"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 天天基金用户动态

- **路由**：`/eastmoney/ttjj/user/:uid`
  - **示例**：https://rsshub.app/eastmoney/search/web3
  - **源代码**：`/eastmoney/ttjj/user.ts`
  - **作者**：@drgnchan

#### 搜索

- **路由**：`/eastmoney/search/:keyword`
  - **示例**：https://rsshub.app/eastmoney/search/web3
  - **源代码**：`/eastmoney/search/index.ts`
  - **作者**：@drgnchan

#### 研究报告

- **路由**：`/eastmoney/report/:category` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/eastmoney/ttjj/user/6551094298949188
  - **源代码**：`/eastmoney/report/index.ts`
  - **作者**：@zidekuls

</details>

### 中国人民银行
<a id="中国人民银行"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 工作论文

- **路由**：`/gov/pbc/gzlw` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/gov/pbc/gzlw
  - **源代码**：`/gov/pbc/gzlw.ts`
  - **作者**：@Fatpandac

#### 沟通交流

- **路由**：`/gov/pbc/goutongjiaoliu` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/gov/pbc/gzlw
  - **源代码**：`/gov/pbc/goutongjiaoliu.ts`
  - **作者**：@Fatpandac

#### 货币政策司公开市场交易公告

- **路由**：`/gov/pbc/tradeAnnouncement`
  - **示例**：https://rsshub.app/gov/pbc/goutongjiaoliu
  - **源代码**：`/gov/pbc/trade-announcement.ts`
  - **作者**：@nczitzk

</details>

### 中国货币网
<a id="中国货币网"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 公告

- **路由**：`/chinamoney/:channelId?`
  - **示例**：https://rsshub.app/chinamoney
  - **源代码**：`/chinamoney/notice.ts`
  - **作者**：@TonyRL

</details>

### 中证网
<a id="中证网"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Unknown

- **路由**：`/cs/video/:category?`
  - **示例**：https://rsshub.app/cs/video/今日聚焦
  - **源代码**：`/cs/video.ts`
  - **作者**：@nczitzk

</details>

### 乌拉邦
<a id="乌拉邦"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 最新研报

- **路由**：`/ulapia/research/latest` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/ulapia/research/latest
  - **源代码**：`/ulapia/research.ts`

#### 频道

- **路由**：`/ulapia/reports/:category?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/taoguba/blog/252069
  - **源代码**：`/ulapia/index.ts`
  - **作者**：@nczitzk

</details>

### 前瞻网
<a id="前瞻网"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 排行榜

- **路由**：`/qianzhan/analyst/rank/:type?` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/nbd/daily
  - **源代码**：`/qianzhan/rank.ts`
  - **作者**：@yuuow

#### 文章列表

- **路由**：`/qianzhan/analyst/column/:type?`
  - **示例**：https://rsshub.app/qianzhan/analyst/rank/week
  - **源代码**：`/qianzhan/column.ts`
  - **作者**：@moke8

</details>

### 北京证券交易所
<a id="北京证券交易所"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 栏目

- **路由**：`/bse/:category?/:keyword?` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/baidu/gushitong/index
  - **源代码**：`/bse/index.ts`
  - **作者**：@CaoMeiYouRen

</details>

### 华储网
<a id="华储网"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 通知

- **路由**：`/mrm/:category?`
  - **示例**：https://rsshub.app/mrm
  - **源代码**：`/mrm/index.ts`
  - **作者**：@TonyRL

</details>

### 国家金融与发展实验室
<a id="国家金融与发展实验室"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 研究

- **路由**：`/nifd/research/:categoryGuid?`
  - **示例**：https://rsshub.app/gelonghui/hot-article
  - **源代码**：`/nifd/research.ts`

</details>

### 巴伦周刊中文版
<a id="巴伦周刊中文版"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 栏目

- **路由**：`/barronschina/:id?` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/unusualwhales/news
  - **源代码**：`/barronschina/index.ts`
  - **作者**：@TonyRL

</details>

### 律动
<a id="律动"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 新闻快讯

- **路由**：`/theblockbeats/:channel?`
  - **示例**：https://rsshub.app/laohu8/personal/3527667596890271
  - **源代码**：`/theblockbeats/index.ts`
  - **作者**：@Fatpandac

</details>

### 智通财经网
<a id="智通财经网"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 推荐

- **路由**：`/zhitongcaijing/:id?/:category?`
  - **示例**：https://rsshub.app/zhitongcaijing
  - **源代码**：`/zhitongcaijing/index.ts`
  - **作者**：@nczitzk

</details>

### 有知有行
<a id="有知有行"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 有知文章

- **路由**：`/youzhiyouxing/materials/:id?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/xueqiu/snb/ZH1288184
  - **源代码**：`/youzhiyouxing/materials.ts`
  - **作者**：@broven, @Fatpandac, @nczitzk

</details>

### 格隆汇
<a id="格隆汇"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 主题文章

- **路由**：`/gelonghui/subject/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/gelonghui/user/5273
  - **源代码**：`/gelonghui/subject.ts`
  - **作者**：@nczitzk

#### 实时快讯

- **路由**：`/gelonghui/live` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/fastbull/news
  - **源代码**：`/gelonghui/live.ts`
  - **作者**：@nczitzk

#### 搜索关键字

- **路由**：`/gelonghui/keyword/:keyword`
  - **示例**：https://rsshub.app/gelonghui/home
  - **源代码**：`/gelonghui/keyword.ts`
  - **作者**：@nczitzk

#### 最热文章

- **路由**：`/gelonghui/hot-article/:type?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/gelonghui/subject/4
  - **源代码**：`/gelonghui/hot-article.ts`
  - **作者**：@nczitzk

#### 用户文章

- **路由**：`/gelonghui/user/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/gelonghui/keyword/早报
  - **源代码**：`/gelonghui/user.ts`
  - **作者**：@nczitzk

#### 首页

- **路由**：`/gelonghui/home/:tag?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/gelonghui/live
  - **源代码**：`/gelonghui/home.ts`

</details>

### 每经网
<a id="每经网"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 分类

- **路由**：`/nbd/:id?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/nbd
  - **源代码**：`/nbd/index.ts`
  - **作者**：@nczitzk

#### 重磅原创

- **路由**：`/nbd/daily` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/nbd/daily
  - **源代码**：`/nbd/daily.ts`
  - **作者**：@yuuow

</details>

### 汇通网
<a id="汇通网"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 7x24 小时快讯

- **路由**：`/fx678/kx` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/fx678/kx
  - **源代码**：`/fx678/kx.ts`
  - **作者**：@occupy5, @dousha

</details>

### 法布财经
<a id="法布财经"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 快讯

- **路由**：`/fastbull/express-news` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/fastbull/express-news
  - **源代码**：`/fastbull/express-news.ts`
  - **作者**：@nczitzk

#### 新闻

- **路由**：`/fastbull/news,/` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/fastbull/express-news
  - **源代码**：`/fastbull/news.ts`
  - **作者**：@nczitzk
- **路由**：`/fastbull/news,/` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/fastbull/news
  - **源代码**：`/fastbull/news.ts`
  - **作者**：@nczitzk

</details>

### 淘股吧
<a id="淘股吧"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 用户博客

- **路由**：`/taoguba/blog/:id,/user/:id` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/techflowpost/express
  - **源代码**：`/taoguba/blog.ts`
  - **作者**：@nczitzk
- **路由**：`/taoguba/blog/:id,/user/:id` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/taoguba/blog/252069
  - **源代码**：`/taoguba/blog.ts`
  - **作者**：@nczitzk

</details>

### 深圳证券交易所
<a id="深圳证券交易所"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 上市公告 - 可转换债券

- **路由**：`/szse/notice` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/szse/notice
  - **源代码**：`/szse/notice.ts`
  - **作者**：@Jeason0228, @nczitzk

#### 创业板项目动态

- **路由**：`/szse/projectdynamic/:type?/:stage?/:status?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/sse/disclosure/beginDate=2018-08-18&endDate=2020-08-25&productId=600696
  - **源代码**：`/szse/projectdynamic.ts`
  - **作者**：@nczitzk

#### 最新规则

- **路由**：`/szse/rule` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/szse/rule
  - **源代码**：`/szse/rule.ts`
  - **作者**：@nczitzk

#### 问询函件

- **路由**：`/szse/inquire/:category?/:select?/:keyword?` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/szse/notice
  - **源代码**：`/szse/inquire.ts`
  - **作者**：@Jeason0228, @nczitzk

</details>

### 深潮 TechFlow
<a id="深潮-techflow"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 快讯

- **路由**：`/techflowpost/express,/newsflash` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/szse/rule
  - **源代码**：`/techflowpost/express.ts`
  - **作者**：@nczitzk
- **路由**：`/techflowpost/express,/newsflash` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/techflowpost/express
  - **源代码**：`/techflowpost/express.ts`
  - **作者**：@nczitzk

</details>

### 百度
<a id="百度"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 首页指数

- **路由**：`/baidu/gushitong/index` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/baidu/gushitong/index
  - **源代码**：`/baidu/gushitong/index.ts`
  - **作者**：@CaoMeiYouRen

</details>

### 老虎社区
<a id="老虎社区"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 个人主页

- **路由**：`/laohu8/personal/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/laohu8/personal/3527667596890271
  - **源代码**：`/laohu8/personal.ts`
  - **作者**：@Fatpandac

</details>

### 证券时报网
<a id="证券时报网"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 栏目

- **路由**：`/stcn/:id?`
  - **示例**：https://rsshub.app/stcn/yw
  - **源代码**：`/stcn/index.ts`
  - **作者**：@nczitzk

</details>

### 财经网
<a id="财经网"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 滚动新闻

- **路由**：`/caijing/roll` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/caijing/roll
  - **源代码**：`/caijing/roll.ts`
  - **作者**：@TonyRL

</details>

### 财联社
<a id="财联社"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 深度

- **路由**：`/cls/depth/:category?` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/cls/hot
  - **源代码**：`/cls/depth.ts`
  - **作者**：@5upernova-heng, @nczitzk

#### 热门文章排行榜

- **路由**：`/cls/hot` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/cls/hot
  - **源代码**：`/cls/hot.ts`
  - **作者**：@5upernova-heng, @nczitzk

#### 电报

- **路由**：`/cls/telegraph/:category?` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/caijing/roll
  - **源代码**：`/cls/telegraph.ts`
  - **作者**：@TonyRL

</details>

### 金十数据
<a id="金十数据"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 主题文章

- **路由**：`/jin10/topic/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/jin10
  - **源代码**：`/jin10/topic.ts`
  - **作者**：@laampui

#### 市场快讯

- **路由**：`/jin10/:important?` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/fx678/kx
  - **源代码**：`/jin10/index.ts`
  - **作者**：@occupy5, @dousha

</details>

### 金色财经
<a id="金色财经"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 分类

- **路由**：`/jinse/:category?`
  - **示例**：https://rsshub.app/jin10/topic/396
  - **源代码**：`/jinse/catalogue.ts`
  - **作者**：@miles170

#### 快讯

- **路由**：`/jinse/lives/:category?`
  - **示例**：https://rsshub.app/jinse/lives
  - **源代码**：`/jinse/lives.ts`
  - **作者**：@nczitzk

#### 首页

- **路由**：`/jinse/timeline/:category?`
  - **示例**：https://rsshub.app/jinse/lives
  - **源代码**：`/jinse/timeline.ts`
  - **作者**：@nczitzk

</details>

### 雪球
<a id="雪球"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 今日话题

- **路由**：`/xueqiu/today` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/xueqiu/today
  - **源代码**：`/xueqiu/today.ts`
  - **作者**：@nczitzk

#### 热帖

- **路由**：`/xueqiu/hots` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/xueqiu/today
  - **源代码**：`/xueqiu/hots.ts`
  - **作者**：@nczitzk

#### 用户专栏

- **路由**：`/xueqiu/column/:id` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/xueqiu/hots
  - **源代码**：`/xueqiu/column.ts`
  - **作者**：@hillerliao

#### 用户动态

- **路由**：`/xueqiu/user/:id/:type?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/xueqiu/user_stock/1247347556
  - **源代码**：`/xueqiu/user.ts`
  - **作者**：@hillerliao

#### 用户收藏动态

- **路由**：`/xueqiu/favorite/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/xueqiu/column/9962554712
  - **源代码**：`/xueqiu/favorite.ts`
  - **作者**：@TonyRL

#### 用户自选动态

- **路由**：`/xueqiu/user_stock/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/xueqiu/favorite/8152922548
  - **源代码**：`/xueqiu/user-stock.ts`
  - **作者**：@imlonghao

#### 组合最新调仓信息

- **路由**：`/xueqiu/snb/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/xueqiu/snb/ZH1288184
  - **源代码**：`/xueqiu/snb.ts`
  - **作者**：@ZhishanZhang

#### 股票信息

- **路由**：`/xueqiu/stock_info/:id/:type?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/xueqiu/stock_comments/SZ002626
  - **源代码**：`/xueqiu/stock-info.ts`

#### 股票评论

- **路由**：`/xueqiu/stock_comments/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/xueqiu/fund/040008
  - **源代码**：`/xueqiu/stock-comments.ts`
  - **作者**：@HenryQW, @NathanDai

#### 蛋卷基金净值更新

- **路由**：`/xueqiu/fund/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/ulapia/research/latest
  - **源代码**：`/xueqiu/fund.ts`

</details>

### 麦肯锡
<a id="麦肯锡"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 洞见

- **路由**：`/mckinsey/cn/:category?`
  - **示例**：https://rsshub.app/mckinsey/cn
  - **源代码**：`/mckinsey/cn/index.ts`
  - **作者**：@laampui

</details>
