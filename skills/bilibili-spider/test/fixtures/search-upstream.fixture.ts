/**
 * bili-search **上游原始响应** fixture —— L2 专用。
 *
 * 与 `search.fixture.ts` 的分工：那份是 Goal **聚合后**的 `BiliSearchResult`，
 * 喂给投影纯函数；这份是 `/x/web-interface/{nav,wbi/search/type}` 的**原始
 * JSON**，喂给 FakeUpstream，让 nav → 签名 → 分页 → 归一化 → 去重 → 投影
 * 整条链路真的跑一遍。
 *
 * 来源：docs/[搞笑].search.bilibili.com.har（六种 search_type 均有实录）。
 * 脱敏（docs/TESTING.md §2.3 三律）：
 *   ① 标题 / UP 名 / 简介 / 直播间名一律换成 mock 中文；aid/bvid/mid/roomid/uid
 *      换成假值但**保持位数与形态**（bvid 仍是 BV 开头 12 位，aid 仍是 15 位雪花）；
 *   ② 所有图片与页面 URL 域名换成 example.invalid；
 *   ③ 无凭据字段可留 —— nav 的 wbi_img 是**公开**密钥（每日轮换、匿名可取），
 *      但仍换成假 32 位 hex：签名算法只关心长度与字符集，真值没有测试价值。
 *
 * 保留的上游噪声（badgepay / cny_flag / hit_columns / new_rec_tags / vt_display …）
 * 是「投影必须显式枚举字段」这条纪律的检材，勿删。
 */

/** 上游统一信封：code=0 为成功 */
export function biliOk<T>(data: T): { code: number; message: string; ttl: number; data: T } {
  return { code: 0, message: "OK", ttl: 1, data };
}

/**
 * 业务失败信封 —— B 站用 code≠0 表达「参数不对 / 风控 / 需登录」。
 * 常见值：-400 请求错误、-403 访问权限不足、-352 风控校验失败、-101 未登录。
 */
export function biliErr(code: number, message: string): { code: number; message: string; ttl: number; data: null } {
  return { code, message, ttl: 1, data: null };
}

// ============================================================================
// nav —— WBI 密钥来源，几乎每个 Goal 的第一跳
// ============================================================================

/**
 * nav 正常响应。img_url / sub_url 的**文件名**（去扩展名）就是 imgKey / subKey，
 * `extractWbiKey` 靠 URL pathname 尾段解析 —— 所以这里必须是完整合法 URL。
 */
export const navFixture = {
  wbi_img: {
    img_url: "https://img.example.invalid/bfs/wbi/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png",
    sub_url: "https://img.example.invalid/bfs/wbi/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.png",
  },
};

/** 未登录时 nav 仍返回 200 + code=-101，但 wbi_img 缺失 —— 契约漂移的真实来源 */
export const navMissingWbiFixture = {
  isLogin: false,
};

// ============================================================================
// video 搜索 —— 最常用分类，dynamic_offset 翻页 + 去重
// ============================================================================

/** 差异字段之外的噪声由本函数补齐（上游单条 66 个字段，投影只消费约 16 个） */
function videoItem(o: {
  seq: number;
  aid: number;
  bvid: string;
  title: string;
  description?: string;
  mid: number;
  author: string;
  play: number;
  danmaku: number;
  favorites: number;
  review: number;
  like: number;
  pubdate: number;
  senddate: number;
  duration: string;
  rank_index: number;
  rank_offset: number;
}) {
  const { seq, ...rest } = o;
  return {
    type: "video",
    ...rest,
    id: o.aid,
    arcurl: `http://www.example.invalid/video/av${o.aid}`,
    pic: `//img.example.invalid/bfs/archive/mock-${seq}.jpg`,
    upic: `https://img.example.invalid/bfs/face/mock-${seq}.jpg`,
    typename: "综艺",
    typeid: "71",
    tag: "测试标签A,测试标签B",
    // —— 以下投影一律不消费，用于验证「禁止 spread」——
    description: o.description ?? "",
    desc: "",
    area: 0,
    badgepay: false,
    biz_data: null,
    card_status: null,
    cate_name: "",
    cny_flag: false,
    corner: "",
    enable_vt: 0,
    episode_count_text: "",
    hit_columns: ["title"],
    is_charge_video: 0,
    is_intervene: 0,
    is_live_room_inline: 0,
    is_pay: 0,
    is_union_video: 0,
    live_status: 0,
    live_time: "",
    new_rec_tags: [],
    online: 0,
    parent_area_id: 0,
    parent_area_name: "",
    rec_reason: "",
    rec_tags: null,
    release_status: 0,
    roomid: 0,
    short_id: 0,
    spread_id: 0,
    style: 0,
    subtitle: "",
    tags: null,
    uface: "",
    uid: 0,
    uname: "",
    url: "",
    user_cover: "",
    video_review: 0,
    view_type: "",
    vt: 0,
    vt_display: "",
    watched_show: null,
  };
}

