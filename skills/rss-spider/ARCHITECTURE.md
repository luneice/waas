# rss-spider 架构设计

## 1. 系统职责

从任意 RSS 来源获取 Feed，按需补全不完整条目的正文内容，输出结构化情报。

## 2. 核心约束

| #   | 约束                       | 设计影响                                                           |
| --- | -------------------------- | ------------------------------------------------------------------ |
| C1  | Chrome 带登录态，全局唯一  | `IBrowserSessionProvider` 单点创建，注入所有消费方                 |
| C2  | RSSHub 必须复用我的 Chrome | `EmbeddedRsshubRuntime` 通过 `getWSEndpoint()` 获取端点传给 rsshub |
| C3  | Feed 来源可扩展            | Provider 策略接口，Factory 统一分发                                |
| C4  | 补全策略不确定哪个更好     | 两级策略链：item 级 + page 级，均可替换/重排                       |
| C5  | RSSHub 自带路由发现能力    | 不重造 Radar，基于 rsshub 路由注册表封装 Discovery                 |

## 3. 全局架构

```
                          ┌─────────────────────────────────────┐
                          │         RssSkill (BaseSkill)         │
                          │  参数归一化 → 三步编排 → 包装输出      │
                          └────────────────┬────────────────────┘
                                           │
                    ┌──────────────────────┬┴──────────────────────┐
                    ▼                      ▼                       ▼
            ① Acquire Feed          ② Assess               ③ Enrich
           (FeedProvider)        (pure function)        (EnrichmentChain)
                    │                                          │
          ┌─────────┼──────────┐                   ┌───────────┼──────────┐
          ▼         ▼          ▼                   ▼                      ▼
       URL      RSSHub    GoogleNews        RsshubEnricher         BrowserEnricher
                  │          │                    │                      │
                  │          │              ┌─────┘                ┌─────┼──────┐
                  │          │              ▼                      ▼            ▼
                  │          │        IRsshubDiscovery      Readability    Custom
                  │          │        IRsshubRuntime        Extractor     Extractor
                  │          │              │
                  └──────────┼──────────────┘
                             ▼
                    IBrowserSessionProvider
                      (共享 Chrome 实例)
```

## 4. 模块结构

```
src/
├── cli.ts                         ← CLI 入口
├── config.ts                      ← 配置（单文件，env → 属性）
├── types.ts                       ← RssFeed / RssItem / 所有类型
│
├── rsshub/                        ← RSSHub 能力封装
│   ├── interfaces.ts              ← IRsshubRuntime + IRsshubDiscovery
│   ├── embedded-runtime.ts        ← 路由请求 (init / fetchRoute)
│   ├── discovery.ts               ← 路由发现 (基于 rsshub 路由注册表)
│   ├── route-resolver.ts          ← 路由解析工具
│   └── failure-classifier.ts      ← 错误分类
│
├── provider/                      ← Feed 来源层
│   ├── interfaces.ts              ← IFeedProvider / IFeedProviderFactory
│   ├── url.provider.ts            ← HTTP 获取 RSS/Atom/JSON
│   ├── rsshub.provider.ts         ← 委托 IRsshubRuntime
│   ├── google-news.provider.ts    ← Puppeteer → Google News RSS XML
│   └── factory.ts                 ← 分发 + Discovery 自动检测
│
├── enrichment/                    ← 补全层
│   ├── interfaces.ts              ← IItemEnricher / IPageExtractor / IEnrichmentChain
│   ├── enrichment-chain.ts        ← 批量编排 + 并发控制
│   ├── rsshub.enricher.ts         ← Discovery.detect → Runtime.fetchRoute
│   ├── browser.enricher.ts        ← 打开页面 → 逐策略提取
│   ├── readability.extractor.ts   ← Readability + Turndown
│   └── custom.extractor.ts        ← CSS 选择器 / 启发式
│
├── skill/                         ← Skill 层
│   ├── rss.skill.ts               ← 主 Skill (BaseSkill)
│   ├── page-extract.skill.ts      ← 单页提取 (PuppeteerSkill)
│   ├── list-extract.skill.ts      ← 列表提取 (PuppeteerSkill)
│   ├── route-discover.skill.ts    ← 路由发现 (BaseSkill)
│   └── registry.ts                ← Composition Root
│
└── utils/
    ├── concurrency.ts             ← 并发控制
    ├── feed-parser.ts             ← XML/JSON Feed 解析
    ├── html-to-markdown.ts        ← Turndown 封装
    └── google-news-decoder.ts     ← Google News URL 工具
```

## 5. 接口契约

### 5.1 Feed 来源

```typescript
interface IFeedProvider {
  readonly type: string; // "url" | "rsshub" | "google-news"
  readonly sourceUrl: string; // 实际请求地址（日志/调试用）
  fetch(): Promise<RssFeed>;
}

interface IFeedProviderFactory {
  create(params: FeedParams): IFeedProvider;
}
```

Factory 内部决策逻辑：

