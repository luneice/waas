# 📰 传统媒体（traditional-media）

本分类共 **120** 条路由。

## 使用方式（给 AI）

1. 先在本页的「服务总览」定位目标站点/服务。
2. 打开对应服务的折叠块，选择与你要订阅的「Feed」最匹配的一条路由。
3. 将路由模板里的 `:参数` 替换为具体值；`?` 表示可选段。
4. 若标注了「反爬严格/需要登录/需要 Cookie」等标签，优先使用自建实例并配置相应环境变量或代理。

## 服务总览（渐进式入口）

| 服务 | 路由数 |
|---|---:|
| [AP News](#ap-news) | 1 |
| [Caixin Global](#caixin-global) | 1 |
| [Canadian Broadcasting Corporation](#canadian-broadcasting-corporation) | 1 |
| [CNBC](#cnbc) | 1 |
| [Corona Virus Disease 2019](#corona-virus-disease-2019) | 2 |
| [DNA India](#dna-india) | 2 |
| [Ekantipur / कान्तिपुर (Nepal)的直接链接")](#ekantipur--कनतपर-nepal的直接链接) | 1 |
| [Financial Times](#financial-times) | 2 |
| [Korean Central News Agency (KCNA) 朝鲜中央通讯社 朝鲜中央通讯社的直接链接")](#korean-central-news-agency-kcna-朝鲜中央通讯社-朝鲜中央通讯社的直接链接) | 1 |
| [La Jornada](#la-jornada) | 1 |
| [National Public Radio](#national-public-radio) | 1 |
| [NHK](#nhk) | 2 |
| [Now 新聞](#now-新聞) | 1 |
| [Radio Free Asia (RFA) 自由亚洲电台 自由亚洲电台的直接链接")](#radio-free-asia-rfa-自由亚洲电台-自由亚洲电台的直接链接) | 1 |
| [Reuters 路透社](#reuters-路透社) | 2 |
| [Rodong Sinmun 劳动新闻](#rodong-sinmun-劳动新闻) | 1 |
| [Russian News Agency TASS](#russian-news-agency-tass) | 1 |
| [Solidot](#solidot) | 1 |
| [Sputnik News 俄罗斯卫星通讯社](#sputnik-news-俄罗斯卫星通讯社) | 1 |
| [Taiwan News 台灣英文新聞](#taiwan-news-台灣英文新聞) | 1 |
| [The Atlantic](#the-atlantic) | 1 |
| [The Economist](#the-economist) | 3 |
| [The Hindu](#the-hindu) | 1 |
| [The New York Times 纽约时报](#the-new-york-times-纽约时报) | 3 |
| [The Nikkei 日本経済新聞](#the-nikkei-日本経済新聞) | 2 |
| [The Wall Street Journal (WSJ) 华尔街日报 华尔街日报的直接链接")](#the-wall-street-journal-wsj-华尔街日报-华尔街日报的直接链接) | 1 |
| [Voice of Mongolia 蒙古之声](#voice-of-mongolia-蒙古之声) | 1 |
| [Yomiuri Shimbun 読売新聞](#yomiuri-shimbun-読売新聞) | 1 |
| [三立新聞網](#三立新聞網) | 1 |
| [东方网](#东方网) | 3 |
| [东网](#东网) | 2 |
| [中国新闻周刊](#中国新闻周刊) | 1 |
| [中国环球电视网](#中国环球电视网) | 1 |
| [中国科技网](#中国科技网) | 1 |
| [中央通讯社](#中央通讯社) | 2 |
| [人民网](#人民网) | 2 |
| [信报财经新闻](#信报财经新闻) | 1 |
| [公視新聞網](#公視新聞網) | 3 |
| [共同网](#共同网) | 1 |
| [内蒙古广播电视台](#内蒙古广播电视台) | 1 |
| [北极星电力网](#北极星电力网) | 2 |
| [华尔街见闻](#华尔街见闻) | 2 |
| [南方网](#南方网) | 2 |
| [南方都市报](#南方都市报) | 2 |
| [厦门网](#厦门网) | 1 |
| [参考消息](#参考消息) | 2 |
| [四川广播电视台](#四川广播电视台) | 1 |
| [天下雜誌](#天下雜誌) | 4 |
| [央视新闻](#央视新闻) | 4 |
| [客家電視台](#客家電視台) | 1 |
| [希望之声](#希望之声) | 1 |
| [广州日报](#广州日报) | 1 |
| [新华每日电讯](#新华每日电讯) | 1 |
| [新唐人电视台](#新唐人电视台) | 1 |
| [新快报](#新快报) | 1 |
| [新蓝网（浙江广播电视集团）](#新蓝网浙江广播电视集团) | 2 |
| [无线新闻](#无线新闻) | 1 |
| [河北网络广播电视台](#河北网络广播电视台) | 1 |
| [浙江在线](#浙江在线) | 1 |
| [湖南日报](#湖南日报) | 1 |
| [澎湃新闻](#澎湃新闻) | 4 |
| [环球网](#环球网) | 1 |
| [理论网](#理论网) | 1 |
| [第一财经](#第一财经) | 9 |
| [羊城晚报金羊网](#羊城晚报金羊网) | 1 |
| [联合早报](#联合早报) | 4 |
| [聯合新聞網](#聯合新聞網) | 3 |
| [華視](#華視) | 1 |
| [财新博客](#财新博客) | 6 |
| [香港经济日报](#香港经济日报) | 1 |

## 服务详情（按需展开）

### AP News
<a id="ap-news"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Topics

- **路由**：`/apnews/topics/:topic?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/apnews/topics/apf-topnews>![
  - **源代码**：`/apnews/topics.ts`
  - **作者**：@zoenglinghou, @mjysci, @TonyRL

</details>

### Caixin Global
<a id="caixin-global"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Latest News

- **路由**：`/caixinglobal/latest` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/apnews/topics/apf-topnews>![
  - **源代码**：`/caixinglobal/latest.ts`
  - **作者**：@TonyRL

</details>

### Canadian Broadcasting Corporation
<a id="canadian-broadcasting-corporation"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### News

- **路由**：`/cbc/topics/:topic?` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/caixinglobal/latest>![
  - **源代码**：`/cbc/topics.ts`
  - **作者**：@TonyRL

</details>

### CNBC
<a id="cnbc"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Full article RSS

- **路由**：`/cnbc/rss/:id?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/cbc/topics>![
  - **源代码**：`/cnbc/rss.ts`
  - **作者**：@TonyRL

</details>

### Corona Virus Disease 2019
<a id="corona-virus-disease-2019"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### News

- **路由**：`/scmp/:category_id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/scmp/3>![
  - **源代码**：`/scmp/index.ts`
  - **作者**：@proletarius101

#### Topics

- **路由**：`/scmp/topics/:topic` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/scmp/3>![
  - **源代码**：`/scmp/topic.ts`
  - **作者**：@TonyRL

</details>

### DNA India
<a id="dna-india"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### News

- **路由**：`/dnaindia/:category,/topic/:topic` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/scmp/topics/coronavirus-pandemic-all-stories>![
  - **源代码**：`/dnaindia/category.ts`
  - **作者**：@Rjnishant530
- **路由**：`/dnaindia/:category,/topic/:topic` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/dnaindia/headlines>![
  - **源代码**：`/dnaindia/category.ts`
  - **作者**：@Rjnishant530

</details>

### Ekantipur / कान्तिपुर (Nepal)的直接链接")
<a id="ekantipur--कनतपर-nepal的直接链接"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Full Article RSS

- **路由**：`/ekantipur/:channel?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/ekantipur/news>![
  - **源代码**：`/ekantipur/issue.ts`
  - **作者**：@maniche04

</details>

### Financial Times
<a id="financial-times"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### FT 中文网

- **路由**：`/ft/:language/:channel?`
  - **示例**：https://rsshub.app/ft/chinese/hotstoryby7day>![
  - **源代码**：`/ft/channel.ts`
  - **作者**：@HenryQW, @xyqfer

#### myFT personal RSS

- **路由**：`/ft/myft/:key`
  - **示例**：https://rsshub.app/ft/myft/rss-key>![
  - **源代码**：`/ft/myft.ts`
  - **作者**：@HenryQW

</details>

### Korean Central News Agency (KCNA) 朝鲜中央通讯社 朝鲜中央通讯社的直接链接")
<a id="korean-central-news-agency-kcna-朝鲜中央通讯社-朝鲜中央通讯社的直接链接"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### News

- **路由**：`/kcna/:lang/:category?` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/kcna/en>![
  - **源代码**：`/kcna/news.ts`
  - **作者**：@Rongronggg9

</details>

### La Jornada
<a id="la-jornada"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### News

- **路由**：`/jornada/:date?/:category?`
  - **示例**：https://rsshub.app/jornada/2022-10-12/capital>![
  - **源代码**：`/jornada/index.ts`
  - **作者**：@Thealf154

</details>

### National Public Radio
<a id="national-public-radio"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### News

- **路由**：`/npr/:endpoint?`
  - **示例**：https://rsshub.app/npr/1001>![
  - **源代码**：`/npr/full.ts`
  - **作者**：@bennyyip

</details>

### NHK
<a id="nhk"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### News Web Easy

- **路由**：`/nhk/news_web_easy` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/nhk/news_web_easy>![
  - **源代码**：`/nhk/news-web-easy.ts`
  - **作者**：@Andiedie

#### WORLD-JAPAN - Top Stories

- **路由**：`/nhk/news/:lang?` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/nhk/news_web_easy>![
  - **源代码**：`/nhk/news.ts`
  - **作者**：@Andiedie

</details>

### Now 新聞
<a id="now-新聞"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 新聞

- **路由**：`/now/news/:category?/:id?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/now/news>![
  - **源代码**：`/now/news.ts`
  - **作者**：@nczitzk

</details>

### Radio Free Asia (RFA) 自由亚洲电台 自由亚洲电台的直接链接")
<a id="radio-free-asia-rfa-自由亚洲电台-自由亚洲电台的直接链接"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### News

- **路由**：`/rfa/:language?/:channel?/:subChannel?`
  - **示例**：https://rsshub.app/reuters/investigates>![
  - **源代码**：`/rfa/index.ts`
  - **作者**：@LyleLee

</details>

### Reuters 路透社
<a id="reuters-路透社"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Category/Topic/Author

- **路由**：`/reuters/:category/:topic?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/reuters/world/us>![
  - **源代码**：`/reuters/common.ts`
  - **作者**：@LyleLee, @HenryQW, @proletarius101, @black-desk, @nczitzk

#### Inverstigates

- **路由**：`/reuters/investigates`
  - **示例**：https://rsshub.app/reuters/investigates>![
  - **源代码**：`/reuters/investigates.ts`
  - **作者**：@LyleLee

</details>

### Rodong Sinmun 劳动新闻
<a id="rodong-sinmun-劳动新闻"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### News

- **路由**：`/rodong/news/:language?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/rodong/news>![
  - **源代码**：`/rodong/news.ts`
  - **作者**：@TonyRL

</details>

### Russian News Agency TASS
<a id="russian-news-agency-tass"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### News

- **路由**：`/tass/:category?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/tass/politics>![
  - **源代码**：`/tass/news.ts`
  - **作者**：@TonyRL

</details>

### Solidot
<a id="solidot"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 最新消息

- **路由**：`/solidot/:type?`
  - **示例**：https://rsshub.app/solidot/linux>![
  - **源代码**：`/solidot/main.ts`
  - **作者**：@sgqy, @hang333, @TonyRL

</details>

### Sputnik News 俄罗斯卫星通讯社
<a id="sputnik-news-俄罗斯卫星通讯社"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Category

- **路由**：`/sputniknews/:category?/:language?`
  - **示例**：https://rsshub.app/sputniknews>![
  - **源代码**：`/sputniknews/index.ts`
  - **作者**：@nczitzk

</details>

### Taiwan News 台灣英文新聞
<a id="taiwan-news-台灣英文新聞"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Hot News

- **路由**：`/taiwannews/hot/:lang?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/nytimes/daily_briefing_chinese>![
  - **源代码**：`/taiwannews/hot.ts`
  - **作者**：@yueyericardo, @nczitzk

</details>

### The Atlantic
<a id="the-atlantic"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### News

- **路由**：`/theatlantic/:category` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/taiwannews/hot>![
  - **源代码**：`/theatlantic/news.ts`
  - **作者**：@EthanWng97

</details>

### The Economist
<a id="the-economist"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Category

- **路由**：`/economist/:endpoint` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/economist/latest>![
  - **源代码**：`/economist/full.ts`
  - **作者**：@ImSingee

#### Espresso

- **路由**：`/economist/espresso` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/economist/latest>![
  - **源代码**：`/economist/espresso.ts`
  - **作者**：@ImSingee

#### Global Business Review

- **路由**：`/economist/global-business-review/:language?` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/economist/espresso>![
  - **源代码**：`/economist/global-business-review.ts`
  - **作者**：@TonyRL

</details>

### The Hindu
<a id="the-hindu"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Topic

- **路由**：`/thehindu/topic/:topic` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/thehindu/topic/rains>![
  - **源代码**：`/thehindu/topic.ts`
  - **作者**：@TonyRL

</details>

### The New York Times 纽约时报
<a id="the-new-york-times-纽约时报"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Best Seller Books

- **路由**：`/nytimes/book/:category?` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/nikkei/asia>![
  - **源代码**：`/nytimes/book.ts`
  - **作者**：@rainrdx

#### News

- **路由**：`/nytimes/:lang?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/nytimes/dual>![
  - **源代码**：`/nytimes/index.ts`
  - **作者**：@HenryQW

#### 新闻简报

- **路由**：`/nytimes/daily_briefing_chinese` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/nytimes/daily_briefing_chinese>![
  - **源代码**：`/nytimes/daily-briefing-chinese.ts`
  - **作者**：@yueyericardo, @nczitzk

</details>

### The Nikkei 日本経済新聞
<a id="the-nikkei-日本経済新聞"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### News

- **路由**：`/nikkei/:category/:article_type?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/economist/global-business-review/cn-en>![
  - **源代码**：`/nikkei/news.ts`
  - **作者**：@Arracc

#### Nikkei Asia Latest News

- **路由**：`/nikkei/asia` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/nikkei/asia>![
  - **源代码**：`/nikkei/asia/index.ts`
  - **作者**：@rainrdx

</details>

### The Wall Street Journal (WSJ) 华尔街日报 华尔街日报的直接链接")
<a id="the-wall-street-journal-wsj-华尔街日报-华尔街日报的直接链接"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### News

- **路由**：`/wsj/:lang/:category?`
  - **示例**：https://rsshub.app/thehindu/topic/rains>![
  - **源代码**：`/wsj/news.ts`
  - **作者**：@TonyRL

</details>

### Voice of Mongolia 蒙古之声
<a id="voice-of-mongolia-蒙古之声"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### News

- **路由**：`/vom/featured/:lang?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/vom/featured>![
  - **源代码**：`/vom/featured.ts`
  - **作者**：@TonyRL

</details>

### Yomiuri Shimbun 読売新聞
<a id="yomiuri-shimbun-読売新聞"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### News

- **路由**：`/yomiuri/:category?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/yomiuri/news>![
  - **源代码**：`/yomiuri/news.ts`
  - **作者**：@Arracc

</details>

### 三立新聞網
<a id="三立新聞網"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 新聞

- **路由**：`/setn/:category?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/setn>![
  - **源代码**：`/setn/index.ts`
  - **作者**：@nczitzk

</details>

### 东方网
<a id="东方网"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 24 小时热闻

- **路由**：`/eastday/24/:category?` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/yicai/latest>![
  - **源代码**：`/eastday/24.ts`
  - **作者**：@nczitzk

#### 上海新闻

- **路由**：`/eastday/sh` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/eastday/sh>![
  - **源代码**：`/eastday/sh.ts`
  - **作者**：@saury

#### 原创

- **路由**：`/eastday/portrait` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/eastday/sh>![
  - **源代码**：`/eastday/portrait.ts`
  - **作者**：@saury

</details>

### 东网
<a id="东网"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Money18

- **路由**：`/oncc/money18/:id?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/eastday/portrait>![
  - **源代码**：`/oncc/money18.ts`
  - **作者**：@nczitzk

#### 即時新聞

- **路由**：`/oncc/:language/:channel?`
  - **示例**：https://rsshub.app/oncc/money18/exp>![
  - **源代码**：`/oncc/index.ts`
  - **作者**：@Fatpandac

</details>

### 中国新闻周刊
<a id="中国新闻周刊"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 栏目

- **路由**：`/inewsweek/:channel` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/inewsweek/survey>![
  - **源代码**：`/inewsweek/index.ts`
  - **作者**：@changren-wcr

</details>

### 中国环球电视网
<a id="中国环球电视网"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 播客

- **路由**：`/cgtn/podcast/:category/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/cgtn/podcast/ezfm/4>![
  - **源代码**：`/cgtn/podcast.ts`
  - **作者**：@5upernova-heng

</details>

### 中国科技网
<a id="中国科技网"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 科技日报

- **路由**：`/stdaily/digitalpaper`
  - **示例**：https://rsshub.app/stdaily/digitalpaper>![
  - **源代码**：`/stdaily/digitalpaper.ts`
  - **作者**：@lyqluis

</details>

### 中央通讯社
<a id="中央通讯社"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Unknown

- **路由**：`/cna/web/:id?`
  - **示例**：https://rsshub.app/cna/web/aall>![
  - **源代码**：`/cna/web/index.ts`
  - **作者**：@dzx-dzx

#### 分类

- **路由**：`/cna/:id?`
  - **示例**：https://rsshub.app/cna/web/aall>![
  - **源代码**：`/cna/index.ts`
  - **作者**：@dzx-dzx

</details>

### 人民网
<a id="人民网"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 习近平系列重要讲话

- **路由**：`/people/xjpjh/:keyword?/:year?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/people/xjpjh>![
  - **源代码**：`/people/xjpjh.ts`

#### 领导留言板

- **路由**：`/people/liuyan/:id/:state?` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/thepaper/featured>![
  - **源代码**：`/people/liuyan.ts`
  - **作者**：@HenryQW, @nczitzk, @bigfei

</details>

### 信报财经新闻
<a id="信报财经新闻"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 即时新闻

- **路由**：`/hkej/:category?` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/hkej/index>![
  - **源代码**：`/hkej/index.ts`
  - **作者**：@TonyRL

</details>

### 公視新聞網
<a id="公視新聞網"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 專題策展

- **路由**：`/pts/curations` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/pts/live/62e8e4bbb4de2cbd74468b2b>![
  - **源代码**：`/pts/curations.ts`

#### 整理報導

- **路由**：`/pts/live/:id` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/pts/projects>![
  - **源代码**：`/pts/live.ts`
  - **作者**：@nczitzk

#### 數位敘事

- **路由**：`/pts/projects` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/pts/projects>![
  - **源代码**：`/pts/projects.ts`
  - **作者**：@nczitzk

</details>

### 共同网
<a id="共同网"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 最新报道

- **路由**：`/kyodonews/:language?/:keyword?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/pts/curations>![
  - **源代码**：`/kyodonews/index.ts`
  - **作者**：@nczitzk

</details>

### 内蒙古广播电视台
<a id="内蒙古广播电视台"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 点播

- **路由**：`/nmtv/column/:id?`
  - **示例**：https://rsshub.app/southcn/nfapp/reporter/969927791>![
  - **源代码**：`/nmtv/column.ts`
  - **作者**：@nczitzk

</details>

### 北极星电力网
<a id="北极星电力网"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 光伏

- **路由**：`/bjx/gf/:type`
  - **示例**：https://rsshub.app/bjx/gf/sc>![
  - **源代码**：`/bjx/types.ts`
  - **作者**：@Sxuet

#### 环保要闻

- **路由**：`/bjx/huanbao` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bjx/huanbao>![
  - **源代码**：`/bjx/huanbao.ts`
  - **作者**：@zsimple

</details>

### 华尔街见闻
<a id="华尔街见闻"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 实时快讯

- **路由**：`/wallstreetcn/live/:category?/:score?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/wallstreetcn/live>![
  - **源代码**：`/wallstreetcn/live.ts`
  - **作者**：@nczitzk

#### 最热文章

- **路由**：`/wallstreetcn/hot/:period?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/wallstreetcn/hot>![
  - **源代码**：`/wallstreetcn/hot.ts`
  - **作者**：@nczitzk

</details>

### 南方网
<a id="南方网"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 南方 +（按作者）

- **路由**：`/southcn/nfapp/reporter/:reporter`
  - **示例**：https://rsshub.app/southcn/nfapp/reporter/969927791>![
  - **源代码**：`/southcn/nfapp/reporter.ts`
  - **作者**：@TimWu007

#### 南方 +（按栏目 ID）

- **路由**：`/southcn/nfapp/column/:column?`
  - **示例**：https://rsshub.app/oeeee/app/reporter/249>![
  - **源代码**：`/southcn/nfapp/column.ts`
  - **作者**：@TimWu007

</details>

### 南方都市报
<a id="南方都市报"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 南都客户端（按记者）

- **路由**：`/oeeee/app/reporter/:id`
  - **示例**：https://rsshub.app/oeeee/web/170>![
  - **源代码**：`/oeeee/app/reporter.ts`
  - **作者**：@TimWu007

#### 奥一网

- **路由**：`/oeeee/web/:channel`
  - **示例**：https://rsshub.app/oeeee/web/170>![
  - **源代码**：`/oeeee/web.ts`
  - **作者**：@TimWu007

</details>

### 厦门网
<a id="厦门网"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 数字媒体

- **路由**：`/xmnn/epaper/:id?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/xmnn/epaper/xmrb>![
  - **源代码**：`/xmnn/epaper.ts`
  - **作者**：@nczitzk

</details>

### 参考消息
<a id="参考消息"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 栏目

- **路由**：`/cankaoxiaoxi/column/:id?,/:id?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/caixin/latest>![
  - **源代码**：`/cankaoxiaoxi/index.ts`
  - **作者**：@tpnonthealps
- **路由**：`/cankaoxiaoxi/column/:id?,/:id?`
  - **示例**：https://rsshub.app/cankaoxiaoxi/column/diyi>![
  - **源代码**：`/cankaoxiaoxi/index.ts`
  - **作者**：@yuxinliu-alex, @nczitzk

</details>

### 四川广播电视台
<a id="四川广播电视台"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 电视回放

- **路由**：`/sctv/programme/:id?/:limit?/:isFull?`
  - **示例**：https://rsshub.app/sctv/programme/1>![
  - **源代码**：`/sctv/programme.ts`
  - **作者**：@nczitzk

</details>

### 天下雜誌
<a id="天下雜誌"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 主頻道

- **路由**：`/cw/master/:channel`
  - **示例**：https://rsshub.app/cw/master/8>![
  - **源代码**：`/cw/master.ts`
  - **作者**：@TonyRL

#### 作者

- **路由**：`/cw/author/:channel` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/cw/today>![
  - **源代码**：`/cw/author.ts`
  - **作者**：@TonyRL

#### 子頻道

- **路由**：`/cw/sub/:channel` `🚨 反爬严格`
  - **示例**：https://rsshub.app/cw/sub/615>![
  - **源代码**：`/cw/sub.ts`
  - **作者**：@TonyRL

#### 最新上線

- **路由**：`/cw/today`
  - **示例**：https://rsshub.app/cw/sub/615>![
  - **源代码**：`/cw/today.ts`
  - **作者**：@TonyRL

</details>

### 央视新闻
<a id="央视新闻"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 专题

- **路由**：`/cctv/:category` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/cctv/photo/jx>![
  - **源代码**：`/cctv/category.ts`
  - **作者**：@nczitzk

#### 央视网图片《镜象》

- **路由**：`/cctv/photo/jx` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/cctv/xwlb>![
  - **源代码**：`/cctv/jx.ts`
  - **作者**：@zengxs

#### 新闻联播

- **路由**：`/cctv/xwlb` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/cctv/xwlb>![
  - **源代码**：`/cctv/xwlb.ts`
  - **作者**：@zengxs

#### 栏目

- **路由**：`/cctv/lm/:id?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/cctv/lm/xwzk>![
  - **源代码**：`/cctv/lm.ts`
  - **作者**：@nczitzk

</details>

### 客家電視台
<a id="客家電視台"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 新聞首頁

- **路由**：`/hakkatv/news/:type?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/hakkatv/news>![
  - **源代码**：`/hakkatv/type.ts`
  - **作者**：@TonyRL

</details>

### 希望之声
<a id="希望之声"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 频道

- **路由**：`/soundofhope/:channel/:id` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/soundofhope/term/203>![
  - **源代码**：`/soundofhope/channel.ts`
  - **作者**：@Fatpandac

</details>

### 广州日报
<a id="广州日报"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 客户端

- **路由**：`/gzdaily/app/:column?`
  - **示例**：https://rsshub.app/gzdaily/app/74>![
  - **源代码**：`/gzdaily/app.ts`
  - **作者**：@TimWu007

</details>

### 新华每日电讯
<a id="新华每日电讯"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 今日

- **路由**：`/mrdx/today` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/cztv/zjxwlb>![
  - **源代码**：`/mrdx/daily.ts`
  - **作者**：@yhkang

</details>

### 新唐人电视台
<a id="新唐人电视台"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 频道

- **路由**：`/ntdtv/:language/:id` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/mrdx/today>![
  - **源代码**：`/ntdtv/channel.ts`
  - **作者**：@Dustin-Jiang

</details>

### 新快报
<a id="新快报"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 新闻

- **路由**：`/xkb/:channel`
  - **示例**：https://rsshub.app/xkb/350>![
  - **源代码**：`/xkb/index.ts`
  - **作者**：@TimWu007

</details>

### 新蓝网（浙江广播电视集团）
<a id="新蓝网浙江广播电视集团"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 浙江新闻联播

- **路由**：`/cztv/zjxwlb` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/cztv/zjxwlb/daily>![
  - **源代码**：`/cztv/zjxwlb.ts`
  - **作者**：@yhkang

#### 浙江新闻联播 - 每日合集

- **路由**：`/cztv/zjxwlb/daily` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/cztv/zjxwlb/daily>![
  - **源代码**：`/cztv/daily.ts`
  - **作者**：@yhkang

</details>

### 无线新闻
<a id="无线新闻"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 新闻

- **路由**：`/tvb/news/:category?/:language?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/cw/author/57>![
  - **源代码**：`/tvb/news.ts`
  - **作者**：@nczitzk

</details>

### 河北网络广播电视台
<a id="河北网络广播电视台"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 农博士在行动

- **路由**：`/hebtv/nbszxd`
  - **示例**：https://rsshub.app/hebtv/nbszxd>![
  - **源代码**：`/hebtv/nong-bo-shi-zai-xing-dong.ts`
  - **作者**：@iamqiz, @nczitzk

</details>

### 浙江在线
<a id="浙江在线"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 浙报集团系列报刊

- **路由**：`/zjol/paper/:id?`
  - **示例**：https://rsshub.app/zjol/paper/zjrb>![
  - **源代码**：`/zjol/paper.ts`
  - **作者**：@nczitzk

</details>

### 湖南日报
<a id="湖南日报"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 电子刊物

- **路由**：`/hnrb/:id?` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/hebtv/nbszxd>![
  - **源代码**：`/hnrb/index.ts`
  - **作者**：@iamqiz, @nczitzk

</details>

### 澎湃新闻
<a id="澎湃新闻"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 明查

- **路由**：`/thepaper/factpaper/:status?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/thepaper/factpaper>![
  - **源代码**：`/thepaper/factpaper.ts`
  - **作者**：@nczitzk

#### 栏目

- **路由**：`/thepaper/list/:id`
  - **示例**：https://rsshub.app/thepaper/list/25457>![
  - **源代码**：`/thepaper/list.ts`
  - **作者**：@nczitzk, @bigfei

#### 频道

- **路由**：`/thepaper/channel/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/thepaper/factpaper>![
  - **源代码**：`/thepaper/channel.ts`
  - **作者**：@nczitzk

#### 首页头条

- **路由**：`/thepaper/featured` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/thepaper/featured>![
  - **源代码**：`/thepaper/featured.ts`
  - **作者**：@HenryQW, @nczitzk, @bigfei

</details>

### 环球网
<a id="环球网"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 分类

- **路由**：`/huanqiu/news/:category?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/huanqiu/news/china>![
  - **源代码**：`/huanqiu/index.ts`
  - **作者**：@yuxinliu-alex

</details>

### 理论网
<a id="理论网"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 学习时报

- **路由**：`/cntheory/paper/:id?`
  - **示例**：https://rsshub.app/cntheory/paper>![
  - **源代码**：`/cntheory/paper.ts`
  - **作者**：@nczitzk

</details>

### 第一财经
<a id="第一财经"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### DT 财经

- **路由**：`/yicai/dt/:column?/:category?`
  - **示例**：https://rsshub.app/yicai/dt/article>![
  - **源代码**：`/yicai/dt.ts`
  - **作者**：@nczitzk

#### VIP 频道

- **路由**：`/yicai/vip/:id?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/yicai/vip/428>![
  - **源代码**：`/yicai/vip.ts`
  - **作者**：@nczitzk

#### 一财号

- **路由**：`/yicai/author/:id?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/yicai/author/100005663>![
  - **源代码**：`/yicai/author.ts`
  - **作者**：@nczitzk

#### 关注

- **路由**：`/yicai/feed/:id?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/yicai/vip/428>![
  - **源代码**：`/yicai/feed.ts`
  - **作者**：@nczitzk

#### 头条

- **路由**：`/yicai/headline` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/yicai/headline>![
  - **源代码**：`/yicai/headline.ts`
  - **作者**：@nczitzk

#### 新闻

- **路由**：`/yicai/news/:id?` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/yicai/headline>![
  - **源代码**：`/yicai/news.ts`
  - **作者**：@nczitzk

#### 最新

- **路由**：`/yicai/latest` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/yicai/brief>![
  - **源代码**：`/yicai/latest.ts`
  - **作者**：@sanmmm, @nczitzk

#### 正在

- **路由**：`/yicai/brief` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/yicai/author/100005663>![
  - **源代码**：`/yicai/brief.ts`
  - **作者**：@nczitzk

#### 视听

- **路由**：`/yicai/video/:id?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/yicai/video>![
  - **源代码**：`/yicai/video.ts`
  - **作者**：@nczitzk

</details>

### 羊城晚报金羊网
<a id="羊城晚报金羊网"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 新闻

- **路由**：`/ycwb/:node`
  - **示例**：https://rsshub.app/ycwb/1>![
  - **源代码**：`/ycwb/index.ts`
  - **作者**：@TimWu007

</details>

### 联合早报
<a id="联合早报"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 互动新闻

- **路由**：`/zaobao/interactive-graphics`
  - **示例**：https://rsshub.app/zaobao/interactive-graphics>![
  - **源代码**：`/zaobao/interactive.ts`
  - **作者**：@shunf4

#### 其他栏目

- **路由**：`/zaobao/:type?/:section?`
  - **示例**：https://rsshub.app/zaobao/realtime/china>![
  - **源代码**：`/zaobao/index.ts`
  - **作者**：@shunf4

#### 即时新闻

- **路由**：`/zaobao/realtime/:section?`
  - **示例**：https://rsshub.app/zaobao/interactive-graphics>![
  - **源代码**：`/zaobao/realtime.ts`
  - **作者**：@shunf4

#### 新闻

- **路由**：`/zaobao/znews/:section?`
  - **示例**：https://rsshub.app/zaobao/lifestyle/health>![
  - **源代码**：`/zaobao/znews.ts`
  - **作者**：@shunf4

</details>

### 聯合新聞網
<a id="聯合新聞網"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 即時新聞

- **路由**：`/udn/news/breakingnews/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/udn/news/breakingnews/99>![
  - **源代码**：`/udn/breaking-news.ts`
  - **作者**：@miles170

#### 轉角國際 - 標籤

- **路由**：`/udn/global/tag/:tag?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/udn/global/tag/過去24小時>![
  - **源代码**：`/udn/global/tag.ts`
  - **作者**：@emdoe, @nczitzk

#### 轉角國際 - 首頁

- **路由**：`/udn/global/:category?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/udn/global>![
  - **源代码**：`/udn/global/index.ts`
  - **作者**：@nczitzk

</details>

### 華視
<a id="華視"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 新聞

- **路由**：`/cts/:category` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/wallstreetcn/hot>![
  - **源代码**：`/cts/news.ts`
  - **作者**：@miles170

</details>

### 财新博客
<a id="财新博客"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 新闻分类

- **路由**：`/caixin/:column/:category`
  - **示例**：https://rsshub.app/caixin/article>![
  - **源代码**：`/caixin/category.ts`
  - **作者**：@EsuRt

#### 最新文章

- **路由**：`/caixin/latest` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/caixin/latest>![
  - **源代码**：`/caixin/latest.ts`
  - **作者**：@tpnonthealps

#### 财新一线

- **路由**：`/caixin/k` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/caixin/database>![
  - **源代码**：`/caixin/k.ts`
  - **作者**：@nczitzk

#### 财新周刊

- **路由**：`/caixin/weekly` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/caixin/k>![
  - **源代码**：`/caixin/weekly.ts`
  - **作者**：@boypt

#### 财新数据通

- **路由**：`/caixin/database` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bjx/huanbao>![
  - **源代码**：`/caixin/database.ts`
  - **作者**：@zsimple

#### 首页新闻

- **路由**：`/caixin/article` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/caixin/weekly>![
  - **源代码**：`/caixin/article.ts`
  - **作者**：@TonyRL

</details>

### 香港经济日报
<a id="香港经济日报"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 新闻

- **路由**：`/hket/:category?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/hket/sran001>![
  - **源代码**：`/hket/index.ts`
  - **作者**：@TonyRL

</details>
