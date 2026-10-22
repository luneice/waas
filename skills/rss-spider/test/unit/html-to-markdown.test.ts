/**
 * html-to-markdown 单元测试（L1，纯 Node，jsdom + Readability + Turndown）。
 *
 * extractReadableContent 是 ReadabilityExtractor 的核心提取逻辑，纯函数
 * （输入 html+url，输出 {title,html,markdown,excerpt} 或 null），
 * 完全绕开 FakePage/page.evaluate 的限制（详见 list-extract/page-extract
 * 模块测试踩坑记录），是验证提取质量的唯一直接路径。
 */
import { test } from "vitest";
import assert from "node:assert/strict";

import { extractReadableContent } from "@src/utils/html-to-markdown";

const LONG_ARTICLE_HTML = `<html><head><title>页面标题</title></head><body>
<nav>导航干扰内容，不应出现在提取结果里</nav>
<article>
<h1>测试文章标题</h1>
<p>这是第一段正文内容，包含足够多的文字以便 Readability 能识别出这是一篇正式文章而不是导航噪声。这段话需要足够长。</p>
<p>这是第二段正文内容，继续补充文字长度，确保 Readability 提取算法能够正确识别主体内容区域并提纯出来，转换为干净的 markdown 格式文本。</p>
<p>第三段，进一步充实内容长度，避免被判定为内容不足而返回 null，这是测试 extractReadableContent 函数的关键前提条件。</p>
</article>
<div class="share-toolbar">分享按钮干扰，class 含 share 应被移除</div>
<footer>页脚干扰内容，footer 标签应被移除</footer>
</body></html>`;

test("提取长文章：标题/正文/摘要均非空，markdown 含标题与三段正文", () => {
  const result = extractReadableContent(LONG_ARTICLE_HTML, "https://example.invalid/article");
  assert.ok(result);
  assert.equal(result!.title, "页面标题");
  assert.ok(result!.markdown.includes("测试文章标题"));
  assert.ok(result!.markdown.includes("第一段正文内容"));
  assert.ok(result!.markdown.includes("第三段"));
  assert.ok(result!.excerpt.length > 0);
});

test("噪声剥离：nav/footer/share 相关元素不出现在提取结果中", () => {
  const result = extractReadableContent(LONG_ARTICLE_HTML, "https://example.invalid/article");
  assert.ok(result);
  assert.ok(!result!.html.includes("导航干扰内容"));
  assert.ok(!result!.html.includes("分享按钮干扰"));
  assert.ok(!result!.html.includes("页脚干扰内容"));
});

test("内容过短：Readability 仍能解析出 article，但调用方（ReadabilityExtractor）的质量门槛在上层判断，本函数本身不因短内容返回 null", () => {
  const html = `<html><body><article><p>太短</p></article></body></html>`;
  const result = extractReadableContent(html, "https://example.invalid/short");
  assert.ok(result, "extractReadableContent 本身不做长度门槛判断，只要 Readability 能解析出 article 就返回非 null");
  assert.equal(result!.markdown, "太短");
});

test("无可提取内容：纯空文档 Readability 解析失败 → 返回 null", () => {
  const html = `<html><head></head><body></body></html>`;
  const result = extractReadableContent(html, "https://example.invalid/empty");
  assert.equal(result, null);
});

test("<style>/<script>/<svg> 标签在正则清理阶段就被剥离，不进入 jsdom", () => {
  const html = `<html><body>
<style>.foo { color: red; }</style>
<script>console.log("evil")</script>
<svg><circle r="10"/></svg>
<article>
<h1>标题</h1>
<p>正文内容足够长，用于确保 Readability 能正确识别文章主体，这段话本身需要有一定字数长度。</p>
<p>继续补充正文长度，避免被认为内容不足，这是验证噪声标签剥离是否生效的测试用例正文。</p>
</article>
</body></html>`;
  const result = extractReadableContent(html, "https://example.invalid/noise");
  assert.ok(result);
  assert.ok(!result!.html.includes("evil"));
  assert.ok(!result!.html.includes("color: red"));
});
