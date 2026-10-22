/**
 * bili-channel fixture —— L2 专用，上游原始响应。
 *
 * biliOk/biliErr 与 bili-search / creator 系列共用同一套，从
 * search-upstream.fixture.ts 直接复用，不重复定义。
 *
 * season（/x/polymer/web-space/seasons_archives_list）与 series
 * （/x/series/archives）是两个完全独立的端点、独立的 Goal 类
 * （BiliChannelSeasonGoal / BiliChannelSeriesGoal），均无 WBI，
 * page_num/pn + page_size/ps 翻页。season 首页携带 meta（合集名/封面/简介），
 * series 接口不返回 meta（BiliChannelSkill 侧留空占位）。
 *
 * 脱敏三律同 search-upstream.fixture.ts 文件头。
 */
export { biliOk, biliErr } from "./search-upstream.fixture";

function seasonArchiveItem(o: { aid: number; bvid: string; title: string }) {
  return {
    aid: o.aid,
    bvid: o.bvid,
    title: o.title,
    pic: `//img.example.invalid/bfs/archive/mock-${o.aid}.jpg`,
    duration: 600,
    pubdate: 1770000000,
    stat: { view: 100000, danmaku: 500 },
  };
}

// ============================================================================
// season —— /x/polymer/web-space/seasons_archives_list
// ============================================================================

export const seasonArchivesPage1Fixture = {
  archives: [
    seasonArchiveItem({ aid: 113000000000201, bvid: "BV1dd4y1d7d1", title: "测试合集稿件标题甲" }),
    seasonArchiveItem({ aid: 113000000000202, bvid: "BV1dd4y1d7d2", title: "测试合集稿件标题乙" }),
  ],
  meta: {
    season_id: 30001,
    name: "测试合集甲",
    cover: "//img.example.invalid/bfs/archive/mock-season-30001.jpg",
    description: "测试合集简介",
    total: 3,
    mid: 546195,
  },
  page: { page_num: 1, page_size: 20, total: 3 },
};

/** 第 2 页：首条与第 1 页第 2 条 aid 相同，用于验证跨页去重 */
export const seasonArchivesPage2Fixture = {
  archives: [
    seasonArchiveItem({ aid: 113000000000202, bvid: "BV1dd4y1d7d2", title: "测试合集稿件标题乙" }),
    seasonArchiveItem({ aid: 113000000000203, bvid: "BV1dd4y1d7d3", title: "测试合集稿件标题丙" }),
  ],
  meta: {
    season_id: 30001,
    name: "测试合集甲",
    cover: "//img.example.invalid/bfs/archive/mock-season-30001.jpg",
    description: "测试合集简介",
    total: 3,
    mid: 546195,
  },
  page: { page_num: 2, page_size: 20, total: 3 },
};

export const seasonArchivesEmptyFixture = {
  archives: [],
  meta: {
    season_id: 30001,
    name: "测试合集甲",
    cover: "//img.example.invalid/bfs/archive/mock-season-30001.jpg",
    description: "测试合集简介",
    total: 0,
    mid: 546195,
  },
  page: { page_num: 1, page_size: 20, total: 0 },
};

/** 契约漂移：archives 从数组变成对象 */
export const seasonArchivesShapeDriftFixture = {
  archives: { unexpected: "shape" },
  meta: {
    season_id: 30001,
    name: "测试合集甲",
    cover: "//img.example.invalid/bfs/archive/mock-season-30001.jpg",
    description: "测试合集简介",
    total: 3,
    mid: 546195,
  },
  page: { page_num: 1, page_size: 20, total: 3 },
};

// ============================================================================
// series —— /x/series/archives（无 meta）
// ============================================================================

export const seriesArchivesPage1Fixture = {
  archives: [
    seasonArchiveItem({ aid: 114000000000301, bvid: "BV1ee4y1e7e1", title: "测试系列稿件标题甲" }),
    seasonArchiveItem({ aid: 114000000000302, bvid: "BV1ee4y1e7e2", title: "测试系列稿件标题乙" }),
  ],
  page: { num: 1, size: 20, total: 3 },
};

/** 第 2 页：首条与第 1 页第 2 条 aid 相同，用于验证跨页去重 */
export const seriesArchivesPage2Fixture = {
  archives: [
    seasonArchiveItem({ aid: 114000000000302, bvid: "BV1ee4y1e7e2", title: "测试系列稿件标题乙" }),
    seasonArchiveItem({ aid: 114000000000303, bvid: "BV1ee4y1e7e3", title: "测试系列稿件标题丙" }),
  ],
  page: { num: 2, size: 20, total: 3 },
};

export const seriesArchivesEmptyFixture = {
  archives: [],
  page: { num: 1, size: 20, total: 0 },
};

/** 契约漂移：archives 从数组变成对象 */
export const seriesArchivesShapeDriftFixture = {
  archives: { unexpected: "shape" },
  page: { num: 1, size: 20, total: 3 },
};
