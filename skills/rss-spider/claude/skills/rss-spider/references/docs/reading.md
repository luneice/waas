# 📚 阅读（reading）

本分类共 **32** 条路由。

## 使用方式（给 AI）

1. 先在本页的「服务总览」定位目标站点/服务。
2. 打开对应服务的折叠块，选择与你要订阅的「Feed」最匹配的一条路由。
3. 将路由模板里的 `:参数` 替换为具体值；`?` 表示可选段。
4. 若标注了「反爬严格/需要登录/需要 Cookie」等标签，优先使用自建实例并配置相应环境变量或代理。

## 服务总览（渐进式入口）

| 服务 | 路由数 |
|---|---:|
| [hameln](#hameln) | 1 |
| [Inoreader](#inoreader) | 1 |
| [Literotica](#literotica) | 1 |
| [MagazineLib](#magazinelib) | 1 |
| [Penguin Random House](#penguin-random-house) | 2 |
| [SF 轻小说](#sf-轻小说) | 1 |
| [SoBooks](#sobooks) | 3 |
| [syosetu](#syosetu) | 1 |
| [书伴](#书伴) | 1 |
| [刺猬猫](#刺猬猫) | 1 |
| [哩哔轻小说](#哩哔轻小说) | 1 |
| [日本語多読道場](#日本語多読道場) | 1 |
| [明月中文网](#明月中文网) | 2 |
| [晋江文学城](#晋江文学城) | 2 |
| [東立出版社](#東立出版社) | 1 |
| [欢乐书客](#欢乐书客) | 1 |
| [爱思想](#爱思想) | 3 |
| [起点](#起点) | 5 |
| [超星](#超星) | 1 |
| [轻小说文库](#轻小说文库) | 2 |

## 服务详情（按需展开）

### hameln
<a id="hameln"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### chapter

- **路由**：`/hameln/chapter/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/hameln/chapter/264928
  - **源代码**：`/hameln/chapter.ts`
  - **作者**：@huangliangshusheng

</details>

### Inoreader
<a id="inoreader"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### RSS

- **路由**：`/inoreader/rss/:user/:tag`
  - **示例**：https://rsshub.app/hameln/chapter/264928
  - **源代码**：`/inoreader/rss.ts`
  - **作者**：@EthanWng97

</details>

### Literotica
<a id="literotica"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### New Stories

- **路由**：`/literotica/new` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/literotica/new
  - **源代码**：`/literotica/new.ts`
  - **作者**：@nczitzk

</details>

### MagazineLib
<a id="magazinelib"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Latest Magazine

- **路由**：`/magazinelib/latest-magazine/:query?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/literotica/new
  - **源代码**：`/magazinelib/latest-magazine.ts`
  - **作者**：@nczitzk

</details>

### Penguin Random House
<a id="penguin-random-house"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Articles

- **路由**：`/penguin-random-house/articles` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/penguin-random-house/articles
  - **源代码**：`/penguin-random-house/articles.ts`
  - **作者**：@StevenRCE0

#### Book Lists

- **路由**：`/penguin-random-house/the-read-down` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/penguin-random-house/articles
  - **源代码**：`/penguin-random-house/thereaddown.ts`
  - **作者**：@StevenRCE0

</details>

### SF 轻小说
<a id="sf-轻小说"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 章节

- **路由**：`/sfacg/novel/chapter/:id` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/penguin-random-house/the-read-down
  - **源代码**：`/sfacg/novel-chapter.ts`
  - **作者**：@StevenRCE0

</details>

### SoBooks
<a id="sobooks"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 归档

- **路由**：`/sobooks/date/:date?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/sobooks/date/2020-11
  - **源代码**：`/sobooks/date.ts`
  - **作者**：@nczitzk

#### 标签

- **路由**：`/sobooks/tag/:id?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/sfacg/novel/chapter/672431
  - **源代码**：`/sobooks/tag.ts`
  - **作者**：@nczitzk

#### 首页

- **路由**：`/sobooks/:category?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/sobooks/date/2020-11
  - **源代码**：`/sobooks/index.ts`
  - **作者**：@nczitzk

</details>

### syosetu
<a id="syosetu"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### chapter

- **路由**：`/syosetu/chapter/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/syosetu/chapter/n1976ey
  - **源代码**：`/syosetu/chapter.ts`
  - **作者**：@huangliangshusheng

</details>

### 书伴
<a id="书伴"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 分类

- **路由**：`/bookfere/:category`
  - **示例**：https://rsshub.app/yomujp/n1
  - **源代码**：`/bookfere/category.ts`
  - **作者**：@eternasuno

</details>

### 刺猬猫
<a id="刺猬猫"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 章节

- **路由**：`/ciweimao/chapter/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/ciweimao/chapter/100043404
  - **源代码**：`/ciweimao/chapter.ts`
  - **作者**：@keocheung

</details>

### 哩哔轻小说
<a id="哩哔轻小说"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 小说更新

- **路由**：`/linovelib/novel/:id` `🚨 反爬严格`
  - **示例**：https://rsshub.app/jjwxc/book/7013024
  - **源代码**：`/linovelib/novel.ts`
  - **作者**：@misakicoca

</details>

### 日本語多読道場
<a id="日本語多読道場"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 等级

- **路由**：`/yomujp/:level?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/wenku8/volume/1163
  - **源代码**：`/yomujp/level.ts`
  - **作者**：@eternasuno

</details>

### 明月中文网
<a id="明月中文网"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 分类

- **路由**：`/56kog/class/:category?`
  - **示例**：https://rsshub.app/56kog/top/weekvisit
  - **源代码**：`/56kog/class.ts`
  - **作者**：@nczitzk

#### 榜单

- **路由**：`/56kog/top/:category?`
  - **示例**：https://rsshub.app/linovelib/novel/2547
  - **源代码**：`/56kog/top.ts`
  - **作者**：@misakicoca

</details>

### 晋江文学城
<a id="晋江文学城"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 作品

- **路由**：`/jjwxc/book/:id?`
  - **示例**：https://rsshub.app/jjwxc/author/4364484
  - **源代码**：`/jjwxc/book.ts`
  - **作者**：@nczitzk

#### 作者最新作品

- **路由**：`/jjwxc/author/:id?`
  - **示例**：https://rsshub.app/hbooker/chapter/100113279
  - **源代码**：`/jjwxc/author.ts`
  - **作者**：@keocheung

</details>

### 東立出版社
<a id="東立出版社"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 新聞

- **路由**：`/tongli/news/:type`
  - **示例**：https://rsshub.app/ciweimao/chapter/100043404
  - **源代码**：`/tongli/news.ts`
  - **作者**：@keocheung

</details>

### 欢乐书客
<a id="欢乐书客"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 章节

- **路由**：`/hbooker/chapter/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/tongli/news/6
  - **源代码**：`/hbooker/chapter.ts`
  - **作者**：@keocheung

</details>

### 爱思想
<a id="爱思想"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 专题

- **路由**：`/aisixiang/zhuanti/:id`
  - **示例**：https://rsshub.app/aisixiang/thinktank/WuQine/论文
  - **源代码**：`/aisixiang/zhuanti.ts`
  - **作者**：@nczitzk

#### 思想库（专栏）

- **路由**：`/aisixiang/thinktank/:id/:type?`
  - **示例**：https://rsshub.app/aisixiang/column/722
  - **源代码**：`/aisixiang/thinktank.ts`
  - **作者**：@HenryQW, @nczitzk

#### 栏目

- **路由**：`/aisixiang/column/:id`
  - **示例**：https://rsshub.app/syosetu/chapter/n1976ey
  - **源代码**：`/aisixiang/column.ts`
  - **作者**：@HenryQW, @nczitzk

</details>

### 起点
<a id="起点"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 作者

- **路由**：`/qidian/author/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/qidian/chapter/1010400217
  - **源代码**：`/qidian/author.ts`
  - **作者**：@fuzy112

#### 章节

- **路由**：`/qidian/chapter/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/qidian/free
  - **源代码**：`/qidian/chapter.ts`
  - **作者**：@LogicJake

#### 讨论区

- **路由**：`/qidian/forum/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/qidian/forum/1010400217
  - **源代码**：`/qidian/forum.ts`
  - **作者**：@fuzy112

#### 限时免费

- **路由**：`/qidian/free/:type?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/qidian/free-next
  - **源代码**：`/qidian/free.ts`
  - **作者**：@LogicJake

#### 限时免费下期预告

- **路由**：`/qidian/free-next/:type?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/qidian/forum/1010400217
  - **源代码**：`/qidian/free-next.ts`
  - **作者**：@fuzy112

</details>

### 超星
<a id="超星"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 期刊

- **路由**：`/chaoxing/qk/:id/:needContent?` `🚨 反爬严格`
  - **示例**：https://rsshub.app/chaoxing/qk/6b5c39b3dd84352be512e29df0297437
  - **源代码**：`/chaoxing/qk.ts`
  - **作者**：@nczitzk

</details>

### 轻小说文库
<a id="轻小说文库"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 最新卷

- **路由**：`/wenku8/volume/:id` `🚨 反爬严格`
  - **示例**：https://rsshub.app/wenku8/chapter/74
  - **源代码**：`/wenku8/volume.ts`
  - **作者**：@zsakvo

#### 章节

- **路由**：`/wenku8/chapter/:id` `🚨 反爬严格`
  - **示例**：https://rsshub.app/qidian/author/9639927
  - **源代码**：`/wenku8/chapter.ts`
  - **作者**：@zsakvo

</details>
