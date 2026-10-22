/**
 * 投影层快照测试（首批：bili-search / bili-video / bili-comments）。
 *
 * 投影是纯函数（Raw → AI-Ready），是全仓最适合快照锁定的层：
 *   - 快照守护**整个输出形状**——字段增删、口径漂移、spread 泄露一律现形；
 *   - 显式断言守护**本次修复的回归点**（totalBytes 双计、meta 拍平），
 *     即使快照被无脑刷新，这些断言仍会拦住语义倒退。
 *
 * 运行：yarn test（tsx --test）；契约有意变更后 UPDATE_SNAPSHOTS=1 yarn test 刷新。
 */
import { test } from "vitest";
import assert from "node:assert/strict";

import { projectBiliSearchAiReady } from "@src/projections/search.ai-ready";
import { projectBiliVideoDownloadAiReady } from "@src/projections/video-download.ai-ready";
import { projectBiliCommentsAiReady } from "@src/projections/comment.ai-ready";

import { expectSnapshot } from "../helpers/snapshot";
import { searchFixture } from "../fixtures/search.fixture";
import { videoDownloadFixture } from "../fixtures/video-download.fixture";
import { commentsFixture } from "../fixtures/comments.fixture";

test("bili-search 投影：meta 拍平为通用翻页契约", () => {
  const out = projectBiliSearchAiReady(searchFixture);

  // 通用契约字段（spider-runtime.md §4：page 类看 total/pagesFetched/returnedCount）
  assert.equal(out.meta.total, 120);
  assert.equal(out.meta.totalPages, 5);
  assert.equal(out.meta.pageStart, 1);
  assert.equal(out.meta.pagesFetched, 2);
  assert.equal(out.meta.returnedCount, 2);
  assert.equal(out.meta.duplicatesRemoved, 3);
  // 旧嵌套结构不得回潮
  assert.ok(!("page" in out.meta), "meta.page 嵌套结构应已拍平");
  assert.ok(!("totalResults" in out.meta), "meta.totalResults 应更名为 total");

  assert.equal(out.items.length, 2);
  assert.equal(out.meta.crawledAt, "2026-07-01T00:00:00.000Z");

  expectSnapshot("bili-search", out);
});

test("bili-video 投影：落盘汇总每文件恰好计一次", () => {
  const out = projectBiliVideoDownloadAiReady(videoDownloadFixture);

  // 双计回归核心断言：merged 同时在 files[] 与 page.merged 出现，
  // totalBytes 必须 = 5000+3000+1000+500+300，而非把 merged 再加一次
  assert.equal(out.meta.files.totalBytes, 9800);
  assert.equal(out.meta.files.mediaCount, 2, "mediaCount 只数分片，不含合并成品");
  assert.equal(out.meta.files.mergedCount, 1);
  assert.equal(out.meta.files.subtitleCount, 2);

  assert.equal(out.content.pages.length, 2);
  assert.equal(out.content.pages[1].streamUnavailable, "大会员专享，未购买");
  assert.ok(
    out.insights.some((l) => l.includes("合并成品 1 个 + 分片 2 个")),
    "insights 应按新口径描述落盘",
  );

  expectSnapshot("bili-video", out);
});

test("bili-comments 投影：置顶楼与普通楼分离", () => {
  const out = projectBiliCommentsAiReady(commentsFixture);

  assert.equal(out.topItems.length, 1);
  assert.equal(out.items.length, 2);
  assert.equal(out.meta.total, 256);
  assert.equal(out.meta.hasMore, false);
  // 楼中楼与本地化配图透传
  assert.equal(out.items[0].replies.length, 1);
  assert.equal(out.items[0].images[0].localized, true);

  expectSnapshot("bili-comments", out);
});
