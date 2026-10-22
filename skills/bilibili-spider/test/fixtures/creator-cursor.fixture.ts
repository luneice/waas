/**
 * creator 模块 fixture（channels / articles / feed） —— L2 专用，上游原始响应。
 *
 * nav / biliOk / biliErr 与 bili-search / creator-upstream 共用同一套，
 * 从 search-upstream.fixture.ts 直接复用，不重复定义。
 *
 * articles / feed 是 offset 游标翻页范式（与 videos/audios/channels 的
 * page 类翻页不同）：单次执行只抓一页，聚合结果含 nextOffset/hasMore，
 * 由调用方携带 nextOffset 续取；fixture 因此只需准备"首页"与"含 offset
 * 续取"两种响应，不需要像 page 类那样准备多页轮换序列。
 *
 * 脱敏三律同 search-upstream.fixture.ts 文件头。
 */
export { biliOk, biliErr, navFixture, navMissingWbiFixture } from "./search-upstream.fixture";

// ============================================================================
// channels —— /x/polymer/web-space/seasons_series_list（无 WBI，page 类翻页）
// ============================================================================

function seasonItem(o: { seasonId: number; name: string; mid: number }) {
  return {
    meta: {
      season_id: o.seasonId,
      name: o.name,
      cover: `//img.example.invalid/bfs/archive/mock-season-${o.seasonId}.jpg`,
      description: "测试合集简介",
      total: 20,
      mid: o.mid,
    },
    archives: [
      {
        aid: 113000000000201,
        bvid: "BV1dd4y1d7d1",
        title: "测试合集稿件标题甲",
        pic: "//img.example.invalid/bfs/archive/mock-cover-201.jpg",
        duration: 600,
        pubdate: 1770000000,
        stat: { view: 100000, danmaku: 500 },
      },
    ],
  };
}

function seriesItem(o: { seriesId: number; name: string; mid: number }) {
  return {
    meta: {
      series_id: o.seriesId,
      name: o.name,
      cover: `//img.example.invalid/bfs/archive/mock-series-${o.seriesId}.jpg`,
      description: "测试系列简介",
      total: 8,
      mid: o.mid,
    },
    archives: [],
  };
}

export const seasonsSeriesPage1Fixture = {
  items_lists: {
    page: { page_num: 1, page_size: 20, total: 3 },
    seasons_list: [seasonItem({ seasonId: 30001, name: "测试合集甲", mid: 546195 })],
    series_list: [seriesItem({ seriesId: 40001, name: "测试系列甲", mid: 546195 })],
  },
};

export const seasonsSeriesPage2Fixture = {
  items_lists: {
    page: { page_num: 2, page_size: 20, total: 3 },
    seasons_list: [seasonItem({ seasonId: 30002, name: "测试合集乙", mid: 546195 })],
    series_list: [],
  },
};

export const seasonsSeriesEmptyFixture = {
  items_lists: {
    page: { page_num: 1, page_size: 20, total: 0 },
    seasons_list: [],
    series_list: [],
  },
};

/** 契约漂移：seasons_list 从数组变成对象 */
export const seasonsSeriesShapeDriftFixture = {
  items_lists: {
    page: { page_num: 1, page_size: 20, total: 3 },
    seasons_list: { unexpected: "shape" },
    series_list: [],
  },
};

// ============================================================================
// articles —— /x/polymer/web-dynamic/v1/opus/feed/space（WBI，offset 游标）
// ============================================================================

function opusItem(o: { opusId: string; content: string }) {
  return {
    opus_id: o.opusId,
    content: o.content,
    cover: { url: `//img.example.invalid/bfs/new_dyn/mock-${o.opusId}.jpg` },
    jump_url: `//www.example.invalid/opus/${o.opusId}`,
    stat: { view: 30000, like: 2000, comment: 300, forward: 50 },
  };
}

/** 首页：has_more=true，续取需带 offset */
export const opusFeedPage1Fixture = {
  has_more: true,
  offset: "opus-offset-0001",
  items: [
    opusItem({ opusId: "820000000000001", content: "测试图文正文摘要甲" }),
    opusItem({ opusId: "820000000000002", content: "测试图文正文摘要乙" }),
  ],
};

/** 续取页：has_more=false，无更多 */
export const opusFeedPage2Fixture = {
  has_more: false,
  offset: "opus-offset-0002",
  items: [opusItem({ opusId: "820000000000003", content: "测试图文正文摘要丙" })],
};

export const opusFeedEmptyFixture = {
  has_more: false,
  offset: "",
  items: [],
};

/** 契约漂移：items 从数组变成对象 */
export const opusFeedShapeDriftFixture = {
  has_more: false,
  offset: "",
  items: { unexpected: "shape" },
};

// ============================================================================
// feed —— /x/polymer/web-dynamic/v1/feed/space（WBI，offset 游标，混合时间线）
// ============================================================================

function dynamicArchiveItem(o: { idStr: string; jumpUrl: string }) {
  return {
    id_str: o.idStr,
    type: "DYNAMIC_TYPE_AV",
    modules: {
      module_author: { pub_ts: 1770000000 },
      module_dynamic: {
        desc: { text: "测试动态文案（视频）" },
        major: { type: "MAJOR_TYPE_ARCHIVE", archive: { jump_url: o.jumpUrl } },
      },
      module_stat: { comment: { count: 300 }, forward: { count: 50 }, like: { count: 5000 } },
    },
  };
}

function dynamicWordItem(o: { idStr: string }) {
  return {
    id_str: o.idStr,
    type: "DYNAMIC_TYPE_WORD",
    modules: {
      module_author: { pub_ts: 1770000100 },
      module_dynamic: { desc: { text: "测试纯文本动态" }, major: null },
      module_stat: { comment: { count: 10 }, forward: { count: 1 }, like: { count: 100 } },
    },
  };
}

function dynamicForwardItem(o: { idStr: string }) {
  return {
    id_str: o.idStr,
    type: "DYNAMIC_TYPE_FORWARD",
    modules: {
      module_author: { pub_ts: 1770000200 },
      module_dynamic: { desc: { text: "测试转发动态" }, major: null },
      module_stat: { comment: { count: 5 }, forward: { count: 20 }, like: { count: 200 } },
    },
  };
}

export const dynamicFeedPage1Fixture = {
  has_more: true,
  offset: "dyn-offset-0001",
  items: [
    dynamicArchiveItem({ idStr: "930000000000001", jumpUrl: "//www.example.invalid/video/BV1ee4y1e7e1" }),
    dynamicWordItem({ idStr: "930000000000002" }),
    dynamicForwardItem({ idStr: "930000000000003" }),
  ],
};

export const dynamicFeedEmptyFixture = {
  has_more: false,
  offset: "",
  items: [],
};

/** 契约漂移：items 从数组变成对象 */
export const dynamicFeedShapeDriftFixture = {
  has_more: false,
  offset: "",
  items: { unexpected: "shape" },
};
