# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> 本仓库全部文档为中文。回复、注释、提交信息一律用中文，技术术语与代码标识符保留原文。
>
> 本文件是**工程规格**：讲清系统的设计范式、扩展点契约与编码规范，让你不必逐个文件梳理就能动手改代码。会随时间漂移的枚举（有哪些 skill、哪个包有什么脚本、CLI 有哪些子命令）一律现查——写死就会过期。

---

## 1. 系统定位与设计范式

Task-driven web spider system —— **Yarn 4 (Berry) workspaces monorepo**。框架层 `@spider/core`（`packages/core`）+ 若干爬虫 `skills/*`。每个 skill 用 esbuild 打包成 Claude Code skill 产物（`scripts/index.js` + `SKILL.md`），供 Claude 通过 `Bash(node ...)` 调用。采集原理是 puppeteer-core 连接**已开远程调试的真实 Chrome**，在页面上下文内发请求以继承登录态。

**架构思想借鉴 NestJS**：装饰器声明意图 + 构造函数依赖注入 + 模板方法固化流程。核心是一句话——

> **消费者是 AI Agent，不是人。** 一切设计服务于此：输出是结构化 JSON 而非人类可读文本；错误是可判定的 `kind` 而非自由文本；Skill 自描述参数（`paramSchema`）以便 Agent 发现；失败绝不抛异常，永远返回可解析的信封。

### 用到的设计模式（改代码前先认出你在哪个模式里）

| 模式 | 落点 | 含义 |
|---|---|---|
| **模板方法** | `PuppeteerSkill.execute()` 固化流程骨架；`LifecycleStage.run()` 固化阶段执行，子类只实现 `pick()` | 流程不可改，只能填空 |
| **策略** | `IBrowserConnector` ← `CDPConnector` / `PooledConnector`；`IBrowserRouter`；`LayoutStrategy` / `SidecarStrategy` | 换实现不改调用方 |
| **注册表** | `SkillRegistry`（`Map<id, ISkill>`），派发点同时是观测切面 | 运行时按 id 派发 |
| **声明式元编程** | Goal / Page 两套装饰器 + `reflect-metadata`（Symbol 键挂 constructor） | 元数据与执行分离 |
| **责任链** | Hook 链按 `composeHooks()` 顺序执行，任一环可短路 | 可插拔扩展 |
| **管道** | `ProjectionPipeline` 四阶段 `normalize → project → envelope → emit` | 每阶段单一职责，可省略 |
| **上下文对象** | `GoalContext`（端点间）、`PageContext`（阶段间） | 替代实例字段，避免并发竞态 |
| **判别联合** | `SkillResult` 按 `success` 判别；`ObsEvent` 按 `kind` | 类型收窄即错误处理 |
| **空对象** | `NOOP_RUNTIME`、空 `pipeline` getter | 让观测/投影可选，无需判空 |
| **环境上下文** | `AsyncLocalStorage` 承载 `RuntimeContext` | 横切能力免传参 |
| **RAII 租约** | `PageSession.release()` / `BrowserLease.release()`，幂等 + `finally` 保证 | 资源必然释放 |

### 分层（`packages/core/src/index.ts` 的导出顺序就是依赖方向，不可逆序依赖）

```
Layer 0  errors/ observability/ runtime/     贯穿全栈
Layer 1  goal/                               HTTP 编排引擎
Layer 2  skill/                              技能契约与注册表
Layer 3  browser/                            浏览器连接（策略模式）
Layer 4  storage/                            产物落盘
Layer 5  puppeteer/                          Page 生命周期
Layer 6  cli/                                统一入口
```

---

## 2. 核心契约（写代码时的硬约束）

### 2.1 继承链与各层职责

```
ISkill<TParams, TResult, TProjected, TOptions>          纯接口
  └ BaseSkill        参数校验 / 结果构建 / 告警收集；execute() 仍是 abstract
      └ PuppeteerSkill      ★ 模板方法在这层：12 阶段 execute() 已实现
          └ PuppeteerGoalSkill   fetchData() 委托 GoalExecutor.execute(createGoal(params))
```

**关键区分**：`BaseSkill.execute()` 是 abstract——直接继承它（纯 HTTP 模式）意味着**你要自己写整个 execute()**，包括调 `normalizeParams` / `validateWithSchema` / `project` / `buildSuccess` / `buildFailure`。只有继承 `PuppeteerSkill` 才免费获得 12 阶段模板。

泛型三件套贯穿全链，**不要用 `any` 打断**：`TParams`（入参）、`TResult`（数据源原始结构）、`TProjected`（对外投影，默认 `= TResult`）。

### 2.2 四个 abstract 成员（每个 Skill 必填）

```typescript
abstract readonly id: string;              // = CLI skill-id，kebab-case
abstract readonly name: string;            // 中文名
abstract readonly description: string;     // 中文说明，供 Agent 判断该不该调
abstract readonly paramSchema: SkillParamSchema[];
```

`SkillParamSchema` 是闭合结构，字段固定为 `{ name, type: "string"|"number"|"boolean"|"object"|"array", required, default?, description }`。它有三重作用：`--list` 的目录来源、`validateWithSchema()` 的校验依据、Agent 发现能力的入口。

**填 schema 就自动获得校验**——`validateWithSchema()`（在 `normalizeParams` **之后**执行）按它检查必填、比对类型，并对安全偏差自动 coerce（`"5"`→`5`、`"true"`→`true`）。缺必填抛 `MissingContextError`，类型不符抛 `InvalidParamsError`，不必手写这部分。

> ⚠️ **`default` 只是给 Agent 看的文档，框架不会注入它。** 实际默认值必须在 `normalizeParams()` 里用 `??` 兜底，否则参数就是 `undefined`。
>
> `description` 是 Agent 选参的唯一依据，惯例是**写进上游来源与依赖链**，而非只描述字段含义。枚举型参数用 `type:"string"` + description 列举取值（schema 无 enum 字段），备选值就地插值（`` `Tab 名（${ALLOWED_TABS.join(" / ")}）` ``）以免与代码里的常量数组漂移。

