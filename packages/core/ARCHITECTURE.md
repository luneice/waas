# @spider/core 架构设计

## 概述

`@spider/core` 是 spider monorepo 的核心框架层，为所有爬虫 Skill 提供统一的抽象基础设施。采用 **Template Method + 依赖注入 + 声明式装饰器** 三大模式，实现关注点分离和代码复用。

```
@spider/core
├── errors/          ← 错误体系：SkillFailureKind 闭合枚举 + SpiderError 子类
├── observability/   ← 事件模型与 Sink（运行时服务在 runtime/）
├── runtime/         ← RuntimeContext：AsyncLocalStorage 注入的横切能力
├── goal/            ← Goal 引擎：装饰器体系 + 执行器
├── skill/           ← Skill 基础设施：契约、基类、注册表
├── browser/         ← 浏览器连接层：会话管理、连接器、池化、路由
├── storage/         ← 产物持久化：Artifact + IArtifactSink 策略
├── puppeteer/       ← Page 驱动的 Skill 体系：Lifecycle、Hook、装饰器、Skill 基类
├── license/         ← 纯离线 RSA 验签、机器指纹、通行令牌
├── cli/             ← 通用 CLI 入口（runCLI）
└── testing/         ← 运行时 helper（FakePage 等，非测试运行器）
```

`src/index.ts` 的导出顺序即依赖方向，不可逆序依赖。

---

## 1. 分层架构

### 继承层级

```
ISkill<TParams extends object> (接口)
  │
  BaseSkill (抽象基类 — skill/)
  │  ├ id / name / description / paramSchema
  │  ├ normalizeParams(p: TParams): TParams   → 类型保留：参数校验 & 归一化
  │  ├ validateWithSchema(p: TParams)          → 基于 paramSchema 自动校验(required + type)
  │  ├ addWarning() / peekWarnings()           → 软告警收集
  │  ├ buildSuccess(data, params, startedAt)    → 构建成功返回体 (SkillResultSuccess<T>)
  │  ├ buildFailure(error, params, startedAt)   → 构建失败返回体 (SkillResultFailure)
  │  └ abstract execute()                       → ★ 这层没有实现，纯 HTTP Skill 要自己写整个 execute()
  │
  PuppeteerSkill (抽象类 — puppeteer/)
  │  ├ deps: PuppeteerSkillDeps              ← 构造函数注入（goalExecutor? 可选）
  │  ├ abstract siteURL                      ← 站点基础地址
  │  ├ abstract getPath(params: TParams)     ← 导航路径（类型安全）
  │  ├ abstract fetchData(page, params, options?, ctx?)  ← 核心数据获取
  │  ├ navigate(page, params, ctx?)          ← siteURL + getPath 拼接导航（可覆写）
  │  ├ get pipeline(): ProjectionPipeline    ← ★ 投影的唯一承载形式，默认 {}（identity）
  │  ├ get waitForSelector(): string | null  ← 导航后等待条件（可覆写）
  │  ├ get hooks(): IPageHook[]              ← 声明式 Hook 列表（可覆写）
  │  └ execute()                             ← ★ Template Method 在这层实现
  │
  PuppeteerGoalSkill (抽象类 — puppeteer/)
     ├ abstract createGoal(params: TParams)    ← 创建 Goal 实例（类型安全）
     └ fetchData() = GoalExecutor.execute(createGoal(params))  ← 非密封，子类可覆写
```

> ⚠️ **框架不调用任何 `project()` 方法。** 投影只有 `pipeline` getter 一种承载形式。写 `protected project()` 不会报错也不会执行 —— `TProjected` 形同虚设而 typecheck 静默通过，是最难发现的一类 bug。原委见 `puppeteer/projection.ts` 文件头。

### Page Lifecycle（`PuppeteerSkill.execute()`）

```
params (宽入, TParams)
    │
    ▼
normalizeParams(p: TParams): TParams  ← 类型保留的参数校验 / 归一化
    │
    ▼
validateWithSchema(p: TParams)         ← 基于 paramSchema 自动校验 required + type
    │
    ▼
new PageContext(params)        ← 创建 per-call 上下文（typed Slot API）
    │
    ▼
sessionProvider.acquire()      ← DI：浏览器会话获取
    │
    ▼  ┌─ activateHooks(装饰器 + 实例 hooks) ─┐
    │  │                                       │
    │  │  ① SETUP — hooks.setup(page, ctx)     │  ← 挂监听器、设拦截、写 ctx 初始值
    │  │        │                               │
    │  │  ② NAVIGATE — navigate(page, p, ctx)  │  ← Skill 自身：siteURL + getPath
    │  │        │                               │
    │  │  ③ WAIT — waitForSelector             │  ← 声明式等待条件（可选）
    │  │        │                               │
    │  │  ④ READY — hooks.ready(page, ctx)     │  ← 导航后就绪判断
    │  │        │                               │
    │  │  ⑤ INTERACT — hooks.interact(p, ctx)  │  ← 页面操作：滚动、点击
    │  │        │                               │
    │  │  ⑥ FETCH — fetchData(page, ..., ctx)  │  ← Skill 自身：核心数据获取
    │  │        │                               │
    │  │  ⑦ EXTRACT — hooks.extract(page, ctx) │  ← 收割被动捕获 + 主动下载
    │  │        │                               │
    │  │  ⑧ TRANSFORM — hooks.transform(p,ctx) │  ← 过滤、转换、元数据组装
    │  │        │                               │
    │  │  ⑨ PERSIST — hooks.persist(page, ctx) │  ← 二进制 → 磁盘，生成 Artifact[]
    │  │        │                               │
    │  │  ⑩ PROJECTION — this.pipeline         │  ← normalize→project→envelope→emit
    │  │        │                               │
    │  │  ⑪ BUILD — buildSuccess(projected)    │  ← 组装 SkillResult 信封
    │  │        │                               │
    │  │  ⑫ TEARDOWN — hooks.teardown(p, ctx)  │  ← finally：清理监听器
    │  │                                       │
    │  └───────────────────────────────────────┘
    │
    ▼
buildSuccess(data)             ← 成功 → SkillResultSuccess<T> { data, artifacts? }
       (catch → buildFailure(error) → SkillResultFailure)
```

**12 个环节里只有 7 个是可插拔 Stage**：`setup / ready / interact / extract / transform / persist / teardown`。
navigate / waitForSelector / fetchData / projection / buildSuccess 由 `execute()` 直接完成，**不经 Hook** —— 想扩展行为只能挂那 7 个，别试图 hook navigate。

**阶段与职责边界**：

| 阶段       | 驱动方 | 可插拔 | 职责                                                                                    |
| ---------- | ------ | ------ | ----------------------------------------------------------------------------------------- |
| setup      | Hook   | ✅     | 导航前准备：挂 response 监听、设置拦截、设 viewport/UA。**此时页面还是 `about:blank`**     |
| navigate   | Skill  | ❌     | `siteURL + getPath(params)` → `page.goto()`。重试用 `@RetryNavigation`                    |
| wait       | Skill  | ❌     | 导航后等待条件：声明式 `waitForSelector` 属性（可选）                                       |
| ready      | Hook   | ✅     | 导航后就绪判断。页面已落在目标站点，**需要读写站点存储的逻辑挂这里**                        |
| interact   | Hook   | ✅     | 操作页面：点击展开、滚动加载、翻页、填表提交                                                |
| fetchData  | Skill  | ❌     | Skill 自身核心逻辑：读取数据，通过 `ctx` 与 Hook 通信                                       |
| extract    | Hook   | ✅     | 数据采集：从监听器收割已捕获的响应和媒体、主动下载浏览器未加载的资源                        |
| transform  | Hook   | ✅     | 数据加工：过滤不相关捕获、元数据组装、数据转换                                              |
| persist    | Hook   | ✅     | 持久化：`ArtifactPersistHook` 将 Buffer 写入 `IArtifactSink`，生成 `Artifact[]` 写回 ctx    |
| projection | Skill  | ❌     | `runProjectionPipeline(this.pipeline, ...)`：四阶段投影 + 副作用产出                        |
| teardown   | Hook   | ✅     | 执行结束（finally）：忽略激活条件、吞掉所有异常，保证清理必然发生                            |

navigate 和 fetchData 是 Skill 的核心职责，不暴露为 Hook 阶段。所有阶段统一通过 `PageContext` 通信。

> **PageContext**：per-call 上下文对象，提供 `params` + `options` + 类型化 Slot API 贯穿全阶段。跨阶段通信必须通过 `SlotKey<T>`（`ctx.get(slot)` / `ctx.set(slot, value)` / `ctx.require(slot)`），编译期即可校验值形状。不再暴露裸 `Map` 属性。每次 `execute()` 创建新实例，避免并发竞态。

---

## 2. 模块详解

### 2.1 Goal 引擎（`goal/`）

声明式装饰器体系，让数据获取逻辑以「声明配置 + 响应映射方法体」的形式表达。

| 装饰器       | 职责                                                   |
| ------------ | ------------------------------------------------------ |
| `@Goal`      | 类级：声明 Goal 标识与默认配置                         |
| `@Endpoint`  | 方法级：声明 HTTP 请求（method, url, body/query 构造） |
| `@Paginated` | 方法级：翻页策略（pageSize, stopWhen, cursor）         |
| `@Expanded`  | 方法级：展开 — 源数据 → 并发请求                       |
| `@Aggregate` | 方法级：聚合 — 最终结果组装                            |

**执行流程**：`GoalExecutor` 读取装饰器元数据，按拓扑顺序执行 Endpoint → Paginated → Expanded → Aggregate，方法体负责响应转化（字段映射、投影）。

**启动前校验**（fail-fast）：

- 验证 `@Aggregate` 装饰器存在（Goal 必须有聚合方法）
- 验证所有 `@Endpoint`/`@Paginated`/`@Expanded` 方法在 Goal 实例上存在
- 将已知 Endpoint 名称注册到 `GoalContext`（用于 `ctx.get()` 拼写检查）

