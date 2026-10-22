# 🔄 程序更新（program-update）

本分类共 **56** 条路由。

## 使用方式（给 AI）

1. 先在本页的「服务总览」定位目标站点/服务。
2. 打开对应服务的折叠块，选择与你要订阅的「Feed」最匹配的一条路由。
3. 将路由模板里的 `:参数` 替换为具体值；`?` 表示可选段。
4. 若标注了「反爬严格/需要登录/需要 Cookie」等标签，优先使用自建实例并配置相应环境变量或代理。

## 服务总览（渐进式入口）

| 服务 | 路由数 |
|---|---:|
| [Amazon](#amazon) | 1 |
| [Android](#android) | 1 |
| [APKPure](#apkpure) | 1 |
| [App Center](#app-center) | 1 |
| [App Store/Mac App Store](#app-storemac-app-store) | 3 |
| [Apple](#apple) | 1 |
| [ASUS](#asus) | 2 |
| [Bilibili](#bilibili) | 1 |
| [BlueStacks](#bluestacks) | 1 |
| [Brave](#brave) | 1 |
| [Civitai](#civitai) | 2 |
| [CPUID](#cpuid) | 1 |
| [Docker Hub](#docker-hub) | 2 |
| [Eagle](#eagle) | 1 |
| [F-Droid](#f-droid) | 1 |
| [FossHub](#fosshub) | 1 |
| [GoFans](#gofans) | 1 |
| [Google](#google) | 1 |
| [Greasy Fork](#greasy-fork) | 4 |
| [iFi audio](#ifi-audio) | 1 |
| [ImageMagick](#imagemagick) | 1 |
| [Infuse](#infuse) | 1 |
| [IPSW.me](#ipswme) | 1 |
| [MacUpdate](#macupdate) | 1 |
| [Microsoft Edge](#microsoft-edge) | 1 |
| [MIUI](#miui) | 1 |
| [Mozilla](#mozilla) | 1 |
| [Neat Download Manager](#neat-download-manager) | 1 |
| [Not a Tesla App](#not-a-tesla-app) | 1 |
| [O&O Software](#oo-software) | 1 |
| [Postman](#postman) | 1 |
| [PuTTY](#putty) | 1 |
| [qBittorrent](#qbittorrent) | 1 |
| [RemNote](#remnote) | 1 |
| [RSSHub](#rsshub) | 1 |
| [Sony](#sony) | 1 |
| [SourceForge](#sourceforge) | 1 |
| [TradingView](#tradingview) | 1 |
| [Typora](#typora) | 2 |
| [Unraid](#unraid) | 1 |
| [Western Digital](#western-digital) | 1 |
| [winstall](#winstall) | 1 |
| [WizTree](#wiztree) | 1 |
| [WziFile](#wzifile) | 1 |
| [Zotero](#zotero) | 1 |
| [小米](#小米) | 1 |
| [王者荣耀](#王者荣耀) | 1 |

## 服务详情（按需展开）

### Amazon
<a id="amazon"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Kindle Software Updates

- **路由**：`/amazon/kindle/software-updates` `🚨 反爬严格`
  - **示例**：https://rsshub.app/amazon/kindle/software-updates
  - **源代码**：`/amazon/kindle-software-updates.ts`
  - **作者**：@EthanWng97

</details>

### Android
<a id="android"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### SDK Platform Tools release notes

- **路由**：`/android/platform-tools-releases` `🔍 支持 Radar` `🚨 反爬严格`
  - **示例**：https://rsshub.app/amazon/kindle/software-updates
  - **源代码**：`/android/platform-tools-releases.ts`
  - **作者**：@EthanWng97

</details>

### APKPure
<a id="apkpure"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Versions

- **路由**：`/apkpure/versions/:pkg/:region?` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/android/platform-tools-releases
  - **源代码**：`/apkpure/versions.ts`
  - **作者**：@nczitzk

</details>

### App Center
<a id="app-center"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Release

- **路由**：`/app-center/release/:user/:app/:distribution_group` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/app-center/release/cloudflare/1.1.1.1-windows/beta
  - **源代码**：`/app-center/release.ts`
  - **作者**：@Rongronggg9

</details>

### App Store/Mac App Store
<a id="app-storemac-app-store"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### In-App-Purchase Price Drop Alert

- **路由**：`/appstore/iap/:country/:id`
  - **示例**：https://rsshub.app/appstore/iap/us/id953286746
  - **源代码**：`/appstore/in-app-purchase.ts`
  - **作者**：@HenryQW

#### Price Drop

- **路由**：`/appstore/price/:country/:type/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/appstore/iap/us/id953286746
  - **源代码**：`/appstore/price.ts`
  - **作者**：@HenryQW

#### 每日精品限免 / 促销应用（鲜面连线 by AppSo）

- **路由**：`/appstore/xianmian` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/appstore/price/us/mac/id1152443474
  - **源代码**：`/appstore/xianmian.ts`
  - **作者**：@Andiedie

</details>

### Apple
<a id="apple"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### App Update

- **路由**：`/apple/apps/update/:country/:id/:platform?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/apple/apps/update/us/id408709785
  - **源代码**：`/apple/apps.ts`
  - **作者**：@EkkoG, @nczitzk

</details>

### ASUS
<a id="asus"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### BIOS

- **路由**：`/asus/bios/:model` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/appstore/xianmian
  - **源代码**：`/asus/bios.ts`
  - **作者**：@Andiedie

#### GPU Tweak

- **路由**：`/asus/gpu-tweak` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/asus/bios/RT-AX88U
  - **源代码**：`/asus/gpu-tweak.ts`
  - **作者**：@Fatpandac

</details>

### Bilibili
<a id="bilibili"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 更新情报

- **路由**：`/bilibili/app/:id?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/asus/gpu-tweak
  - **源代码**：`/bilibili/app.ts`
  - **作者**：@TonyRL

</details>

### BlueStacks
<a id="bluestacks"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### BlueStacks 5 Release Notes

- **路由**：`/bluestacks/release/5` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bluestacks/release/5
  - **源代码**：`/bluestacks/release.ts`
  - **作者**：@TonyRL

</details>

### Brave
<a id="brave"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Release Notes

- **路由**：`/brave/latest` `🔍 支持 Radar` `🚨 反爬严格` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/bluestacks/release/5
  - **源代码**：`/brave/latest.ts`
  - **作者**：@TonyRL

</details>

### Civitai
<a id="civitai"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Latest models

- **路由**：`/civitai/models` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/brave/latest
  - **源代码**：`/civitai/models.ts`
  - **作者**：@nczitzk

#### Model discussions

- **路由**：`/civitai/discussions/:modelId` `⚙️ 需要配置` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/civitai/models
  - **源代码**：`/civitai/discussions.ts`
  - **作者**：@DIYgod

</details>

### CPUID
<a id="cpuid"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### News

- **路由**：`/cpuid/news` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/cpuid/news
  - **源代码**：`/cpuid/news.ts`

</details>

### Docker Hub
<a id="docker-hub"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Image New Build

- **路由**：`/dockerhub/build/:owner/:image/:tag?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/cpuid/news
  - **源代码**：`/dockerhub/build.ts`

#### Image New Tag

- **路由**：`/dockerhub/tag/:owner/:image/:limits?`
  - **示例**：https://rsshub.app/dockerhub/tag/library/mariadb
  - **源代码**：`/dockerhub/tag.ts`

</details>

### Eagle
<a id="eagle"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Changelog

- **路由**：`/eagle/changelog/:language?`
  - **示例**：https://rsshub.app/eagle/changelog/en
  - **源代码**：`/eagle/changelog.ts`
  - **作者**：@tigercubden

</details>

### F-Droid
<a id="f-droid"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### App Update

- **路由**：`/f-droid/apprelease/:app` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/f-droid/apprelease/com.termux
  - **源代码**：`/f-droid/apprelease.ts`
  - **作者**：@garywill

</details>

### FossHub
<a id="fosshub"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Software Update

- **路由**：`/fosshub/:id`
  - **示例**：https://rsshub.app/f-droid/apprelease/com.termux
  - **源代码**：`/fosshub/index.ts`
  - **作者**：@garywill

</details>

### GoFans
<a id="gofans"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 最新限免 / 促销应用

- **路由**：`/gofans/:kind?`
  - **示例**：https://rsshub.app/fosshub/qBittorrent
  - **源代码**：`/gofans/index.ts`
  - **作者**：@nczitzk

</details>

### Google
<a id="google"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Extension Update

- **路由**：`/google/chrome/extension/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/gofans
  - **源代码**：`/google/extension.ts`
  - **作者**：@DIYgod

</details>

### Greasy Fork
<a id="greasy-fork"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Script Feedback

- **路由**：`/greasyfork/scripts/:script/feedback` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/google/chrome/extension/kefjpfngnndepjbopdmoebkipbgkggaa
  - **源代码**：`/greasyfork/feedback.ts`
  - **作者**：@miles170

#### Script Update

- **路由**：`/greasyfork/:language/:domain?,/scripts/sort/:sort/:language?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/greasyfork/scripts/431691-bypass-all-shortlinks/feedback
  - **源代码**：`/greasyfork/scripts.ts`
  - **作者**：@miles170
- **路由**：`/greasyfork/:language/:domain?,/scripts/sort/:sort/:language?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/greasyfork/en/google.com
  - **源代码**：`/greasyfork/scripts.ts`
  - **作者**：@imlonghao, @miles170

#### Script Version History

- **路由**：`/greasyfork/scripts/:script/versions` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/greasyfork/scripts/431691-bypass-all-shortlinks/versions
  - **源代码**：`/greasyfork/versions.ts`
  - **作者**：@miles170

</details>

### iFi audio
<a id="ifi-audio"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Download Hub

- **路由**：`/ifi-audio/download/:val/:id`
  - **示例**：https://rsshub.app/firecore/ios
  - **源代码**：`/ifi-audio/download.ts`
  - **作者**：@NathanDai

</details>

### ImageMagick
<a id="imagemagick"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Changelog

- **路由**：`/imagemagick/changelog` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/imagemagick/changelog
  - **源代码**：`/imagemagick/changelog.ts`
  - **作者**：@nczitzk

</details>

### Infuse
<a id="infuse"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Release Notes

- **路由**：`/firecore/:os`
  - **示例**：https://rsshub.app/greasyfork/scripts/431691-bypass-all-shortlinks/versions
  - **源代码**：`/firecore/index.ts`
  - **作者**：@miles170

</details>

### IPSW.me
<a id="ipswme"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Apple Firmware Update-IPSWs/OTAs version

- **路由**：`/ipsw/index/:ptype/:pname` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/imagemagick/changelog
  - **源代码**：`/ipsw/index.ts`
  - **作者**：@nczitzk

</details>

### MacUpdate
<a id="macupdate"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Update

- **路由**：`/macupdate/app/:appId/:appSlug?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/firefox/addons/rsshub-radar
  - **源代码**：`/macupdate/app.ts`
  - **作者**：@TonyRL

</details>

### Microsoft Edge
<a id="microsoft-edge"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Addons Update

- **路由**：`/microsoft/edge/addon/:crxid` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/microsoft/edge/addon/gangkeiaobmjcjokiofpkfpcobpbmnln
  - **源代码**：`/microsoft/addon.ts`
  - **作者**：@hoilc, @DIYgod

</details>

### MIUI
<a id="miui"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### New firmware

- **路由**：`/miui/:device/:type?/:region?`
  - **示例**：https://rsshub.app/microsoft/edge/addon/gangkeiaobmjcjokiofpkfpcobpbmnln
  - **源代码**：`/miui/index.ts`
  - **作者**：@hoilc, @DIYgod

</details>

### Mozilla
<a id="mozilla"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Add-ons Update

- **路由**：`/firefox/addons/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/firefox/addons/rsshub-radar
  - **源代码**：`/firefox/addons.ts`
  - **作者**：@DIYgod

</details>

### Neat Download Manager
<a id="neat-download-manager"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Download

- **路由**：`/neatdownloadmanager/download/:os?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/neatdownloadmanager/download
  - **源代码**：`/neatdownloadmanager/download.ts`
  - **作者**：@nczitzk

</details>

### Not a Tesla App
<a id="not-a-tesla-app"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Tesla Software Updates

- **路由**：`/notateslaapp/ota` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/neatdownloadmanager/download
  - **源代码**：`/notateslaapp/update.ts`
  - **作者**：@mrbruce516

</details>

### O&O Software
<a id="oo-software"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Changelog

- **路由**：`/oo-software/changelog/:id` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/notateslaapp/ota
  - **源代码**：`/oo-software/changelog.ts`
  - **作者**：@mrbruce516

</details>

### Postman
<a id="postman"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Release Notes

- **路由**：`/postman/release-notes` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/postman/release-notes
  - **源代码**：`/postman/release-notes.ts`
  - **作者**：@nczitzk

</details>

### PuTTY
<a id="putty"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Change Log

- **路由**：`/putty/changes` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/postman/release-notes
  - **源代码**：`/putty/changes.ts`
  - **作者**：@nczitzk

</details>

### qBittorrent
<a id="qbittorrent"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### News

- **路由**：`/qbittorrent/news` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/putty/changes
  - **源代码**：`/qbittorrent/news.ts`
  - **作者**：@nczitzk

</details>

### RemNote
<a id="remnote"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Changelog

- **路由**：`/remnote/changelog` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/qbittorrent/news
  - **源代码**：`/remnote/changelog.ts`
  - **作者**：@TonyRL

</details>

### RSSHub
<a id="rsshub"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### New routes

- **路由**：`/rsshub/routes/:lang?` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/remnote/changelog
  - **源代码**：`/rsshub/routes.ts`
  - **作者**：@TonyRL, @amakerlife

</details>

### Sony
<a id="sony"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Software Downloads

- **路由**：`/sony/downloads/:productType/:productId` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/rsshub/routes/en
  - **源代码**：`/sony/downloads.ts`
  - **作者**：@EthanWng97

</details>

### SourceForge
<a id="sourceforge"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Software

- **路由**：`/sourceforge/:routeParams?`
  - **示例**：https://rsshub.app/sourceforge/topic=artificial-intelligence&os=windows
  - **源代码**：`/sourceforge/index.ts`
  - **作者**：@JimenezLi

</details>

### TradingView
<a id="tradingview"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Desktop releases and release notes

- **路由**：`/tradingview/desktop` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/tradingview/desktop
  - **源代码**：`/tradingview/desktop.ts`
  - **作者**：@nczitzk

</details>

### Typora
<a id="typora"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Changelog

- **路由**：`/typora/changelog` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/tradingview/desktop
  - **源代码**：`/typora/changelog.ts`
  - **作者**：@nczitzk

#### Dev Release Changelog

- **路由**：`/typora/changelog/dev` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/typora/changelog
  - **源代码**：`/typora/changelog-dev.ts`
  - **作者**：@cnzgray

</details>

### Unraid
<a id="unraid"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Community Apps

- **路由**：`/unraid/community-apps` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/typora/changelog/dev
  - **源代码**：`/unraid/community-apps.ts`
  - **作者**：@nczitzk

</details>

### Western Digital
<a id="western-digital"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Download

- **路由**：`/wdc/download/:id?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/diskanalyzer/whats-new
  - **源代码**：`/wdc/download.ts`
  - **作者**：@nczitzk

</details>

### winstall
<a id="winstall"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Apps Update

- **路由**：`/winstall/:appId` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/wdc/download/279
  - **源代码**：`/winstall/update.ts`
  - **作者**：@TonyRL

</details>

### WizTree
<a id="wiztree"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### What's New

- **路由**：`/diskanalyzer/whats-new` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/unraid/community-apps
  - **源代码**：`/diskanalyzer/whats-new.ts`
  - **作者**：@KTachibanaM

</details>

### WziFile
<a id="wzifile"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Version History

- **路由**：`/wizfile/updates` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/winstall/Mozilla.Firefox
  - **源代码**：`/wizfile/index.ts`
  - **作者**：@Fatpandac

</details>

### Zotero
<a id="zotero"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### Version History

- **路由**：`/zotero/versions` `🔍 支持 Radar` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/wizfile/updates
  - **源代码**：`/zotero/versions.ts`
  - **作者**：@Fatpandac

</details>

### 小米
<a id="小米"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 小米应用商店金米奖

- **路由**：`/mi/golden`
  - **示例**：https://rsshub.app/tencent/qq/sdk/changelog/iOS
  - **源代码**：`/mi/golden.ts`
  - **作者**：@nuomi1

</details>

### 王者荣耀
<a id="王者荣耀"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 更新日志

- **路由**：`/tencent/qq/sdk/changelog/:platform` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/zotero/versions
  - **源代码**：`/tencent/qq/sdk/changelog.ts`
  - **作者**：@jasongzy

</details>