**ID 命名空间用登记表管，不靠散落约定。** 同名 ID（`categoryId` / `tagId`）在不同 Skill 指向完全不同的上游主键——包内建一个单一事实源模块登记 `命名空间 → {产出 Skill 字段路径, 消费 Skill 入参, 易混警告}`，并导出 `nsTag(ns)` 生成 `[ns:xxx]` 前缀供 description 使用、`producerMeta(ns)` 给产出方的 meta 标注 `idNamespace` / `idConsumers`。**新增任何 ID 类入参/输出必须先登记**。参考 `xhs-spider/src/projections/id-namespace.ts`，效果形如：

```typescript
description: "[ns:rank-tag-id|rank-area-id] 标签 ID。tab∈{area,ip-area} 时从 kol-rank-areas 取（rank-area-id）；" +
             "其他 tab 从 kol-rank-tags 取（rank-tag-id，依赖 tab+datecode+period）。勿投入 industry-id / goods-category-id"
```

### 2.3 错误体系：闭合枚举，只有 `kind` 是真理源

`errors/kinds.ts` 定义 6 组共 16 个 `SkillFailureKind`，`category` / `retryable` / `handling` **由函数从 kind 派生**（`categoryOf()` / `isRetryable()` / `handlingOf()`），不是手填字段。「情形 → kind → 处置」的唯一真理源在 `errors/kind-meta.ts`（`KIND_META`），Agent 错误表由 `node scripts/gen-error-table.ts` 从它生成（`--check` 校验漂移，勿手改表）：

| category | kind | retryable |
|---|---|---|
| `browser` | `browser-unavailable` / `browser-acquire-timeout` / `navigation-failed` | ✅ |
| `auth` | `not-logged-in` / `access-denied` / `risk-control` | ❌ |
| `params` | `missing-context` / `invalid-params` | ❌ |
| `upstream` | `upstream-shape-changed` / `endpoint-http` / `endpoint-timeout` / `retry-exhausted` | `endpoint-*` ✅ |
| `pipeline` | `hook-abort` / `pipeline-error` | ❌ |
| `business` | `no-results` / `unsupported` | ❌ |

**新增错误场景先在 `kinds.ts` 归类**，不要造自由文本。抛错用对应的 `SpiderError` 子类（携带 `scope` / `details`），`buildFailure()` 会把任意输入归一化成结构化 `errorInfo`。

> `no-results` 归为 failure 是刻意的：Agent 需要一个可判定信号，而非空数组带来的歧义。

### 2.4 输出信封：两层，都不可绕过

**外层 `SkillResult<T>`** 是判别联合——`{success:true, data, metadata, artifacts?}` | `{success:false, error, metadata}`。

**Skill 执行绝不向调用者抛异常**，一律 `buildFailure()` 包装。这是铁律：CLI 的消费者是 Agent，崩溃的进程无法被解析。

**内层 AI-Ready 信封**（`data` 的内容）：`{ meta, insights, items }`（或 `payload` / `content`）。`insights` 是中文要点数组，供 Agent 优先读取以压缩上下文。契约见 `skills/_shared/claude/rules/spider-runtime.md §4`。

### 2.5 两套正交装饰器

职责边界稳定：**Goal 装饰器（`goal/`）管 HTTP 数据流，Page 装饰器（`puppeteer/`）管浏览器交互**，不得混用。完整 options 字段以各自 `decorators.ts` / `interfaces.ts` 为准。

- Goal 侧：`@Goal`（类级默认值）+ `@Endpoint`（方法级）；`@Paginated` / `@Expanded` / `@Streamed` 是**叠加修饰符**，必须与 `@Endpoint` 共存，不能独立；`@Aggregate()` 从 `GoalContext` 收集结果。**书写顺序无关**——`finalizeGoalMetadata()` 延迟合并，不要为"顺序"debug。
- Page 侧：类级 `@CaptureResponse` / `@CaptureMedia` / `@BlockResource` / `@Viewport`；方法级 `@Setup` / `@Ready` / `@Interact` / `@Extract` / `@Transform` / `@Persist` / `@Teardown` 自动注册为对应阶段的 Hook。

**两种数据流形态，别混用**：

| 形态 | 装饰器 | 隐含假设 |
|---|---|---|
| 请求-响应（有界） | `@Endpoint` / `@Paginated` / `@Expanded` | 每次交互有明确的「完成」时刻 |
| 推送流（无界） | `@Endpoint` + `@Streamed` | 「完成」不是协议事件，而是**业务判断** |

推送类协议（SSE / WebSocket / NDJSON 长响应）破坏了前者的假设，所以 `@Streamed` 多出两件事：`reduce`（把碎片归一成累加器，HTTP 方法体拿到的是完整响应而流拿到的是碎片）与 `until(acc, event, ctx)`（终止判定，**第三个参数是 ctx**）。

> ⚠️ **`until` 能读 ctx 是刻意的**，因为 `@Paginated.stopWhen(response, page, accumulated)` **拿不到 ctx**——读不到用户传的 `maxPages`。曾有人用「装饰器给硬上限 + 聚合层按入参裁剪」绕过，实测：用户传 `maxPages=1` 时上游被打了 **20 次**请求，而输出的 `pagesFetched` 因为裁剪过仍显示 1，**从结果完全看不出超发**，还顺带丢了数据。
>
> **入参驱动的翻页优先用 `@Expanded` + 由入参算出的页号数组**（要几页发几次），不要用 `@Paginated` + 事后裁剪。
>
> 另：`@Endpoint.timeout` 对 `@Streamed` **不生效**（那是「整个请求的上限」，会把正常的长连接掐断），流的时间控制走 `idleTimeout`（断流检测）+ `maxDuration`（硬上限），两者语义不同不可互替——一条正常长连接可能挂 10 分钟只推 3 条。