**运行时安全**：

- `GoalContext.get(methodName)` 在返回数据前验证 methodName 是否存在于当前 Goal 定义中（防止拼写错误静默返回 undefined）
- `@Endpoint` 支持 `responseType: "json" | "text" | "blob"`（blob 返回 base64 编码）
- `@Expanded` 使用预计算索引代替 `indexOf` 查找，避免 O(n²) 复杂度
- `@Paginated` 始终使用方法体返回值作为累积结果

**关键类型**：

- `BaseGoal<TResult>` — Goal 抽象基类（子类 + 装饰器组合使用）
- `GoalExecutor` — 装饰器驱动的执行引擎
- `GoalContext` — Endpoint 间数据共享上下文（含已知 Endpoint 校验）
- `createGoalExecutor()` — 工厂函数

### 2.2 Skill 基础设施（`skill/`）

| 组件                    | 说明                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| `ISkill<TParams>`       | Skill 公共接口：`TParams extends object`，id, name, description, paramSchema, execute()          |
| `BaseSkill`             | 抽象基类：normalizeParams() 类型保留返回 TParams、validateWithSchema()、addWarning()、buildSuccess/Failure。`execute()` 仍是 abstract |
| `SkillRegistry`         | 注册表：register → list → execute（按 id 路由）                                                   |
| `SkillResult<T>`        | **判别联合体**：`SkillResultSuccess<T> \| SkillResultFailure`，通过 `success` 字段区分            |
| `SkillResultSuccess<T>` | 成功体：`{ success: true, data: T, metadata, artifacts? }`                                        |
| `SkillResultFailure`    | 失败体：`{ success: false, error: string, data?: unknown, metadata }`                             |
| `SkillResultMetadata`   | 执行元信息：skillId, skillName, params, startedAt, completedAt, durationMs                        |
| `SkillParamSchema`      | 参数自描述元数据（用于 CLI --list、Agent 自发现、validateWithSchema 自动校验）                    |
| `SkillFailureKind`      | 标准化错误分类联合类型，按 6 大 Category（browser/auth/params/upstream/pipeline/business）展开。详见 `errors/` 模块及下文「错误体系」一章。 |
| `formatError()` *(legacy)* | 旧版错误格式化函数，已 @deprecated。新代码请直接 `throw new SpiderError`/`MissingContextError` 等，由 `BaseSkill.buildFailure` 自动归一化。 |
| `SkillResultMetadata.errorInfo` | 失败结果中的结构化错误信息（`SpiderErrorInfo`）：`{ kind, category, phase, scope, details, retryable, cause }`，AI 消费方据此判断是否重试 |
| `SkillResultMetadata.warnings`  | 软告警列表（`SkillWarning[]`），通过 `BaseSkill.addWarning(warning)` 累积 — 不阻断执行也不进 stdout |

> ⚠️ **`BaseSkill.execute()` 是 abstract。** 直接继承 `BaseSkill`（纯 HTTP 模式）意味着你要自己写整个 execute()：调 `normalizeParams` → `validateWithSchema` → 取数 → `runProjectionPipeline`（若需要）→ `buildSuccess` / `buildFailure`。只有继承 `PuppeteerSkill` 才免费获得 12 环节模板。

> ⚠️ **`normalizeFailure` 只对 `typeof error === "string"` 解析 `[kind]` 前缀。** Error 实例即便消息里带 `[browser-unavailable]` 也会被兜底成 `pipeline-error`（不可重试）。所以框架内**必须抛 `SpiderError` 子类**，不能靠字符串前缀传递语义。

### 2.3 投影管道（`puppeteer/projection.ts`）

**投影是框架的核心价值，不是可选修饰**：上游 API 返回什么、字段叫什么名字，都不应泄漏给消费者。投影层负责显式枚举字段、重命名为语义化业务术语、剥离内部 ID 与噪声 —— 上游改版时只需要改这一层。

```
normalize  → 通用裁剪 / 命名归一化（如 stripNoise）
project    → 业务字段抽取（TRaw → TPayload）
envelope   → 包装成 AI-Ready 信封（TPayload → TProjected）
emit       → 副作用产出（markdown 落盘、通知）— 不改变返回值
```

四个阶段**全部可选**，省略即 identity。`options.projectionMode === "raw"`（CLI `--raw`）时整条管道被 bypass，直接返回 `fetchData` 的原始结果，仅用于核对上游响应。

**泛型有四个参数，但基类默认签名把 `TPayload` 锁成了 `TResult`**：

```typescript
protected get pipeline(): ProjectionPipeline<TParams, TResult, TResult, TProjected>
```

所以**单层投影必须写在 `envelope` 阶段**，写进 `project` 会类型不匹配（`TPayload = TResult ≠ TProjected`）。只有子类显式写全四个泛型、真正需要两级转换（先裁剪成中间结构再包信封）时才用 `project`。

**`ProjectionContext`** 携带投影所需的一切：`params`（归一化后的入参）、`pageContext`（读 Slot）、`artifacts`（persist 产出）、`warnings`、`runtime`、`addWarning()`。

> ⚠️ **投影不得依赖实例字段。** 派生值若无法从 `ctx.params` 还原，一律走 Slot：`fetchData` 里 `ctx.set(XxxSlot, v)` → `envelope` 里 `ctx.pageContext.get(XxxSlot)`。用 `private currentXxx` 暂存会在并发 `execute()` 之间串数据 —— 每次 execute 新建 `PageContext` 正是为了杜绝这个。注意 `normalizeParams` 早于 `PageContext` 创建，**不能在那里写 Slot**。

### 2.4 产物持久化（`storage/`）


Skill 管道的持久化抽象 — 将二进制捕获转为磁盘文件，输出零二进制的 Artifact 清单。

#### 核心类型

| 类型               | 说明                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| `Artifact`         | Value Object：`{ path, relativePath?, role, contentType, sourceUrl?, sizeBytes }` — 持久化后的产物描述 |
| `ArtifactMeta`     | write() 的元信息参数：`{ role, contentType, sourceUrl? }`                                              |
| `IArtifactSink`    | 策略接口：`write(key, data, meta) → Promise<Artifact>`                                                 |
| `FileArtifactSink` | 本地文件系统实现 — 写入 `outputDir` 下，返回相对路径                                                   |

`Artifact.relativePath`：相对于 `artifactPrefix` 的路径（如 `"images/001_章节速览.png"`），供 Markdown 文件内部图片引用使用；`path` 为完整相对路径（如 `"assets/课程名/01-文章/images/001_章节速览.png"`）。

#### 设计原则

- **零二进制输出**：`Artifact` 只包含文件路径和元信息，不包含 Buffer。AI 消费者通过 `path` 引用文件
- **语义角色**：`role` 字段让消费者理解产物用途（`"content-image"` / `"video"` / `"api-snapshot"`）
- **策略可替换**：`IArtifactSink` 支持本地文件、OSS、数据库等后端，通过 DI 注入
- **可配置前缀**：Hook 可在 `ctx` 通过 `ctx.set(ArtifactPrefixSlot, ...)` 指定存储路径前缀，缺省为 `"media"`
- **MIME 分类子目录**：`ArtifactPersistHook` 按媒体类型自动分至 `images/` / `audio/` / `video/` 子目录
- **人类可读命名**：Hook 可在 `ctx` 写入 `ArtifactLegendsSlot`（`Map<url, legend>`），优先以 legend 作为文件名

#### Artifact 生命周期

```
setup                     → ctx.set(ArtifactPrefixSlot, "assets/课程名/01-文章标题")
                            （Hook 可选：不设则退化为 "media"）
    │
    ▼
@CaptureMedia             → ctx.set(CapturedMediaSlot, Map<url, CapturedEntry<Buffer>>)
    │
    ▼
transform Hook            → 修剪 Map，只保留正文引用的媒体
                            同时写入 ctx.set(ArtifactLegendsSlot, Map<url, legend>)
    │
    ▼
ArtifactPersistHook       → 读取 prefix + legends
    │                        按 MIME 分类：images/ audio/ video/
    │                        文件名：legend（优先）→ URL 推导 → media_NNN 兜底
    │                        IArtifactSink.write(`${prefix}/${subdir}/${filename}`)
    │                        artifact.relativePath = `${subdir}/${filename}`
    │                        写回 ctx.set(ArtifactsSlot, ...)
    ▼
pipeline.envelope         → ctx.pageContext.get(ArtifactsSlot)
                            → 用 artifact.relativePath 重写内容图片引用
pipeline.emit             → IArtifactSink.write(`${prefix}/article.md`) 落地 Markdown
    │
    ▼
result.artifacts          → SkillResultSuccess<T>.artifacts?: Artifact[]
```

**ctx 约定 Slot（强类型；通用 Slot 定义在 `puppeteer/slots.ts`，`StorageResetReportSlot` 随其 Hook 定义在 `puppeteer/storage-reset.ts`）**：

| Slot                     | 类型                  | 说明                                              |
| ------------------------ | --------------------- | ------------------------------------------------- |
| `ArtifactsSlot`          | `Artifact[]`          | persist 后写入，供 `pipeline.envelope` / `.emit` 读取       |
| `ArtifactPrefixSlot`     | `string`              | 存储路径前缀，setup Hook 写入                      |
| `ArtifactLegendsSlot`    | `Map<string, string>` | URL → legend 映射，transform Hook 写入             |
| `CapturedMediaSlot`      | `Map<url, CapturedEntry>` | `@CaptureMedia` 写入的二进制资源              |
| `StorageResetReportSlot` | `StorageResetReport`  | `@StorageReset` 执行后落地的清理摘要               |

> ⚠️ v2 起统一改为 `defineSlot<T>()` 创建的强类型 Slot；旧字符串常量 `ARTIFACTS_KEY` / `ARTIFACT_PREFIX_KEY` / `ARTIFACT_LEGENDS_KEY` 仍从 `artifact-persist.ts` 导出为**兼容别名**（= 对应 Slot 的 `.name`），新代码不要使用。

