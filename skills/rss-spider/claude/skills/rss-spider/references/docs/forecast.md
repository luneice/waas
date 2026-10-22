# ❗️ 预报预警（forecast）

本分类共 **24** 条路由。

## 使用方式（给 AI）

1. 先在本页的「服务总览」定位目标站点/服务。
2. 打开对应服务的折叠块，选择与你要订阅的「Feed」最匹配的一条路由。
3. 将路由模板里的 `:参数` 替换为具体值；`?` 表示可选段。
4. 若标注了「反爬严格/需要登录/需要 Cookie」等标签，优先使用自建实例并配置相应环境变量或代理。

## 服务总览（渐进式入口）

| 服务 | 路由数 |
|---|---:|
| [BADAN METEOROLOGI, KLIMATOLOGI, DAN GEOFISIKA(Indonesian)的直接链接")](#badan-meteorologi-klimatologi-dan-geofisikaindonesian的直接链接) | 2 |
| [Outage.Report](#outagereport) | 1 |
| [Uptime Robot](#uptime-robot) | 1 |
| [中国人民银行](#中国人民银行) | 2 |
| [中国国家应急广播](#中国国家应急广播) | 1 |
| [中国气象局](#中国气象局) | 1 |
| [中央气象台](#中央气象台) | 1 |
| [停水通知](#停水通知) | 10 |
| [和风天气](#和风天气) | 2 |
| [地震速报](#地震速报) | 2 |
| [重庆燃气](#重庆燃气) | 1 |

## 服务详情（按需展开）

### BADAN METEOROLOGI, KLIMATOLOGI, DAN GEOFISIKA(Indonesian)的直接链接")
<a id="badan-meteorologi-klimatologi-dan-geofisikaindonesian的直接链接"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### News

- **路由**：`/bmkg/news` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bmkg/news
  - **源代码**：`/bmkg/news.ts`
  - **作者**：@Shinanory

#### Recent Earthquakes

- **路由**：`/bmkg/earthquake` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bmkg/news
  - **源代码**：`/bmkg/earthquake.ts`
  - **作者**：@Shinanory

</details>

### Outage.Report
<a id="outagereport"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Report

- **路由**：`/outagereport/:name/:count?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bmkg/earthquake
  - **源代码**：`/outagereport/index.ts`
  - **作者**：@Shinanory

</details>

### Uptime Robot
<a id="uptime-robot"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### RSS

- **路由**：`/uptimerobot/rss/:id/:routeParams?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/uptimerobot/rss/u358785-e4323652448755805d668f1a66506f2f
  - **源代码**：`/uptimerobot/rss.ts`
  - **作者**：@Rongronggg9

</details>

### 中国人民银行
<a id="中国人民银行"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 广东省内城市预警信号

- **路由**：`/gov/guangdong/tqyb/sncsyjxh` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/gov/guangdong/tqyb/sncsyjxh
  - **源代码**：`/gov/guangdong/tqyb/sncsyjxh.ts`
  - **作者**：@Fatpandac

#### 突发性天气提示

- **路由**：`/gov/guangdong/tqyb/tfxtq` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/gov/guangdong/tqyb/sncsyjxh
  - **源代码**：`/gov/guangdong/tqyb/tfxtq.ts`
  - **作者**：@Fatpandac

</details>

### 中国国家应急广播
<a id="中国国家应急广播"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 应急新闻

- **路由**：`/cneb/yjxw/:category?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/cneb/yjxw
  - **源代码**：`/cneb/yjxw.ts`
  - **作者**：@nczitzk

</details>

### 中国气象局
<a id="中国气象局"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 天气预报频道

- **路由**：`/cma/channel/:id?`
  - **示例**：https://rsshub.app/cma/channel/380
  - **源代码**：`/cma/channel.ts`
  - **作者**：@nczitzk

</details>

### 中央气象台
<a id="中央气象台"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Unknown

- **路由**：`/nmc/weatheralarm/:province?` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/gov/guangdong/tqyb/tfxtq
  - **源代码**：`/nmc/weatheralarm.ts`
  - **作者**：@Fatpandac

</details>

### 停水通知
<a id="停水通知"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 东莞市

- **路由**：`/tingshuitz/dongguan` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/tingshuitz/dalian
  - **源代码**：`/tingshuitz/dongguan.ts`
  - **作者**：@DIYgod

#### 南京市

- **路由**：`/tingshuitz/nanjing` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/tingshuitz/hangzhou
  - **源代码**：`/tingshuitz/nanjing.ts`
  - **作者**：@znhocn

#### 大连市

- **路由**：`/tingshuitz/dalian` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/tingshuitz/dalian
  - **源代码**：`/tingshuitz/dalian.ts`
  - **作者**：@DIYgod

#### 广州市

- **路由**：`/tingshuitz/guangzhou`
  - **示例**：https://rsshub.app/tingshuitz/dongguan
  - **源代码**：`/tingshuitz/guangzhou.ts`
  - **作者**：@victoriqueko

#### 杭州市

- **路由**：`/tingshuitz/hangzhou` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/tingshuitz/guangzhou
  - **源代码**：`/tingshuitz/hangzhou.ts`
  - **作者**：@xyqfer

#### 深圳市

- **路由**：`/tingshuitz/shenzhen` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/tingshuitz/nanjing
  - **源代码**：`/tingshuitz/shenzhen.ts`
  - **作者**：@ocleo1

#### 萧山区

- **路由**：`/tingshuitz/xiaoshan` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/tingshuitz/xian
  - **源代码**：`/tingshuitz/xiaoshan.ts`
  - **作者**：@ciaranchen

#### 西安市

- **路由**：`/tingshuitz/xian` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/tingshuitz/shenzhen
  - **源代码**：`/tingshuitz/xian.ts`
  - **作者**：@lilPiper

#### 长沙市

- **路由**：`/tingshuitz/changsha/:channelId?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/tingshuitz/yangjiang
  - **源代码**：`/tingshuitz/changsha.ts`
  - **作者**：@ciaranchen

#### 阳江市

- **路由**：`/tingshuitz/yangjiang` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/tingshuitz/xiaoshan
  - **源代码**：`/tingshuitz/yangjiang.ts`
  - **作者**：@znhocn

</details>

### 和风天气
<a id="和风天气"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 实时天气

- **路由**：`/qweather/now/:location` `⚙️ 需要配置`
  - **示例**：https://rsshub.app/qweather/广州
  - **源代码**：`/qweather/now.ts`
  - **作者**：@Rein-Ou

#### 近三天天气

- **路由**：`/qweather/3days/:location` `⚙️ 需要配置`
  - **示例**：https://rsshub.app/qweather/3days/广州
  - **源代码**：`/qweather/3days.ts`
  - **作者**：@Rein-Ou, @la3rence

</details>

### 地震速报
<a id="地震速报"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 中国地震台

- **路由**：`/earthquake/ceic/:type?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/earthquake/ceic/1
  - **源代码**：`/earthquake/ceic.ts`
  - **作者**：@SettingDust

#### 中国地震局

- **路由**：`/earthquake/:region?` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/earthquake
  - **源代码**：`/earthquake/index.ts`
  - **作者**：@LogicJake

</details>

### 重庆燃气
<a id="重庆燃气"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 停气检修通知

- **路由**：`/cqgas/tqtz` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/nmc/weatheralarm/广东省
  - **源代码**：`/cqgas/tqtz.ts`
  - **作者**：@Mai19930513

</details>