### 2.6 Page Lifecycle：12 环节，但只有 7 个是可插拔 Stage

```
setup → [navigate] → [waitForSelector] → ready → interact → [fetchData]
      → extract → transform → persist → [projection] → [buildResult] → teardown
```

**方括号的 5 步由 `PuppeteerSkill.execute()` 直接完成，不经 Hook**；只有 `setup / ready / interact / extract / transform / persist / teardown` 这 7 步是 `LifecycleStage`，可被 Hook 插入。想扩展行为就往这 7 个里挂，别试图 hook navigate。

> ⚠️ **`@Setup` 跑在 navigate 之前**——此时页面还是 `about:blank`，**没有 Origin**。任何依赖同源的初始化（建立 WebSocket、发同源请求）必须挂 `@Ready`（导航之后）。挂错阶段的症状是上游直接拒绝握手，而**单测抓不到**（测试替身不关心页面 URL），只在真机暴露。守护办法：断言装饰器注册的阶段名（读 `getMethodHooks`），不依赖真机也能拦住。
>
> 另注意：同一个类里**多个 `@Teardown` 方法共用一个 hook 函数**，`buildSelfHook` 是无 try/catch 的循环——第一个抛错会跳过后面所有 `@Teardown`。框架只在 hook **之间**隔离异常，不在同一 hook 内的方法之间隔离。要释放多个资源就各自 try/catch。

`teardown` 是独立实例：**忽略激活条件、吞掉所有异常**，保证清理必然发生。Hook 可返回控制信号短路——`SKIP_STAGE`（跳过本阶段剩余 Hook）、`SKIP_PIPELINE`（终止数据管道，属受控信号非错误）、`abortPipeline(reason)`（转为 failure）。

> `emit` 曾是第 8 个 Stage，已废弃——副作用产出请用 `ProjectionPipeline.emit`。`hooks.ts` 注释里的 `emit` 是文档残留。

**跨阶段通信只走强类型 Slot API**：`defineSlot<T>(name)` 定义，`ctx.get/set/require/has/getOrCreate(slot)` 读写。**不要挂实例字段**——每次 `execute()` 新建 `PageContext` 正是为了避免并发竞态。`SlotKey<T>` 的类型靠 phantom field 承载，运行时只是 `{name}`，**同名 slot 会撞同一存储槽**。

浏览器来源对 Skill 透明：只依赖 `IBrowserSessionProvider`。策略是**按端点数量自动选的**——单端点用 `CDPConnector` 直连，多端点自动切 `PooledConnector` + `BrowserPool` + `CompositeRouter`（健康过滤 → 硬约束 → 软约束打分 → 并发上限 → Least Connections）。

### 2.7 依赖注入：两套机制，都没有容器

**(a) 构造函数注入**——业务依赖走这条，接口隔离：

```typescript
interface PuppeteerSkillDeps {
  sessionProvider: IBrowserSessionProvider;   // 必填
  artifactSink?: IArtifactSink;
  goalExecutor?: GoalExecutor;                // 可选
}
interface GoalSkillDeps extends PuppeteerSkillDeps {
  goalExecutor: GoalExecutor;                 // 通过 extends 收窄为必填
}
```

**没有 DI 容器**（无 tsyringe/inversify）。各 skill 的 `registry.ts` 是 IoC 组装点：`deps?.x ?? new DefaultX()` 提供默认实现并允许测试注入，然后 `new SkillRegistry().register(...).register(...)` 链式注册。**没有全局跨 skill 注册表**，每个 skill 自建；skill 类上的 `id` 就是 CLI skill-id。

**(b) `AsyncLocalStorage` 环境注入**——横切能力（tracer / events / blobs / redact / clock / config）聚合在 `RuntimeContext`，用 `currentRuntime()` 就地取用，不必层层传参。

> **`runWithRuntime()` 只允许在 `cli/run.ts` 和 `testing/runtime`（`createTestRuntime` 配套）调用，其它地方调用视为反模式。** 未注入时返回 `NOOP_RUNTIME`（Null Object，零成本空操作）——这让观测彻底可选，也意味着**框架内不存在第二种发事件的方式**，没有顶层 `emitEvent` 可调。

---

## 3. 新增 Skill 的标准姿势

### 3.1 选模式（三选一，不得混用）

| 模式 | 何时用 | 继承 | 参考 |
|---|---|---|---|
| **GoalExecutor** | 需登录态/Cookie 的平台 | `PuppeteerGoalSkill` | `xhs-spider` |
| **Provider** | 需 Python 生态库 | `BaseSkill` + Client 类 | `fin-spider` |
| **直接** | 纯 HTTP / RSS | `BaseSkill` | `rss-spider` |

**按需运行时**：纯 HTTP 不连浏览器；需登录态才连 Chrome CDP；需 Python 库才起独立 Bridge 进程隔离。浏览器一律 `puppeteer-core` CDP 远程调试，不捆绑 Chromium 二进制。**新增 npm / Python 依赖前先评估是否已有等价的内部实现或现有依赖能满足**——依赖会进 bundle，也会进每个消费方的部署面。

> 「不得混用」指**单个 Skill 不要脚踏两条船**，不是"一个包只能有一种模式"。同一包内**按链路分别选模式**是正常的：HTTP 链路走 `PuppeteerGoalSkill`，无 HTTP 端点可声明的链路（长连接推送、SSR 内联状态）**刻意跳出 Goal 链**直接继承 `PuppeteerSkill` 自实现 `fetchData`——硬套 Goal 只能造一个空壳骗过类型系统。先例：`bilibili-spider/src/skills/article/_base.ts`（SSR 内联）、`tradingview-spider/src/skills/tv-ws-skill-base.ts`（WS 推送）。

### 3.2 Goal 模式骨架