/**
 * 第 1 页：3 条。第 3 条与第 2 页首条 **bvid 相同**，用于验证跨页去重。
 * 第 2 条标题带 `<em class="keyword">` 高亮标签 —— 上游对命中词的真实行为，
 * 投影必须 stripHtml，否则 Agent 会拿到一串 HTML。
 */
export const searchVideoPage1Raw = {
  seid: "mock-seid-0001",
  page: 1,
  pagesize: 42,
  numResults: 1000,
  numPages: 24,
  suggest_keyword: "",
  rqt_type: "search",
  cost_time: {},
  exp_list: {},
  egg_hit: 0,
  in_black_key: 0,
  in_white_key: 0,
  is_hit_web_inf: 0,
  show_column: 0,
  next: null,
  result: [
    videoItem({
      seq: 1,
      aid: 116648174421738,
      bvid: "BV1AjGD6mEJ6",
      title: "测试视频甲：合集汇总",
      mid: 3691007780588329,
      author: "测试UP甲",
      play: 23489,
      danmaku: 1,
      favorites: 101,
      review: 1,
      like: 117,
      pubdate: 1779931800,
      senddate: 1779993619,
      duration: "331:14",
      rank_index: 1,
      rank_offset: 0,
    }),
    videoItem({
      seq: 2,
      aid: 116648174421739,
      bvid: "BV1AjGD6mEJ7",
      // 上游对命中关键词加 <em> 高亮 —— 投影必须剥掉
      title: '盘点<em class="keyword">测试</em>瞬间',
      description: "测试简介乙",
      mid: 3691007780588330,
      author: "测试UP乙",
      play: 88000,
      danmaku: 320,
      favorites: 1200,
      review: 45,
      like: 5600,
      pubdate: 1779931900,
      senddate: 1779993700,
      duration: "12:34",
      rank_index: 2,
      rank_offset: 1,
    }),
    videoItem({
      seq: 3,
      aid: 116648174421740,
      bvid: "BV1AjGD6mEJ8",
      title: "测试视频丙（与第 2 页首条重复）",
      mid: 3691007780588331,
      author: "测试UP丙",
      play: 4200,
      danmaku: 8,
      favorites: 30,
      review: 2,
      like: 210,
      pubdate: 1779932000,
      senddate: 1779993800,
      duration: "05:20",
      rank_index: 3,
      rank_offset: 2,
    }),
  ],
};

/**
 * 第 2 页：2 条，首条 bvid 与第 1 页第 3 条**重复**（dynamic_offset 翻页的
 * 真实现象：偏移窗口滑动时上游会重复吐同一条）。去重后净增 1 条。
 */
