# 📢 政务消息（government）

本分类共 **3** 条路由。

## 使用方式（给 AI）

1. 先在本页的「服务总览」定位目标站点/服务。
2. 打开对应服务的折叠块，选择与你要订阅的「Feed」最匹配的一条路由。
3. 将路由模板里的 `:参数` 替换为具体值；`?` 表示可选段。
4. 若标注了「反爬严格/需要登录/需要 Cookie」等标签，优先使用自建实例并配置相应环境变量或代理。

## 服务总览（渐进式入口）

| 服务 | 路由数 |
|---|---:|
| [Thailand Department of Lands](#thailand-department-of-lands) | 1 |
| [中国人民银行](#中国人民银行) | 2 |

## 服务详情（按需展开）

### Thailand Department of Lands
<a id="thailand-department-of-lands"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### e-LandsAnnouncement

- **路由**：`/dol/announce/:owner?/:province?/:office?`
  - **示例**：https://rsshub.app/dol/announce
  - **源代码**：`/dol/announce.ts`
  - **作者**：@itpcc

</details>

### 中国人民银行
<a id="中国人民银行"></a>

<details>
<summary>展开 / 收起 路由列表</summary>

#### 太原市人力资源和社会保障局政府公开信息

- **路由**：`/gov/taiyuan/rsj/:caty/:page?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/gov/taiyuan/rsj/gggs
  - **源代码**：`/gov/taiyuan/rsj.ts`
  - **作者**：@2PoL

#### 深圳市委组织部

- **路由**：`/gov/shenzhen/zzb/:caty/:page?` `🔍 支持 Radar`
  - **示例**：https://rsshub.app/gov/shenzhen/zzb/tzgg
  - **源代码**：`/gov/shenzhen/zzb/index.ts`
  - **作者**：@zlasd

</details>