```typescript
class MySkill extends PuppeteerGoalSkill<MyParams, MyGoalResult, MyProjected> {
  readonly id = "my-skill";
  readonly name = "我的技能";
  readonly description = "...";   // 中文，供 Agent 判断该不该调
  readonly paramSchema: SkillParamSchema[] = [
    { name: "keyword", type: "string", required: true, description: "搜索关键词" },
  ];

  protected readonly siteURL = "https://example.com";
  protected getPath(params: MyParams) { return `/path?q=${params.keyword}`; }
  protected createGoal(params: MyParams): BaseGoal<MyGoalResult> { return new MyGoal(); }

  // ★ 投影走 pipeline getter，不是 project() 方法
  //   单层转换写 envelope（TPayload 被基类锁为 TResult，见下方说明）
  protected get pipeline(): ProjectionPipeline<MyParams, MyGoalResult, MyGoalResult, MyProjected> {
    return {
      envelope: (data, ctx) => ({ meta, insights, items: /* 显式枚举字段 */ }),
    };
  }
}
```

> **不要写 `protected project()` 方法**——投影本身没被取消，被取消的是"用方法覆写做投影"这种承载形式。`BaseSkill` / `PuppeteerSkill` / 包内基类曾三层各有一个 `project()`，子类一覆写就静默切断上层，连带丢掉 `ctx`、去噪与 emit（原委见 `puppeteer/projection.ts` 文件头）。现统一为 `pipeline` getter 的四个可选阶段（省略即 identity）。**基类不再调用任何 `project()` 方法**——写了也不会执行，`TProjected` 会形同虚设而 typecheck 不报错，是最难发现的一类 bug。

**`pipeline` 的四个泛型参数**：基类默认签名是 `<TParams, TResult, TResult, TProjected>`，即 `TPayload` 被锁为 `TResult`——所以单层投影必须写在 **`envelope`** 阶段，写进 `project` 会类型不匹配。只有在子类显式写全四个泛型、真正需要两级转换（先裁剪成中间结构、再包信封）时才用 `project`。

**投影不得依赖实例字段**。投影所需的派生值（解析出的 adapter、归一化入参、编译后的正则）若无法从 `ctx.params` 还原，一律走 Slot：`fetchData` 里 `ctx.set(XxxSlot, v)` → `envelope` 里 `ctx.pageContext.get(XxxSlot)`。用 `private currentXxx` 字段暂存会在并发 `execute()` 间串数据——每次 execute 新建 `PageContext` 就是为了杜绝这个（见 §2.6）。注意 `normalizeParams` 早于 `PageContext` 创建，**不能在那里写 Slot**；它只负责校验与填默认值。参考 `cninfo-spider/src/skills/slots.ts`。

**Skill:Goal 归属关系**：一次 `execute()` 只跑一个 Goal 实例；Goal 类**不得跨 Skill 共享**（每个 Goal 只属于一个 Skill）。但**允许 `createGoal()` 按参数在数个专属 Goal 之间分派**——`dedao/course-search`（bootstrap / continuation）、`cninfo/holder-trade`（detail / stat）都是这个写法。配套的 Goal 类（`thrall/<name>.ts`）：

```typescript
const SCOPE = "my-skill";          // 同时用作 @Goal.id 与错误 scope

@Goal({ id: SCOPE, name: "我的目标", baseURL: SOME_API, defaults: SHARED_GOAL_DEFAULTS })
export class MyGoal extends BaseGoal<MyGoalResult> {
  @Endpoint("/some/path", { method: "GET", query: (ctx) => buildQuery(ctx) })
  fetchList(response: RawResponse): RawPayload {     // ★ 方法体本身就是该端点的投影函数
    return response?.Data ?? { ItemList: [] };
  }

  @Aggregate()
  aggregate(ctx: GoalContext): MyGoalResult {
    const data = ctx.get<RawPayload>("fetchList");   // ★ 按方法名取上游结果
    return { totalCount: data.TotalCount ?? 0, items: data.ItemList ?? [], crawledAt: new Date() };
  }
}
```

要点：**端点方法体 = 该端点的投影函数**（返回值进 `GoalContext`）；`@Aggregate()` 必须恰好一个——缺失时 `GoalExecutor` 前置校验直接失败，重复声明**不报错**而是静默取最后定义的（元数据覆盖），别写两个；`ctx.get(name)` 的 name 是**方法名**，跨端点取值需在 `dependencies` 里声明，否则 `get()` 会抛出带诊断的错误。`@Expanded` 的端点方法会拿到数组。

> ⚠️ **端点方法体是无 `this` 调用的**——executor 内是裸调 `fn(validated, page)`，`this` 为 `undefined`。所以**不能用实例字段暂存跨页状态**（如翻页元信息），写了真机必崩。需要回传的信息一律塞进返回值，由 `aggregate()` 汇总。
>
> **动态路径段（`/:market/scan`）只有 `@Paginated` / `@Expanded` 会替换**——非分页端点调的是 `resolveUrl(url, {}, baseURL)`（空参数对象，不做替换），URL 会原样发出去。入参驱动的路径段有两种写法：域是**闭合小集合**时用「抽象基类 + 每域一个子类 + 工厂分派」（见 `xhs-spider/src/thrall/kol-rank/dates.ts`）；域是**开放集合**时用单元素 `@Expanded` 承载替换（见 `tradingview-spider/src/thrall/scan.ts`）。后者更适合"随时可能新增取值"的场景，也避免诱使人写白名单拦截。
>
> 顺带：`getOrCreateGoalMetadata` 的「继承 + 拷贝」语义已修复并有测试守护，**抽象基类持 `@Aggregate` + 子类各持 `@Endpoint`** 的写法是安全的（兄弟子类不会互相污染）。旧注释里"继承不可用"的说法是修复前的历史包袱。

`aggregate()` 里 `ctx.params` 拿得到入参，用它补齐上游响应没有的回显字段（`tab` / `pageIndex` / `crawledAt`）——这是 Goal 层唯一允许的"非上游数据"来源。

### 3.3 包内基类分层：把重复的坐标抽上去

