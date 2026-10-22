/**
 * 列表页提取 Skill
 *
 * AI Agent 入口：Puppeteer 打开列表页，自动探测或按自定义选择器提取文章列表。
 * 继承核心 PuppeteerSkill，复用 Template Method 的浏览器生命周期管理。
 */
import type { Page, PuppeteerLifeCycleEvent } from "puppeteer-core";
import {
  PuppeteerSkill,
  MissingContextError,
  type PuppeteerSkillDeps,
  type SkillParamSchema,
} from "@spider/core";
import type { Configuration } from "@src/config";
import type { RssFeed, RssItem, ListSelectors } from "@src/types";

/** ListExtractSkill 依赖 */
export interface ListExtractSkillDeps extends PuppeteerSkillDeps {
  config: Configuration;
}

interface ListExtractParams {
  /** 列表页 URL */
  url: string;
  /** 自定义 CSS 选择器 */
  selectors?: ListSelectors;
}

export class ListExtractSkill extends PuppeteerSkill<
  ListExtractParams,
  RssFeed
> {
  readonly id = "list-extract";
  readonly name = "列表页提取";
  readonly description =
    "Puppeteer 打开列表页 URL，自动探测或按自定义选择器提取文章列表（标题、链接、时间、摘要）";
  readonly paramSchema: SkillParamSchema[] = [
    {
      name: "url",
      type: "string",
      required: true,
      description: "列表页地址",
    },
    {
      name: "selectors",
      type: "object",
      required: false,
      description: "自定义 CSS 选择器 { item, title, link, time, summary }",
    },
  ];

  private readonly config: Configuration;

  constructor(deps: ListExtractSkillDeps) {
    super(deps);
    this.config = deps.config;
  }

  // ── PuppeteerSkill 钩子 ──

  protected readonly siteURL = "";

  protected getPath(params: ListExtractParams): string {
    return params.url;
  }

  protected async navigate(
    page: Page,
    params: ListExtractParams,
  ): Promise<void> {
    const url = params.url;
    if (!url) return;
    await page.goto(url, {
      waitUntil: this.navigateWaitUntil,
      timeout: this.navigateTimeout,
    });
  }

  protected get navigateWaitUntil(): PuppeteerLifeCycleEvent {
    return "domcontentloaded";
  }

  protected get navigateTimeout(): number {
    return this.config.pageNavigationTimeout;
  }

  protected normalizeParams(params: ListExtractParams): ListExtractParams {
    if (!params.url || typeof params.url !== "string") {
      throw new MissingContextError("url 参数为必填项", { scope: this.id });
    }
    return params;
  }

  protected async fetchData(
    page: Page,
    params: ListExtractParams,
  ): Promise<RssFeed> {
    const selectors = params.selectors;
    const url = params.url;

    await this.waitForListContent(page, selectors);
    const items = await this.extractListItems(page, selectors);

    return {
      title: await page.title(),
      link: url,
      description: `从 ${url} 提取的列表`,
      items,
    };
  }

  private async waitForListContent(
    page: Page,
    selectors?: ListSelectors,
  ): Promise<void> {
    const timeout = this.config.pageContentTimeout;
    try {
      if (selectors?.item) {
        await page.waitForSelector(selectors.item, { timeout });
      } else {
        await page.waitForFunction(
          () => {
            const candidates = [
              "article",
              '[class*="item"]',
              '[class*="post"]',
              ".list-group-item",
              "li a",
            ];
            return candidates.some((s) => document.querySelector(s));
          },
          { timeout },
        );
      }
    } catch {
      // 超时不抛错，尝试直接提取
    }
  }

  private async extractListItems(
    page: Page,
    selectors?: ListSelectors,
  ): Promise<RssItem[]> {
    return page.evaluate((sel: any) => {
      const candidateSelectors = [
        "article",
        '[class*="item"]',
        '[class*="post"]',
        '[class*="entry"]',
        '[class*="card"]',
        "li:has(a)",
        ".list-group-item",
      ];

      const $ = {
        findItems(customSelector?: string): Element[] {
          if (customSelector) {
            return Array.from(document.querySelectorAll(customSelector));
          }
          for (const cs of candidateSelectors) {
            const els = document.querySelectorAll(cs);
            if (els.length >= 2) return Array.from(els);
          }
          return [];
        },
        getText(
          el: Element,
          selector?: string,
          fallbackSelectors?: string[],
        ): string {
          if (selector) {
            const found = el.querySelector(selector);
            if (found) return (found.textContent || "").trim();
          }
          if (fallbackSelectors) {
            for (const fs of fallbackSelectors) {
              const found = el.querySelector(fs);
              if (found) return (found.textContent || "").trim();
            }
          }
          return "";
        },
        getLink(el: Element, selector?: string): string {
          if (selector) {
            const a = el.querySelector(selector) as HTMLAnchorElement | null;
            if (a?.href) return a.href;
          }
          const a = el.querySelector("a[href]") as HTMLAnchorElement | null;
          return a?.href || "";
        },
        getTime(el: Element, selector?: string): string {
          if (selector) {
            const found = el.querySelector(selector);
            if (found) {
              return (
                found.getAttribute("datetime") ||
                (found.textContent || "").trim()
              );
            }
          }
          const time = el.querySelector("time, [datetime]");
          if (time) {
            return (
              time.getAttribute("datetime") || (time.textContent || "").trim()
            );
          }
          return "";
        },
      };

      const elements = $.findItems(sel?.item);
      return elements.map((el) => ({
        title:
          $.getText(el, sel?.title, ["h1", "h2", "h3", "h4", "a"]) ||
          (el.textContent || "").trim().slice(0, 100),
        link: $.getLink(el, sel?.link),
        pubDate: $.getTime(el, sel?.time),
        description: $.getText(el, sel?.summary, [
          "p",
          '[class*="desc"]',
          '[class*="summary"]',
          '[class*="excerpt"]',
        ]),
      })) as any[];
    }, selectors || {});
  }
}
