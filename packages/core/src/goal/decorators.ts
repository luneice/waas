import "reflect-metadata";
import { STREAMED_METADATA_KEY } from "./streamed";
import {
  GoalOptions,
  EndpointOptions,
  PaginatedOptions,
  ExpandedOptions,
  EndpointMetadata,
  GoalMetadataStore,
} from "./interfaces";

// ============================================================================
// 元数据 Key 定义
// ============================================================================

export const METADATA_KEY = {
  /** Goal 配置 */
  GOAL_STORE: Symbol("ai-spider:goal-store"),
  /** Paginated 配置（临时存储） */
  PAGINATED: Symbol("ai-spider:paginated"),
  /** Expanded 配置（临时存储） */
  EXPANDED: Symbol("ai-spider:expanded"),
};

// ============================================================================
// 元数据辅助函数
// ============================================================================

/**
 * 获取或创建 Goal 元数据存储。
 *
 * ⚠️ 必须用 `getOwnMetadata` 判定"本类有没有自己的 store"——`getMetadata` 会
 * 沿原型链回溯。抽象基类上挂了 `@Aggregate`（xhs 的 BaseDatesGoal 就是这个写法）
 * 时，子类的 `@Endpoint` / `@Goal` 会取到**基类那一个** store 并就地改写，
 * 于是所有兄弟子类共用一份元数据、后声明的静默覆盖先声明的：4 个 Tab 的
 * 日期端点全部塌缩成最后一个类的 URL，而 `aggregate()` 读的是实例字段
 * `this.endpoint`，回显依旧"正确"——请求打错了地方，输出却看不出来。
 *
 * 正确语义是**继承 + 拷贝**：子类以基类声明为起点（拿到基类的 `@Aggregate`
 * 与共享端点），但后续改写只落在自己的 store 上，不回流污染基类与兄弟。
 */
function getOrCreateGoalMetadata(target: any): GoalMetadataStore {
  const own = Reflect.getOwnMetadata(METADATA_KEY.GOAL_STORE, target) as
    | GoalMetadataStore
    | undefined;
  if (own) return own;

  const inherited = Reflect.getMetadata(METADATA_KEY.GOAL_STORE, target) as
    | GoalMetadataStore
    | undefined;

  const store: GoalMetadataStore = inherited
    ? {
        options: { ...inherited.options },
        // endpoint 逐条浅拷贝：finalizeGoalMetadata 会就地写 paginated/expanded，
        // 共享同一个 EndpointMetadata 对象等于把污染换个地方继续
        endpoints: new Map(
          Array.from(inherited.endpoints, ([name, meta]) => [name, { ...meta }]),
        ),
        aggregateMethod: inherited.aggregateMethod,
      }
    : {
        options: { id: "", name: "" },
        endpoints: new Map(),
      };

  Reflect.defineMetadata(METADATA_KEY.GOAL_STORE, store, target);
  return store;
}

/**
 * 获取 Goal 元数据
 */
export function getGoalMetadata(target: any): GoalMetadataStore | undefined {
  return Reflect.getMetadata(METADATA_KEY.GOAL_STORE, target);
}

// ============================================================================
// @Goal 装饰器
// ============================================================================

/**
 * @Goal 装饰器 - 定义一个 Goal 类
 *
 * @example
 * ```typescript
 * @Goal({
 *   id: "brand-analysis",
 *   name: "品牌数据分析",
 *   baseURL: "https://api.example.com",
 *   defaults: {
 *     retry: { count: 3, delay: 1000 },
 *     interval: 1000,
 *     concurrency: 3,
 *     timeout: 30000,
 *   },
 * })
 * export class BrandAnalysisGoal extends BaseGoal<BrandResult> {}
 * ```
 */
export function Goal(options: GoalOptions): ClassDecorator {
  return function (target: any) {
    const store = getOrCreateGoalMetadata(target);
    store.options = options;
  };
}

// ============================================================================
// @Endpoint 装饰器
// ============================================================================

/**
 * @Endpoint 装饰器 - 定义一个 API 端点
 *
 * @example
 * ```typescript
 * @Endpoint("https://api.example.com/categories", {
 *   method: "POST",
 *   body: { type: "all" },
 *   retry: { count: 5 },
 * })
 * fetchCategory(response: CategoryResponse): Category {
 *   return response.data.categories[0];
 * }
 * ```
 */
export function Endpoint(
  url: string,
  options: EndpointOptions = { method: "GET" },
): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const constructor = target.constructor;
    const store = getOrCreateGoalMetadata(constructor);
    const methodName = String(propertyKey);

    // 创建 Endpoint 元数据
    const metadata: EndpointMetadata = {
      url,
      options,
      methodName,
    };

    // 检查是否有预先存储的 Paginated/Expanded 配置
    const paginatedConfig = Reflect.getMetadata(
      METADATA_KEY.PAGINATED,
      target,
      propertyKey,
    );
    if (paginatedConfig) {
      metadata.paginated = paginatedConfig;
    }

    const expandedConfig = Reflect.getMetadata(
      METADATA_KEY.EXPANDED,
      target,
      propertyKey,
    );
    if (expandedConfig) {
      metadata.expanded = expandedConfig;
    }

    store.endpoints.set(methodName, metadata);

    return descriptor;
  };
}

// ============================================================================
// @Paginated 装饰器
// ============================================================================

