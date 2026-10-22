/**
 * bili-article fixture —— L2 专用。
 *
 * 与其余模块不同：专栏正文来自登录态详情页 SSR/CSR 渲染后的 DOM
 * （`.opus-module-content`），不是独立 JSON 接口，所以本模块没有
 * `FakeUpstream.route()` 式的「上游 JSON 响应」fixture，而是提供：
 *   - 供 `FakePage({ html })` 渲染的 opus 详情页 HTML 片段（linkedom 解析，
 *     docs/TESTING.md §2.2 允许的新 devDependency）；
 *   - 供 `FakeUpstream` 应答的 web-dynamic detail 补充元信息接口
 *     （fetchMeta 调用 `/x/polymer/web-dynamic/v1/detail`）；
 *   - 供配图下载 fetch 应答的图片字节响应。
 *
 * 脱敏三律同 search-upstream.fixture.ts 文件头（域名换 example.invalid，
 * 标题/作者换 mock 中文）。
 */

/** opus 详情页 HTML：标题 + 作者 + 正文（文字段 + 配图段 + 链接卡段）。 */
export const opusDetailHtmlFixture = `<html><body>
<div class="opus-module-title__text">测试专栏标题</div>
<div class="opus-module-author">
  <span class="opus-module-author__name">测试作者名</span>
  <span class="opus-module-author__pub__text">2026-01-01 12:00</span>
</div>
<div class="opus-module-content">
  <div>正文第一段纯文本，介绍背景信息。</div>
  <div class="opus-para-pic">
    <img data-src="//img.example.invalid/bfs/new_dyn/mock-img-1.jpg" alt="配图说明甲" />
  </div>
  <div class="opus-para-link-card">
    <a href="https://www.example.invalid/goods/1"><div>测试商品标题</div><div>￥99.00</div></a>
  </div>
</div>
</body></html>`;

/** 只有标题+作者，无正文容器子节点（found=false 分支：容器存在但段落为空）。 */
export const opusDetailEmptyBodyHtmlFixture = `<html><body>
<div class="opus-module-title__text">测试专栏标题（空正文）</div>
<div class="opus-module-content"></div>
</body></html>`;

/** 未找到正文容器（改版/受限/未渲染完成）：无 .opus-module-content 节点。 */
export const opusDetailMissingContainerHtmlFixture = `<html><body>
<div class="opus-module-title__text">测试专栏标题</div>
</body></html>`;

/** 充电专属拦截：正文区域出现 upower 充电入口。 */
export const opusDetailChargeBlockedHtmlFixture = `<html><body>
<div class="opus-module-title__text">测试充电专属专栏</div>
<div class="opus-module-content">
  <a href="https://www.example.invalid/upower/123?opus=820000000000099">充电解锁完整内容</a>
</div>
</body></html>`;

// ============================================================================
// web-dynamic detail —— 补充元信息（mid/commentId/stat），Node 侧 fetch 调用
// ============================================================================

const DETAIL_PATH = "/x/polymer/web-dynamic/v1/detail";

export function webDynamicDetailFixture(opusId: string) {
  return {
    code: 0,
    message: "0",
    data: {
      item: {
        basic: { comment_id_str: null, rid_str: opusId },
        modules: {
          module_author: { mid: 546195 },
          module_stat: {
            like: { count: 2000 },
            forward: { count: 50 },
            comment: { count: 300 },
            coin: { count: 100 },
            favorite: { count: 80 },
          },
        },
      },
    },
  };
}

export { DETAIL_PATH };

/** detail 接口未取到 item（json 结构异常）：fetchMeta 内部 catch 吞掉，meta 为 null。 */
export const webDynamicDetailMissingItemFixture = {
  code: 0,
  message: "0",
  data: {},
};

// ============================================================================
// 配图下载 —— 页内 fetch 应答（图片字节，1x1 透明 PNG）
// ============================================================================

/** 1x1 透明 PNG 字节，用于配图下载路径（FakeUpstream body 需为 binary 编码字符串）。 */
const TINY_PNG_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

/** FakeUpstream 应答体：body 须是 binary 编码字符串，contentType 显式指定，见 fake-page.ts makeResponse。 */
export const tinyPngReply = {
  body: TINY_PNG_BUFFER.toString("binary"),
  contentType: "image/png",
};

export const IMAGE_URL = "https://img.example.invalid/bfs/new_dyn/mock-img-1.jpg";
