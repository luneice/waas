/**
 * page-extract fixture —— L2 专用。
 *
 * PageExtractSkill 的 fetchData 完全在浏览器上下文操作，且真实
 * ReadabilityExtractor/CustomExtractor 在开头都会 `page.evaluate(
 * "if (typeof __name === ...) ...")`（字符串源码，非函数），FakePage 的
 * vm 重建对这段语句字符串会抛 SyntaxError（真机 puppeteer 能跑语句字符串，
 * 替身跑不了，全仓仅此两处踩雷）。
 *
 * 因此本模块 L2 测试主线注入 fake `IPageExtractor[]`，覆盖 skill 层的策略链
 * 编排逻辑（顺序/首个命中即返回/全失败降级/emit 落盘两种分支/错误传播）；
 * 真实 extractor 的提取质量已在 test/unit/html-to-markdown.test.ts 里
 * 直接测 extractReadableContent（不经 page，无此限制）。
 */
import type { IPageExtractor } from "@src/enrichment/interfaces";
import type { ExtractResult } from "@src/types";

/** 总是返回给定结果的 fake extractor。 */
export function fakeExtractor(result: ExtractResult | null): IPageExtractor {
  return {
    async tryExtract() {
      return result;
    },
  };
}

/** 记录调用次序、总是返回 null（模拟"该策略不适用"）。 */
export function fakeExtractorRecording(log: string[], name: string): IPageExtractor {
  return {
    async tryExtract() {
      log.push(name);
      return null;
    },
  };
}

/** 抛异常的 fake extractor（模拟策略内部意外错误）。 */
export function throwingExtractor(message: string): IPageExtractor {
  return {
    async tryExtract() {
      throw new Error(message);
    },
  };
}

export const sampleExtractResult: ExtractResult = {
  title: "测试文章标题",
  content: "# 测试文章标题\n\n这是提取出的正文内容，包含足够信息用于落盘断言。",
  author: "测试作者",
  publishedAt: "2026-01-01T10:00:00Z",
};
