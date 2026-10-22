# 🎨️ 设计（design）

本分类共 **13** 条路由。

## 使用方式（给 AI）

1. 先在本页的「服务总览」定位目标站点/服务。
2. 打开对应服务的折叠块，选择与你要订阅的「Feed」最匹配的一条路由。
3. 将路由模板里的 `:参数` 替换为具体值；`?` 表示可选段。
4. 若标注了「反爬严格/需要登录/需要 Cookie」等标签，优先使用自建实例并配置相应环境变量或代理。

## 服务总览（渐进式入口）

| 服务 | 路由数 |
|---|---:|
| [Behance](#behance) | 1 |
| [Boss 设计](#boss-设计) | 1 |
| [Dribbble](#dribbble) | 3 |
| [Eagle](#eagle) | 1 |
| [Google](#google) | 1 |
| [Notefolio](#notefolio) | 1 |
| [Shopping Design](#shopping-design) | 1 |
| [爱果果](#爱果果) | 1 |
| [站酷](#站酷) | 3 |

## 服务详情（按需展开）

### Behance
<a id="behance"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### User Works

- **路由**：`/behance/:user/:type?`
  - **示例**：https://rsshub.app/behance/mishapetrick
  - **源代码**：`/behance/user.ts`
  - **作者**：@MisteryMonster

</details>

### Boss 设计
<a id="boss-设计"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 分类

- **路由**：`/bossdesign/:category?`
  - **示例**：https://rsshub.app/bossdesign
  - **源代码**：`/bossdesign/index.ts`
  - **作者**：@TonyRL

</details>

### Dribbble
<a id="dribbble"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Keyword

- **路由**：`/dribbble/keyword/:keyword`
  - **示例**：https://rsshub.app/dribbble/keyword/player
  - **源代码**：`/dribbble/keyword.ts`
  - **作者**：@DIYgod, @loganrockmore

#### Popular

- **路由**：`/dribbble/popular/:timeframe?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/dribbble/keyword/player
  - **源代码**：`/dribbble/popular.ts`
  - **作者**：@DIYgod, @loganrockmore

#### User (or team)的直接链接")

- **路由**：`/dribbble/user/:name` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/dribbble/popular
  - **源代码**：`/dribbble/user.ts`
  - **作者**：@DIYgod, @loganrockmore

</details>

### Eagle
<a id="eagle"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Blog

- **路由**：`/eagle/blog/:cate?/:language?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/dribbble/user/google
  - **源代码**：`/eagle/blog.ts`
  - **作者**：@Fatpandac

</details>

### Google
<a id="google"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Google Fonts

- **路由**：`/google/fonts/:sort?` `⚙️ 需要配置`
  - **示例**：https://rsshub.app/google/fonts/date
  - **源代码**：`/google/fonts.ts`
  - **作者**：@Fatpandac

</details>

### Notefolio
<a id="notefolio"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Works

- **路由**：`/notefolio/search/:category?/:order?/:time?/:query?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/notefolio/search/1/pick/all/life
  - **源代码**：`/notefolio/search.ts`
  - **作者**：@BianTan

</details>

### Shopping Design
<a id="shopping-design"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 文章列表

- **路由**：`/shoppingdesign/posts` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/shoppingdesign/posts
  - **源代码**：`/shoppingdesign/posts.ts`
  - **作者**：@miles170

</details>

### 爱果果
<a id="爱果果"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 最新 H5

- **路由**：`/iguoguo/html5` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/shoppingdesign/posts
  - **源代码**：`/iguoguo/index.ts`
  - **作者**：@miles170

</details>

### 站酷
<a id="站酷"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Unknown

- **路由**：`/zcool/user/:uid` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/iguoguo/html5
  - **源代码**：`/zcool/user.ts`
  - **作者**：@yuxinliu-alex

#### 作品总榜单

- **路由**：`/zcool/top/:type`
  - **示例**：https://rsshub.app/zcool/top/design
  - **源代码**：`/zcool/top.ts`
  - **作者**：@yuuow

#### 发现

- **路由**：`/zcool/discover/:query?/:subCate?/:hasVideo?/:city?/:college?/:recommendLevel?/:sort?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/zcool/user/baiyong
  - **源代码**：`/zcool/discover.ts`
  - **作者**：@junbaor

</details>
