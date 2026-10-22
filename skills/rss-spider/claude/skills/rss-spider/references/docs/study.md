# 📖 学习（study）

本分类共 **27** 条路由。

## 使用方式（给 AI）

1. 先在本页的「服务总览」定位目标站点/服务。
2. 打开对应服务的折叠块，选择与你要订阅的「Feed」最匹配的一条路由。
3. 将路由模板里的 `:参数` 替换为具体值；`?` 表示可选段。
4. 若标注了「反爬严格/需要登录/需要 Cookie」等标签，优先使用自建实例并配置相应环境变量或代理。

## 服务总览（渐进式入口）

| 服务 | 路由数 |
|---|---:|
| [Asian Innovation and Entrepreneurship Association](#asian-innovation-and-entrepreneurship-association) | 1 |
| [Chinese Social Science Net](#chinese-social-science-net) | 1 |
| [DBLP](#dblp) | 1 |
| [MindMeister](#mindmeister) | 1 |
| [NEEA 中国教育考试网](#neea-中国教育考试网) | 1 |
| [ORCID](#orcid) | 1 |
| [Tableau](#tableau) | 1 |
| [The Korea Institute of Marine Law](#the-korea-institute-of-marine-law) | 1 |
| [X-MOL](#x-mol) | 1 |
| [上海市教育考试院](#上海市教育考试院) | 2 |
| [中华人民共和国学位证书查询](#中华人民共和国学位证书查询) | 1 |
| [中国人工智能学会](#中国人工智能学会) | 1 |
| [中国技术经济学会](#中国技术经济学会) | 1 |
| [中国智库网](#中国智库网) | 1 |
| [中国研究生招生信息网](#中国研究生招生信息网) | 3 |
| [中国管理现代化研究会](#中国管理现代化研究会) | 1 |
| [中国计算机学会](#中国计算机学会) | 3 |
| [山东省教育招生考试院](#山东省教育招生考试院) | 1 |
| [湖南人事考试网](#湖南人事考试网) | 1 |
| [福建考试报名网](#福建考试报名网) | 1 |
| [网易公开课](#网易公开课) | 1 |
| [语雀](#语雀) | 1 |

## 服务详情（按需展开）

### Asian Innovation and Entrepreneurship Association
<a id="asian-innovation-and-entrepreneurship-association"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Seminar Series

- **路由**：`/aiea/seminars/:period`
  - **示例**：https://rsshub.app/aiea/seminars/upcoming
  - **源代码**：`/aiea/index.ts`
  - **作者**：@zxx-457

</details>

### Chinese Social Science Net
<a id="chinese-social-science-net"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Institute of Law

- **路由**：`/cssn/iolaw/:section?`
  - **示例**：https://rsshub.app/cssn/iolaw/zxzp
  - **源代码**：`/cssn/iolaw.ts`
  - **作者**：@HankChow

</details>

### DBLP
<a id="dblp"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Keyword Search

- **路由**：`/dblp/:field` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/cssn/iolaw/zxzp
  - **源代码**：`/dblp/publication.ts`
  - **作者**：@ytno1

</details>

### MindMeister
<a id="mindmeister"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Public Maps

- **路由**：`/mindmeister/:category?/:language?`
  - **示例**：https://rsshub.app/dblp/knowledge%20tracing
  - **源代码**：`/mindmeister/example.ts`
  - **作者**：@ytno1

</details>

### NEEA 中国教育考试网
<a id="neea-中国教育考试网"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 教育部考试中心日本语能力测试重要通知

- **路由**：`/neea/jlpt` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/neea/jlpt
  - **源代码**：`/neea/jlpt.ts`
  - **作者**：@nczitzk

</details>

### ORCID
<a id="orcid"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Works List

- **路由**：`/orcid/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/neea/jlpt
  - **源代码**：`/orcid/index.ts`
  - **作者**：@nczitzk

</details>

### Tableau
<a id="tableau"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Viz of the day

- **路由**：`/tableau/viz-of-the-day` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/kimlaw/thesis
  - **源代码**：`/tableau/viz-of-the-day.ts`
  - **作者**：@TonyRL

</details>

### The Korea Institute of Marine Law
<a id="the-korea-institute-of-marine-law"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Thesis

- **路由**：`/kimlaw/thesis` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/orcid/0000-0002-4731-9700
  - **源代码**：`/kimlaw/thesis.ts`
  - **作者**：@TonyRL

</details>

### X-MOL
<a id="x-mol"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### News

- **路由**：`/x-mol/news/:tag?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/tableau/viz-of-the-day
  - **源代码**：`/x-mol/news.ts`

</details>

### 上海市教育考试院
<a id="上海市教育考试院"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 消息

- **路由**：`/shmeea/:id?`
  - **示例**：https://rsshub.app/shmeea/08000
  - **源代码**：`/shmeea/index.ts`
  - **作者**：@jialinghui, @Misaka13514

#### 自学考试通知公告

- **路由**：`/shmeea/self-study` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/shmeea/self-study
  - **源代码**：`/shmeea/self-study.ts`
  - **作者**：@h2ws

</details>

### 中华人民共和国学位证书查询
<a id="中华人民共和国学位证书查询"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Unknown

- **路由**：`/chinadegrees/:province?`
  - **示例**：https://rsshub.app/chinadegrees/11
  - **源代码**：`/chinadegrees/province.ts`
  - **作者**：@TonyRL

</details>

### 中国人工智能学会
<a id="中国人工智能学会"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 学会动态

- **路由**：`/caai/:caty`
  - **示例**：https://rsshub.app/caai/45
  - **源代码**：`/caai/index.ts`
  - **作者**：@tudou027

</details>

### 中国技术经济学会
<a id="中国技术经济学会"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 栏目

- **路由**：`/cste/:id?`
  - **示例**：https://rsshub.app/cste
  - **源代码**：`/cste/index.ts`
  - **作者**：@nczitzk

</details>

### 中国智库网
<a id="中国智库网"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 观点与实践

- **路由**：`/chinathinktanks/:id`
  - **示例**：https://rsshub.app/chinadegrees/11
  - **源代码**：`/chinathinktanks/viewpoint.ts`
  - **作者**：@TonyRL

</details>

### 中国研究生招生信息网
<a id="中国研究生招生信息网"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 考研动态

- **路由**：`/chsi/kydt` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/chsi/hotnews
  - **源代码**：`/chsi/kydt.ts`
  - **作者**：@yanbot-team

#### 考研热点新闻

- **路由**：`/chsi/hotnews` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/chsi/hotnews
  - **源代码**：`/chsi/hotnews.ts`
  - **作者**：@yanbot-team

#### 考研资讯

- **路由**：`/chsi/kyzx/:type` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/chsi/kydt
  - **源代码**：`/chsi/kyzx.ts`
  - **作者**：@SunBK201

</details>

### 中国管理现代化研究会
<a id="中国管理现代化研究会"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 栏目

- **路由**：`/camchina/:id?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/caai/45
  - **源代码**：`/camchina/index.ts`
  - **作者**：@nczitzk

</details>

### 中国计算机学会
<a id="中国计算机学会"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 大数据专家委员会

- **路由**：`/ccf/tfbd/:caty/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/ccf/tfbd/xwdt/tzgg
  - **源代码**：`/ccf/tfbd/index.ts`
  - **作者**：@tudou027

#### 新闻

- **路由**：`/ccf/news/:category?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/ccf/news
  - **源代码**：`/ccf/news.ts`
  - **作者**：@nczitzk

#### 计算机视觉专委会 - 学术动态 - 分类

- **路由**：`/ccf/ccfcv/:channel/:category`
  - **示例**：https://rsshub.app/ccf/tfbd/xwdt/tzgg
  - **源代码**：`/ccf/ccfcv/index.ts`
  - **作者**：@tudou027

</details>

### 山东省教育招生考试院
<a id="山东省教育招生考试院"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 新闻

- **路由**：`/sdzk/:bcid?/:cid?`
  - **示例**：https://rsshub.app/hunanpea/rsks/2f1a6239-b4dc-491b-92af-7d95e0f0543e
  - **源代码**：`/sdzk/index.ts`
  - **作者**：@TonyRL

</details>

### 湖南人事考试网
<a id="湖南人事考试网"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 公告

- **路由**：`/hunanpea/rsks/:guid` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/hunanpea/rsks/2f1a6239-b4dc-491b-92af-7d95e0f0543e
  - **源代码**：`/hunanpea/rsks.ts`
  - **作者**：@TonyRL

</details>

### 福建考试报名网
<a id="福建考试报名网"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 分类

- **路由**：`/fjksbm/:category?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/x-mol/news/3
  - **源代码**：`/fjksbm/index.ts`
  - **作者**：@nczitzk

</details>

### 网易公开课
<a id="网易公开课"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 精品课程

- **路由**：`/163/open/vip` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/shmeea/self-study
  - **源代码**：`/163/open/vip.ts`
  - **作者**：@hoilc

</details>

### 语雀
<a id="语雀"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 知识库

- **路由**：`/yuque/:name/:book` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/163/open/vip
  - **源代码**：`/yuque/book.ts`
  - **作者**：@hoilc

</details>
