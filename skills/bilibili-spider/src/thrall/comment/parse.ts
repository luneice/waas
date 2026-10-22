/**
 * 评论纯映射层（Node 侧，无副作用）。
 *
 * 把 reply/wbi/main 与 reply/reply 的原始 reply 节点映射为结构化 BiliCommentItem，
 * 文字取 content.message，图片取 content.pictures[]，楼中楼递归映射内嵌 .replies[]。
 */
import type {
  BiliCommentImage,
  BiliCommentItem,
  BiliCommentUser,
  RawReply,
  RawReplyPicture,
} from "@src/types/comment.types";

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** 升级图片 URL 为 https，并去掉 @ 裁剪/转码后缀。 */
function toHttps(raw: string | undefined): string {
  let url = (raw ?? "").trim();
  if (!url) return url;
  const at = url.indexOf("@");
  if (at >= 0) url = url.slice(0, at);
  if (url.startsWith("//")) url = `https:${url}`;
  else if (url.startsWith("http://")) url = `https://${url.slice(7)}`;
  return url;
}

/** 去掉 IP 属地的「IP属地：」前缀，仅保留地区。 */
function normalizeLocation(raw: string | undefined): string | null {
  const text = (raw ?? "").trim();
  if (!text) return null;
  return text.replace(/^IP属地[:：]\s*/, "").trim() || null;
}

function mapPicture(raw: RawReplyPicture): BiliCommentImage | null {
  const url = toHttps(raw.img_src);
  if (!url) return null;
  const image: BiliCommentImage = { url };
  if (typeof raw.img_width === "number") image.width = raw.img_width;
  if (typeof raw.img_height === "number") image.height = raw.img_height;
  if (typeof raw.img_size === "number") image.sizeKb = raw.img_size;
  return image;
}

function mapUser(raw: RawReply): BiliCommentUser {
  const member = raw.member ?? {};
  return {
    mid: num(member.mid),
    name: member.uname ?? "",
    avatar: toHttps(member.avatar),
    level: num(member.level_info?.current_level),
  };
}

/**
 * 映射单条评论。`maxNestedReplies` 控制内嵌楼中楼保留条数（默认全部）；
 * 追加的完整楼中楼由编排层另行注入，不在此处网络请求。
 */
export function mapReply(
  raw: RawReply,
  maxNestedReplies = Number.POSITIVE_INFINITY,
): BiliCommentItem {
  const pictures = Array.isArray(raw.content?.pictures)
    ? raw.content!.pictures!
    : [];
  const images = pictures
    .map(mapPicture)
    .filter((img): img is BiliCommentImage => img !== null);

  const nested = Array.isArray(raw.replies) ? raw.replies : [];
  const replies = nested
    .slice(0, Math.max(0, maxNestedReplies))
    .map((r) => mapReply(r, maxNestedReplies));

  return {
    rpid: raw.rpid_str ?? "",
    user: mapUser(raw),
    message: raw.content?.message ?? "",
    images,
    like: num(raw.like),
    publishedAt: num(raw.ctime),
    replyCount: num(raw.rcount),
    location: normalizeLocation(raw.reply_control?.location),
    replies,
  };
}

/** 遍历评论树收集全部图片（含楼中楼），供下载层统一处理。 */
export function collectCommentImages(
  items: BiliCommentItem[],
): BiliCommentImage[] {
  const out: BiliCommentImage[] = [];
  const walk = (list: BiliCommentItem[]): void => {
    for (const item of list) {
      out.push(...item.images);
      if (item.replies.length) walk(item.replies);
    }
  };
  walk(items);
  return out;
}