### 2.5 浏览器连接层（`browser/`）

纯连接管理 — 不含 Skill 基类、Page Lifecycle 或装饰器。

#### 核心架构

```
Skill 层
  │
  ▼
ChromeSessionProvider (IBrowserSessionProvider)
  │  唯一入口 — 下层 Skill 只依赖此类
  │  职责: acquire() → BrowserLease → newPage() → PageSession
  │
  ▼
IBrowserConnector (策略接口)
  │  可插拔的浏览器来源
  │  职责: acquire() → BrowserLease { browser, release() }
  │
  ├── CDPConnector          ← 本地/单节点 HTTP CDP 直连
  ├── PooledConnector       ← 多端点连接池 + 路由
  └── ... (future: WS、手机浏览器等)
```

**设计原则**：下层 Skill 永远只看到 `ChromeSessionProvider`，不关心浏览器从哪里来（本地 CDP、远程 WS、连接池、手机浏览器……）。连接来源的变化通过 `IBrowserConnector` 策略注入，对下层完全透明。

#### 接口

| 类型                      | 说明                                                           |
| ------------------------- | -------------------------------------------------------------- |
| `PageSession`             | RAII 风格浏览器会话 — `{ page, release() }`                    |
| `BrowserLease`            | 浏览器租约 — `{ browser, release() }`，由 Connector 返回       |
| `IBrowserConnector`       | 连接策略接口 — `acquire()` → `BrowserLease`，`getWSEndpoint()` |
| `IBrowserSessionProvider` | 会话提供者接口（`ChromeSessionProvider` 实现）                 |
| `BrowserAcquireOptions`   | acquire 选项：browserURL / site / requiredTags                 |
| `BrowserSkillOptions`     | 执行选项扩展：browserURL, page, site, requiredTags             |

#### 连接器（策略实现）

| 类                | 说明                                                                        |
| ----------------- | --------------------------------------------------------------------------- |
| `CDPConnector`    | 单连接：每次 acquire 建立新 puppeteer.connect，超时后自动 disconnect 防泄漏 |
| `PooledConnector` | 委托 `BrowserPool`：多端点路由、并发控制、健康检查、长连接复用              |

#### 池化 & 路由

| 类                | 说明                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------- |
| `BrowserPool`     | 连接池 — 每个 `BrowserEndpoint` 维护长连接，支持 `acquirePage()` 和 `acquireBrowserLease()` |
| `CompositeRouter` | 路由策略 — 健康过滤 → 硬约束（site/tags）→ 软约束打分 → 并发上限 → Least Connections        |
| `BrowserEndpoint` | 端点描述符 — `{ id, url, tags, maxConcurrency }`                                            |

**策略是按端点数量自动选的**：单端点用 `CDPConnector` 直连，多端点自动切 `PooledConnector` + `BrowserPool` + `CompositeRouter`。对 Skill 完全透明。

`BrowserPoolOptions.acquireTimeoutMs`（默认 60s，`0` = 不限）限制**等待并发槽位**的时长。超时抛 `BrowserAcquireTimeoutError`（可重试）；`dispose()` 会把所有等待者用 `BrowserUnavailableError` reject —— 二者都不能让调用方悬挂。

### 2.6 Page 生命周期体系（`puppeteer/`）

#### 核心概念：三层抽象

```
IPageHook (接口)       — 声明 Hook 能参与哪些阶段
    │
LifecycleStage (抽象类) — 每个阶段的执行策略（pick + run）
    │
PageLifecycle (编排器)  — 将多个 Stage 按声明顺序组合
```

#### PageContext（`puppeteer/context.ts`）

| 类                    | 说明                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------- |
| `PageContext<TParams>` | per-call 上下文 — `params` + `options` + 私有 `_slots: Map` 贯穿全阶段                       |
| `SlotKey<T>`           | 携带类型信息的上下文键（phantom type），运行时只保留 `name` 作为底层 Map key                  |
| `defineSlot<T>(name)`  | 工厂函数：创建新的类型化 Slot                                                                |

**Slot API**：`ctx.get<T>(slot)` / `ctx.set<T>(slot, value)` / `ctx.require<T>(slot)` / `ctx.has(slot)` / `ctx.delete(slot)` / `ctx.getOrCreate<T>(slot, factory)`

**内置 Slot**（`puppeteer/slots.ts`）：

| Slot                  | 类型                                | 说明                                   |
| --------------------- | ----------------------------------- | -------------------------------------- |
| `CapturedMediaSlot`   | `Map<string, CapturedEntry<Buffer>>` | 已捕获的媒体资源（@CaptureMedia 写入） |
| `ArtifactsSlot`       | `Artifact[]`                        | persist 后的产物清单                   |
| `ArtifactPrefixSlot`  | `string`                            | 存储路径前缀（@Setup 阶段写入）       |
| `ArtifactLegendsSlot` | `Map<string, string>`               | URL → legend 映射（transform 写入）   |

所有阶段（Skill 方法和 Hook 方法）统一通过 `PageContext` 的 Slot API 通信。`fetchData` 和 `navigate` 的签名均以 `ctx?: PageContext` 作为参数。

#### IPageHook（`puppeteer/hooks.ts`）

```typescript
interface IPageHook {
  readonly name: string;

  /**
   * 运行时激活条件 — 每个 Stage **进入前**都会重新求值（lazy）。
   * 默认 true。teardown 例外：为保证资源清理，即使返回 false 仍会被执行。
   */
  shouldActivate?(ctx: PageContext<any>): boolean;

  // Page Control
  setup?(page, ctx): Promise<HookOutcome>;     // 导航前
  ready?(page, ctx): Promise<HookOutcome>;     // 导航后就绪
  interact?(page, ctx): Promise<HookOutcome>;  // 页面操作

  // Data Pipeline
  extract?(page, ctx): Promise<HookOutcome>;   // 数据采集
  transform?(page, ctx): Promise<HookOutcome>; // 数据加工
  persist?(page, ctx): Promise<HookOutcome>;   // 持久化

  // Cleanup
  teardown?(page, ctx): Promise<HookOutcome>;  // finally
}
```

> Hook 只有这 7 个阶段。**副作用产出不是 Hook 阶段** —— 走 `ProjectionPipeline.emit`。

**HookSignal** — Hook 方法返回 `HookOutcome`（`void | HookSignal`）：

| 信号              | 效果                                                                 |
| ----------------- | -------------------------------------------------------------------- |
| `SKIP_STAGE`      | 跳过当前 Stage 的剩余 Hook，其它 Stage 继续执行                     |
| `SKIP_PIPELINE`   | 跳过所有后续 Data Pipeline 阶段（直接进入投影 → teardown）。**受控信号，不是错误** |
| `abortPipeline()` | 中止整个 Skill 执行，跳到 teardown 并产出 failure 结果               |

**激活谓词** — 声明式 `shouldActivate` 辅助函数（`ActivationPredicate`）：

| 函数                | 说明                                      |
| ------------------- | ----------------------------------------- |
| `whenParam(name)`   | 参数字段为 truthy 时激活                  |
| `whenParamNot(n,v)` | 参数字段不等于给定值时激活                |
| `whenSlot(slot)`    | 指定 Slot 已赋值时激活                    |
| `not(p)`            | 取反                                      |
| `allOf(...ps)`      | 全部满足                                  |
| `anyOf(...ps)`      | 任一满足                                  |

一个 Hook 可以实现任意阶段的组合。多个 Hook 按声明顺序执行。

#### LifecycleStage（`puppeteer/lifecycle.ts`）

每个阶段是独立的执行单元：

| Stage           | 执行策略           | 说明                                                       |
| --------------- | ------------------ | ---------------------------------------------------------- |
| `SetupStage`    | 顺序，异常传播     | 导航前准备                                                 |
| `ReadyStage`    | 顺序，异常传播     | 导航后就绪                                                 |
| `InteractStage` | 顺序，异常传播     | 页面操作                                                   |
| `ExtractStage`  | 顺序，异常传播     | 数据采集                                                   |
| `TransformStage`| 顺序，异常传播     | 数据加工                                                   |
| `PersistStage`  | 顺序，异常传播     | 持久化                                                     |
| `TeardownStage` | 顺序，**异常吞没** | finally 清理，忽略 shouldActivate，不阻断流程              |

> 旧的 `EmitStage` 已被废弃，副作用产出（markdown 落盘、发通知等）现在由 `ProjectionPipeline.emit` 完成，
> 与数据投影 (`normalize / project / envelope`) 同位于 Skill 中、不再作为 Lifecycle 阶段。

每个 Hook **进入每个 Stage 前**都会惰性求值 `shouldActivate(ctx)`（lazy per-stage），允许 Hook 响应前面 Stage 写入的 Slot 数据。

`defaultLifecycle`：标准 PageLifecycle 实例，包含上述全部 Stage（teardown 除外，独立在 finally 中执行）。

`PageLifecycle.runDataPipeline(hooks, page, ctx)`：按 `DATA_PIPELINE_STAGES`（extract → transform → persist）顺序执行，捕获 `PipelineHalt` 实现 skipPipeline 语义。

#### 拦截器体系（`puppeteer/interceptor.ts` + `puppeteer/response-interceptor.ts`）

```
IPageHook (接口)
  │
  └── abstract PageInterceptor<TEvent>     ← 拦截器抽象基类
        │  通用：first/all 模式调度、key/timeout/activateOn
        │  通用：ctx 读写（并发安全，无实例状态）
        │  通用：setup → subscribe + extract → collect + teardown → unsubscribe
        │
        │  子类实现 4 个抽象方法：
        │    subscribe(page, handler)   — 绑定到页面事件
        │    unsubscribe(page, handler) — 解绑
        │    matches(event)             — 匹配条件
        │    parseEvent(event)          — 从事件中提取数据
        │
        └── ResponseInterceptor          ← HTTP 响应拦截
              page.on("response") + URL/content-type 匹配 + body 解析
```

