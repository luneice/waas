/**
 * bili-search 投影 fixture —— 全 mock 数据（脱敏，不含真实平台内容）。
 *
 * 覆盖点：dynamic_offset 分类（video）、去重计数、双条目、固定 crawledAt。
 */
import type { BiliSearchResult } from "@src/types/search.types";

export const searchFixture: BiliSearchResult = {
  keyword: "测试关键词",
  kind: "video",
  qvId: "mock-qv-id-0001",
  query: {
    page: 1,
    maxPages: 2,
    pageSize: 42,
    order: null,
    pubtimeBeginS: 0,
    pubtimeEndS: 0,
    duration: null,
    tids: null,
    categoryId: null,
    orderSort: null,
    userType: null,
    offsetStep: 24,
  },
  crawledAt: new Date("2026-07-01T00:00:00.000Z"),
  totalResults: 120,
  totalPages: 5,
  pagesFetched: 2,
  duplicateCount: 3,
  returnedCount: 2,
  items: [
    {
      itemType: "video",
      dedupeKey: "video:MOCKBV0000001",
      id: "MOCKBV0000001",
      title: "测试视频甲",
      description: "测试描述甲",
      url: "https://example.invalid/video/MOCKBV0000001",
      cover: "https://example.invalid/cover/1.jpg",
      author: { id: "10001", name: "测试作者甲", avatar: null },
      stats: { play: 12345, danmaku: 67, like: 890 },
      publishedAt: "2026-06-30T12:00:00.000Z",
      duration: "12:34",
      rank: { index: 1, offset: 0 },
      extra: {},
    },
    {
      itemType: "video",
      dedupeKey: "video:MOCKBV0000002",
      id: "MOCKBV0000002",
      title: "测试视频乙",
      description: null,
      url: "https://example.invalid/video/MOCKBV0000002",
      cover: null,
      author: { id: null, name: null, avatar: null },
      stats: { play: 42 },
      publishedAt: null,
      duration: null,
      rank: { index: 2, offset: 24 },
      extra: { note: "mock" },
    },
  ],
  pages: [
    {
      page: 1,
      dynamicOffset: 0,
      returnedCount: 3,
      addedCount: 2,
      duplicateCount: 1,
      totalResults: 120,
      totalPages: 5,
    },
    {
      page: 2,
      dynamicOffset: 24,
      returnedCount: 2,
      addedCount: 0,
      duplicateCount: 2,
      totalResults: 120,
      totalPages: 5,
    },
  ],
};