export const searchVideoPage2Raw = {
  ...searchVideoPage1Raw,
  page: 2,
  result: [
    videoItem({
      seq: 3,
      aid: 116648174421740,
      bvid: "BV1AjGD6mEJ8",
      title: "测试视频丙（与第 2 页首条重复）",
      mid: 3691007780588331,
      author: "测试UP丙",
      play: 4200,
      danmaku: 8,
      favorites: 30,
      review: 2,
      like: 210,
      pubdate: 1779932000,
      senddate: 1779993800,
      duration: "05:20",
      rank_index: 3,
      rank_offset: 2,
    }),
    videoItem({
      seq: 4,
      aid: 116648174421741,
      bvid: "BV1AjGD6mEJ9",
      title: "测试视频丁",
      mid: 3691007780588332,
      author: "测试UP丁",
      play: 999,
      danmaku: 0,
      favorites: 5,
      review: 0,
      like: 12,
      pubdate: 1779932100,
      senddate: 1779993900,
      duration: "01:02",
      rank_index: 25,
      rank_offset: 24,
    }),
  ],
};

/** 正常空集：关键词过窄时 result 为空数组，numResults=0，**不是错误** */
export const searchVideoEmptyRaw = {
  ...searchVideoPage1Raw,
  numResults: 0,
  numPages: 0,
  result: [],
};

/**
 * 契约漂移：`result` 从数组变成对象。
 * `extractSearchPage` 对此显式抛 UpstreamShapeChangedError —— 这是全仓少数
 * 主动校验上游形状的地方，值得钉住。
 */
export const searchVideoShapeDriftRaw = {
  ...searchVideoPage1Raw,
  result: { unexpected: "shape" },
};

// ============================================================================
// live 搜索 —— 唯一的分组结构（result 是对象而非数组）
// ============================================================================

/**
 * 直播搜索：`result` 是 `{live_room, live_user}` 分组对象，翻页元数据在
 * `pageinfo.live_room` 而非顶层 numResults。同一个 kind 走完全不同的解析分支，
 * 是 extractSearchPage 里最容易改错的地方。
 */
export const searchLiveRaw = {
  seid: "mock-seid-0002",
  page: 1,
  pagesize: 42,
  numResults: 0,
  numPages: 0,
  pageinfo: {
    live_room: { numResults: 621, pages: 15, total: 621, numPages: 15 },
    live_user: { numResults: 1000, pages: 167, total: 1000, numPages: 167 },
  },
  result: {
    live_room: [
      {
        type: "live_room",
        roomid: 1787655699,
        id: null,
        title: "测试直播间甲",
        uname: "测试主播甲",
        uid: 1846309355,
        mid: null,
        user_cover: "//img.example.invalid/bfs/live/user_cover/mock-1.jpg",
        cover: "//img.example.invalid/bfs/live-key-frame/mock-1.jpg",
        online: 6029,
        attentions: 138,
        live_time: "2026-05-29 21:28:47",
        // 分区名同样会被打上高亮标签
        cate_name: '<em class="keyword">测试</em>整蛊',
        live_status: 1,
        tags: "",
        short_id: 0,
        area: 0,
      },
    ],
    live_user: [
      {
        type: "live_user",
        uid: 1681337756,
        mid: null,
        uname: '<em class="keyword">测试</em>主播乙',
        uface: "//img.example.invalid/bfs/face/mock-lu-1.jpg",
        attentions: 37144,
        live_status: 1,
        tags: "",
        cate_name: "",
        online: 0,
      },
    ],
  },
};

// ============================================================================
// bili_user 搜索 —— stats 走 fans/videos 而非 play/danmaku
// ============================================================================

export const searchUserRaw = {
  seid: "mock-seid-0003",
  page: 1,
  pagesize: 36,
  numResults: 480,
  numPages: 14,
  result: [
    {
      type: "bili_user",
      mid: 546195,
      uid: 546195,
      uname: '<em class="keyword">测试</em>用户甲',
      usign: "测试个性签名",
      upic: "//img.example.invalid/bfs/face/mock-u1.jpg",
      uface: "",
      fans: 1234567,
      videos: 321,
      level: 6,
      gender: 1,
      is_upuser: 1,
      is_live: 0,
      room_id: 0,
      official_verify: { type: 0, desc: "" },
      hit_columns: ["uname"],
      res: [],
    },
  ],
};