| 类                           | 说明                                                                        |
| ---------------------------- | --------------------------------------------------------------------------- |
| `PageInterceptor<T>`         | 抽象基类 — first/all 双模式调度、超时管理、teardown 自动清理监听器          |
| `ResponseInterceptor`        | HTTP 响应拦截器 — RegExp 匹配 URL / string[] 匹配 content-type / 自定义谓词 |
| `CapturedEntry`              | 已捕获条目 — `{ url, mimeType, body }`                                      |
| `InterceptorOptions`         | 基础配置 — `into: SlotKey`, mode, timeoutMs, `activateWhen: ActivationPredicate` |
| `ResponseInterceptorOptions` | 扩展配置 — + match (ResponseMatcher), parse (ResponseParse)                      |

#### Page 装饰器（`puppeteer/decorators.ts`）

两层装饰器正交组合：Goal 装饰器管 HTTP 数据流，Page 装饰器管浏览器交互。

**类级装饰器** — 注册 Hook 元数据到类原型，运行时由 `getClassHooks()` 沿继承链（基类→派生类）收集。

| 装饰器             | 阶段                   | 说明                                                                      |
| ------------------ | ---------------------- | ------------------------------------------------------------------------- |
| `@CaptureResponse` | setup+extract+teardown | 按 URL 模式拦截页面网络响应。`into: SlotKey<T>` 指定写入的 Slot           |
| `@CaptureMedia`    | setup+extract+teardown | 按 content-type 捕获媒体。`into` 默认 `CapturedMediaSlot`                 |
| `@BlockResource`   | setup+teardown         | 阻止特定资源类型加载。`activateWhen` 支持类型化谓词                       |
| `@Viewport`        | setup                  | 设置页面视口尺寸                                                          |
| `@UserAgent`       | setup                  | 设置页面 User-Agent                                                       |
| `@Screenshot`      | 错误时                 | 出错时自动截图（由 `tryScreenshot()` 实现）                               |

**方法级装饰器** — 将 Skill 自身的方法注册为 Hook 阶段入口，由 `buildSelfHook(instance)` 聚合为单个 IPageHook。

| 装饰器        | 对应阶段     | 说明                                      |
| ------------- | ------------ | ----------------------------------------- |
| `@Setup()`    | setup        | 导航前准备（配置 Slot、挂监听等）         |
| `@Ready()`    | ready        | 导航后就绪判断                            |
| `@Interact()` | interact     | 页面操作                                  |
| `@Extract()`  | extract      | 数据采集                                  |
| `@Transform()`| transform    | 数据加工                                  |
| `@Persist()`  | persist      | 持久化                                    |
| `@Teardown()` | teardown     | 清理                                      |

所有方法装饰器可选 `{ when?: ActivationPredicate }` 参数控制激活条件。

**Hook 组合顺序**（`composeHooks()`）：classHooks（继承链，基类优先） → instanceHooks（`get hooks()`） → selfHook（方法装饰器） → ArtifactPersistHook。

> ⚠️ **所有类级装饰器都必须通过 `pushClassHook(target, hook)` 注册。** `composeHooks()` 只认 `getClassHooks()`；自建元数据键 + 自建 builder 的装饰器**不报错也不生效**（`@StorageReset` 曾如此，装饰器写了等于没写）。

#### Skill 模板（`puppeteer/`）

| 类                   | 说明                                                                                |
| -------------------- | ----------------------------------------------------------------------------------- |
| `PuppeteerSkill`     | Template Method 基类 — 驱动 Page Lifecycle，composeHooks 自动组合 classHooks + instanceHooks + selfHook + ArtifactPersistHook |
| `PuppeteerGoalSkill` | Goal 驱动中间层 — fetchData 委托给 GoalExecutor（非密封，子类可覆写）                                                        |

**关键设计决策：**

- **类型保留的 `normalizeParams`**：`normalizeParams(p: TParams): TParams` 而非返回 `Record<string, unknown>`，消除了整条调用链上的类型擦除。子类的 `getPath`、`createGoal`、`fetchData` 均接收强类型 `TParams`，彻底消灭 `as` 类型断言。

- **方法级装饰器取代 `initContext`**：已废弃的 `initContext` 由 `@Setup()` 方法装饰器替代。子类将派生状态写入 Slot（如 `ctx.set(ArtifactPrefixSlot, ...)`），`shouldActivate` 每 Stage 重新求值可响应前面 Stage 写入的值。

- **非密封的 `PuppeteerGoalSkill.fetchData`**：默认实现委托给 `GoalExecutor.execute(createGoal(params))`，但子类可覆写以实现 **Goal+Hook 双模式**（如 CourseArticleDetailSkill 的 override/auto-navigation 双路径）或在调用 Goal 前对 params 做扁平化处理。

- **`PuppeteerSkillDeps.goalExecutor?`**：声明为可选字段，`GoalSkillDeps` extends 时收窄为必填。不再需要 `declare` hack 重声明 deps 类型。

---

## 3. URL 模型

采用 **siteURL + getPath(params)** 两级拆分：

```typescript
// 站点固定基址（abstract readonly）
protected abstract readonly siteURL: string;
// "https://<数据源域名>"

// 路径由参数决定（abstract method，参数强类型）
protected abstract getPath(params: TParams): string;
// 静态: () => "/#/data/category"
// 动态: (p) => `/search/result?q=${p.keyword}`
// 跳过导航: () => ""
```

`navigate(page, params, ctx?)` 自动拼接并调用 `page.goto()`，子类可覆写以实现定制导航逻辑。

---

## 4. 依赖注入

所有 `PuppeteerSkill` / `PuppeteerGoalSkill` 子类通过构造函数接收分层依赖：

```typescript
/** PuppeteerSkill 仅需浏览器会话（goalExecutor 可选，供混合模式 Skill 使用） */
interface PuppeteerSkillDeps {
  sessionProvider: IBrowserSessionProvider;
  artifactSink?: IArtifactSink;
  goalExecutor?: GoalExecutor;  // 可选 — PuppeteerSkill 层不强制要求
}

/** PuppeteerGoalSkill 收窄为必填 goalExecutor */
interface GoalSkillDeps extends PuppeteerSkillDeps {
  goalExecutor: GoalExecutor;   // 必填 — 通过 extends 收窄
}
```

每层只声明自己需要的依赖（接口隔离原则）：

- `PuppeteerSkill` → `PuppeteerSkillDeps`（sessionProvider + artifactSink?）
- `PuppeteerGoalSkill` → `GoalSkillDeps`（sessionProvider + artifactSink? + goalExecutor）

各 spider 的 `registry.ts` 负责组装依赖（IoC 入口）：

```typescript
export const createDefaultRegistry = (
  deps?: Partial<GoalSkillDeps>,
  browserURL?: string,
  outputDir?: string,
): SkillRegistry => {
  const baseDir = outputDir ?? process.cwd();
  const resolved: GoalSkillDeps = {
    sessionProvider:
      deps?.sessionProvider ?? new ChromeSessionProvider({ browserURL }),
    goalExecutor: deps?.goalExecutor ?? createGoalExecutor(),
    artifactSink: deps?.artifactSink ?? new FileArtifactSink(baseDir),
  };
  return new SkillRegistry()
    .register(new SomeSkill(resolved))
    .register(new AnotherSkill(resolved));
};
```

---

## 5. 子类实现指南

### 5.1 Goal 驱动型 Skill（大多数场景）

继承 `PuppeteerGoalSkill`，实现 4 个抽象成员 + `pipeline`：

```typescript
class MySkill extends PuppeteerGoalSkill<MyParams, MyGoalResult, MyProjected> {
  readonly id = "my-skill";
  readonly name = "我的技能";
  readonly description = "...";            // 中文，供 Agent 判断该不该调
  readonly paramSchema: SkillParamSchema[] = [...];

  protected readonly siteURL = "https://<内部代号>";
  protected getPath(params: MyParams) { return `/path?q=${params.keyword}`; }
  protected createGoal(params: MyParams): BaseGoal<MyGoalResult> { return new MyGoal(); }

  // ★ 投影走 pipeline getter。单层转换写 envelope —— 基类把 TPayload 锁成了 TResult
  protected get pipeline(): ProjectionPipeline<MyParams, MyGoalResult, MyGoalResult, MyProjected> {
    return {
      envelope: (data, ctx) => ({
        meta: { skill: this.id, semantics: "...", crawledAt: data.crawledAt },
        insights: buildMyInsights(data.items),
        items: data.items.map(projectItem),   // 显式枚举字段，禁止 {...raw} spread
      }),
    };
  }
}
```

**`paramSchema.default` 只是给 Agent 看的文档，框架不会注入它。** 实际默认值必须在 `normalizeParams()` 里用 `??` 兜底。

### 5.2 自定义数据获取型 Skill

继承 `PuppeteerSkill`，直接实现 `fetchData()`。

**方式一：声明式 Hook（推荐）**

```typescript
import { defineSlot, ResponseInterceptor } from "@spider/core";

const CaptureSlot = defineSlot<ApiResponse>("capture");

class MyCustomSkill extends PuppeteerSkill<Params, Result, Projected> {
  // ...siteURL, getPath 同上

  // 声明 Hook — 不再需要覆写 navigate()
  protected get hooks() {
    return [
      new ResponseInterceptor({
        match: URL_MATCHER,
        into: CaptureSlot,
        mode: "first",
      }),
    ];
  }

  protected async fetchData(page, params, options?, ctx?) {
    const captured = ctx?.get(CaptureSlot);
    // 处理 captured 数据...
  }
}
```

**方式二：装饰器式（类 + 方法）**

