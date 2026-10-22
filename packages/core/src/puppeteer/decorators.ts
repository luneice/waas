import "reflect-metadata";
import type { Page } from "puppeteer-core";
import type {
  IPageHook,
  ActivationPredicate,
  HookFn,
  HookOutcome,
  HookSignal,
} from "./hooks";
import type { PageContext } from "./context";
import { ResponseInterceptor } from "./response-interceptor";
import type { ResponseParse } from "./response-interceptor";
import type { SlotKey } from "./slots";
import { CapturedMediaSlot, defineSlot } from "./slots";
import type { CapturedEntry } from "./captured-entry";

// ============================================================================
// 元数据 Key
// ============================================================================

const CLASS_HOOKS_KEY = Symbol("spider:class-hooks");
const METHOD_HOOKS_KEY = Symbol("spider:method-hooks");
const SCREENSHOT_KEY = Symbol("spider:screenshot");

// ============================================================================
// 类级 Hook 注册（由 @CaptureResponse / @CaptureMedia / @BlockResource 等写入）
// ============================================================================

/** 读取类（含继承链）上注册的 Hook 实例列表 */
export function getClassHooks(target: Function): IPageHook[] {
  const hooks: IPageHook[] = [];
  // 从基类到派生类顺序收集，使派生类装饰器后执行（靠近业务）
  const chain: Function[] = [];
  let cur: Function | null = target;
  while (cur && cur !== Function.prototype && cur !== Object) {
    chain.unshift(cur);
    cur = Object.getPrototypeOf(cur);
  }
  for (const ctor of chain) {
    const own =
      (Reflect.getOwnMetadata(CLASS_HOOKS_KEY, ctor) as
        | IPageHook[]
        | undefined) ?? [];
    hooks.push(...own);
  }
  return hooks;
}

/** @deprecated 使用 getClassHooks */
export const getPageHooks = getClassHooks;

/**
 * 把一个 Hook 实例注册到类元数据上。
 *
 * **所有类级装饰器都必须走这里** —— composeHooks() 只认 getClassHooks()，
 * 自建元数据键 + 自建 builder 的装饰器会静默失效（@StorageReset 曾如此）。
 */
export function pushClassHook(target: Function, hook: IPageHook): void {
  const existing =
    (Reflect.getOwnMetadata(CLASS_HOOKS_KEY, target) as IPageHook[]) ?? [];
  Reflect.defineMetadata(CLASS_HOOKS_KEY, [...existing, hook], target);
}

// ============================================================================
// 方法级 Hook 注册（由 @Setup / @Ready / @Interact / ... 写入）
// ============================================================================

export type StageName =
  | "setup"
  | "ready"
  | "interact"
  | "extract"
  | "transform"
  | "persist"
  | "teardown";

interface MethodHookEntry {
  stage: StageName;
  method: string | symbol;
  when?: ActivationPredicate;
}

/** 按继承链收集方法 Hook（基类优先） */
export function getMethodHooks(target: Function): MethodHookEntry[] {
  const entries: MethodHookEntry[] = [];
  const chain: Function[] = [];
  let cur: Function | null = target;
  while (cur && cur !== Function.prototype && cur !== Object) {
    chain.unshift(cur);
    cur = Object.getPrototypeOf(cur);
  }
  for (const ctor of chain) {
    const own =
      (Reflect.getOwnMetadata(METHOD_HOOKS_KEY, ctor) as
        | MethodHookEntry[]
        | undefined) ?? [];
    entries.push(...own);
  }
  return entries;
}

function registerMethodHook(
  target: object,
  stage: StageName,
  method: string | symbol,
  when?: ActivationPredicate,
): void {
  const ctor = (target as { constructor: Function }).constructor;
  const existing =
    (Reflect.getOwnMetadata(METHOD_HOOKS_KEY, ctor) as MethodHookEntry[]) ?? [];
  Reflect.defineMetadata(
    METHOD_HOOKS_KEY,
    [...existing, { stage, method, when }],
    ctor,
  );
}

/**
 * 从 Skill 实例构造 self-hook：把打了方法级装饰器的方法聚合成一个 IPageHook。
 * 同一 Stage 下多个方法按装饰器注册顺序执行。
 */
export function buildSelfHook(instance: object): IPageHook | null {
  const entries = getMethodHooks(
    (instance as { constructor: Function }).constructor,
  );
  if (entries.length === 0) return null;

  const grouped = new Map<StageName, MethodHookEntry[]>();
  for (const e of entries) {
    const arr = grouped.get(e.stage) ?? [];
    arr.push(e);
    grouped.set(e.stage, arr);
  }

  const hook: IPageHook = {
    name: `self:${instance.constructor.name}`,
  };
  const makeStageFn = (list: MethodHookEntry[]): HookFn => {
    return async (page: Page, ctx: PageContext): Promise<HookOutcome> => {
      for (const e of list) {
        if (e.when && !e.when(ctx)) continue;
        const fn = (instance as Record<string | symbol, unknown>)[e.method];
        if (typeof fn !== "function") continue;
        const result = (await (fn as HookFn).call(instance, page, ctx)) as
          | HookSignal
          | void
          | undefined;
        if (
          result &&
          (result.abort || result.skipPipeline || result.skipStage)
        ) {
          return result;
        }
      }
    };
  };

  for (const [stage, list] of grouped) {
    (hook as unknown as Record<string, HookFn>)[stage] = makeStageFn(list);
  }
  return hook;
}

