// ============================================================================
// StorageReset — 浏览器宿主存储清理（Cookie / localStorage / sessionStorage / IndexedDB）
// ============================================================================
//
// 背景：
//   - CDPConnector 寄生在用户 Chrome profile 中，多次跑同一 skill 会被站点
//     通过 localStorage / IndexedDB / Cookie 写入的"行为指纹"识别为异常。
//   - 必须能在导航后、业务交互前清理这些"行为存储"，但不能误删登录态。
//
// 设计原则：
//   - 默认只清"会话级"数据（sessionStorage）
//   - 通过 keys 精确指定要删的 localStorage / sessionStorage 键
//   - 通过 cookies/cookieDomains 精确指定要删的 cookie
//   - 通过 indexedDBs 指定要删的 IndexedDB 数据库名
//   - all=true 才会全清（强烈不推荐，会清掉登录态）
//
// 加入方式：
//   - 类装饰器 @StorageReset({ ... })
//   - 直接 new StorageResetHook({ ... }) 加到 hooks getter
//
// ⚠️ 执行时机是 **ready 阶段**（navigate 之后），不是 setup。
//   setup 跑在 page.goto 之前，此时页面还是 about:blank —— 在那里
//   page.evaluate 读到的是空白页的 localStorage，够不着目标站点的存储。
//   ready 阶段页面已落在目标站点，且早于 interact/extract，是清理的正确位置。
// ============================================================================

import type { Page } from "puppeteer-core";
import type { IPageHook, HookOutcome, ActivationPredicate } from "./hooks";
import type { PageContext } from "./context";
import { currentRuntime } from "../runtime";
import { pushClassHook } from "./decorators";
import { defineSlot } from "./slots";

export interface StorageResetOptions {
  /** 要删除的 localStorage 键（精确匹配；空则不动） */
  localStorageKeys?: string[];
  /** 要删除的 sessionStorage 键（默认全清） */
  sessionStorageKeys?: string[] | "all";
  /** 是否清空 sessionStorage（等价于 sessionStorageKeys: "all"） */
  clearSessionStorage?: boolean;
  /** 要删除的 IndexedDB 数据库名（精确匹配） */
  indexedDBs?: string[];
  /** 要删除的 cookie 名（精确匹配） */
  cookies?: string[];
  /** 要删除的 cookie 域（删除该域下全部 cookie） */
  cookieDomains?: string[];
  /** 危险开关：true 时清空所有 storage / cookies。**会破坏登录态**，仅测试用。 */
  all?: boolean;
  /** 激活谓词（每个 Stage 进入前惰性求值） */
  activateWhen?: ActivationPredicate;
}

const StorageResetReportSlot = defineSlot<{
  localStorageRemoved: number;
  sessionStorageRemoved: number;
  indexedDBRemoved: string[];
  cookiesRemoved: number;
}>("__storage_reset.report");

export class StorageResetHook implements IPageHook {
  readonly name = "storage-reset";
  private readonly options: StorageResetOptions;

  constructor(options: StorageResetOptions = {}) {
    this.options = options;
  }

  shouldActivate(ctx: PageContext): boolean {
    return this.options.activateWhen ? this.options.activateWhen(ctx) : true;
  }

