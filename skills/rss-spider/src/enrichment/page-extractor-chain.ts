/**
 * Page extractor 策略链编排。
 *
 * 主文档优先；主文档无正文时，再按同源性与可见文本量尝试 child frame。
 * 这类页面的顶层文档通常只有标题和导航，真正正文由
 * 同源 iframe 承载。
 */
import type { Frame, Page } from "puppeteer-core";
import type {
  IPageExtractor,
  PageExtractionContext,
} from "./interfaces";
import type { DetailSelectors, ExtractResult } from "@src/types";

interface FrameCandidate {
  frame: Frame;
  textLength: number;
  sameOrigin: boolean;
  index: number;
}

export interface PageExtractorChainOptions {
  page: Page;
  url: string;
  extractors: IPageExtractor[];
  selectors?: DetailSelectors;
  minFrameContentLength: number;
}

/** 按策略优先级从主文档或 child frame 提取正文。 */
export async function extractPageWithFrames(
  options: PageExtractorChainOptions,
): Promise<ExtractResult | null> {
  const { page, url, extractors, selectors } = options;
  const mainResult = await runExtractors(page, url, extractors, selectors);
  if (mainResult) return mainResult;

  const minimumLength = selectors?.content
    ? 1
    : Math.max(1, options.minFrameContentLength);
  const candidates = await collectFrameCandidates(page, url, minimumLength);

  for (const { frame } of candidates) {
    const result = await runExtractors(
      frame,
      frame.url() || url,
      extractors,
      selectors,
    );
    if (!result || plainTextLength(result.content) < minimumLength) continue;

    const pageTitle = normalize(await page.title().catch(() => ""));
    const frameTitle = normalize(result.title);
    return {
      ...result,
      title:
        pageTitle.length >= frameTitle.length
          ? pageTitle
          : frameTitle || undefined,
    };
  }

  return null;
}

async function runExtractors(
  context: PageExtractionContext,
  url: string,
  extractors: IPageExtractor[],
  selectors?: DetailSelectors,
): Promise<ExtractResult | null> {
  for (const extractor of extractors) {
    const result = await extractor.tryExtract(context, url, selectors);
    if (result?.content?.trim()) return result;
  }
  return null;
}

async function collectFrameCandidates(
  page: Page,
  pageUrl: string,
  minimumLength: number,
): Promise<FrameCandidate[]> {
  // FakePage 等最小测试替身不必实现 frame API。
  const frameAwarePage = page as Page & {
    frames?: () => Frame[];
    mainFrame?: () => Frame;
  };
  if (typeof frameAwarePage.frames !== "function") return [];

  const mainFrame =
    typeof frameAwarePage.mainFrame === "function"
      ? frameAwarePage.mainFrame()
      : undefined;
  const frames = frameAwarePage.frames().filter((frame) => frame !== mainFrame);
  const candidates = await Promise.all(
    frames.map(async (frame, index): Promise<FrameCandidate | null> => {
      try {
        const textLength = await frame.evaluate(
          () =>
            (document.body?.innerText || "").replace(/\s+/g, " ").trim()
              .length,
        );
        if (textLength < minimumLength) return null;
        return {
          frame,
          textLength,
          sameOrigin: hasSameOrigin(pageUrl, frame.url()),
          index,
        };
      } catch {
        // frame 可能在排名期间被页面卸载，跳过即可。
        return null;
      }
    }),
  );

  return candidates
    .filter((candidate): candidate is FrameCandidate => candidate !== null)
    .sort((a, b) => {
      if (a.sameOrigin !== b.sameOrigin) return a.sameOrigin ? -1 : 1;
      return b.textLength - a.textLength || a.index - b.index;
    });
}

function hasSameOrigin(left: string, right: string): boolean {
  try {
    return new URL(left).origin === new URL(right).origin;
  } catch {
    return false;
  }
}

function plainTextLength(content?: string): number {
  return normalize(content?.replace(/<[^>]*>/g, "")).length;
}

function normalize(value?: string): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}
