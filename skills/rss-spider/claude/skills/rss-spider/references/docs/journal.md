# 🔬 科学期刊（journal）

本分类共 **41** 条路由。

## 使用方式（给 AI）

1. 先在本页的「服务总览」定位目标站点/服务。
2. 打开对应服务的折叠块，选择与你要订阅的「Feed」最匹配的一条路由。
3. 将路由模板里的 `:参数` 替换为具体值；`?` 表示可选段。
4. 若标注了「反爬严格/需要登录/需要 Cookie」等标签，优先使用自建实例并配置相应环境变量或代理。

## 服务总览（渐进式入口）

| 服务 | 路由数 |
|---|---:|
| [ACM Special Interest Group on Security Audit and Control](#acm-special-interest-group-on-security-audit-and-control) | 1 |
| [American Economic Association](#american-economic-association) | 1 |
| [American Institute of Physics](#american-institute-of-physics) | 1 |
| [Annual Reviews](#annual-reviews) | 1 |
| [BioOne](#bioone) | 2 |
| [caa.reviews](#caareviews) | 3 |
| [Google](#google) | 2 |
| [IEEE Computer Society](#ieee-computer-society) | 1 |
| [IEEE Xplore](#ieee-xplore) | 1 |
| [INFORMS](#informs) | 1 |
| [MDPI](#mdpi) | 1 |
| [National Bureau of Economic Research](#national-bureau-of-economic-research) | 2 |
| [Nature Journal](#nature-journal) | 5 |
| [Network and Distributed System Security (NDSS) Symposium Symposium的直接链接")](#network-and-distributed-system-security-ndss-symposium-symposium的直接链接) | 1 |
| [Oxford University Press](#oxford-university-press) | 1 |
| [Royal Society of Chemistry](#royal-society-of-chemistry) | 1 |
| [Science Magazine](#science-magazine) | 4 |
| [ScienceDirect](#sciencedirect) | 1 |
| [Springer](#springer) | 1 |
| [Telecompaper](#telecompaper) | 2 |
| [The University of Chicago Press: Journals](#the-university-of-chicago-press-journals) | 1 |
| [Trending Papers](#trending-papers) | 1 |
| [USENIX](#usenix) | 1 |
| [X-MOL](#x-mol) | 1 |
| [中国知网](#中国知网) | 3 |
| [管理世界](#管理世界) | 1 |

## 服务详情（按需展开）

### ACM Special Interest Group on Security Audit and Control
<a id="acm-special-interest-group-on-security-audit-and-control"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### The ACM Conference on Computer and Communications Security

- **路由**：`/sigsac/ccs` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/sigsac/ccs
  - **源代码**：`/sigsac/ccs.ts`

</details>

### American Economic Association
<a id="american-economic-association"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Journal

- **路由**：`/aeaweb/:id`
  - **示例**：https://rsshub.app/aeaweb/aer
  - **源代码**：`/aeaweb/index.ts`
  - **作者**：@nczitzk

</details>

### American Institute of Physics
<a id="american-institute-of-physics"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Journal

- **路由**：`/aip/:pub/:jrn`
  - **示例**：https://rsshub.app/aip/aapt/ajp
  - **源代码**：`/aip/journal.ts`
  - **作者**：@Derekmini, @auto-bot-ty

</details>

### Annual Reviews
<a id="annual-reviews"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Journal

- **路由**：`/annualreviews/:id`
  - **示例**：https://rsshub.app/annualreviews/anchem
  - **源代码**：`/annualreviews/index.ts`
  - **作者**：@nczitzk

</details>

### BioOne
<a id="bioone"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Featured articles

- **路由**：`/bioone/featured` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/sigsac/ccs
  - **源代码**：`/bioone/featured.ts`

#### Journals

- **路由**：`/bioone/journals/:journal?` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bioone/featured
  - **源代码**：`/bioone/journal.ts`
  - **作者**：@nczitzk

</details>

### caa.reviews
<a id="caareviews"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Book Reviews

- **路由**：`/caareviews/book` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bioone/journals/acta-chiropterologica
  - **源代码**：`/caareviews/book.ts`
  - **作者**：@Fatpandac

#### Essays

- **路由**：`/caareviews/essay` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/caareviews/book
  - **源代码**：`/caareviews/essay.ts`
  - **作者**：@Fatpandac

#### Exhibition Reviews

- **路由**：`/caareviews/exhibition` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/caareviews/essay
  - **源代码**：`/caareviews/exhibition.ts`
  - **作者**：@Fatpandac

</details>

### Google
<a id="google"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Author Citations

- **路由**：`/google/citations/:id` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/caareviews/exhibition
  - **源代码**：`/google/citations.ts`
  - **作者**：@Fatpandac

#### Keywords Monitoring

- **路由**：`/google/scholar/:query` `🚨 反爬严格`
  - **示例**：https://rsshub.app/google/scholar/data+visualization
  - **源代码**：`/google/scholar.ts`
  - **作者**：@HenryQW

</details>

### IEEE Computer Society
<a id="ieee-computer-society"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### IEEE Symposium on Security and Privacy

- **路由**：`/ieee-security/security-privacy` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/ieee-security/security-privacy
  - **源代码**：`/ieee-security/sp.ts`
  - **作者**：@ZeddYu

</details>

### IEEE Xplore
<a id="ieee-xplore"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Early Access Journal

- **路由**：`/ieee/journal/:journal/earlyaccess/:sortType?`
  - **示例**：https://rsshub.app/ieee/journal/5306045/earlyaccess
  - **源代码**：`/ieee/earlyaccess.ts`
  - **作者**：@5upernova-heng

</details>

### INFORMS
<a id="informs"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Category

- **路由**：`/informs/:category?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/ieee-security/security-privacy
  - **源代码**：`/informs/index.ts`
  - **作者**：@ZeddYu

</details>

### MDPI
<a id="mdpi"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Journal

- **路由**：`/mdpi/:journal` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/informs/mnsc
  - **源代码**：`/mdpi/journal.ts`
  - **作者**：@Derekmini

</details>

### National Bureau of Economic Research
<a id="national-bureau-of-economic-research"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### All Papers

- **路由**：`/nber/papers,/news`
  - **示例**：https://rsshub.app/nber/papers
  - **源代码**：`/nber/index.ts`
- **路由**：`/nber/papers,/news`
  - **示例**：https://rsshub.app/nber/papers
  - **源代码**：`/nber/index.ts`

</details>

### Nature Journal
<a id="nature-journal"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Cover Story

- **路由**：`/nature/cover` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/nature/cover
  - **源代码**：`/nature/cover.ts`
  - **作者**：@y9c

#### Journal List

- **路由**：`/nature/siteindex` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/nature/cover
  - **源代码**：`/nature/siteindex.ts`
  - **作者**：@y9c

#### Latest Research

- **路由**：`/nature/research/:journal?`
  - **示例**：https://rsshub.app/nature/siteindex
  - **源代码**：`/nature/research.ts`
  - **作者**：@TonyRL

#### Nature News

- **路由**：`/nature/news`
  - **示例**：https://rsshub.app/nature/news
  - **源代码**：`/nature/news.ts`
  - **作者**：@y9c, @TonyRL

#### Research Highlight

- **路由**：`/nature/highlight/:journal?`
  - **示例**：https://rsshub.app/nature/news
  - **源代码**：`/nature/highlight.ts`
  - **作者**：@y9c, @TonyRL

</details>

### Network and Distributed System Security (NDSS) Symposium Symposium的直接链接")
<a id="network-and-distributed-system-security-ndss-symposium-symposium的直接链接"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Accepted papers

- **路由**：`/ndss-symposium/ndss` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/nber/papers
  - **源代码**：`/ndss-symposium/ndss.ts`

</details>

### Oxford University Press
<a id="oxford-university-press"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Oxford Academic

- **路由**：`/oup/journals/:name` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/ndss-symposium/ndss
  - **源代码**：`/oup/index.ts`
  - **作者**：@ZeddYu

</details>

### Royal Society of Chemistry
<a id="royal-society-of-chemistry"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Journal

- **路由**：`/rsc/journal/:id/:category?`
  - **示例**：https://rsshub.app/oup/journals/adaptation
  - **源代码**：`/rsc/journal.ts`
  - **作者**：@nczitzk

</details>

### Science Magazine
<a id="science-magazine"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Blogs

- **路由**：`/science/blogs/:name?` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/science/blogs/pipeline
  - **源代码**：`/science/blogs.ts`
  - **作者**：@TomHodson

#### Cover Story

- **路由**：`/science/cover` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/science/blogs/pipeline
  - **源代码**：`/science/cover.ts`
  - **作者**：@y9c, @TonyRL

#### Current Issue

- **路由**：`/science/current/:journal?` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/science/cover
  - **源代码**：`/science/current.ts`
  - **作者**：@y9c, @TonyRL

#### First Release

- **路由**：`/science/early/:journal?` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/science/early
  - **源代码**：`/science/early.ts`
  - **作者**：@y9c, @TonyRL

</details>

### ScienceDirect
<a id="sciencedirect"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Journal

- **路由**：`/sciencedirect/journal/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/sciencedirect/journal/research-policy
  - **源代码**：`/sciencedirect/journal.ts`
  - **作者**：@nczitzk

</details>

### Springer
<a id="springer"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Journal

- **路由**：`/springer/journal/:journal` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/sciencedirect/journal/research-policy
  - **源代码**：`/springer/journal.ts`
  - **作者**：@Derekmini, @TonyRL

</details>

### Telecompaper
<a id="telecompaper"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### News

- **路由**：`/telecompaper/news/:caty/:year?/:country?/:type?`
  - **示例**：https://rsshub.app/springer/journal/10450
  - **源代码**：`/telecompaper/news.ts`
  - **作者**：@Derekmini, @TonyRL

#### Search

- **路由**：`/telecompaper/search/:keyword?/:company?/:sort?/:period?`
  - **示例**：https://rsshub.app/telecompaper/search/Nokia
  - **源代码**：`/telecompaper/search.ts`
  - **作者**：@nczitzk

</details>

### The University of Chicago Press: Journals
<a id="the-university-of-chicago-press-journals"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Current Issue

- **路由**：`/uchicago/journals/current/:journal` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/uchicago/journals/current/jpe
  - **源代码**：`/uchicago/current.ts`
  - **作者**：@TonyRL

</details>

### Trending Papers
<a id="trending-papers"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Trending Papers on arXiv

- **路由**：`/trendingpapers/papers/:category?/:time?/:cited?`
  - **示例**：https://rsshub.app/trendingpapers/papers
  - **源代码**：`/trendingpapers/papers.ts`
  - **作者**：@CookiePieWw

</details>

### USENIX
<a id="usenix"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Security Symposia

- **路由**：`/usenix/usenix-security-sympoium` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/uchicago/journals/current/jpe
  - **源代码**：`/usenix/usenix.ts`
  - **作者**：@ZeddYu

</details>

### X-MOL
<a id="x-mol"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Journal

- **路由**：`/x-mol/paper/:type/:magazine` `🚨 反爬严格`
  - **示例**：https://rsshub.app/usenix/usenix-security-sympoium
  - **源代码**：`/x-mol/paper.ts`
  - **作者**：@ZeddYu

</details>

### 中国知网
<a id="中国知网"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Unknown

- **路由**：`/cnki/author/:code`
  - **示例**：https://rsshub.app/cnki/author/000042423923
  - **源代码**：`/cnki/author.ts`
  - **作者**：@harveyqiu, @Derekmini

#### 期刊

- **路由**：`/cnki/journals/:name` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/cnki/author/000042423923
  - **源代码**：`/cnki/journals.ts`
  - **作者**：@harveyqiu, @Derekmini

#### 网络首发

- **路由**：`/cnki/journals/debut/:name` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/cnki/journals/LKGP
  - **源代码**：`/cnki/debut.ts`
  - **作者**：@Fatpandac, @Derekmini

</details>

### 管理世界
<a id="管理世界"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 分类

- **路由**：`/mvm/:category?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/mvm
  - **源代码**：`/mvm/index.ts`
  - **作者**：@nczitzk

</details>