  async ready(page: Page, ctx: PageContext): Promise<HookOutcome> {
    const opts = this.options;
    const report = {
      localStorageRemoved: 0,
      sessionStorageRemoved: 0,
      indexedDBRemoved: [] as string[],
      cookiesRemoved: 0,
    };

    // ── localStorage / sessionStorage / IndexedDB 走 page.evaluate ──
    try {
      const counts = await page.evaluate(
        async (params: {
          localStorageKeys?: string[];
          sessionStorageKeys?: string[] | "all";
          clearSessionStorage?: boolean;
          indexedDBs?: string[];
          all?: boolean;
        }) => {
          const out = {
            localStorageRemoved: 0,
            sessionStorageRemoved: 0,
            indexedDBRemoved: [] as string[],
          };

          if (params.all) {
            try {
              out.localStorageRemoved = window.localStorage.length;
              window.localStorage.clear();
            } catch {
              /* SecurityError on file:// etc. */
            }
            try {
              out.sessionStorageRemoved = window.sessionStorage.length;
              window.sessionStorage.clear();
            } catch {
              /* */
            }
          } else {
            if (params.localStorageKeys?.length) {
              for (const k of params.localStorageKeys) {
                try {
                  if (window.localStorage.getItem(k) !== null) {
                    window.localStorage.removeItem(k);
                    out.localStorageRemoved++;
                  }
                } catch {
                  /* */
                }
              }
            }
            const sk = params.sessionStorageKeys;
            const clearAllSession = params.clearSessionStorage || sk === "all";
            if (clearAllSession) {
              try {
                out.sessionStorageRemoved = window.sessionStorage.length;
                window.sessionStorage.clear();
              } catch {
                /* */
              }
            } else if (Array.isArray(sk)) {
              for (const k of sk) {
                try {
                  if (window.sessionStorage.getItem(k) !== null) {
                    window.sessionStorage.removeItem(k);
                    out.sessionStorageRemoved++;
                  }
                } catch {
                  /* */
                }
              }
            }
          }

          // IndexedDB
          const dbs = params.indexedDBs ?? [];
          if (
            params.all &&
            typeof indexedDB !== "undefined" &&
            "databases" in indexedDB
          ) {
            try {
              const list = await (
                indexedDB as IDBFactory & {
                  databases?: () => Promise<{ name?: string }[]>;
                }
              ).databases!();
              dbs.push(...list.map((d) => d.name ?? "").filter(Boolean));
            } catch {
              /* */
            }
          }
          for (const name of dbs) {
            await new Promise<void>((resolve) => {
              try {
                const req = indexedDB.deleteDatabase(name);
                req.onsuccess = req.onerror = req.onblocked = () => resolve();
              } catch {
                resolve();
              }
            });
            out.indexedDBRemoved.push(name);
          }

          return out;
        },
        {
          localStorageKeys: opts.localStorageKeys,
          sessionStorageKeys: opts.sessionStorageKeys,
          clearSessionStorage: opts.clearSessionStorage,
          indexedDBs: opts.indexedDBs,
          all: opts.all,
        },
      );
      report.localStorageRemoved = counts.localStorageRemoved;
      report.sessionStorageRemoved = counts.sessionStorageRemoved;
      report.indexedDBRemoved = counts.indexedDBRemoved;
    } catch (err) {
      // 跨域或非 http 场景下 evaluate 可能失败，不阻断流程
      emitStorageResetError("evaluate", err, {
        target: "browser-storage",
      });
    }

    // ── cookie 走 puppeteer 的 page.cookies / page.deleteCookie ──
    if (opts.all || opts.cookies?.length || opts.cookieDomains?.length) {
      try {
        const cookies = await page.cookies();
        const targets = cookies.filter((c) => {
          if (opts.all) return true;
          if (opts.cookies?.includes(c.name)) return true;
          if (
            opts.cookieDomains?.some(
              (d) => c.domain === d || c.domain.endsWith(`.${d}`),
            )
          )
            return true;
          return false;
        });
        for (const c of targets) {
          await page.deleteCookie({
            name: c.name,
            domain: c.domain,
            path: c.path,
          });
        }
        report.cookiesRemoved = targets.length;
      } catch (err) {
        emitStorageResetError("cookies", err, {
          target: "cookies",
        });
      }
    }

    ctx.set(StorageResetReportSlot, report);
  }
}

function emitStorageResetError(
  phase: string,
  error: unknown,
  details?: Record<string, unknown>,
): void {
  currentRuntime().events.emitError({
    errorKind: "storage-reset",
    category: "browser-storage",
    phase,
    scope: "page.storage-reset",
    message: "Storage reset operation failed",
    error,
    retryable: false,
    details,
  });
}

// ============================================================================
// @StorageReset 类装饰器
// ============================================================================

/**
 * @StorageReset — 在 ready 阶段（navigate 之后）清理浏览器宿主存储。
 *
 * 注意：
 *   - 默认不清登录态（cookie）。除非显式声明 cookies / cookieDomains / all。
 *   - 多次叠加会注册多个 Hook，按声明顺序执行。
 *   - ready 跑在 navigate（含其重试）全部完成之后，因此清理必然作用于最终
 *     加载成功的那个页面；挂在 setup 时导航重试后不会重跑，是旧实现的缺陷。
 */
export function StorageReset(
  options: StorageResetOptions = {},
): ClassDecorator {
  return function (target: Function) {
    pushClassHook(target, new StorageResetHook(options));
  };
}

export { StorageResetReportSlot };
