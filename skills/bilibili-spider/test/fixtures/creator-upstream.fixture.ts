/**
 * creator 模块 fixture（profile / videos / audios） —— L2 专用，上游原始响应。
 *
 * nav / biliOk / biliErr 与 bili-search 共用同一套（同一个 `/x/web-interface/nav`
 * 前置链路、同一套业务码信封），从 `search-upstream.fixture.ts` 直接复用，
 * 不重复定义——避免两份 nav fixture 出现细节漂移。
 *
 * 脱敏三律同 search-upstream.fixture.ts 文件头。
 */
export { biliOk, biliErr, navFixture, navMissingWbiFixture } from "./search-upstream.fixture";

// ============================================================================
// profile —— 7 端点聚合（nav + acc/info + relation/stat + upstat + navnum
// + notice + masterpiece）
// ============================================================================

export const accInfoFixture = {
  mid: 546195,
  name: "测试UP主甲",
  face: "//img.example.invalid/bfs/face/mock-face.jpg",
  sign: "测试个性签名",
  sex: "男",
  level: 6,
  birthday: "01-01",
  official: { role: 0, title: "", type: -1 },
  vip: { type: 2, status: 1, label: { text: "年度大会员" } },
  live_room: {
    roomid: 12345,
    title: "测试直播间标题",
    url: "https://live.example.invalid/12345",
    liveStatus: 0,
  },
};

export const relationStatFixture = {
  following: 100,
  follower: 500000,
  black: 0,
  whisper: 0,
};

export const upstatFixture = {
  archive: { view: 80000000 },
  article: { view: 200000 },
  likes: 3000000,
};

export const navnumFixture = {
  video: 300,
  article: 12,
  album: 0,
  bangumi: 0,
  cheese: 0,
};

export const noticeFixture = "测试空间公告内容";

export const masterpieceFixture = [
  {
    aid: 113000000000001,
    bvid: "BV1aa4y1a7a1",
    title: "测试代表作标题",
    pic: "//img.example.invalid/bfs/archive/mock-cover-1.jpg",
    desc: "测试代表作简介",
    duration: 600,
    pubdate: 1770000000,
    short_link_v2: "https://b23.example.invalid/mock1",
    stat: { view: 5000000, like: 300000, coin: 50000, favorite: 80000, reply: 3000, share: 1000, danmaku: 20000 },
  },
];

/** 隐私墙：masterpiece 命中 53013 时降级为空数组，不报错 */
export const masterpiecePrivacyFixture = { code: 53013, message: "被访问用户已设置隐私", ttl: 1, data: null };

// ============================================================================
// videos —— /x/space/wbi/arc/search（WBI，page 类翻页）
// ============================================================================

function vlistItem(o: { seq: number; aid: number; bvid: string; title: string }) {
  return {
    aid: o.aid,
    bvid: o.bvid,
    title: o.title,
    description: "测试视频简介",
    pic: `//img.example.invalid/bfs/archive/mock-cover-${o.seq}.jpg`,
    length: "10:00",
    created: 1770000000 + o.seq,
    typeid: 21,
    play: 500000 * o.seq,
    comment: 3000 * o.seq,
    video_review: 200 * o.seq,
  };
}

export const arcSearchPage1Fixture = {
  list: {
    vlist: [
      vlistItem({ seq: 1, aid: 113000000000101, bvid: "BV1bb4y1b7b1", title: "测试视频标题甲" }),
      vlistItem({ seq: 2, aid: 113000000000102, bvid: "BV1bb4y1b7b2", title: "测试视频标题乙" }),
    ],
    tlist: { "21": { name: "日常", count: 200 }, "17": { name: "单机游戏", count: 100 } },
  },
  page: { pn: 1, ps: 25, count: 300 },
};

/** 第 2 页：第 1 条与第 1 页第 2 条 aid 相同（跨页重复，验证去重） */
export const arcSearchPage2Fixture = {
  list: {
    vlist: [
      vlistItem({ seq: 2, aid: 113000000000102, bvid: "BV1bb4y1b7b2", title: "测试视频标题乙" }),
      vlistItem({ seq: 3, aid: 113000000000103, bvid: "BV1bb4y1b7b3", title: "测试视频标题丙" }),
    ],
    tlist: {},
  },
  page: { pn: 2, ps: 25, count: 300 },
};

export const arcSearchEmptyFixture = {
  list: { vlist: [], tlist: {} },
  page: { pn: 1, ps: 25, count: 0 },
};

/** 契约漂移：vlist 从数组变成对象 */
export const arcSearchShapeDriftFixture = {
  list: { vlist: { unexpected: "shape" }, tlist: {} },
  page: { pn: 1, ps: 25, count: 300 },
};

// ============================================================================
// audios —— /audio/music-service/web/song/upper（无 WBI，page 类翻页）
// ============================================================================

function songItem(o: { seq: number; id: number; title: string }) {
  return {
    id: o.id,
    title: o.title,
    cover: `//img.example.invalid/bfs/audio/mock-cover-${o.seq}.jpg`,
    intro: "测试音频简介",
    bvid: `BV1cc4y1c7c${o.seq}`,
    ctime: 1770000000 + o.seq,
    passtime: 1770000000 + o.seq,
    coin_num: 100 * o.seq,
    statistic: { play: 30000 * o.seq, collect: 2000 * o.seq, comment: 100 * o.seq, share: 50 * o.seq },
  };
}

export const songUpperPage1Fixture = {
  curPage: 1,
  pageCount: 2,
  totalSize: 60,
  pageSize: 42,
  data: [
    songItem({ seq: 1, id: 900001, title: "测试音频标题甲" }),
    songItem({ seq: 2, id: 900002, title: "测试音频标题乙" }),
  ],
};

export const songUpperPage2Fixture = {
  curPage: 2,
  pageCount: 2,
  totalSize: 60,
  pageSize: 42,
  data: [songItem({ seq: 3, id: 900003, title: "测试音频标题丙" })],
};

export const songUpperEmptyFixture = {
  curPage: 1,
  pageCount: 0,
  totalSize: 0,
  pageSize: 42,
  data: [],
};

/** 契约漂移：data 从数组变成对象 */
export const songUpperShapeDriftFixture = {
  curPage: 1,
  pageCount: 1,
  totalSize: 1,
  pageSize: 42,
  data: { unexpected: "shape" },
};