```typescript
import { CaptureResponse, BlockResource, Setup, Transform, defineSlot } from "@spider/core";
import { ArtifactPrefixSlot, whenParamNot } from "@spider/core";

const ArticleSlot = defineSlot<ArticleResponse>("article");

@CaptureResponse({ pattern: /api\/article/, into: ArticleSlot })
@BlockResource({ types: ["font", "stylesheet"] })
class FastArticleSkill extends PuppeteerSkill<Params, Result> {

  @Setup()
  configurePrefix(page: Page, ctx: PageContext) {
    ctx.set(ArtifactPrefixSlot, `assets/${ctx.params.folder}`);
  }

  @Transform({ when: whenParamNot("includeMedia", false) })
  async collectVideoMeta(page: Page, ctx: PageContext) {
    // 方法装饰器自动注册为 Hook 阶段
  }

  protected async fetchData(page, params, options?, ctx?) {
    const article = ctx?.get(ArticleSlot);
    // ...
  }
}
```

**方式三：声明式 Hook + 方法装饰器 + @CaptureMedia（复杂场景）**

```typescript
import {
  CaptureMedia, Setup, whenParamNot, ArtifactPrefixSlot,
} from "@spider/core";
import { ArticleListSlot } from "./slots";

@CaptureMedia({ activateWhen: whenParamNot("includeMedia", false) })
class ArticleSkill extends PuppeteerGoalSkill<Params, Result, Projected> {

  @Setup()
  configurePrefix(page: Page, ctx: PageContext) {
    if (ctx.params.folder) {
      ctx.set(ArtifactPrefixSlot, `assets/${ctx.params.folder}`);
    }
  }

  protected get hooks(): IPageHook[] {
    return [
      new ResponseInterceptor({
        match: V2_MATCHER,
        into: ArticleListSlot,
        mode: "first",
        activateWhen: whenParam("autoNavigate"),
      }),
      new MediaDownloadHook(),        // extract: 主动下载
      new MediaFilterHook(),          // transform: 过滤
    ];
  }

  /** 数据投影 + markdown 落盘都在 ProjectionPipeline。 */
  protected get pipeline(): ProjectionPipeline<Params, Raw, Raw, Projected> {
    return {
      envelope: (data, pctx) => buildProjected(data, pctx),
      emit: async (_envelope, pctx) => {
        if (sink) await emitArticleMarkdown(pctx.pageContext, sink);
      },
    };
  }

  protected createGoal(params: Params) { return new ArticleGoal(); }

  // 覆写 fetchData 实现双模式：Goal 直连 / 自动导航
  protected async fetchData(page, params: Params, options?, ctx?) {
    if (params.runtime?.token) {
      // override 模式
      return this.deps.goalExecutor.execute(this.createGoal(params), page, ...);
    }
    return { content: "", runtimeSource: "auto-navigation" };
  }
}
```

---

## 6. CLI 入口（`cli/`）

`runCLI()` 提供所有 Spider 共享的 CLI 入口逻辑：

```
node <entry> --list                    → 列出所有 Skill
node <entry> --help                    → 帮助信息（含 obs 配置摘要）
node <entry> <skill-id> [json] [flags] → 执行 Skill
node <entry> obs <subcommand> [args]   → 查询观测数据（trace/recent/slow/errors/http/body）
```

**自动行为**（v3）：

- 启动时调用 `bootstrapObservability()` 装配 trace sink（默认 JSONL；可通过 `SPIDER_OBS_SINKS=jsonl,logger` 追加 stderr 回声）。
- trace 启用且 `SPIDER_LOG_LEVEL` 未显式设置时，自动 `setRootLogger(noopLogger)` 静默原 logger。
- 入口包一层 `runRootTrace({ caller, rationale, traceId }, ...)`，发出 `task.start` / `task.end` 事件；下游所有 skill/goal/endpoint/hook span 自动挂在该 traceId 上。
- 解析 `--rationale` / `--caller` / `--trace-id` 与 `SPIDER_RATIONALE` / `SPIDER_CALLER` / `SPIDER_TRACE_ID` 两路输入（CLI flag 优先）。**不再从业务参数里读 `_meta`** —— 元数据不污染业务接口，AI 传参保持简洁。
- 剥离 `--storage-dir` / `--license` / obs 相关 flag，避免污染下游 JSON 解析。
- 内置全局超时保护（默认 120s），超时后 `fatal()` + `process.exit(1)`；正常完成给予 500ms 异步清理窗口（含 `shutdownObservability()` flush sinks）。

> ⛔ **stdout 只允许最终 JSON。** 注册、生命周期、重试轨迹一律走 observability（→ stderr），任何 `console.log` 都会污染 Agent 的解析。

各 spider 的 `cli.ts` 只需调用 `runCLI()` 并传入 registry 工厂，无需自行管理超时或 trace 装配。详见 [OBSERVABILITY.md](../OBSERVABILITY.md)。

---

## 7. 错误体系（`errors/`）

自顶向下三层，**只有 `kind` 是真理源**：

```
FailureCategory   : "browser" | "auth" | "params" | "upstream" | "pipeline" | "business"
       ▲ 类别（粗粒度，由 categoryOf(kind) 派生，不是手填字段）
       │
SkillFailureKind  : 15 个判别字符串字面量（闭合枚举，定位到具体子原因）
       ▲ 分类（buildFailure 读取，写入 metadata.errorInfo）
       │
SpiderError 子类  : NavigationFailedError / NotLoggedInError / EndpointHttpError / ...
       ▲ 实例（携带 phase/scope/details/cause，业务侧 throw 时使用）
```

| Category   | Kind                                                                  | retryable |
| ---------- | --------------------------------------------------------------------- | --------- |
| `browser`  | `browser-unavailable` / `browser-acquire-timeout` / `navigation-failed` | ✅        |
| `auth`     | `not-logged-in` / `access-denied`                                       | ❌        |
| `params`   | `missing-context` / `invalid-params`                                    | ❌        |
| `upstream` | `upstream-shape-changed` / `endpoint-http` / `endpoint-timeout` / `retry-exhausted` | `endpoint-*` ✅ |
| `pipeline` | `hook-abort` / `pipeline-error`                                         | ❌        |
| `business` | `no-results` / `unsupported`                                            | ❌        |

`category` 与 `retryable` 都**由函数从 kind 派生**（`categoryOf()` / `isRetryable()`），新增错误场景先在 `kinds.ts` 归类，不要造自由文本。

> `no-results` 归为 failure 是刻意的：Agent 需要一个可判定信号，而非空数组带来的歧义。

**使用约定**：

- 框架/Skill 内部统一 `throw new <TypedError>("msg", { scope, phase, details, cause })`，**禁裸 `throw new Error`**。
- `BaseSkill.buildFailure()` 把任意 `unknown` 归一化为 `SpiderError`，`toErrorInfo()` 写入 `metadata.errorInfo`。
- **Skill 执行绝不向调用者抛异常** —— CLI 的消费者是 Agent，崩溃的进程无法被解析。
- 字符串形式的 `"[kind] msg"` 是仅存的旧代码兼容路径。**Error 实例带这种前缀无效**，会兜底成 `pipeline-error`。

---

## 8. 重构变更记录

> 本节是历史留痕，**不是 API 参考**。当前 API 以第 1–7 节与源码为准；下面提到的旧符号（`initContext` / `@Emit` / `IPageHook.project` / `BaseSkill.project` 等）均已不存在。

### 2026-05 RuntimeContext + ProjectionPipeline 重构

**动机**：两项严重架构偏差 — (1) 框架内 11+ 处直接调用 `emitEvent()` / `withSpan()` / `getBodyStore()`，可观测性状态隐式全局耦合，测试无法替换、CLI 之外的宿主无法接入；(2) `BaseSkill.project()` / `PuppeteerSkill.project(data, ctx?)` / xhs 包内基类 `project()` 三处隐式覆盖，子类一覆写就静默切断上层，连带丢掉 ctx、去噪与 emit。

| #   | 变更                                              | 说明                                                                                                                                  |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `RuntimeContext` + AsyncLocalStorage 注入         | 新增 `runtime/` 模块：`NoopRuntime`（默认）/ `LiveRuntime`（CLI 注入）/ `currentRuntime()` ALS 读取；框架内 13 个文件全部改走 `currentRuntime().{tracer,events,blobs,redact,config}` |
| 2   | 收窄 observability 公开导出                       | `observability/index.ts` 仅保留 sinks/bus/config 类型；`emitEvent` / `withSpan` / `getBodyStore` / `emitErrorEvent` 等不再对外               |
| 3   | `cli/run.ts` 装配 LiveRuntime                     | `createLiveRuntime(cfg)` → `runWithRuntime(rt, () => runRootTrace(...))`；`finally` 中 `shutdownLiveRuntime` 刷盘                          |
| 4   | `createTestRuntime()`                             | `testing/runtime.ts` 暴露内存版 runtime，供单元测试断言 events/blobs                                                                          |
| 5   | `ProjectionPipeline<TParams, TRaw, TPayload, TEnvelope>` | 4 阶段管道 `normalize → project → envelope → emit`；`runProjectionPipeline(pipeline, raw, ctx, mode)` 在 `mode === "raw"` 时整段 bypass    |
| 6   | **所有 `project()` 方法删除**                      | 投影唯一承载形式变为 `protected get pipeline()` getter，默认 `{}`（identity）。**基类不再调用任何 `project()`**                                |
| 7   | `SkillExecuteOptions.projectionMode`              | `"normal" \| "raw"`，对应 CLI `--raw`；替代以前散落各处的 `XHS_RAW` 环境变量                                                                  |
| 8   | xhs 39 个 Skill 迁移到 `pipeline`                  | 包内基类的隐式 `stripNoise` 删除；`isRawMode()` 与 `XHS_RAW` 在 4 个 projection 文件中全部清除                                          |
| 9   | dedao `MarkdownEmitHook` → `emitArticleMarkdown`  | 改为工具函数，在 `course-article-detail.skill` 的 `pipeline.emit` 阶段调用                                                                    |
| 10  | 删除 `EmitStage` / `@Emit` / `IPageHook.emit`     | Lifecycle 不再有 emit 阶段；`DATA_PIPELINE_STAGES` 收窄为 `[extract, transform, persist]`；`StageName` 联合类型同步收窄                         |