Skill 数量上规模后，`siteURL` / `getPath()` 会大面积重复。**按"站点 → 页面模块 → 具体 Skill"抽两级抽象基类**，具体 Skill 只剩 id / name / description / paramSchema / createGoal / normalizeParams / pipeline：

```typescript
// ① 站点级：src/skills/<site>-skill-base.ts —— 只定 siteURL
export abstract class XxxSkillBase<TParams extends object = Record<string, unknown>, TData extends object = object, TProjected = TData>
  extends PuppeteerGoalSkill<TParams, TData, TProjected> {
  protected readonly siteURL = XXX_SITE;
}

// ② 模块级：src/skills/<module>/_base.ts —— 只定该页面模块的 path
export abstract class KolRankSkillBase<...> extends XxxSkillBase<...> {
  protected getPath(): string { return "/#/blogger/list"; }
}
```

泛型参数必须逐级透传（带默认值），否则子类丢失类型收窄。**基类只承载"坐标"（站点、路径），不承载业务逻辑**——共享的查询构造 / 参数归一放 `thrall/<module>/_shared.ts`，共享的默认值放 `thrall/shared.ts`。

### 3.4 硬性纪律

- **`@Paginated` 必须有终止条件**：`maxPages` 或 `stopWhen` 至少给一个（框架对页数**无**兜底，两个都不给就是无限分页）。`@Expanded` 的 `concurrency` / `interval` 有三级回退——装饰器 → `@Goal.defaults` → 框架内置（3 / 1000ms），**惯例是在 `thrall/shared.ts` 的 goal defaults 里统一给**，端点上只在需要偏离站点节流基线时才覆写，不要为"显式"到处复制字面量（会与 defaults 漂移）。
- **Skill = 原子能力单元**：封装一个完整且独立的获取需求，调用者执行一次即得最终结果。
- **Skill 之间不得有运行时调用依赖**。复用逻辑下沉到 `packages/core` 或包内 `utils/`；跨 Skill 编排交给外部 Agent 在 CLI 层完成。
- 必须经 `SkillRegistry` 注册并暴露 `id`/`name`/`description`/`paramSchema`。

### 3.5 投影层：契约的守门人

**`project()` 必须显式枚举字段，禁止 `{...rawData}` spread**——spread 会让上游新增字段静默泄露给消费者，破坏契约稳定性。同时剥离内部 ID、冗余描述、URL 等噪声。

- **空值语义显式声明**：`null` = 数据源不提供，`0` = 值确实为零。二者不可混用。
- **百分比保留原值**（`0.5` 即 0.5%），采集阶段不得 `/100`。
- **上游 ID 是不透明主键**：原样透传，下游不得假设编码（只做 `/^[\w-]{5,64}$/` 反注入）。不同 skill 的同名 ID（`orgId`/`scode`/`secid`、`categoryId`/`tagId`）指向**完全不同的字典，绝不通用**——命名空间登记见 §2.2，面向 Agent 的权威文档是各 skill 的 `references/conventions.md`。
- **脱敏是投影层的职责**：带平台特征的字段名要改成中性业务术语（如平台自有的达人指数 → `authorityIndex`），不把平台品牌痕迹透给消费者（见 §4.6）。
- **破坏性输出变更**（删字段、改类型）递增该 skill 包的 MAJOR 版本号。

**分层数据流水线**：`Fetch → Orchestration → Project` 三层职责不可混淆——**获取层不得对业务数据做任何变换**。

### 3.6 枚举取值：抓包样本 ≠ 全集

一次抓包只覆盖了你走过的那条用户路径。把当时见到的取值当成全集写进白名单并**在 `normalizeParams` 里拦截**，是本仓出现过的一类真实功能阉割——某包曾据 HAR 把上游的扫描域固化成 4 个并拦截其余，实测上游至少有 20 个域，加密货币（5.8 万标的）、期货（5.3 万）、外汇、美股、日股等全被拒之门外，而**报错信息还理直气壮地说"不是合法取值"**。

判据很简单：**这个枚举是我方定义的，还是上游定义的？**

| 枚举归属 | 处置 |
|---|---|
| 我方定义（如 skill 自己的 `mode` / `tab` 分派） | 可以拦截，取值非法直接 `InvalidParamsError` |
| **上游定义**（扫描域、字段名、资产类别、分类 ID…） | **只做形状校验**（防注入），取值透传给上游，让上游的 4xx 来判定 |

对上游枚举，把已验证的取值写进 `paramSchema.description` 和 `references/` 作**提示**，并显式说明"不做白名单拦截、可能有未列出的取值"。同时在包内建一个「已验证取值」常量并配测试断言它覆盖了主要类别——防止后人又把提示清单误当成拦截白名单收窄回去。

同理，`Raw*` 类型里上游枚举字段用 `string` 而非字面量联合：**联合类型本身就在诱导白名单**。

---

## 4. 编码规范

### 4.1 TypeScript 配置的实际约束

**全仓 `strict: false`**，`experimentalDecorators` + `emitDecoratorMetadata` 必开（装饰器基础设施依赖），`target: ES2020`，多数 `module: commonjs`。

⚠️ **`noImplicitAny` + `strictNullChecks` 只有部分包补开了**（core / xhs / bid / bilibili 等有，rss / cninfo 没有）。**改某个包前先看它自己的 `tsconfig.json`**——在宽松包里写的代码挪到严格包会报错。新包建议补开这两项。

包内导入用 `@src/*` 路径别名（1160 处，压倒性惯例），跨包用 `@spider/core`。相对路径只用于各包 `src/index.ts` 的 barrel 再导出。

### 4.2 命名与代码组织

