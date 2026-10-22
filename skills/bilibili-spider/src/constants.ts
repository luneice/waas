export const BILIBILI_SITE = "https://search.bilibili.com";
export const BILIBILI_WWW = "https://www.bilibili.com";
export const BILIBILI_SPACE = "https://space.bilibili.com";
export const BILIBILI_API_BASE = "https://api.bilibili.com";

/** 空间页接口统一的 web_location 埋点值（HAR 抓包一致）。 */
export const BILIBILI_SPACE_WEB_LOCATION = "333.1387";

/** 评论区接口 reply/wbi/main 的 web_location 埋点值（HAR 抓包一致）。 */
export const BILIBILI_REPLY_WEB_LOCATION = "1315875";

/** 评论主楼默认连抓页数。 */
export const BILI_COMMENTS_DEFAULT_MAX_PAGES = 3;
/** 评论主楼连抓硬上限（防御性，避免无限翻页）。 */
export const BILI_COMMENTS_MAX_PAGES_CAP = 20;
/** includeReplies=true 时每条主楼追加楼中楼的默认条数。 */
export const BILI_COMMENTS_DEFAULT_REPLIES_LIMIT = 10;
/** 楼中楼接口 reply/reply 单页最大 ps。 */
export const BILI_COMMENTS_REPLIES_PAGE_SIZE = 20;
/** 单图下载默认超时（毫秒）。 */
export const BILI_COMMENTS_DEFAULT_IMAGE_TIMEOUT = 30_000;

export const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";
