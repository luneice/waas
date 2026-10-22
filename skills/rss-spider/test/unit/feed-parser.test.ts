/**
 * feed-parser 单元测试（L1，纯函数，无副作用）。
 *
 * parseXmlFeed/parseJsonFeed 是本包唯一的「上游数据形状判定」逻辑：
 * 判断一份文档到底是不是 RSS2.0/Atom/JSON Feed，判不出来就是
 * invalid-params（提示用户换 page-extract/list-extract），而不是
 * upstream-shape-changed——字段级缺失全部容错降级，不抛错。
 */
import { test } from "vitest";
import assert from "node:assert/strict";

import { parseXmlFeed, parseJsonFeed } from "@src/utils/feed-parser";

// ============================================================================
// RSS 2.0
// ============================================================================

test("parseXmlFeed：标准 RSS 2.0，含分类数组与 dc:creator", () => {
  const xml = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>测试频道</title>
  <link>https://example.invalid/</link>
  <description>测试描述</description>
  <item>
    <title>测试标题甲</title>
    <link>https://example.invalid/1</link>
    <pubDate>Mon, 01 Jan 2026 00:00:00 GMT</pubDate>
    <description>测试正文甲</description>
    <category>科技</category>
    <category>AI</category>
  </item>
  <item>
    <title>测试标题乙</title>
    <link>https://example.invalid/2</link>
    <pubDate>Tue, 02 Jan 2026 00:00:00 GMT</pubDate>
    <description>测试正文乙</description>
    <dc:creator>测试作者</dc:creator>
  </item>
</channel></rss>`;

  const feed = parseXmlFeed(xml);
  assert.equal(feed.title, "测试频道");
  assert.equal(feed.items.length, 2);
  assert.deepEqual(feed.items[0].category, ["科技", "AI"]);
  assert.equal(feed.items[1].author, "测试作者");
  assert.equal(feed.items[1].category, undefined, "无 category 时应是 undefined 而非空数组");
});

test("parseXmlFeed：RSS 2.0 单条 item（非数组）也能正确解析为长度 1 的数组", () => {
  const xml = `<rss version="2.0"><channel>
  <title>单条频道</title>
  <item><title>唯一一条</title><link>https://example.invalid/only</link></item>
</channel></rss>`;

  const feed = parseXmlFeed(xml);
  assert.equal(feed.items.length, 1);
  assert.equal(feed.items[0].title, "唯一一条");
});

test("parseXmlFeed：channel 无 item → items 为空数组，不报错", () => {
  const xml = `<rss version="2.0"><channel><title>空频道</title><link>https://example.invalid/</link></channel></rss>`;
  const feed = parseXmlFeed(xml);
  assert.equal(feed.items.length, 0);
});

// ============================================================================
// Atom
// ============================================================================

test("parseXmlFeed：Atom feed，link 优先取 rel=alternate", () => {
  const xml = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>测试 Atom 频道</title>
  <link rel="self" href="https://example.invalid/feed.atom"/>
  <link rel="alternate" href="https://example.invalid/"/>
  <subtitle>Atom 描述</subtitle>
  <entry>
    <title>Atom 条目甲</title>
    <link rel="alternate" href="https://example.invalid/entry/1"/>
    <published>2026-01-01T00:00:00Z</published>
    <summary>摘要甲</summary>
    <author><name>测试作者</name></author>
  </entry>
</feed>`;

  const feed = parseXmlFeed(xml);
  assert.equal(feed.link, "https://example.invalid/", "应优先取 rel=alternate 而非 rel=self");
  assert.equal(feed.items[0].link, "https://example.invalid/entry/1");
  assert.equal(feed.items[0].author, "测试作者");
  assert.equal(feed.items[0].description, "摘要甲");
});

test("parseXmlFeed：Atom entry 只有 updated 无 published → pubDate 回退 updated", () => {
  const xml = `<feed xmlns="http://www.w3.org/2005/Atom">
  <title>t</title>
  <entry>
    <title>条目</title>
    <link href="https://example.invalid/e1"/>
    <updated>2026-03-01T00:00:00Z</updated>
    <content>正文</content>
  </entry>
</feed>`;

  const feed = parseXmlFeed(xml);
  assert.equal(feed.items[0].pubDate, "2026-03-01T00:00:00Z");
  assert.equal(feed.items[0].description, "正文");
});

test("parseXmlFeed：Atom link 单个字符串形式也能提取", () => {
  const xml = `<feed xmlns="http://www.w3.org/2005/Atom">
  <title>t</title>
  <entry><title>条目</title><link href="https://example.invalid/single"/></entry>
</feed>`;
  const feed = parseXmlFeed(xml);
  assert.equal(feed.items[0].link, "https://example.invalid/single");
});

// ============================================================================
// 错误路径
// ============================================================================

test("parseXmlFeed：非法 XML（连续尖括号导致 fast-xml-parser 抛裸异常）→ invalid-params", () => {
  assert.throws(
    () => parseXmlFeed("<rss><channel><<<bad"),
    (err: unknown) => {
      assert.ok(err && typeof err === "object" && "kind" in err);
      assert.equal((err as { kind: string }).kind, "invalid-params");
      return true;
    },
  );
});

test("parseXmlFeed：合法 XML 但不是 RSS/Atom（如把普通 HTML 当 feed 传入）→ invalid-params", () => {
  assert.throws(
    () => parseXmlFeed("<html><body><h1>这是网页不是 feed</h1></body></html>"),
    (err: unknown) => {
      assert.equal((err as { kind: string }).kind, "invalid-params");
      return true;
    },
  );
});

// ============================================================================
// JSON Feed
// ============================================================================

test("parseJsonFeed：标准 JSON Feed，author 为对象形式", () => {
  const json = {
    title: "JSON 频道",
    home_page_url: "https://example.invalid/",
    description: "JSON 描述",
    items: [
      {
        title: "条目甲",
        url: "https://example.invalid/j1",
        date_published: "2026-01-01T00:00:00Z",
        content_html: "<p>正文</p>",
        author: { name: "作者甲" },
        tags: ["a", "b"],
      },
    ],
  };
  const feed = parseJsonFeed(json);
  assert.equal(feed.title, "JSON 频道");
  assert.equal(feed.items[0].author, "作者甲");
  assert.deepEqual(feed.items[0].category, ["a", "b"]);
});

test("parseJsonFeed：author 为字符串形式，link 回退用 authors[0].name", () => {
  const json = {
    title: "t",
    items: [
      { title: "x", link: "https://example.invalid/x", author: "字符串作者", authors: [{ name: "备用作者" }] },
    ],
  };
  const feed = parseJsonFeed(json);
  assert.equal(feed.items[0].author, "字符串作者", "author 是字符串时应直接使用，不看 authors[]");
});

test("parseJsonFeed：items 缺失字段全部容错为空串/空数组，不抛错", () => {
  const feed = parseJsonFeed({ items: [{}] });
  assert.equal(feed.items[0].title, "");
  assert.equal(feed.items[0].link, "");
  assert.deepEqual(feed.items[0].category, []);
});

test("parseJsonFeed：无 items 字段 → 空数组", () => {
  const feed = parseJsonFeed({ title: "空频道" });
  assert.deepEqual(feed.items, []);
});