| 对象 | 规则 |
|---|---|
| 包 | `<datasource>-spider`（按**数据源**而非业务域），包名 `@spider/<name>` |
| skill-id | kebab-case，包内唯一，就是 CLI 第一个位置参数。`<模块>-<动作>`（`kol-rank-list` / `entity-search`）或平台前缀式（`bili-video`）——**无统一强制前缀** |
| 类 | Skill 类 `<Domain><Action>Skill`；Goal 类 `<Domain><Action>Goal`；基类 `<X>SkillBase` |
| 类型 | `*Params`（入参）/ `Raw*`（1:1 上游 JSON）/ `*Result`·`*GoalResult`（Goal 聚合）/ `*Projected`（对外）/ `*Card`·`*Brief`·`*Item`（中间投影） |
| 函数 | 投影 `project<Thing>AiReady()`；要点 `build<Thing>Insights()` |
| 文件 | `*.skill.ts`（一文件一 skill-id）/ `thrall/<name>.ts`（Goal，靠目录区分不加后缀）/ `projections/*.ai-ready.ts` / `*.types.ts` / `_base.ts` / `_shared.ts` |

`projections/` 下除 `*.ai-ready.ts`（模块信封）外，还放**跨模块复用的字段级投影器**（如把上游达人对象压成 `BloggerCard`）与工具（`stripNoise()`、ID 命名空间登记表），不带 `.ai-ready` 后缀。信封函数调它们，它们不反向依赖信封。

**镜像原则**：`thrall/<module>/<name>.ts` ↔ `skills/<module>/<name>.skill.ts` ↔ `types/<module>.types.ts` ↔ `projections/<module>.ai-ready.ts`，四处同名对齐（目录形态见 §6）。

**规则文件前缀**：`spider-` 是**保留前缀**（`skills/_shared/claude/rules/`）；skill 自有规则须以完整 skill 名或首段 token 为前缀（`xhs-spider-*.md` / `xhs-*.md`）。**skill 名撞 `spider-` 前缀会导致构建报错。**

**全仓 0 个 `enum`**——一律用字面量联合类型 + `as const` 对象。字典用 `Record<K, string>`，站点/端点常量集中在 `src/constants.ts`（SCREAMING_SNAKE）。

**类型三段式**（权威表述见 `cninfo-spider/src/types/market/holder-trade.types.ts` 文件头）：① `Raw*` 保留上游原字段名（含 `F00x` 这类），带 `[k: string]: unknown` 兜底 → ② 领域对象（camelCase 语义字段）→ ③ `*Projected` 投影。上游改字段时映射函数编译报错，这是刻意的早期预警。

**风格细节**：偏好 `interface`（680 处）远超 `type`（256，仅用于联合/别名工厂）；`import type` 与值导入分两条语句；无 `public` 关键字（靠默认）；覆写点一律 `protected`，内部 helper `private`；纯函数辅助放 class 之前的模块顶层。

### 4.3 投影层实操

`insights` 是**纯模板字符串拼接 + 手算聚合**，无 LLM。惯例：`build<X>Insights(items, meta): string[]`，空数组早退返回 `["榜单为空"]` 之类，随后逐条 `out.push()`。配套模块私有格式化小工具（`pct()` / `wan()`，万/亿分档）。写什么由"Agent 拿到后最可能立刻算的东西"决定——总量与均值、占比与达成率、分布分档、期间变化（升/平/降/新进），而非复述字段。

`envelope` 三种写法：委托 `projections/*.ai-ready.ts` 独立模块（xhs）、私有 `buildEnvelope()` 方法（bid）、内联（简单场景）。**`normalize` 阶段全仓 0 使用**——去噪工具 `stripNoise()` 都在 `envelope` 内直接调；`emit` 仅用于副作用落盘。

**模块规模上来后，给每个页面模块定义一个泛型信封类型**，让同模块多个 Skill 共享形状、各自收窄 payload 与 meta：

```typescript
export interface XxxAiReady<TPayload, TMeta extends object = object> {
  meta: TMeta & { skill: string; semantics: string; crawledAt: Date | string };
  units?: Record<string, string>;
  insights: string[];
  payload: TPayload;
}
```

- **`meta.semantics` 是强制字段**：一句中文说清这组数字的口径（`近 7 天 行业达人榜`）。Agent 回写时只允许用这个口径，不得自造词——所以它必须由投影层给出。
- **`units` / `enums` 显式声明**：数值化枚举（如 `gender: 0|1|2`）保留原值 + 附字典翻译，不在采集侧转成字符串。
- **信封 body 字段名三选一**：列表用 `items`，多面板 / ID 产出型用 `payload`，单对象用 `detail`。`units` 的位置（`meta` 内 or 与 `meta` 平级）**同一个包里都可能不一致**——跟随你正在改的那个模块的既有写法，不要为统一而重构已发布的信封（那是破坏性变更，见 §3.5）。

### 4.4 错误抛出

一律抛 `SpiderError` 子类（`MissingContextError` / `InvalidParamsError` / `NotLoggedInError` / `UpstreamShapeChangedError` / `NavigationFailedError`），**必带 `{ scope: this.id }`**，可选 `phase` / `details` / `cause`。**禁裸 `throw new Error`。**

`normalizeParams()` 的职责固定三件：**语义校验（抛 SpiderError）→ trim/clamp → `??` 填默认值**，返回全新对象。区分「缺失」用 `MissingContextError`、「非法」用 `InvalidParamsError`。错误信息要**给引导**，例：`` `tab="${p.tab}" 不走 GetBloggerRank，请改用：recommend → kol-rank-recommend` ``。

> 禁 spread 只针对**上游 raw data**；入参对象 `{...params, keyword}` 是允许且常见的。

### 4.5 注释与提交

中文 JSDoc 为主：文件头 `/** ... */` 块交代模块职责与上游端点；接口字段单行 `/** */`；`// ==== 分节 ====` 横幅切分大文件。本仓特色是**决策留痕注释**——投影层会显式写出"故意丢弃"了哪些上游字段及原因（见 `xhs-spider/src/projections/blogger.ts` 文件头），新增投影时请延续。