```
url 提供了?
  ├─ 是 RSS feed URL    → UrlProvider
  └─ 是普通网页 URL     → Discovery.detect(url)
                            ├─ 有匹配路由 → RsshubProvider(detected route)
                            └─ 无匹配     → UrlProvider（兜底尝试直接解析）

route 提供了?           → RsshubProvider(route)
googleQuery 提供了?     → GoogleNewsProvider(query)
```

### 5.2 RSSHub 双能力

```typescript
/** 路由请求 */
interface IRsshubRuntime {
  readonly label: string;
  fetchRoute(route: string, overrideBaseUrl?: string | null): Promise<RssFeed>;
  resolveRoute(route: string, overrideBaseUrl?: string | null): RouteResolution;
}

/** 路由发现 — 基于 rsshub 已加载的路由注册表 */
interface IRsshubDiscovery {
  initialize(): Promise<void>;
  detect(url: string): DetectionResult[];
  search(query: string): RouteInfo[];
  listNamespaces(): string[];
  getNamespaceRoutes(namespace: string): RouteInfo[];
}
```

`Discovery` 依赖 `Runtime` 完成 `init()` 后路由注册表才可用。不再从 `.d.mts` 文件解析。

### 5.3 补全 — 两级策略链

```typescript
/** item 级：用什么手段获取全文 */
interface IItemEnricher {
  tryEnrich(item: RssItem): Promise<RssItem | null>;
  //  null = "我处理不了，交给下一个"
  //  RssItem = "补全完成"
  //  throw = "意外错误"（chain 捕获并记录）
}

/** page 级：用什么方式从页面提取内容 */
interface IPageExtractor {
  tryExtract(
    page: Page,
    url: string,
    selectors?: DetailSelectors,
  ): Promise<ExtractResult | null>;
  //  null = "提取失败或质量不达标，让下一个试"
}

/** 批量编排 */
interface IEnrichmentChain {
  enrich(
    allItems: RssItem[],
    incompleteItems: RssItem[],
    options?: EnrichOptions,
  ): Promise<EnrichResult>;
}
```

运行时调用链：

```
EnrichmentChain
  ├── RsshubEnricher.tryEnrich(item)
  │     Discovery.detect(item.link)
  │       ├─ 有路由 → Runtime.fetchRoute() → 匹配条目 → return RssItem
  │       └─ 无路由 → return null
  │
  └── BrowserEnricher.tryEnrich(item)
        sessionProvider.acquire() → page.goto(item.link)
        for extractor of extractors:
          ├── ReadabilityExtractor.tryExtract(page)
          │     Readability 提纯 → 质量检查(minContentLength)
          │       ├─ 达标 → return ExtractResult
          │       └─ 不达标 → return null
          │
          └── CustomExtractor.tryExtract(page, selectors)
                CSS 选择器 / 启发式 → return ExtractResult | null
```

### 5.4 完整性评估 — 纯函数

```typescript
function assessCompleteness(
  items: RssItem[],
  minContentLength: number,
): {
  complete: RssItem[];
  incomplete: RssItem[];
  unenrichable: RssItem[];
};
```

无状态、无副作用。不需要类和接口。

## 6. Chrome 共享模型

```
                      IBrowserSessionProvider
                    (ChromeSessionProvider — 唯一实例)
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                       │
        ▼                      ▼                       ▼
 GoogleNewsProvider    EmbeddedRsshubRuntime     BrowserEnricher
        │                      │                       │
   acquire()            getWSEndpoint()           acquire()
   拿 page               → ws://...               拿 page
   访问 RSS URL           传给 rsshub.init({       打开 item URL
   捕获 XML response        PUPPETEER_WS_ENDPOINT  执行 extractors
                          })
```

三类消费者，两种消费方式：

- `acquire()` → 拿到 `PageSession`，直接控制 page
- `getWSEndpoint()` → 拿到 WS 地址字符串，传给 rsshub SDK 让它自己连

## 7. 主 Skill 执行流程

```typescript
class RssSkill extends BaseSkill<RssParams, RssResult> {
  async execute(params, options?): Promise<SkillResult<RssResult>> {
    const startedAt = new Date();
    const normalized = this.normalizeParams(params);

    try {
      // ① 获取 Feed
      const provider = this.deps.providerFactory.create(normalized);
      const feed = await provider.fetch();

      // 摘要模式 — 提前返回
      if (normalized.summary) {
        return this.buildResult(
          true,
          summarize(feed),
          undefined,
          normalized,
          startedAt,
        );
      }

      // ② 评估完整性
      const { incomplete } = assessCompleteness(
        feed.items,
        this.deps.config.minContentLength,
      );

      // 无需补全 — 提前返回
      if (normalized.skipEnrichment || incomplete.length === 0) {
        return this.buildResult(
          true,
          { feed, report: null },
          undefined,
          normalized,
          startedAt,
        );
      }

      // ③ 补全
      const { items, report } = await this.deps.enrichmentChain.enrich(
        feed.items,
        incomplete,
        normalized.enrichOptions,
      );

      return this.buildResult(
        true,
        { feed: { ...feed, items }, report },
        undefined,
        normalized,
        startedAt,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return this.buildResult(false, emptyResult(), msg, normalized, startedAt);
    }
  }
}
```

