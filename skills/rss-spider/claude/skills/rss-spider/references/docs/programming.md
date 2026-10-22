# 💻 编程（programming）

本分类共 **108** 条路由。

## 使用方式（给 AI）

1. 先在本页的「服务总览」定位目标站点/服务。
2. 打开对应服务的折叠块，选择与你要订阅的「Feed」最匹配的一条路由。
3. 将路由模板里的 `:参数` 替换为具体值；`?` 表示可选段。
4. 若标注了「反爬严格/需要登录/需要 Cookie」等标签，优先使用自建实例并配置相应环境变量或代理。

## 服务总览（渐进式入口）

| 服务 | 路由数 |
|---|---:|
| [A List Apart](#a-list-apart) | 1 |
| [AlternativeTo](#alternativeto) | 2 |
| [AtCoder](#atcoder) | 2 |
| [BBC News Labs](#bbc-news-labs) | 1 |
| [Bitbucket](#bitbucket) | 2 |
| [Bitmovin](#bitmovin) | 1 |
| [CNCF](#cncf) | 1 |
| [Codeforces](#codeforces) | 2 |
| [deeplearning.ai](#deeplearningai) | 1 |
| [gihyo.jp](#gihyojp) | 1 |
| [Gitee](#gitee) | 4 |
| [GitHub](#github) | 16 |
| [Gitpod](#gitpod) | 2 |
| [Go 语言中文网](#go-语言中文网) | 3 |
| [GoCN](#gocn) | 2 |
| [Hacker News](#hacker-news) | 1 |
| [Hacking8](#hacking8) | 2 |
| [HackMD](#hackmd) | 1 |
| [HelloGitHub](#hellogithub) | 2 |
| [Hex-Rays](#hex-rays) | 1 |
| [Huggingface](#huggingface) | 2 |
| [Issue Hunt](#issue-hunt) | 1 |
| [Kong API 网关平台](#kong-api-网关平台) | 1 |
| [LeetCode](#leetcode) | 1 |
| [ModelScope 魔搭社区](#modelscope-魔搭社区) | 4 |
| [MySQL](#mysql) | 1 |
| [Node.js](#nodejs) | 1 |
| [NOSEC 安全讯息平台](#nosec-安全讯息平台) | 1 |
| [Quicker](#quicker) | 3 |
| [Reactiflux](#reactiflux) | 1 |
| [Rust 语言中文社区](#rust-语言中文社区) | 2 |
| [SecWiki - 安全维基](#secwiki---安全维基) | 1 |
| [SegmentFault](#segmentfault) | 3 |
| [Smashing Magazine](#smashing-magazine) | 1 |
| [web.dev](#webdev) | 3 |
| [前端早早聊](#前端早早聊) | 1 |
| [北京智源人工智能研究院](#北京智源人工智能研究院) | 2 |
| [印记中文](#印记中文) | 1 |
| [墨天轮](#墨天轮) | 1 |
| [安全内参](#安全内参) | 2 |
| [安全客](#安全客) | 1 |
| [开源中国](#开源中国) | 4 |
| [微信小程序](#微信小程序) | 1 |
| [掘金](#掘金) | 9 |
| [极术社区](#极术社区) | 1 |
| [洛谷](#洛谷) | 4 |
| [登链社区](#登链社区) | 1 |
| [蓝桥云课](#蓝桥云课) | 3 |
| [阿里云](#阿里云) | 3 |

## 服务详情（按需展开）

### A List Apart
<a id="a-list-apart"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Topics

- **路由**：`/alistapart/:topic` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/alistapart/application-development>![
  - **源代码**：`/alistapart/topic.ts`
  - **作者**：@Rjnishant530

</details>

### AlternativeTo
<a id="alternativeto"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Platform Software

- **路由**：`/alternativeto/platform/:name/:routeParams?` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/alternativeto/platform/firefox>![
  - **源代码**：`/alternativeto/platform.ts`
  - **作者**：@JimenezLi

#### Software Alternatives

- **路由**：`/alternativeto/software/:name/:routeParams?` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/alternativeto/software/cpp>![
  - **源代码**：`/alternativeto/software.ts`
  - **作者**：@JimenezLi

</details>

### AtCoder
<a id="atcoder"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Contests Archive

- **路由**：`/atcoder/contest/:language?/:rated?/:category?/:keyword?`
  - **示例**：https://rsshub.app/atcoder/contest>![
  - **源代码**：`/atcoder/contest.ts`
  - **作者**：@nczitzk

#### Posts

- **路由**：`/atcoder/post/:language?/:keyword?`
  - **示例**：https://rsshub.app/atcoder/post>![
  - **源代码**：`/atcoder/post.ts`
  - **作者**：@nczitzk

</details>

### BBC News Labs
<a id="bbc-news-labs"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### News

- **路由**：`/bbcnewslabs/news` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bbcnewslabs/news>![
  - **源代码**：`/bbcnewslabs/news.ts`
  - **作者**：@elxy

</details>

### Bitbucket
<a id="bitbucket"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Commits

- **路由**：`/bitbucket/commits/:workspace/:repo_slug` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bbcnewslabs/news>![
  - **源代码**：`/bitbucket/commits.ts`
  - **作者**：@elxy

#### Tags

- **路由**：`/bitbucket/tags/:workspace/:repo_slug`
  - **示例**：https://rsshub.app/bitbucket/commits/blaze-lib/blaze>![
  - **源代码**：`/bitbucket/tags.ts`
  - **作者**：@AuroraDysis

</details>

### Bitmovin
<a id="bitmovin"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Blog

- **路由**：`/bitmovin/blog` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bitmovin/blog>![
  - **源代码**：`/bitmovin/blog.ts`
  - **作者**：@elxy

</details>

### CNCF
<a id="cncf"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Category

- **路由**：`/cncf/:cate?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bitmovin/blog>![
  - **源代码**：`/cncf/index.ts`
  - **作者**：@elxy

</details>

### Codeforces
<a id="codeforces"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Latest contests

- **路由**：`/codeforces/contests` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/codeforces/contests>![
  - **源代码**：`/codeforces/contests.ts`
  - **作者**：@Fatpandac

#### Recent actions

- **路由**：`/codeforces/recent-actions/:minrating?` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/codeforces/contests>![
  - **源代码**：`/codeforces/recent-actions.ts`
  - **作者**：@Fatpandac

</details>

### deeplearning.ai
<a id="deeplearningai"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### TheBatch 周报

- **路由**：`/deeplearning/thebatch` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/codeforces/recent-actions>![
  - **源代码**：`/deeplearning/thebatch.ts`
  - **作者**：@nczitzk, @juvenn

</details>

### gihyo.jp
<a id="gihyojp"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Series

- **路由**：`/gihyo/list/group/:id` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/deeplearning/thebatch>![
  - **源代码**：`/gihyo/group.ts`
  - **作者**：@nczitzk, @juvenn

</details>

### Gitee
<a id="gitee"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 仓库 Releases

- **路由**：`/gitee/releases/:owner/:repo` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/gitee/events/y_project/RuoYi>![
  - **源代码**：`/gitee/repos/releases.ts`
  - **作者**：@TonyRL

#### 仓库动态

- **路由**：`/gitee/events/:owner/:repo` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/gitee/commits/y_project/RuoYi>![
  - **源代码**：`/gitee/repos/events.ts`
  - **作者**：@TonyRL

#### 仓库提交

- **路由**：`/gitee/commits/:owner/:repo` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/gihyo/list/group/Ubuntu-Weekly-Recipe>![
  - **源代码**：`/gitee/repos/commits.ts`
  - **作者**：@TonyRL

#### 用户公开动态

- **路由**：`/gitee/events/:username` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/gitee/releases/y_project/RuoYi>![
  - **源代码**：`/gitee/users/events.ts`
  - **作者**：@TonyRL

</details>

### GitHub
<a id="github"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Gist Commits

- **路由**：`/github/gist/:gistId` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/github/gist/d2c152bb7179d07015f336b1a0582679>![
  - **源代码**：`/github/gist.ts`
  - **作者**：@TonyRL

#### Issue / Pull Request comments

- **路由**：`/github/comments/:user/:repo/:number?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/github/gist/d2c152bb7179d07015f336b1a0582679>![
  - **源代码**：`/github/comments.ts`
  - **作者**：@TonyRL

#### Notifications

- **路由**：`/github/notifications` `⚙️ 需要配置` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/github/comments/DIYgod/RSSHub/8116>![
  - **源代码**：`/github/notifications.ts`
  - **作者**：@zhzy0077

#### Repo Branches

- **路由**：`/github/branches/:user/:repo` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/github/notifications>![
  - **源代码**：`/github/branches.ts`
  - **作者**：@zhzy0077

#### Repo Contributors

- **路由**：`/github/contributors/:user/:repo/:order?/:anon?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/github/branches/DIYgod/RSSHub>![
  - **源代码**：`/github/contributors.ts`
  - **作者**：@zoenglinghou

#### Repo Issues

- **路由**：`/github/issue/:user/:repo/:state?/:labels?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/github/issue/vuejs/core/all/wontfix>![
  - **源代码**：`/github/issue.ts`
  - **作者**：@HenryQW, @AndreyMZ

#### Repo Pull Requests

- **路由**：`/github/pull/:user/:repo/:state?/:labels?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/github/pull/DIYgod/RSSHub>![
  - **源代码**：`/github/pulls.ts`

#### Repo Pulse

- **路由**：`/github/pulse/:user/:repo/:period?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/github/pulse/DIYgod/RSSHub>![
  - **源代码**：`/github/pulse.ts`
  - **作者**：@jameschensmith

#### Repo Stars

- **路由**：`/github/stars/:user/:repo` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/github/pulse/DIYgod/RSSHub>![
  - **源代码**：`/github/star.ts`
  - **作者**：@HenryQW

#### Search Result

- **路由**：`/github/search/:query/:sort?/:order?`
  - **示例**：https://rsshub.app/github/stars/DIYGod/RSSHub>![
  - **源代码**：`/github/search.ts`
  - **作者**：@HenryQW

#### Topics

- **路由**：`/github/topics/:name/:qs?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/github/topics/framework>![
  - **源代码**：`/github/topic.ts`
  - **作者**：@queensferryme

#### Trending

- **路由**：`/github/trending/:since/:language/:spoken_language?` `⚙️ 需要配置` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/github/trending/daily/javascript/en>![
  - **源代码**：`/github/trending.ts`
  - **作者**：@DIYgod, @jameschensmith

#### User Followers

- **路由**：`/github/user/followers/:user` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/github/user/followers/HenryQW>![
  - **源代码**：`/github/follower.ts`
  - **作者**：@HenryQW

#### User Repo

- **路由**：`/github/repos/:user` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/github/user/followers/HenryQW>![
  - **源代码**：`/github/repos.ts`
  - **作者**：@HenryQW

#### User Starred Repositories

- **路由**：`/github/starred_repos/:user` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/github/repos/DIYgod>![
  - **源代码**：`/github/starred-repos.ts`
  - **作者**：@DIYgod

#### Wiki History

- **路由**：`/github/wiki/:user/:repo/:page?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/github/starred_repos/DIYgod>![
  - **源代码**：`/github/wiki.ts`
  - **作者**：@LanceZhu

</details>

### Gitpod
<a id="gitpod"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Blog

- **路由**：`/gitpod/blog` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/gitpod/blog>![
  - **源代码**：`/gitpod/blog.ts`
  - **作者**：@TonyRL

#### Changelog

- **路由**：`/gitpod/changelog` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/gitpod/blog>![
  - **源代码**：`/gitpod/changelog.ts`
  - **作者**：@TonyRL

</details>

### Go 语言中文网
<a id="go-语言中文网"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 周刊

- **路由**：`/studygolang/weekly`
  - **示例**：https://rsshub.app/studygolang/jobs>![
  - **源代码**：`/studygolang/weekly.ts`
  - **作者**：@CcccFz, @nczitzk

#### 招聘

- **路由**：`/studygolang/jobs` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/studygolang/go/daily>![
  - **源代码**：`/studygolang/jobs.ts`
  - **作者**：@nczitzk

#### 板块

- **路由**：`/studygolang/go/:id?` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/gocn/jobs>![
  - **源代码**：`/studygolang/go.ts`
  - **作者**：@AtlanCI, @CcccFz

</details>

### GoCN
<a id="gocn"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 招聘

- **路由**：`/gocn/jobs` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/gocn/topics>![
  - **源代码**：`/gocn/jobs.ts`
  - **作者**：@AtlanCI, @CcccFz

#### 每日新闻

- **路由**：`/gocn/topics` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/gitpod/changelog>![
  - **源代码**：`/gocn/topics.ts`
  - **作者**：@TonyRL

</details>

### Hacker News
<a id="hacker-news"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 用户

- **路由**：`/hackernews/:section?/:type?/:user?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/studygolang/weekly>![
  - **源代码**：`/hackernews/index.ts`
  - **作者**：@CWeilet, @nczitzk

</details>

### Hacking8
<a id="hacking8"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 信息流

- **路由**：`/hacking8/:category?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/hacking8/search/rsshub>![
  - **源代码**：`/hacking8/index.ts`
  - **作者**：@nczitzk

#### 搜索

- **路由**：`/hacking8/search/:keyword?` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/hacking8/search/rsshub>![
  - **源代码**：`/hacking8/search.ts`
  - **作者**：@nczitzk

</details>

### HackMD
<a id="hackmd"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Profile

- **路由**：`/hackmd/profile/:path`
  - **示例**：https://rsshub.app/hackmd/profile/hackmd>![
  - **源代码**：`/hackmd/profile.ts`
  - **作者**：@Yukaii, @kaiix

</details>

### HelloGitHub
<a id="hellogithub"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 文章

- **路由**：`/hellogithub/article/:sort?/:id?,/:sort?/:id?`
  - **示例**：https://rsshub.app/hackmd/profile/hackmd>![
  - **源代码**：`/hellogithub/index.ts`
  - **作者**：@Yukaii, @kaiix
- **路由**：`/hellogithub/article/:sort?/:id?,/:sort?/:id?`
  - **示例**：https://rsshub.app/hellogithub/article>![
  - **源代码**：`/hellogithub/index.ts`
  - **作者**：@moke8, @nczitzk

</details>

### Hex-Rays
<a id="hex-rays"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Hex-Rays News

- **路由**：`/hex-rays/news` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/hellogithub/article>![
  - **源代码**：`/hex-rays/index.ts`
  - **作者**：@hellodword, @TonyRL

</details>

### Huggingface
<a id="huggingface"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Daily Papers

- **路由**：`/huggingface/daily-papers` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/hex-rays/news>![
  - **源代码**：`/huggingface/daily-papers.ts`
  - **作者**：@hellodword, @TonyRL

#### 中文博客

- **路由**：`/huggingface/blog-zh` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/huggingface/daily-papers>![
  - **源代码**：`/huggingface/blog-zh.ts`
  - **作者**：@zeyugao

</details>

### Issue Hunt
<a id="issue-hunt"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Project Funded

- **路由**：`/issuehunt/funded/:username/:repo` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/huggingface/blog-zh>![
  - **源代码**：`/issuehunt/funded.ts`
  - **作者**：@zcf0508

</details>

### Kong API 网关平台
<a id="kong-api-网关平台"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 博客最新文章

- **路由**：`/konghq/blog-posts` `🔍 支持 Radar` `Kong`
  - **示例**：https://rsshub.app/konghq/blog-posts>![
  - **源代码**：`/konghq/blog-posts.ts`
  - **作者**：@piglei

</details>

### LeetCode
<a id="leetcode"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Articles

- **路由**：`/leetcode/articles` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/konghq/blog-posts>![
  - **源代码**：`/leetcode/articles.ts`
  - **作者**：@piglei

</details>

### ModelScope 魔搭社区
<a id="modelscope-魔搭社区"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### DevPress 官方社区

- **路由**：`/modelscope/community` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/leetcode/articles>![
  - **源代码**：`/modelscope/community.ts`
  - **作者**：@LogicJake

#### 创空间

- **路由**：`/modelscope/studios` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/modelscope/community>![
  - **源代码**：`/modelscope/studios.ts`
  - **作者**：@TonyRL

#### 数据集

- **路由**：`/modelscope/datasets` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/modelscope/models>![
  - **源代码**：`/modelscope/datasets.ts`
  - **作者**：@TonyRL

#### 模型库

- **路由**：`/modelscope/models` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/modelscope/studios>![
  - **源代码**：`/modelscope/models.ts`
  - **作者**：@TonyRL

</details>

### MySQL
<a id="mysql"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Release Notes

- **路由**：`/mysql/release/:version?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/modelscope/datasets>![
  - **源代码**：`/mysql/release.ts`
  - **作者**：@TonyRL

</details>

### Node.js
<a id="nodejs"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### News

- **路由**：`/nodejs/blog/:language?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/nodejs/blog>![
  - **源代码**：`/nodejs/blog.ts`
  - **作者**：@nczitzk

</details>

### NOSEC 安全讯息平台
<a id="nosec-安全讯息平台"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Posts

- **路由**：`/nosec/:keykind?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/nosec/hole>![
  - **源代码**：`/nosec/index.ts`
  - **作者**：@hellodword

</details>

### Quicker
<a id="quicker"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 动作分享

- **路由**：`/quicker/share/:category?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/quicker/share/Recent>![
  - **源代码**：`/quicker/share.ts`
  - **作者**：@nczitzk

#### 用户更新

- **路由**：`/quicker/user/:category/:id`
  - **示例**：https://rsshub.app/quicker/user/Actions/3-CL>![
  - **源代码**：`/quicker/user.ts`
  - **作者**：@Cesaryuan, @nczitzk

#### 讨论区

- **路由**：`/quicker/qa/:category?/:state?`
  - **示例**：https://rsshub.app/quicker/qa>![
  - **源代码**：`/quicker/qa.ts`
  - **作者**：@Cesaryuan, @nczitzk

</details>

### Reactiflux
<a id="reactiflux"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Transcripts

- **路由**：`/reactiflux/transcripts` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/reactiflux/transcripts>![
  - **源代码**：`/reactiflux/transcripts.ts`
  - **作者**：@nczitzk

</details>

### Rust 语言中文社区
<a id="rust-语言中文社区"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 招聘

- **路由**：`/rustcc/jobs` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/rustcc/news>![
  - **源代码**：`/rustcc/jobs.ts`
  - **作者**：@zhenlohuang

#### 新闻/聚合

- **路由**：`/rustcc/news` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/reactiflux/transcripts>![
  - **源代码**：`/rustcc/news.ts`
  - **作者**：@nczitzk

</details>

### SecWiki - 安全维基
<a id="secwiki---安全维基"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 最新周刊

- **路由**：`/sec-wiki/weekly` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/rustcc/jobs>![
  - **源代码**：`/sec-wiki/weekly.ts`
  - **作者**：@CcccFz

</details>

### SegmentFault
<a id="segmentfault"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 博客

- **路由**：`/segmentfault/blogs/:tag` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/sec-wiki/weekly>![
  - **源代码**：`/segmentfault/blogs.ts`
  - **作者**：@p7e4

#### 用户

- **路由**：`/segmentfault/user/:name` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/segmentfault/channel/frontend>![
  - **源代码**：`/segmentfault/user.ts`
  - **作者**：@LogicJake, @Fatpandac

#### 频道

- **路由**：`/segmentfault/channel/:name` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/segmentfault/blogs/go>![
  - **源代码**：`/segmentfault/channel.ts`
  - **作者**：@shiluanzzz

</details>

### Smashing Magazine
<a id="smashing-magazine"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Category

- **路由**：`/smashingmagazine/:category?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/segmentfault/user/minnanitkong>![
  - **源代码**：`/smashingmagazine/category.ts`
  - **作者**：@Rjnishant530

</details>

### web.dev
<a id="webdev"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Articles

- **路由**：`/web/articles` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/web/articles>![
  - **源代码**：`/web/articles.ts`
  - **作者**：@KarasuShin

#### Blog

- **路由**：`/web/blog` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/web/articles>![
  - **源代码**：`/web/blog.ts`
  - **作者**：@KarasuShin

#### Series

- **路由**：`/web/series/:seriesName` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/web/blog>![
  - **源代码**：`/web/series.ts`
  - **作者**：@KarasuShin

</details>

### 前端早早聊
<a id="前端早早聊"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 文章

- **路由**：`/zaozao/article/:type?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/modb/topic/44158>![
  - **源代码**：`/zaozao/article.ts`
  - **作者**：@shaomingbo

</details>

### 北京智源人工智能研究院
<a id="北京智源人工智能研究院"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 智源社区 - 活动

- **路由**：`/baai/hub/events` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/baai/hub/comments>![
  - **源代码**：`/baai/events.ts`
  - **作者**：@TonyRL

#### 智源社区 - 评论

- **路由**：`/baai/hub/comments` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/secrss/author/网络安全威胁和漏洞信息共享平台>![
  - **源代码**：`/baai/comments.ts`
  - **作者**：@TonyRL

</details>

### 印记中文
<a id="印记中文"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 周刊 - JavaScript

- **路由**：`/docschina/weekly/:category?` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/wechat/announce>![
  - **源代码**：`/docschina/weekly.ts`
  - **作者**：@xyqfer

</details>

### 墨天轮
<a id="墨天轮"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 合辑

- **路由**：`/modb/topic/:id`
  - **示例**：https://rsshub.app/luogu/user/feed/1>![
  - **源代码**：`/modb/topic.ts`
  - **作者**：@solstice23

</details>

### 安全内参
<a id="安全内参"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 作者

- **路由**：`/secrss/author/:author`
  - **示例**：https://rsshub.app/secrss/category/产业趋势>![
  - **源代码**：`/secrss/author.ts`
  - **作者**：@XinRoom, @SunBK201

#### 分类

- **路由**：`/secrss/category/:category?`
  - **示例**：https://rsshub.app/secrss/category/产业趋势>![
  - **源代码**：`/secrss/category.ts`
  - **作者**：@XinRoom, @SunBK201

</details>

### 安全客
<a id="安全客"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 分类订阅

- **路由**：`/anquanke/:category/:fulltext?`
  - **示例**：https://rsshub.app/aliyun/database_month>![
  - **源代码**：`/anquanke/category.ts`
  - **作者**：@junbaor

</details>

### 开源中国
<a id="开源中国"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 数字型账号用户博客

- **路由**：`/oschina/u/:uid,/user/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/juejin/column/6960559453037199391>![
  - **源代码**：`/oschina/user.ts`
- **路由**：`/oschina/u/:uid,/user/:id` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/oschina/u/3920392>![
  - **源代码**：`/oschina/user.ts`

#### 资讯

- **路由**：`/oschina/news/:category?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/oschina/topic/weekly-news>![
  - **源代码**：`/oschina/news.ts`
  - **作者**：@loveely7

#### 问答主题

- **路由**：`/oschina/topic/:topic` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/oschina/u/3920392>![
  - **源代码**：`/oschina/topic.ts`

</details>

### 微信小程序
<a id="微信小程序"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 公众平台系统公告栏目

- **路由**：`/wechat/announce` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/wechat/announce>![
  - **源代码**：`/wechat/announce.ts`
  - **作者**：@xyqfer

</details>

### 掘金
<a id="掘金"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 专栏

- **路由**：`/juejin/column/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/juejin/posts/3051900006845944>![
  - **源代码**：`/juejin/column.ts`
  - **作者**：@Maecenas

#### 分类

- **路由**：`/juejin/category/:category`
  - **示例**：https://rsshub.app/juejin/pins/6824710202487472141>![
  - **源代码**：`/juejin/category.ts`
  - **作者**：@DIYgod

#### 单个收藏夹

- **路由**：`/juejin/collection/:collectionId` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/juejin/tag/JavaScript>![
  - **源代码**：`/juejin/collection.ts`
  - **作者**：@isheng5

#### 小册

- **路由**：`/juejin/books` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/juejin/collections/1697301682482439>![
  - **源代码**：`/juejin/books.ts`
  - **作者**：@isQ

#### 收藏集

- **路由**：`/juejin/collections/:userId` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/juejin/collections/1697301682482439>![
  - **源代码**：`/juejin/favorites.ts`
  - **作者**：@isQ

#### 标签

- **路由**：`/juejin/tag/:tag` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/juejin/tag/JavaScript>![
  - **源代码**：`/juejin/tag.ts`
  - **作者**：@isheng5

#### 沸点

- **路由**：`/juejin/pins/:type?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/juejin/collection/6845243180586123271>![
  - **源代码**：`/juejin/pins.ts`
  - **作者**：@isQ

#### 热门

- **路由**：`/juejin/trending/:category/:type`
  - **示例**：https://rsshub.app/juejin/category/frontend>![
  - **源代码**：`/juejin/trending.ts`
  - **作者**：@moaix

#### 用户文章

- **路由**：`/juejin/posts/:id` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/juejin/books>![
  - **源代码**：`/juejin/posts.ts`
  - **作者**：@xyqfer

</details>

### 极术社区
<a id="极术社区"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 频道、专栏、用户

- **路由**：`/aijishu/:type/:name?`
  - **示例**：https://rsshub.app/aijishu/channel/ai>![
  - **源代码**：`/aijishu/index.ts`

</details>

### 洛谷
<a id="洛谷"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 日报

- **路由**：`/luogu/daily/:id?` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/luogu/contest>![
  - **源代码**：`/luogu/daily.ts`
  - **作者**：@prnake

#### 比赛列表

- **路由**：`/luogu/contest` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/lanqiao/author/1701267>![
  - **源代码**：`/luogu/contest.ts`
  - **作者**：@prnake

#### 用户动态

- **路由**：`/luogu/user/feed/:uid` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/luogu/user/blog/ftiasch>![
  - **源代码**：`/luogu/user-feed.ts`

#### 用户博客

- **路由**：`/luogu/user/blog/:name` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/luogu/daily>![
  - **源代码**：`/luogu/user-blog.ts`
  - **作者**：@LogicJake, @prnake, @nczitzk

</details>

### 登链社区
<a id="登链社区"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 文章

- **路由**：`/learnblockchain/posts/:cid/:sort?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/baai/hub/events>![
  - **源代码**：`/learnblockchain/posts.ts`
  - **作者**：@TonyRL

</details>

### 蓝桥云课
<a id="蓝桥云课"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 作者发布的课程

- **路由**：`/lanqiao/author/:uid` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/lanqiao/courses/latest/all>![
  - **源代码**：`/lanqiao/author.ts`
  - **作者**：@huhuhang

#### 全站发布的课程

- **路由**：`/lanqiao/courses/:sort/:tag` `🚨 反爬严格`
  - **示例**：https://rsshub.app/lanqiao/questions/2>![
  - **源代码**：`/lanqiao/courses.ts`
  - **作者**：@huhuhang

#### 技术社区

- **路由**：`/lanqiao/questions/:id` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/lanqiao/questions/2>![
  - **源代码**：`/lanqiao/questions.ts`
  - **作者**：@huhuhang

</details>

### 阿里云
<a id="阿里云"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 公告

- **路由**：`/aliyun/notice/:type?`
  - **示例**：https://rsshub.app/aliyun/notice>![
  - **源代码**：`/aliyun/notice.ts`
  - **作者**：@muzea

#### 开发者社区 - 主题

- **路由**：`/aliyun/developer/group/:type` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/aliyun/developer/group/alitech>![
  - **源代码**：`/aliyun/developer/group.ts`
  - **作者**：@umm233

#### 数据库内核月报

- **路由**：`/aliyun/database_month` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/aliyun/developer/group/alitech>![
  - **源代码**：`/aliyun/database-month.ts`
  - **作者**：@umm233

</details>