提交信息 **Conventional Commits + 中文正文**，scope 用包名：`feat(core): ...` / `fix(bid-spider): ...` / `docs: ...`。

### 4.6 安全与信息隔离（红线）

- 代码库、文档、日志中**不得出现采集目标平台的真实域名或商标名称**，需引用时用内部代号。
- 采集数据不进 VCS，示例文件只放脱敏结构或 mock。
- 凭证与会话（Cookie、Token）经环境变量/运行时注入，不得硬编码。
- **浏览器采集必须在 `page.evaluate(fetch(...))` 内发请求继承会话，不得把 Cookie/Token 提取到 Node 层。**
- Python Bridge 是无状态网关，不存任何会话或采集数据；每实例独占端口，不复用。

---

## 5. 构建与验证

包管理器是 **Yarn 4 (Berry)**，不是 npm/pnpm；精确版本见根 `package.json` 的 `packageManager`。

**`scripts/build-skill.js` 是构建的唯一真理源**（重度注释，改构建行为前必读）：

```bash
node scripts/build-skill.js <name> [--target project|global] [--dev] [--no-obfuscate] [-o <dir>]
```

根 `package.json` 的 `build:*` 是**手工维护的不完整别名子集**——没有别名不代表不能构建。别名缺失时直接调上面的命令或 `yarn workspace @spider/<x> build`；新增 skill 时顺手补别名。**各包脚本自己配自己的，不齐是常态**（`typecheck` 尤其），要跑什么先读该包的 `package.json`。

开发期在 skill 目录内用 `yarn skill <skill-id> '<json>'`（tsx 直跑未打包源码，最快回路）。产物形态的调用与自省子命令（`--list` / `obs ...` / `--rationale` / `--caller`）由 `runCLI` 统一提供，以 `packages/core/src/cli/run.ts` 实现为准。

**验证靠 lint + typecheck + 分层测试 + `--dev` 构建后手动跑一次。** 测试运行器统一为 **vitest**（2026-07-27 决策，取代 node:test + tsx；断言仍用 `node:assert/strict`、快照仍用自研 `createSnapshotter`——两者刻意不随运行器变，禁止混入 `toMatchSnapshot` 造快照双体系；覆盖率若启用只准 v8 provider）。投影层是纯函数，用 mock fixture → 投影函数 → JSON 快照对比锁定输出契约，`yarn workspace @spider/<x> test` 运行、`UPDATE_SNAPSHOTS=1` 在契约有意变更后刷新（diff 进 review）。core / cninfo / xhs / bilibili 已接入测试，**其余包尚无 `test` 脚本**——引用任何测试命令前先看该包 `package.json`，不要编造。`packages/core/src/testing/` 是测试替身与夹具（FakePage / FakeUpstream / runSkillWithFixtures），不是测试运行器。**lint 有大量存量报错，只看自己新增的，不要试图清零。** 完整测试体系（单元/模块/E2E 分层、替身接口、fixture 规范、分期路线）见 `docs/TESTING.md`，运行器迁移与 E2E 编排的实施计划见 `docs/VITEST-MIGRATION.md`——写任何测试前先读它们。

### 两个反复咬人的环境陷阱

1. **`BUILD_OUTPUT`（根 `.env`）会静默改写 project 模式的产物位置**，可能指向仓库之外；若目标路径含 `.claude/` 则直接装进去。找不到产物先查它。要落在 `dist/<name>/` 就清掉它或用 `-o` 覆盖。global 模式恒走 `~/.claude/`，不受影响。
2. **运行环境以构建目标与业务依赖为准**：打包已移除授权字节码与 V8 ABI 门禁，不再因授权模块绑定构建机的 OS / CPU 架构或 V8 版本。Node 目标仍以 `build-skill.js` 的 esbuild `target` 为准，业务依赖自身的平台限制仍需单独核对。

### CLI 规范（`runCLI` 已统一实现，新增 skill 不必重造）

所有输出为 JSON（面向 Agent）；`--list` 不依赖运行时；执行前预检运行时（Chrome 端口 / Bridge 健康检查）失败返回 JSON 错误而非崩溃；全局超时防悬挂进程。

各 skill 的 `src/cli.ts` 是薄封装，形态随需求而变——注册表若要用 CDP 地址 / 落盘根目录就接住回调参数，不需要就整个忽略：

```typescript
runCLI((browserURL, storageRoot) => createDefaultRegistry(undefined, browserURL, storageRoot),
       { name: "x-spider", example: '...' });          // 需要外部注入
runCLI(() => createDefaultRegistry(), { name: "x-spider", example: '...', silent: true });  // 不需要
```

`silent: true` 抑制非 JSON 输出。**stdout 必须只有最终 JSON**——注册、生命周期、重试轨迹一律走 observability（`JsonlSink` / `LoggerSink`），任何 `console.log` 都会污染 Agent 的解析。

---

## 6. Skill 包结构

```
skills/<name>/
  package.json          # @spider/<x>；可选 buildConfig.externals（不打进 bundle 的重依赖）
  src/
    cli.ts              # 构建入口 —— 找任何东西都从这里的 import 链往下追
    registry.ts         # createDefaultRegistry()，IoC 组装点
    constants.ts        # 站点 / 端点常量（SCREAMING_SNAKE）
    <x>.skill.ts        # 一个类一个 skill-id
    types/              # *Result 与 *Projected
    <模式特定目录>       # 随数据源模式而异；utils/ 为包内共享
  claude/               # 打包进产物的 Claude 资源
    skills/<name>/{SKILL.md, references/}
    rules/<prefix>-*.md agents/ commands/ agent-memory/ CLAUDE.md
  docs/                 # 逆向分析资料（HAR + *-analysis.md）
```

**Skill 数量多时按页面模块分组**，四处目录同名对齐（§4.2 的镜像原则），每个模块自带 `_base.ts` / `_shared.ts` / `index.ts`：

