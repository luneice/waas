# 🛫 出行旅游（travel）

本分类共 **13** 条路由。

## 使用方式（给 AI）

1. 先在本页的「服务总览」定位目标站点/服务。
2. 打开对应服务的折叠块，选择与你要订阅的「Feed」最匹配的一条路由。
3. 将路由模板里的 `:参数` 替换为具体值；`?` 表示可选段。
4. 若标注了「反爬严格/需要登录/需要 Cookie」等标签，优先使用自建实例并配置相应环境变量或代理。

## 服务总览（渐进式入口）

| 服务 | 路由数 |
|---|---:|
| [12306](#12306) | 2 |
| [Brooklyn Museum 纽约布鲁克林博物馆](#brooklyn-museum-纽约布鲁克林博物馆) | 1 |
| [National Geographic](#national-geographic) | 1 |
| [New Museum 纽约新美术馆](#new-museum-纽约新美术馆) | 1 |
| [中国国际航空公司](#中国国际航空公司) | 1 |
| [国家地理](#国家地理) | 1 |
| [广州地铁](#广州地铁) | 1 |
| [福州地铁](#福州地铁) | 1 |
| [纽约犹太人博物馆](#纽约犹太人博物馆) | 1 |
| [走进日本](#走进日本) | 1 |
| [飞客茶馆](#飞客茶馆) | 2 |

## 服务详情（按需展开）

### 12306
<a id="12306"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 售票信息

- **路由**：`/12306/:date/:from/:to/:type?`
  - **示例**：https://rsshub.app/12306/2022-02-19/重庆/永川东
  - **源代码**：`/12306/index.ts`
  - **作者**：@Fatpandac

#### 最新动态

- **路由**：`/12306/zxdt/:id?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/12306/zxdt
  - **源代码**：`/12306/zxdt.ts`
  - **作者**：@LogicJake

</details>

### Brooklyn Museum 纽约布鲁克林博物馆
<a id="brooklyn-museum-纽约布鲁克林博物馆"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Exhibitions

- **路由**：`/brooklynmuseum/exhibitions/:state?`
  - **示例**：https://rsshub.app/12306/zxdt
  - **源代码**：`/brooklynmuseum/exhibitions.ts`
  - **作者**：@LogicJake

</details>

### National Geographic
<a id="national-geographic"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Latest Stories

- **路由**：`/nationalgeographic/latest-stories` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/brooklynmuseum/exhibitions
  - **源代码**：`/nationalgeographic/latest-stories.ts`
  - **作者**：@miles170

</details>

### New Museum 纽约新美术馆
<a id="new-museum-纽约新美术馆"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Exhibitions

- **路由**：`/newmuseum/exhibitions` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/nationalgeographic/latest-stories
  - **源代码**：`/newmuseum/exhibitions.ts`
  - **作者**：@miles170

</details>

### 中国国际航空公司
<a id="中国国际航空公司"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 服务公告

- **路由**：`/airchina/announcement` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/jewishmuseum/exhibitions
  - **源代码**：`/airchina/index.ts`
  - **作者**：@chazeon

</details>

### 国家地理
<a id="国家地理"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 分类

- **路由**：`/natgeo/:cat/:type?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/guangzhoumetro/news
  - **源代码**：`/natgeo/natgeo.ts`
  - **作者**：@HankChow

</details>

### 广州地铁
<a id="广州地铁"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 新闻

- **路由**：`/guangzhoumetro/news`
  - **示例**：https://rsshub.app/fzmtr/announcements
  - **源代码**：`/guangzhoumetro/news.ts`
  - **作者**：@HankChow

</details>

### 福州地铁
<a id="福州地铁"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 通知公告

- **路由**：`/fzmtr/announcements` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/flyert/preferential
  - **源代码**：`/fzmtr/announcements.ts`
  - **作者**：@howel52

</details>

### 纽约犹太人博物馆
<a id="纽约犹太人博物馆"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Exhibitions

- **路由**：`/jewishmuseum/exhibitions`
  - **示例**：https://rsshub.app/natgeo/environment/article
  - **源代码**：`/jewishmuseum/exhibitions.ts`
  - **作者**：@chazeon

</details>

### 走进日本
<a id="走进日本"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Unknown

- **路由**：`/nippon/:category?` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/airchina/announcement
  - **源代码**：`/nippon/index.ts`
  - **作者**：@LandonLi

</details>

### 飞客茶馆
<a id="飞客茶馆"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 优惠信息

- **路由**：`/flyert/preferential` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/flyert/preferential
  - **源代码**：`/flyert/preferential.ts`
  - **作者**：@howel52

#### 信用卡

- **路由**：`/flyert/creditcard/:bank` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/newmuseum/exhibitions
  - **源代码**：`/flyert/creditcard.ts`
  - **作者**：@chazeon

</details>
