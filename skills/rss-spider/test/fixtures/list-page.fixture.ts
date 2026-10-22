/**
 * list-extract fixture —— L2 专用，linkedom 渲染的列表页 HTML。
 *
 * ListExtractSkill 的 fetchData 完全在 DOM 上操作，零网络请求；
 * `runSkillWithFixtures(skill, params, {upstream, html})` 里的 upstream
 * 一次都不会被调用（skill 从不发 fetch），仍需传一个空 FakeUpstream 满足
 * harness 的必填约束。
 *
 * 注意：linkedom 不做相对 URL 解析（`href="/x"` 读出来还是 `/x`，真机浏览器
 * 会解析成绝对 URL），fixture 一律用绝对 URL 避免这个替身/真机差异干扰断言。
 */

/** 标准列表页：2 篇 article，自动探测应命中 "article" 候选选择器。 */
export const standardListHtml = `<html><body>
<article>
  <h2><a href="https://example.invalid/post/1">测试标题甲</a></h2>
  <time datetime="2026-01-01T10:00:00Z">2026-01-01</time>
  <p>测试摘要甲</p>
</article>
<article>
  <h2><a href="https://example.invalid/post/2">测试标题乙</a></h2>
  <time datetime="2026-01-02T10:00:00Z">2026-01-02</time>
  <p>测试摘要乙</p>
</article>
</body></html>`;

/** 只有 1 个 article：自动探测要求 >= 2 个，应继续降级到下一候选（[class*="item"]）。 */
export const singleArticleFallbackHtml = `<html><body>
<article>
  <h2><a href="https://example.invalid/post/1">测试标题甲（唯一 article）</a></h2>
</article>
<div class="feed-item">
  <h3><a href="https://example.invalid/post/2">测试标题乙</a></h3>
</div>
<div class="feed-item">
  <h3><a href="https://example.invalid/post/3">测试标题丙</a></h3>
</div>
</body></html>`;

/** 无任何候选选择器命中：应返回空数组，不报错。 */
export const noMatchHtml = `<html><body>
<div>纯文本，没有任何列表结构</div>
</body></html>`;

/** 自定义选择器场景：容器用 .custom-row，字段用非常规 class 名。 */
export const customSelectorsHtml = `<html><body>
<div class="custom-row">
  <span class="ttl">自定义标题甲</span>
  <a class="lnk" href="https://example.invalid/custom/1">链接甲</a>
  <span class="pub-time">2026-02-01</span>
  <span class="brief">自定义摘要甲</span>
</div>
<div class="custom-row">
  <span class="ttl">自定义标题乙</span>
  <a class="lnk" href="https://example.invalid/custom/2">链接乙</a>
  <span class="pub-time">2026-02-02</span>
  <span class="brief">自定义摘要乙</span>
</div>
</body></html>`;

/** title/link/summary 均取不到时的兜底：title 回退整个元素文本前 100 字，link 为空串。 */
export const noSubStructureHtml = `<html><body>
<article>纯文本内容占位甲，没有任何子级标签结构可供提取标题、链接或摘要，用于验证兜底逻辑截取前 100 字。</article>
<article>纯文本内容占位乙，同样没有任何子级标签结构，验证第二条也能正确走兜底分支而不会抛错或返回 undefined。</article>
</body></html>`;