**收益**：
- 框架对宿主零硬编码：嵌入到第三方 runtime（如 Worker / Lambda）只需提供自定义 `RuntimeContext`
- 投影流程显式分层（normalize/project/envelope 三步可观察），任何一步可单独覆盖；`--raw` 模式不再依赖魔法环境变量
- emit 阶段从 Hook 体系中剔除，"副作用产出"与"页面交互"完全解耦，Hook 仅负责 page lifecycle

### 2026-07 框架缺陷收口

| #   | 变更                                | 说明                                                                                                          |
| --- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 1   | CDP / Pool 裸 Error → 类型化错误    | `cdp-connector` 超时与 connect 失败、`pool` 的 7 处失败点全部改抛 `BrowserUnavailableError` / `InvalidParamsError`；此前它们被 `normalizeFailure` 兜底成不可重试的 `pipeline-error` |
| 2   | `browser-acquire-timeout` 首次有抛出点 | `waitForSlot` 原为无界 Promise，并发打满即永久悬挂；新增 `BrowserPoolOptions.acquireTimeoutMs`（默认 60s，0 = 不限）    |
| 3   | `dispose()` reject 等待者            | 原实现直接丢弃 resolver，池释放后等待中的调用方永不返回                                                              |
| 4   | `@StorageReset` 接入 Hook 链         | 原用自建元数据键 + 自建 builder，`composeHooks()` 根本不认，装饰器**完全无效**。改走 `pushClassHook`（现已导出）        |
| 5   | `@StorageReset` 时机 setup → ready   | setup 跑在 `page.goto` 之前，页面还是 `about:blank`，读到的是空白页存储；ready 在导航（含其重试）之后               |
| 6   | `RetryStageEntry["stage"]` 派生      | 从 `Exclude<StageName, "teardown">` 派生。手写联合曾列了非 Stage 的 `"navigate"`（永远匹配不到）又漏了 `"setup"`        |
| 7   | `PaginatedOptions.accumulate` 删除   | 全仓 0 使用，且与「方法体即该页投影函数」的范式重叠                                                                  |
| 8   | 清理死导出与过期注释                  | `buildStorageResetHooks` 删除；`hooks.ts` / `skill.ts` 中残留的 `emit` 阶段、`project()` 描述订正                   |

### 2026-04 PageLifecycle + PageContext 重构

**动机**：原 8 阶段 Pipeline 存在多处架构偏差 — `harvest` 与 `extract` 职责混淆、`filterCaptures` 绕过 Hook 体系、`ExecutionBag` 命名与 `PageLifecycle` 不匹配、`runHookStage` 字符串调度缺乏类型安全。

| #   | 变更                                    | 说明                                                                                                  |
| --- | --------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1   | `LifecycleStage` 抽象类 + 8 个具体类   | 每阶段独立的 `pick(hook)` + `run(hooks, page, ctx)` 执行单元，替代 `runHookStage()` 字符串调度        |
| 2   | `PageLifecycle` 编排器                  | 组合 LifecycleStage[]，`run(hooks, page, ctx)` 按顺序执行。`defaultLifecycle` 单例                    |
| 3   | IPageHook 9 阶段                        | setup / ready / interact / extract / transform / persist / project / teardown（移除 harvest）          |
| 4   | `PipelineContext` → `PageContext` 重命名 | 与 `PageLifecycle` 命名一致，全局 31 处重命名                                                         |
| 5   | `ExecutionBag` 类型别名移除             | 所有 `fetchData` / `navigate` 签名统一为 `ctx?: PageContext`                                          |
| 6   | `filterCaptures()` 移除                 | 替代方案：MediaFilterHook 在 transform 阶段处理过滤，通过 `shouldActivate(ctx)` 控制激活              |
| 7   | `runHookStage()` 移除                   | 替代方案：LifecycleStage.run() 提供类型安全的阶段执行                                                |
| 8   | `harvest` Hook 方法移除                 | 原 harvest 职责分拆：被动收割 → extract，主动过滤 → transform                                        |
| 9   | navigate override 消除                  | ARTIFACT_PREFIX_KEY 写入从 navigate() 覆写迁移到行内 setup Hook                                      |
| 10  | project() 纯化                          | videoMeta 提取从 project() 迁移到行内 transform Hook，project 只读 ctx                               |
| 11  | TeardownStage 异常吞没                  | `run()` 内 try-catch 不传播异常，确保清理不阻断流程                                                   |

### 2026-04 Artifact Output Envelope 重构

**动机**：原 `captures: Map<string, unknown>` 将管道内部状态（Buffer、原始 API 响应）泄漏到输出，导致 132MB JSON 中 99% 为噪音。

| #   | 变更                            | 说明                                                                                                 |
| --- | ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | `Artifact` Value Object         | `{ path, relativePath?, role, contentType, sourceUrl?, sizeBytes }` — 零二进制的产物描述             |
| 2   | `IArtifactSink` 策略接口        | 替代 `IMediaStore`，`write(key, data, meta) → Promise<Artifact>`                                     |
| 3   | `FileArtifactSink`              | 替代 `FileMediaStore`，写入 `outputDir`，返回相对路径                                                |
| 4   | `ArtifactPersistHook`           | 替代 `MediaPersistHook`，persist 阶段扫描 ctx.store 中的 Map<string, CapturedEntry>，生成 Artifact[] |
| 5   | `SkillResultSuccess.artifacts`  | 替代 `captures: Map` — 只含文件路径和元信息，零二进制                                                |

### 2026-04 浏览器连接策略模式重构

| #   | 变更                                   | 说明                                                                                           |
| --- | -------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1   | `IBrowserConnector` 策略接口           | 可插拔的浏览器来源抽象：`acquire()` → `BrowserLease { browser, release() }`                    |
| 2   | `CDPConnector` + `PooledConnector`     | 从 Provider 层提取连接策略，Provider 层只剩唯一的 `ChromeSessionProvider`                      |
| 3   | `ChromeSessionProvider` class          | 持有 `IBrowserConnector`，构造时自动解析或接受注入的连接器                                     |
| 4   | 删除旧 Provider                        | `DirectSessionProvider` / `PooledSessionProvider` / `createSessionProvider()` 全部移除         |

### 2026-04 框架安全性与一致性重构

| #   | 变更                            | 说明                                                                                  |
| --- | ------------------------------- | ------------------------------------------------------------------------------------- |
| 1   | `SkillResult<T>` → 判别联合体   | `SkillResultSuccess<T> \| SkillResultFailure`，通过 `success` 字段类型收窄            |
| 2   | `GoalContext.get()` 运行时安全  | 访问未注册的 endpoint 名称时抛出明确错误                                              |
| 3   | Goal 启动前校验                 | 执行前验证 `@Aggregate` 存在 + 所有 endpoint 方法存在                                 |
| 4   | `validateWithSchema()` 自动校验 | 基于 `paramSchema` 在 execute 流程中自动校验 required + type                          |
| 5   | `connectWithTimeout()` 防泄漏   | Chrome 连接超时后自动 disconnect                                                      |

### 2026-04 模块重组（按关注点分层）

| #   | 变更                              | 说明                                                                         |
| --- | --------------------------------- | ---------------------------------------------------------------------------- |
| 1   | `core/` → `goal/`                 | 消除与框架"核心"概念的歧义                                                   |
| 2   | `browser/` 精简为纯连接层         | 只保留连接器、池化、路由、会话管理                                           |
| 3   | 新增 `puppeteer/`                 | Page Lifecycle、Hook、装饰器、Skill 基类的单一内聚模块                       |
| 4   | `src/index.ts` 按层级重组导出     | Goal → Skill → Browser → Puppeteer → CLI                                     |

### 2026-04 Skill 类型体系重构（TParams 类型保留）

| #   | 变更                                        | 说明                                                                                                           |
| --- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | `TParams extends object` 约束               | `ISkill` / `BaseSkill` / `PuppeteerSkill` / `PuppeteerGoalSkill` 全链路增加泛型约束，消除 any                 |
| 2   | `normalizeParams() → TParams`               | 返回类型从 `Record<string, unknown>` 改为 `TParams`，消除类型擦除。`getPath` / `createGoal` / `fetchData` 全部接收强类型参数 |
| 3   | `initContext(params, ctx)` 新钩子            | 在 `activateHooks` 之前执行，将派生状态（`autoNavigate` 等）写入 `ctx.store`，不再污染 params 加 `_` 前缀字段  |
| 4   | `PuppeteerGoalSkill.fetchData` 非密封        | 子类可覆写以实现 Goal+Hook 双模式或 params 扁平化                                                              |
| 5   | `PuppeteerSkillDeps.goalExecutor?` 可选      | `PuppeteerSkill` 层声明可选，`GoalSkillDeps` extends 时收窄为必填，消除子类 `declare` hack                     |
| 6   | `activateOn` 检查 `ctx.store`               | `PageInterceptor.shouldActivate` 从 `ctx.params[key]` 改为 `ctx.get(key)`，与 `initContext` 配合               |
| 7   | `project(data, ctx?)` 分层签名              | `BaseSkill.project(data)` 无 ctx，`PuppeteerSkill.project(data, ctx?)` 可访问 PageContext                      |
| 8   | 全部 consumer skill 适配                    | xhs(2)、dedao(3)、report(2)、rss(4)、fin(1) 共 12 文件完成签名迁移                                            |

### 2026-04 类型化 Slot + 信号系统 + 方法装饰器重构

**动机**：5 项架构偏差 — (1) `PageContext.store: Map<string, unknown>` 弱契约无类型保护；(2) `initContext` 与 `shouldActivate` 耦合；(3) Hook `project` 与 `Skill.project` 语义冲突；(4) `IPageHook` 无流程中止能力；(5) 缺少方法级装饰器，复杂逻辑只能外置为独立 Hook 类。

