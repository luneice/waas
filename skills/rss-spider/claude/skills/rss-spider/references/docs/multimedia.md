# 🔊 音视频（multimedia）

本分类共 **3** 条路由。

## 使用方式（给 AI）

1. 先在本页的「服务总览」定位目标站点/服务。
2. 打开对应服务的折叠块，选择与你要订阅的「Feed」最匹配的一条路由。
3. 将路由模板里的 `:参数` 替换为具体值；`?` 表示可选段。
4. 若标注了「反爬严格/需要登录/需要 Cookie」等标签，优先使用自建实例并配置相应环境变量或代理。

## 服务总览（渐进式入口）

| 服务 | 路由数 |
|---|---:|
| [人人影视](#人人影视) | 1 |
| [哔嘀影视](#哔嘀影视) | 1 |
| [草榴社区](#草榴社区) | 1 |

## 服务详情（按需展开）

### 人人影视
<a id="人人影视"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 影视资讯

- **路由**：`/yyets/article/:type?`
  - **示例**：https://rsshub.app/yyets/article
  - **源代码**：`/yyets/article.ts`
  - **作者**：@wb121017405

</details>

### 哔嘀影视
<a id="哔嘀影视"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 首页

- **路由**：`/bdys/:caty?/:type?/:area?/:year?/:order?` `🚨 反爬严格`
  - **示例**：https://rsshub.app/bdys
  - **源代码**：`/bdys/index.ts`
  - **作者**：@nczitzk

</details>

### 草榴社区
<a id="草榴社区"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 帖子跟踪

- **路由**：`/t66y/post/:tid` `🚨 反爬严格`
  - **示例**：https://rsshub.app/t66y/post/3286088
  - **源代码**：`/t66y/post.ts`
  - **作者**：@cnzgray

</details>