// ============================================================================
// 方法级装饰器 — @Setup / @Ready / @Interact / @Extract / @Transform /
//                @Persist / @Teardown
// ============================================================================

interface MethodDecoratorOptions {
  /** 激活谓词（每次进入 Stage 时惰性求值） */
  when?: ActivationPredicate;
}

function makeStageDecorator(stage: StageName) {
  return function (options: MethodDecoratorOptions = {}): MethodDecorator {
    return function (target, propertyKey) {
      registerMethodHook(target, stage, propertyKey, options.when);
    };
  };
}

export const Setup = makeStageDecorator("setup");
export const Ready = makeStageDecorator("ready");
export const Interact = makeStageDecorator("interact");
export const Extract = makeStageDecorator("extract");
export const Transform = makeStageDecorator("transform");
export const Persist = makeStageDecorator("persist");
export const Teardown = makeStageDecorator("teardown");

// ============================================================================
// @CaptureResponse — 类装饰器：URL 响应拦截
// ============================================================================

export interface CaptureResponseOptions<T> {
  /** URL 匹配正则 */
  pattern: RegExp;
  /** 结果写入 Slot */
  into: SlotKey<T>;
  /** 超时 ms（默认 30_000） */
  timeout?: number;
  /** 响应解析方式（默认 "json"） */
  parse?: ResponseParse;
  /** 激活谓词（每 Stage 惰性求值） */
  activateWhen?: ActivationPredicate;
}

export function CaptureResponse<T = unknown>(
  options: CaptureResponseOptions<T>,
): ClassDecorator {
  return function (target: Function) {
    pushClassHook(
      target,
      new ResponseInterceptor({
        match: options.pattern,
        into: options.into,
        mode: "first",
        parse: options.parse,
        timeoutMs: options.timeout,
        activateWhen: options.activateWhen,
      }),
    );
  };
}

// ============================================================================
// @CaptureMedia — 类装饰器：按 content-type 持续捕获媒体
// ============================================================================

export interface CaptureMediaOptions {
  /** 媒体类型（默认 ["image"]） */
  types?: ("image" | "video" | "audio")[];
  /** 写入 Slot（默认 CapturedMediaSlot） */
  into?: SlotKey<Map<string, CapturedEntry<Buffer>>>;
  /** 激活谓词 */
  activateWhen?: ActivationPredicate;
}

export function CaptureMedia(
  options: CaptureMediaOptions = {},
): ClassDecorator {
  return function (target: Function) {
    const types = options.types ?? ["image"];
    const contentTypePrefixes = types.map((t) => `${t}/`);
    pushClassHook(
      target,
      new ResponseInterceptor({
        match: contentTypePrefixes,
        into: options.into ?? CapturedMediaSlot,
        mode: "all",
        parse: "buffer",
        activateWhen: options.activateWhen,
      }),
    );
  };
}

// ============================================================================
// @BlockResource — 阻止特定资源类型加载
// ============================================================================

export interface BlockResourceOptions {
  types: string[];
  activateWhen?: ActivationPredicate;
}

type RequestHandler = (req: import("puppeteer-core").HTTPRequest) => void;

export function BlockResource(options: BlockResourceOptions): ClassDecorator {
  // 每次装饰器调用独立一个 slot，防止同进程内多类共享 handler 引用
  const handlerSlot = defineSlot<RequestHandler>(
    `__block_resource.handler:${Math.random().toString(36).slice(2)}`,
  );
  return function (target: Function) {
    pushClassHook(target, {
      name: "block-resource",
      shouldActivate: options.activateWhen,
      async setup(page, ctx) {
        await page.setRequestInterception(true);
        const handler: RequestHandler = (req) => {
          if (options.types.includes(req.resourceType())) {
            req.abort();
          } else {
            req.continue();
          }
        };
        page.on("request", handler);
        ctx.set(handlerSlot, handler);
      },
      async teardown(page, ctx) {
        const handler = ctx.get(handlerSlot);
        if (handler) {
          page.off("request", handler);
          ctx.delete(handlerSlot);
        }
      },
    });
  };
}

// ============================================================================
// @Viewport / @UserAgent
// ============================================================================

export function Viewport(width: number, height: number): ClassDecorator {
  return function (target: Function) {
    pushClassHook(target, {
      name: "viewport",
      async setup(page) {
        await page.setViewport({ width, height });
      },
    });
  };
}

export function UserAgent(ua: string): ClassDecorator {
  return function (target: Function) {
    pushClassHook(target, {
      name: "user-agent",
      async setup(page) {
        await page.setUserAgent(ua);
      },
    });
  };
}

// ============================================================================
// @Screenshot — 错误时自动截图（由 PuppeteerSkill.execute 的 catch 分支消费）
// ============================================================================

export interface ScreenshotOptions {
  /** 触发条件 */
  on: "error";
  /**
   * 落盘路径模板 — 支持 `{skillId}` `{timestamp}` 占位符。
   * 默认 `"debug/{skillId}-{timestamp}.png"`。
   * 写入通过 PuppeteerSkillDeps.artifactSink（如未提供则跳过）。
   */
  path?: string;
  /** 是否截取整页（默认 true） */
  fullPage?: boolean;
}

export function Screenshot(options: ScreenshotOptions): ClassDecorator {
  return function (target: Function) {
    Reflect.defineMetadata(SCREENSHOT_KEY, options, target);
  };
}

export function getScreenshotOptions(
  target: Function,
): ScreenshotOptions | undefined {
  return Reflect.getOwnMetadata(SCREENSHOT_KEY, target) as
    | ScreenshotOptions
    | undefined;
}
