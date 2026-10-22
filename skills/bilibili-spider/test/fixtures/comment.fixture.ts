/**
 * bili-comments fixture —— L2 专用，上游原始响应。
 *
 * biliOk/biliErr/navFixture 与 bili-search / creator 系列共用同一套，从
 * search-upstream.fixture.ts 直接复用。
 *
 * 本模块涉及三条独立的上游端点：
 *   - `/x/v2/reply/wbi/main`（WBI 签名）：评论主楼单页，offset 游标；
 *     Skill 层在**单次 execute() 内**按 maxPages 循环连抓（与 creator
 *     articles/feed 的"单次调用只抓一页"不同，更接近 videos/audios 的
 *     page 类翻页语义，只是分页参数是 offset 而非 page_num）；
 *   - `/x/v2/reply/reply`（无 WBI）：楼中楼完整子回复，includeReplies=true 时按主楼逐条追加；
 *   - 评论区定位策略专属端点：`/x/web-interface/view`（bvid→aid）、
 *     `/x/polymer/web-dynamic/v1/detail`（opusId→oid+type）。
 *
 * 脱敏三律同 search-upstream.fixture.ts 文件头。
 */
export { biliOk, biliErr, navFixture, navMissingWbiFixture } from "./search-upstream.fixture";

// ============================================================================
// reply/wbi/main —— 评论主楼单页（offset 游标）
// ============================================================================

function replyItem(o: {
  rpid: string;
  name: string;
  message: string;
  like: number;
  ctime: number;
  rcount?: number;
  withImage?: boolean;
  nestedRpid?: string;
}) {
  return {
    rpid_str: o.rpid,
    member: {
      mid: "546195",
      uname: o.name,
      avatar: `//img.example.invalid/bfs/face/mock-${o.rpid}.jpg`,
      level_info: { current_level: 5 },
    },
    content: {
      message: o.message,
      pictures: o.withImage
        ? [{ img_src: `//img.example.invalid/bfs/comment/mock-${o.rpid}.jpg`, img_width: 200, img_height: 150, img_size: 50 }]
        : null,
    },
    like: o.like,
    ctime: o.ctime,
    rcount: o.rcount ?? 0,
    reply_control: { location: "IP属地：广东" },
    replies: o.nestedRpid
      ? [
          {
            rpid_str: o.nestedRpid,
            member: { mid: "546196", uname: "测试用户乙", avatar: "//img.example.invalid/bfs/face/mock-nested.jpg", level_info: { current_level: 3 } },
            content: { message: "内嵌热门子回复", pictures: null },
            like: 5,
            ctime: o.ctime + 5,
            rcount: 0,
            reply_control: {},
            replies: [],
          },
        ]
      : [],
  };
}

/** 首页：2 条主楼（第 2 条带配图、带内嵌热评），has_more（next_offset 非空，is_end=false） */
export const mainPage1Fixture = {
  cursor: {
    is_end: false,
    all_count: 100,
    pagination_reply: { next_offset: "cm-offset-0001" },
  },
  top_replies: [
    replyItem({ rpid: "9000000001", name: "测试置顶用户", message: "测试置顶评论", like: 999, ctime: 1770000000 }),
  ],
  replies: [
    replyItem({ rpid: "1000000001", name: "测试用户甲", message: "测试评论甲", like: 100, ctime: 1770000100 }),
    replyItem({ rpid: "1000000002", name: "测试用户乙", message: "测试评论乙（带配图+热评）", like: 200, ctime: 1770000200, rcount: 3, withImage: true, nestedRpid: "2000000001" }),
  ],
};

/** 续页：首条与首页第 2 条 rpid 重复（用于验证跨页去重），到底（is_end=true） */
export const mainPage2Fixture = {
  cursor: {
    is_end: true,
    all_count: 100,
    pagination_reply: { next_offset: "" },
  },
  top_replies: [],
  replies: [
    replyItem({ rpid: "1000000002", name: "测试用户乙", message: "测试评论乙（带配图+热评）", like: 200, ctime: 1770000200, rcount: 3, withImage: true, nestedRpid: "2000000001" }),
    replyItem({ rpid: "1000000003", name: "测试用户丙", message: "测试评论丙", like: 30, ctime: 1770000300 }),
  ],
};

export const mainEmptyFixture = {
  cursor: { is_end: true, all_count: 0, pagination_reply: { next_offset: "" } },
  top_replies: [],
  replies: [],
};

/** 契约漂移：replies 从数组变成对象（Goal 层 mapReplies 已做 `Array.isArray` 防御，宽容降级为空） */
export const mainShapeDriftFixture = {
  cursor: { is_end: true, all_count: 5, pagination_reply: { next_offset: "" } },
  top_replies: [],
  replies: { unexpected: "shape" },
};

// ============================================================================
// reply/reply —— 楼中楼完整子回复（includeReplies=true）
// ============================================================================

export const repliesPageFixture = {
  replies: [
    replyItem({ rpid: "2000000001", name: "测试用户乙", message: "内嵌热门子回复", like: 5, ctime: 1770000205 }),
    replyItem({ rpid: "2000000002", name: "测试用户丁", message: "追加楼中楼回复", like: 8, ctime: 1770000210 }),
  ],
};

// ============================================================================
// 评论区定位策略专属端点
// ============================================================================

/** /x/web-interface/view —— bvid → aid */
export function viewFixture(aid: number) {
  return { code: 0, message: "0", data: { aid } };
}

export const viewNotFoundFixture = { code: -404, message: "啥都木有", data: null };

/** /x/polymer/web-dynamic/v1/detail —— opusId → oid+type */
export function dynamicDetailFixture(o: { commentId: string; commentType: number }) {
  return {
    code: 0,
    message: "0",
    data: { item: { basic: { comment_id_str: o.commentId, comment_type: o.commentType } } },
  };
}

export const dynamicDetailMissingFixture = { code: 0, message: "0", data: {} };

// ============================================================================
// 评论配图下载 —— 页内 fetch 应答
// ============================================================================

const TINY_PNG_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

export const tinyPngReply = {
  body: TINY_PNG_BUFFER.toString("binary"),
  contentType: "image/png",
};