/**
 * @Paginated 装饰器 - 为 Endpoint 添加分页能力
 *
 * @example
 * ```typescript
 * @Endpoint("/api/brands", { method: "GET" })
 * @Paginated<BrandListResponse, Brand>({
 *   dependencies: ["fetchCategory"],
 *   pageSize: 20,
 *   maxPages: 5,
 *   interval: 3000,
 *   params: (ctx, page) => ({
 *     page,
 *     size: 20,
 *     categoryId: ctx.get<Category>("fetchCategory").id,
 *   }),
 *   stopWhen: (res) => res.list.length === 0 || res.page >= res.totalPages,
 * })
 * fetchBrandList(response: BrandListResponse, page: number): Brand[] {
 *   return response.list;   // ← 方法体即该页的投影函数，返回值自动累积
 * }
 * ```
 */
export function Paginated<TResponse, TItem>(
  options: PaginatedOptions<TResponse, TItem>,
): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const constructor = target.constructor;
    const store = getOrCreateGoalMetadata(constructor);
    const methodName = String(propertyKey);

    // 尝试直接添加到已存在的 Endpoint
    const metadata = store.endpoints.get(methodName);
    if (metadata) {
      metadata.paginated = options as PaginatedOptions<unknown, unknown>;
    } else {
      // 如果 Endpoint 还未定义，先存储配置
      Reflect.defineMetadata(
        METADATA_KEY.PAGINATED,
        options,
        target,
        propertyKey,
      );
    }

    return descriptor;
  };
}

// ============================================================================
// @Expanded 装饰器
// ============================================================================

/**
 * @Expanded 装饰器 - 为 Endpoint 添加展开能力
 *
 * @example
 * ```typescript
 * @Endpoint("/api/brand/:brandId", { method: "GET" })
 * @Expanded<Brand, BrandDetail>({
 *   dependencies: ["fetchBrandList"],
 *   source: (ctx) => ctx.get<Brand[]>("fetchBrandList"),
 *   params: (brand) => ({ brandId: brand.id }),
 *   concurrency: 5,
 *   interval: 200,
 *   retry: { count: 2, delay: 3000 },
 * })
 * fetchBrandDetails(response: BrandDetail, sourceBrand: Brand): BrandDetail {
 *   return { ...response, categoryId: sourceBrand.categoryId };
 * }
 * ```
 */
export function Expanded<TSource, TResult>(
  options: ExpandedOptions<TSource, TResult>,
): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const constructor = target.constructor;
    const store = getOrCreateGoalMetadata(constructor);
    const methodName = String(propertyKey);

    // 尝试直接添加到已存在的 Endpoint
    const metadata = store.endpoints.get(methodName);
    if (metadata) {
      metadata.expanded = options as ExpandedOptions<unknown, unknown>;
    } else {
      // 如果 Endpoint 还未定义，先存储配置
      Reflect.defineMetadata(
        METADATA_KEY.EXPANDED,
        options,
        target,
        propertyKey,
      );
    }

    return descriptor;
  };
}

// ============================================================================
// @Aggregate 装饰器
// ============================================================================

/**
 * @Aggregate 装饰器 - 标记聚合方法
 *
 * @example
 * ```typescript
 * @Aggregate()
 * aggregate(ctx: GoalContext): BrandAnalysisResult {
 *   return {
 *     category: ctx.get("fetchCategory"),
 *     brands: ctx.get("fetchBrandList"),
 *     brandDetails: ctx.get("fetchBrandDetails"),
 *     totalBrands: ctx.get<Brand[]>("fetchBrandList").length,
 *     analyzedAt: new Date(),
 *   };
 * }
 * ```
 */
export function Aggregate(): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const constructor = target.constructor;
    const store = getOrCreateGoalMetadata(constructor);
    store.aggregateMethod = String(propertyKey);

    return descriptor;
  };
}

// ============================================================================
// 装饰器顺序处理
// ============================================================================

/**
 * 在 Goal 实例化后，合并可能被先定义的 Paginated/Expanded 配置
 * 这个函数会在 GoalExecutor 中调用
 */
export function finalizeGoalMetadata(goal: any): void {
  const store = getGoalMetadata(goal.constructor);
  if (!store) return;

  // 遍历所有方法，检查是否有未合并的 paginated/expanded 配置
  const prototype = Object.getPrototypeOf(goal);
  const methodNames = Object.getOwnPropertyNames(prototype).filter(
    (name) => name !== "constructor" && typeof prototype[name] === "function",
  );

  for (const methodName of methodNames) {
    const endpoint = store.endpoints.get(methodName);
    if (!endpoint) continue;

    // 合并 Paginated 配置
    const paginatedConfig = Reflect.getMetadata(
      METADATA_KEY.PAGINATED,
      prototype,
      methodName,
    );
    if (paginatedConfig && !endpoint.paginated) {
      endpoint.paginated = paginatedConfig;
    }

    // 合并 Expanded 配置
    const expandedConfig = Reflect.getMetadata(
      METADATA_KEY.EXPANDED,
      prototype,
      methodName,
    );
    if (expandedConfig && !endpoint.expanded) {
      endpoint.expanded = expandedConfig;
    }

    // 合并 Streamed 配置（@Streamed 与 @Endpoint 的书写顺序无关）
    const streamedConfig = Reflect.getMetadata(
      STREAMED_METADATA_KEY,
      prototype,
      methodName,
    );
    if (streamedConfig && !endpoint.streamed) {
      endpoint.streamed = streamedConfig;
    }
  }
}