| #   | 变更                                              | 说明                                                                                                                                  |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `SlotKey<T>` + `defineSlot<T>()` 类型化键          | Phantom type 携带类型信息，`ctx.get(slot)` / `ctx.set(slot, value)` 编译期校验值形状                                                   |
| 2   | `PageContext` 私有化 `_slots`                      | 取消 `store: Map<string, unknown>` 暴露，强制通过 `get/set/require/has/delete/getOrCreate` Slot API 访问                                |
| 3   | 4 个内置 Slot                                     | `CapturedMediaSlot` / `ArtifactsSlot` / `ArtifactPrefixSlot` / `ArtifactLegendsSlot`，替代字符串常量键                                  |
| 4   | `initContext` 移除                                 | 由 `@Setup()` 方法装饰器替代，子类在 setup 阶段通过 Slot API 写入派生状态                                                              |
| 5   | `shouldActivate` lazy per-stage                    | 每个 Stage 进入前重新求值，Hook 可响应前面 Stage 写入的 Slot 数据                                                                      |
| 6   | Hook `project` → `emit`                            | 消除 Hook.project 与 Skill.project 的语义歧义；`ProjectStage` → `EmitStage`                                                            |
| 7   | `HookSignal` 信号系统                              | `skipStage` / `skipPipeline` / `abort`；`PipelineHalt` 受控信号终止 Data Pipeline；`HookAbortError` 终止整个 Skill                      |
| 8   | `PageLifecycle.runDataPipeline()`                  | 按 `DATA_PIPELINE_STAGES` 顺序执行，自动 catch `PipelineHalt` 实现 skipPipeline 语义                                                   |
| 9   | `HookOutcome` 返回类型                             | 所有 Hook 方法签名统一为 `Promise<HookOutcome>` = `void \| HookSignal`                                                                 |
| 10  | `ActivationPredicate` 激活谓词                     | `whenParam()` / `whenParamNot()` / `whenSlot()` / `not()` / `allOf()` / `anyOf()` — 替代字符串 `activateOn`                            |
| 11  | `InterceptorOptions.into: SlotKey`                 | 替代 `key: string`，拦截器内部状态也使用派生 `SlotKey` 存储                                                                            |
| 12  | 8 个方法装饰器                                     | `@Setup()` / `@Ready()` / `@Interact()` / `@Extract()` / `@Transform()` / `@Persist()` / `@Emit()` / `@Teardown()`                    |
| 13  | `buildSelfHook(instance)`                          | 聚合方法装饰器为单个 `IPageHook`，参与 `composeHooks()` 组合                                                                           |
| 14  | `getClassHooks()` 替代 `getPageHooks()`            | 沿继承链（基类→派生类）收集类装饰器注册的 Hook                                                                                         |
| 15  | `composeHooks()` 组合顺序                          | classHooks → instanceHooks → selfHook → ArtifactPersistHook                                                                            |
| 16  | `ArtifactPersistHook` 显式 sources                 | `sources: SlotKey<Map<string, CapturedEntry<Buffer>>>[]` 替代扫描 ctx 中所有 Map 值                                                     |
| 17  | `TeardownStage` 忽略 `shouldActivate`              | setup 挂的资源一定要清理；幂等检查在 Hook 内部完成                                                                                      |
| 18  | `tryScreenshot()` 实现                             | 读取 `@Screenshot` 元数据，错误时通过 `page.screenshot()` + `deps.artifactSink` 写入截图                                                |
| 19  | dedao-spider 全面迁移                              | 新增 `skills/slots.ts`（4 个 Slot）；3 个 Hook 迁移为 Slot API + 激活谓词；`course-article-detail.skill.ts` 使用 `@Setup` + `@Transform` |

---

## 9. v2 Hardening（可观测性 / Schema / 重试 / Storage / Testing）

> 本节记录 v2 一次性硬化重构的核心成果。错误体系部分已提升为第 7 节，此处不再重复。

### 9.1 可观测性（`observability/`）

`@spider/core` 提供 **两层可观测性**：

1. **Logger 层**（`SpiderLogger`）— 文本/JSON 行式日志，写 stderr，适合人眼阅读。
2. **Trace 层**（`ObservabilityBus` + JSONL Sink + BodyStore）— 结构化事件总线，通过 `AsyncLocalStorage` 隐式传播 `traceId/spanId`，落地到 `traces/YYYY-MM-DD.jsonl` + 内容寻址 BodyStore，专为 **AI 调用审计** 与 **跨进程关联** 设计。

> 当 trace 层启用（默认开启）且 `SPIDER_LOG_LEVEL` 未显式设置时，CLI 会自动 `setRootLogger(noopLogger)` — 一切关键信息都已落库，避免双通道噪声。
> 用户可设置 `SPIDER_LOG_LEVEL=info`（或更低）显式重新启用日志输出。
> 完整使用指南见 [OBSERVABILITY.md](./OBSERVABILITY.md)。

#### Logger 层

`SpiderLogger` 是唯一允许写入 stderr 的结构化日志器：

- `getRootLogger()` / `setRootLogger(noopLogger)`：CLI 在 `--silent` 时一键禁声。
- `createLogger(scope)`：给各层（`goal.executor` / `puppeteer.skill` / `storage.file-store`）打上 scope。
- 环境变量：
  - `SPIDER_LOG_LEVEL`: `silent | error | warn | info | debug | trace`
  - `SPIDER_LOG_FORMAT`: `text`（默认，人类可读）| `json`（机器可解析）

> ⛔ **stdout 纪律**：CLI 的 stdout 只允许写入最终 JSON 结果。任何中间过程（包括重试、跳过 stage、storage 冲突重命名）必须走 logger（→ stderr）。

#### Trace 层

```
ObservabilityBus（单例）
    │
    ├── JsonlSink     → <obsDir>/traces/YYYY-MM-DD.jsonl   日滚 NDJSON（appendFileSync）
    └── LoggerSink?   → SpiderLogger.debug                  可选回声到 stderr
            │
            └── BodyStore → <obsDir>/bodies/<aa>/<sha256>.<ext>  SHA256 内容寻址
```

> **存储默认为 `~/.spider/`**（跨 cwd / 跨 spider 共享），可用 `SPIDER_OBS_DIR` 重设。
> 旧版 `SqliteSink` 已移除；查询统一走 `obs <subcommand>`（底层是对 JSONL 的流式扫描），不再需要 `better-sqlite3` native binding。

**统一事件模型**（`ObsEvent` 判别联合）：

| Kind                                  | 触发点                                                       | 关键字段                                                                  |
| ------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `task.start` / `task.end`             | `runCLI()` 入口                                              | `caller` `rationale` `argv` `pid`                                         |
| `skill.start` / `skill.end`           | `SkillRegistry.execute()`                                    | `skillId` `params` `paramsRef` `resultSummary` `resultRef` `artifactCount`|
| `stage.start` / `stage.end`           | `PuppeteerSkill.runStage()`                                  | `stage` `hookCount` `status`                                              |
| `hook.invoke`                         | `LifecycleStage.run()` 每个 Hook                              | `stage` `hookName` `status` `signal`（skipStage/skipPipeline/abort）       |
| `navigate.start` / `navigate.end`     | `PuppeteerSkill.navigate()`                                  | `url` `status` `errorMessage`                                             |
| `goal.start` / `goal.end`             | `GoalExecutor.execute()`                                     | `goalId` `goalName` `endpointCount`                                       |
| `endpoint.request`                    | `executeOnce()` 发请求前                                     | `goalId` `methodName` `method` `url` `attempt` `requestRef`               |
| `endpoint.response`                   | `executeOnce()` 收响应后（含失败）                           | `httpStatus` `durationMs` `responseRef` `errorKind`                       |
| `endpoint.projection`                 | `runProjection()`：goalFn[methodName] 返回后                  | `mode(single/paginated/expanded)` `page` `itemIndex` `hasProjection` `projectionRef` |
| `intercept.match`                     | `ResponseInterceptor.parseEvent()`                           | `slot` `url` `mime` `bytes` `bodyRef`                                     |
| `artifact.write`                      | `FileArtifactSink.write()`                                   | `role` `path` `bytes` `sourceUrl` `reused`                                |
| `error`                               | `BaseSkill.buildFailure()`                                   | `errorKind` `category` `phase` `scope` `retryable`                        |

**关键设计决策**：

- **AsyncLocalStorage 上下文传播**：`runRootTrace()` / `runSpan()` 通过 Node `async_hooks` 透传 `traceId/spanId/skillId/goalId` — 业务 API 零污染，无需在签名里加 `tracer` 参数。
- **内容寻址 BodyStore**：所有大对象（请求/响应 body、skill params/result、拦截到的 JSON、投影后产物）按 SHA256 写入 `bodies/<前缀>/<hash>.<ext>` 后只在事件里保留 `BodyRef`（`{ hash, bytes, mime, preview, path }`），自动去重 + 防止 NDJSON 行无限膨胀。
- **脱敏**：`redact()` 深度遍历参数，把 `password/token/cookie/authorization/...` 等键值替换为 `[REDACTED]`；事件里存脱敏版，`paramsRef` 里仍保留原文（仅本地磁盘可见）。
- **AI Rationale 两路获取**（CLI flag 优先于 ENV）：
  - CLI: `--rationale "..."` `--caller "..."` `--trace-id "..."`
  - ENV: `SPIDER_RATIONALE` / `SPIDER_CALLER` / `SPIDER_TRACE_ID`
  - **不走业务参数**：`_meta` 通道已移除，元数据不污染 Skill 入参。

**环境变量**：

