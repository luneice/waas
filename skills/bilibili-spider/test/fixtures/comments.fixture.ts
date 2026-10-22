/**
 * bili-comments 投影 fixture —— 全 mock 数据（脱敏）。
 *
 * 覆盖点：topItems 与 items 分离、楼中楼嵌套、本地化配图、落盘清单。
 */
import type { BiliCommentsResult } from "@src/types/comment.types";

export const commentsFixture: BiliCommentsResult = {
  source: { oid: "111111", type: 1, origin: "video", mode: 3 },
  meta: { total: 256 },
  pagesFetched: 1,
  returnedCount: 2,
  topItems: [
    {
      rpid: "900001",
      user: { mid: 10001, name: "测试作者甲", avatar: "", level: 6 },
      message: "置顶：测试公告",
      images: [],
      like: 999,
      publishedAt: 1751328000,
      replyCount: 0,
      location: "测试省",
      replies: [],
    },
  ],
  items: [
    {
      rpid: "900002",
      user: { mid: 20002, name: "测试用户乙", avatar: "", level: 4 },
      message: "主楼：带图评论",
      images: [
        {
          url: "https://example.invalid/img/1.jpg",
          localPath: "images/900002-1.jpg",
          width: 100,
          height: 100,
          sizeKb: 12,
          sizeBytes: 12288,
        },
      ],
      like: 45,
      publishedAt: 1751328100,
      replyCount: 1,
      location: null,
      replies: [
        {
          rpid: "900003",
          user: { mid: 30003, name: "测试用户丙", avatar: "", level: 2 },
          message: "楼中楼回复",
          images: [],
          like: 3,
          publishedAt: 1751328200,
          replyCount: 0,
          location: "测试市",
          replies: [],
        },
      ],
    },
    {
      rpid: "900004",
      user: { mid: 40004, name: "测试用户丁", avatar: "", level: 5 },
      message: "主楼：纯文字",
      images: [],
      like: 7,
      publishedAt: 1751328300,
      replyCount: 0,
      location: null,
      replies: [],
    },
  ],
  nextOffset: null,
  hasMore: false,
  files: {
    markdown: "comments-111111.md",
    meta: "comments-111111.meta.json",
    images: ["images/900002-1.jpg"],
  },
  outputDir: "/tmp/mock-store/comments",
  crawledAt: new Date("2026-07-01T00:00:00.000Z"),
};