```
src/skills/<module>/{_base.ts, <name>.skill.ts, index.ts}   # 模块基类 + 各 Skill + 桶导出
src/thrall/<module>/{_shared.ts, <name>.ts}                 # 对应 Goal + 模块内共享查询构造
src/types/<module>.types.ts                                 # Raw* + 领域对象
src/projections/<module>.ai-ready.ts                        # 该模块的泛型信封与投影函数
src/types/projected.types.ts                                # 全包 *Projected 汇总
```

`registry.ts` 按模块分组 `.register()`，头部 JSDoc 列出「模块 → Skill 数 → 页面路径」——这是包内唯一的能力全景图，新增模块时同步更新。

**目录布局不齐是常态**，别按上表想当然：`registry.ts` 实际位置随包而异，个别包仍是旧 `assets/` 布局（只支持 project 模式，global 报错）。**以 `src/cli.ts` 的 import 链为准。**

- **有无 `package.json` 决定构建方式，不再决定是否参与构建**——纯文档 skill（模板、只有 HAR 的调研目录、纯 Agent/Command 团队如 `finance-analyst`）无 `package.json` 时，`build-skill.js` 会走 `docsOnly` 分支：跳过 esbuild/混淆，只搬运 `claude/` 资源树到目标 `.claude/`（project）或 `~/.claude/`（global），无业务产物。仍不参与 `workspace` 依赖解析（不出现在 `yarn.lock`），纯文档 skill 若真的只是模板/调研目录（无 `claude/` 新布局）则依旧不接入构建。
- `agent-memory/` 是**播种制**：目标已存在则跳过，绝不覆盖。
- SKILL.md frontmatter：`argument-hint: <skill-id> '<params-json>'`、`allowed-tools: Bash(node *)`（无 `execute` 字段，运行方式写进正文的快速开始）。正文需含快速开始（前置依赖 + 运行示例）、Skill 目录表（ID / 说明 / 必填参数）、每个 Skill 的参数详情表。
- 跨 skill 共享代码只在 `skills/_shared/*`（构建期共享库，不违反「禁止跨 skill 运行时依赖」），见 `docs/INTEL-SUPPLY.md`。

---

## 7. 打包 / License / 防逆向

构建流程：esbuild 业务 bundle → 可选业务混淆 → 安装 external 依赖 → 复制 Claude 资源。正式态与开发态都以 `scripts/index.js` 为唯一入口；默认开启混淆，`--dev` 默认关闭，`--obfuscate` / `--no-obfuscate` 显式覆盖。

打包不再读取私钥或注入授权公钥，`__LICENSE_PUBKEY__` / `__BUILD_ID__` 固定为空字符串；不生成 `license.jsc`、`.sig` 或 `runtime.json`，也不附加 bytenode 运行依赖。core 中的授权实现、签发工具与本地密钥保留，产物沿用无公钥放行分支，不执行验签、完整性校验或机器绑定。

**构建红线**（改混淆配置前必读 `build-skill.js` 内 `BUSINESS_OBFUSCATION_OPTIONS` 注释）：业务 bundle **禁用** `controlFlowFlattening` / `stringArray` / `renameGlobals` 等——会把字面量提出 `page.evaluate(fn)` 回调，导致浏览器里 `xxx is not defined`。

### 跨 `page.evaluate` 边界的代码纪律

`page.evaluate(fn)` 把 fn **字符串化**后丢进浏览器——回调内看不到任何模块作用域。这类故障**只在真机暴露**（单测的 vm 沙箱可能恰好有同名全局），有的甚至**只在正式态构建后**才炸，是全仓最难排查的一类。

把这类代码**集中到单一文件**（如 `<pkg>/src/ws/page-scripts.ts`），文件头写明纪律，并遵守：

- 每个导出是**恰好一个 JSON 可序列化参数**的函数，入参与返回值都是纯数据；
- **禁止引用任何模块作用域标识符**——URL、超时、常量、鉴权字面量一律从入参传入；需要的 helper 在函数体内就地重声明（刻意的重复，配单测把它钉死在权威实现上防漂移）；
- **自备 `__name` 兜底**：`const g = globalThis as any; if (typeof g.__name !== "function") g.__name = (fn) => fn;`。esbuild/tsx 会给函数体内的具名声明注入 `__name()` helper，而该 helper 定义在模块作用域，**不随 `fn.toString()` 过边界**，真机报 `__name is not defined`；
- **不抛异常**，一律返回 `{ok, errorKind}` 由 Node 侧映射成 `SpiderError`——异常跨边界后只剩 message，类型信息全丢。

验收方式唯一：**正式态构建（含混淆）后真机跑一次**。`--dev` 构建和单测都证伪不了这一条。

---

## 8. 运行时前置

浏览器链路 skill 需要一个开了远程调试的 Chrome（默认 `127.0.0.1:4444`，`BROWSER_URL` 可覆盖），启动方式见 `README.md`。每次运行自动把 trace 写到 `~/.spider/`（`SPIDER_OBS_DIR` 可改），用 `obs` 子命令查询。

---

## 9. 文档索引

- `packages/core/ARCHITECTURE.md` —— 框架架构详解（1000+ 行：Lifecycle 各阶段、装饰器完整 options、DI、URL 模型、重构变更记录）。**改 core 前读这个。**
- `docs/LICENSE.md` / `docs/INTEL-SUPPLY.md` / `docs/FIX-SPIDER-SIDE.md` —— license 签发部署、情报供给解耦、最小 diff 修复纪律。
- `docs/TESTING.md` —— 测试体系工程规格（分层设计、替身接口契约、fixture 脱敏规范、CI 门禁分级、四期实施路径）。**写测试前读这个。**
- `skills/_shared/claude/rules/spider-core.md` / `spider-runtime.md` —— 调用协议与输出契约（一次一条命令、只用 jq、错误码表、信封契约）。
- `OBSERVABILITY.md` —— 可观测性使用指南。
- `README.md` —— Chrome 启动、打包模式对照、RSSHub 内嵌运行时。