三步线性流程，无需独立 Pipeline 类。

## 8. Composition Root

```typescript
interface RegistryDeps {
  sessionProvider: IBrowserSessionProvider;
  rsshubRuntime: IRsshubRuntime;
  config: Configuration;
}

function createDefaultRegistry(deps?: Partial<RegistryDeps>): SkillRegistry {
  // ── 基础设施 ──
  const config = deps?.config ?? new Configuration();
  const sessionProvider = deps?.sessionProvider ?? new ChromeSessionProvider();

  // ── RSSHub 双能力 ──
  const rsshubRuntime =
    deps?.rsshubRuntime ?? new EmbeddedRsshubRuntime(sessionProvider, config);
  const discovery = new RsshubDiscovery(rsshubRuntime);

  // ── Feed 来源 ──
  const providerFactory = new FeedProviderFactory(
    rsshubRuntime,
    discovery,
    sessionProvider,
    config,
  );

  // ── 补全: page 级提取策略 ──
  const extractors: IPageExtractor[] = [
    new ReadabilityExtractor(config.minContentLength), // 优先: 成熟开源方案
    new CustomExtractor(), // 回退: CSS 选择器/启发式
  ];

  // ── 补全: item 级策略链 ──
  const enrichmentChain = new EnrichmentChain(
    [
      new RsshubEnricher(discovery, rsshubRuntime, config), // 优先: RSSHub 路由
      new BrowserEnricher(sessionProvider, extractors, config), // 回退: 浏览器提取
    ],
    config,
  );

  // ── Skills ──
  return new SkillRegistry()
    .register(new RssSkill({ providerFactory, enrichmentChain, config }))
    .register(new PageExtractSkill({ sessionProvider, extractors, config }))
    .register(new ListExtractSkill({ sessionProvider, config }))
    .register(new RouteDiscoverSkill({ discovery }));
}
```

外部注入点 3 个（sessionProvider / rsshubRuntime / config），内部装配细节不暴露。测试时只需替换这 3 个。

## 9. 与 @spider/core 的对齐

| Skill                | 基类             | 理由                                           |
| -------------------- | ---------------- | ---------------------------------------------- |
| `RssSkill`           | `BaseSkill`      | 编排器，不是单页浏览器 Skill                   |
| `PageExtractSkill`   | `PuppeteerSkill` | 单页模型，复用 Template Method 的 session 管理 |
| `ListExtractSkill`   | `PuppeteerSkill` | 同上                                           |
| `RouteDiscoverSkill` | `BaseSkill`      | 无浏览器，纯计算                               |

错误处理对齐 core 的 `SkillFailureKind`：

- 浏览器不可达 → `"browser-unavailable"`
- RSSHub 路由不存在 → `"no-results"`
- Feed URL 无法解析 → `"missing-context"`

## 10. 迁移映射

| 现有模块                               | 去向                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------- |
| `source/feed-source.ts` (抽象类)       | **删除** — 接口就够                                                             |
| `source/url-feed-source.ts`            | → `provider/url.provider.ts`                                                    |
| `source/rsshub-source.ts`              | → `provider/rsshub.provider.ts`                                                 |
| `source/google-news-source.ts`         | → `provider/google-news.provider.ts`                                            |
| `source/feed-source-factory.ts`        | → `provider/factory.ts`                                                         |
| `pipeline/` (3 文件)                   | **删除** — 逻辑移入 `RssSkill.execute()`                                        |
| `analyzer/` (3 文件)                   | **降级** → `assessCompleteness()` 纯函数放 `utils/`                             |
| `enricher/feed-enricher.ts` (一个大类) | **拆分** → `enrichment-chain.ts` + `rsshub.enricher.ts` + `browser.enricher.ts` |
| `extractor/page-content-extractor.ts`  | **拆分** → `readability.extractor.ts` + `custom.extractor.ts`                   |
| `rsshub/radar.ts` (.d.mts 解析)        | **重写** → `discovery.ts` (基于 rsshub 路由注册表)                              |
| `rsshub/embedded-runtime.ts`           | **保留**，清理 monkey-patch 注释                                                |
| `config/` (2 文件)                     | **合并** → `config.ts`                                                          |
| `types/` (4 文件)                      | **合并** → `types.ts`                                                           |

## 11. 关键修复项（随重构一并解决）

| 问题                             | 解法                                               |
| -------------------------------- | -------------------------------------------------- |
| WeakMap 按引用匹配导致静默丢数据 | `Map<string, RssItem>` by `link`                   |
| 7 处空 catch                     | chain 统一 catch + 记录到 `EnrichReport.errors`    |
| Radar 同步 readFileSync          | 不再自己解析文件，用 rsshub 注册表                 |
| `concurrency=0` 静默丢数据       | `runWithConcurrency` 加 `Math.max(1, concurrency)` |
| Pipeline 丢失 stack trace        | `RssSkill.execute()` 保留完整 Error 对象           |