| 变量                       | 默认值              | 说明                                            |
| -------------------------- | ------------------- | ----------------------------------------------- |
| `SPIDER_OBS_DIR`           | `~/.spider`         | traces/ + bodies/ 的根目录（跨 cwd 共享）         |
| `SPIDER_OBS_SINKS`         | `jsonl`             | 启用的 sink，可选 `jsonl` `logger`，逗号分隔      |
| `SPIDER_OBS_DISABLE`       | （未设置）          | 设为 `1` 完全关闭 trace 层                      |
| `SPIDER_OBS_BODY_MAX_BYTES`| `5000000`           | 单 body 最大字节数，超出截断                    |
| `SPIDER_OBS_PREVIEW_BYTES` | `256`               | 文本类 body 在事件中保留的预览长度              |
| `SPIDER_OBS_REDACT_KEYS`   | （内置 14 个）      | 额外脱敏字段名，逗号分隔                        |
| `SPIDER_RATIONALE`         | —                   | AI 自报调用动机                                 |
| `SPIDER_CALLER`            | —                   | 调用方标识（如 `claude-sonnet-4`）              |
| `SPIDER_TRACE_ID`          | —                   | 复用已有 traceId，跨进程关联                    |

**`obs` 查询子命令**（所有 spider CLI 自动支持）：

```
node <entry> obs ls                       存储路径与统计
node <entry> obs recent [--limit 20]      最近 trace 概览
node <entry> obs trace <traceId> [--full] 完整 trace 事件列表
node <entry> obs http [--url PATTERN]     HTTP 调用（原始响应 body 路径）
node <entry> obs projections [--method N] 投影后产物（goalFn 返回值）
node <entry> obs slow [--threshold 5000]  慢 span
node <entry> obs errors [--limit N]       错误事件
node <entry> obs body <hash>              dump BodyRef 原文
```

详细输出格式 / flag / 例子见 [OBSERVABILITY.md §5](../../OBSERVABILITY.md#5-obs-cli-命令详细参考)。

### 9.2 Schema 校验（`goal/schema.ts`）

`@Endpoint(..., { schema: { schema, onMismatch?: "throw" | "warn" } })` 在 GoalExecutor 调用 method body 之前对响应做校验：

- `schema` 鸭子类型为 `{ safeParse(raw): { success: true, data } | { success: false, error: { issues?, message? } } }`，**直接兼容 zod**（`@spider/core` 不强依赖 zod，由消费者按需引入）。
- `onMismatch="throw"`（默认）→ 抛 `UpstreamShapeChangedError`，进入 retry/失败链路。
- `onMismatch="warn"` → 走 logger.warn，仍返回原始 payload；适合上线初期只观测、不阻塞。
- 推荐写 `z.object({...}).passthrough()`，让框架只校验关键字段、容忍上游新增字段。

### 9.3 Page 层失败重试（`puppeteer/retry.ts`）

装饰器式（推荐）：

```ts
@RetryNavigation({ times: 2, delayMs: 500, backoff: "exponential" })
@RetryStage("interact", { times: 1 })
class XYZSkill extends PuppeteerGoalSkill<...> {}
```

- `RetryPolicyOptions`：`times`（不含首次，默认 2）/ `delayMs`（默认 1000）/ `maxDelayMs`（默认 10s）/ `backoff`（`"constant" | "linear" | "exponential"`，默认 exponential）/ `retryIf` / `label`。
- `RetryPolicy` 内部按 `isRetryable(spiderError.kind)` 过滤 —— 业务/auth/params 错误一律不重试。重试耗尽抛 `RetryExhaustedError`，`cause` 为最后一次原始错误。
- `RetryStageEntry["stage"]` 由 `Exclude<StageName, "teardown">` 派生 —— 覆盖全部 7 个可插拔 Stage。**navigate 不是 Stage**，它的重试走 `@RetryNavigation`；teardown 被排除是因为它本就吞掉所有异常，重试无意义。
- 重试轨迹作为 `error` 事件（`errorKind: "retry-attempt"`）发到 observability，不走 stdout。

### 9.4 Storage 冲突防护（`storage/`）

`FileArtifactSink` 现在通过 `FileArtifactSinkOptions.conflictPolicy` 显式声明冲突策略：

| Policy      | 行为                                                                |
| ----------- | ------------------------------------------------------------------- |
| `rename`（默认） | 同 key 写入时自动后缀 `_1` `_2` ... 直到磁盘上无冲突            |
| `overwrite` | 直接覆盖；记录 logger.warn                                          |
| `skip`      | 已存在则放弃写入；返回上次写入的 Artifact                            |
| `error`     | 抛 `pipeline-error`，由调用方处理                                    |
| `dedupe`    | 先比较 sha256；同内容直接复用旧 Artifact 并标记 `reused: true`      |

`MemoryArtifactSink` 是新增的内存实现，专供测试与本地干跑使用。

### 9.5 行为存储清理（`puppeteer/storage-reset.ts`）

`@StorageReset(options)` 在 **ready 阶段**（navigate 之后）清理浏览器宿主存储，避免站点通过行为存储识别异常。

| 字段                   | 说明                                                        |
| ---------------------- | ----------------------------------------------------------- |
| `localStorageKeys`     | 要删的 localStorage 键（精确匹配；空则不动）                  |
| `sessionStorageKeys`   | `string[] \| "all"`（默认全清）                              |
| `clearSessionStorage`  | 等价于 `sessionStorageKeys: "all"`                           |
| `indexedDBs`           | 要删的 IndexedDB 数据库名                                     |
| `cookies` / `cookieDomains` | 要删的 cookie 名 / 域                                   |
| `all`                  | 危险开关：全清，**会破坏登录态**，仅测试用                    |
| `activateWhen`         | 激活谓词                                                     |

- 默认只清会话级数据，**不动 cookie**（不破坏登录态）。
- 清理摘要写入 `StorageResetReportSlot`：`{ localStorageRemoved, sessionStorageRemoved, indexedDBRemoved, cookiesRemoved }` 四个计数。
- 挂在 ready 而非 setup 有两重原因：setup 时页面还是 `about:blank`，够不着目标站点的存储；且 ready 跑在导航**及其重试**全部完成之后，清理必然作用于最终加载成功的那个页面。
- 多次叠加会注册多个 Hook，按声明顺序执行。

### 9.6 类型安全

- `BaseSkill<TParams extends object, TResult, TProjected>`、`PuppeteerSkill<TParams>`、`PuppeteerGoalSkill<TParams>` 全链路保留 `TParams`，不再退化为 `Record<string, unknown>`。
- `Goal`/`Endpoint` 通过 `BaseGoal<TResult, TParams>` 携带幻影类型属性 (`__paramsType` / `__resultType`)，让 `GoalExecutor.execute<R>()` 能在调用点回收类型。
- `GoalContext<TParams>` 暴露 `params: TParams`，避免 endpoint 实现里写 `(ctx.params as any).foo`。

### 9.7 Testing 工具（`testing/`）

通过命名空间 `import { testing } from "@spider/core"` 引入，专为单元测试设计：

| 工具                          | 用途                                                                     |
| ----------------------------- | ------------------------------------------------------------------------ |
| `testing.FakePage`            | 实现常用 `Page` 子集（goto/evaluate/setRequestInterception/...）+ `dispatch(event, payload)` 触发监听 |
| `testing.FakeBrowserSessionProvider` | 把 FakePage 包成 `IBrowserSessionProvider`，可塞进 PuppeteerSkillDeps |
| `testing.createFakeResponse`  | 构造 `ResponseInterceptor` 可消费的 fake 响应对象                          |
| `testing.createTestContext`   | 直接拿到 `PageContext<TParams>`，跳过 lifecycle 验证 Hook 行为              |
| `testing.MemoryArtifactSink`  | 内存版 sink，断言写入即可                                                  |

### 9.8 Changelog

| 序号 | 主题            | 关键改动                                                                                                                                                                       |
| ---- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | 行为存储清理     | 新增 `@StorageReset` + `StorageResetHook` + `StorageResetReportSlot`                                                                                                            |
| 2    | Schema 校验      | `EndpointSchemaOptions` + `validateResponse`，在 GoalExecutor.executeOnce 内置                                                                                                 |
| 3    | 可观测性 v1      | `observability/` 模块（Logger 层）；移除 goal/skill 接口里的 `ILogger` / `consoleLogger` / `silentLogger`；CLI 在 silent 模式调 `setRootLogger(noopLogger)`                     |
| 4    | Page 层失败重试  | `RetryPolicy` + `@RetryNavigation` / `@RetryStage`；按 `isRetryable(kind)` 过滤；耗尽抛 `RetryExhaustedError`                                                                  |
| 5    | 类型安全         | `TParams extends object` 全链路；`BaseGoal<TResult, TParams>` 幻影类型；`GoalContext<TParams>`                                                                                  |
| 6    | Storage 冲突防护 | `ArtifactConflictPolicy` + `FileArtifactSinkOptions`；新增 `MemoryArtifactSink`                                                                                                |
| 7    | 测试可达         | 新增 `testing/` 模块（FakePage / FakeBrowserSessionProvider / createTestContext / MemoryArtifactSink）                                                                          |
| 8    | 错误分类         | 新增 `errors/` 模块：`FailureCategory` × `SkillFailureKind` × `SpiderError` 三层；14+ 类型化子类；所有 Skill `throw new <TypedError>(...)`；`buildFailure` 自动写 `errorInfo` |
| 9    | 可观测性 v3 (Trace) | `ObservabilityBus` + 14 类 `ObsEvent`（含 `endpoint.projection`）+ JSONL/Logger 两种 Sink + `AsyncLocalStorage` trace 上下文 + 内容寻址 `BodyStore`；CLI 自动注入 `task` span，剥离 `_meta.rationale`，trace 启用时默认静默 logger；新增 `obs ls/trace/recent/slow/errors/http/projections/body` 查询子命令；默认存储路径改为 `~/.spider/`（跨 cwd 共享）。**原 SqliteSink 已移除**，查询全部走 JSONL 流式扫描，不再依赖 `better-sqlite3` native binding。完整指南见 [OBSERVABILITY.md](./OBSERVABILITY.md) |
