/**
 * 评论入口解析（纯，无网络）。
 *
 * 把用户多形态入参归一为「评论区定位描述符」CommentInput，交给 subject 解析层
 * （部分形态需一次网络请求换取 oid+type）。优先级：oid+type 直传 > 视频 > 专栏 cv
 * > opus 图文。URL 内部识别 /video、/opus、/read/cv。
 */
import { InvalidParamsError } from "@spider/core";
import type { BiliCommentParams } from "@src/types/comment.types";

const SCOPE = "bili-comments";

export type CommentInput =
  | { kind: "direct"; oid: string; type: number }
  | { kind: "video"; bvid?: string; aid?: string }
  | { kind: "article"; cvId: string }
  | { kind: "opus"; opusId: string };

const OPUS_RE = /opus\/(\d+)/i;
const CV_RE = /(?:read\/)?cv(\d+)/i;
const VIDEO_BV_RE = /video\/(BV[0-9A-Za-z]+)/i;
const VIDEO_AV_RE = /video\/av(\d+)/i;
/** opus 主键为长数字串（实测约 19 位），用 >=16 位区分 cv 短号。 */
const OPUS_ID_MIN_DIGITS = 16;

function cleanDigits(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const m = String(value).trim().match(/(\d+)/);
  return m ? m[1] : undefined;
}

function cleanBvid(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const m = String(value).trim().match(/(BV[0-9A-Za-z]+)/i);
  return m ? m[1] : undefined;
}

/** 从 URL / 简写解析视频/专栏/opus 形态。 */
function parseFromText(text: string): CommentInput | null {
  const bv = text.match(VIDEO_BV_RE)?.[1];
  if (bv) return { kind: "video", bvid: bv };

  const av = text.match(VIDEO_AV_RE)?.[1];
  if (av) return { kind: "video", aid: av };

  const opus = text.match(OPUS_RE)?.[1];
  if (opus) return { kind: "opus", opusId: opus };

  const cv = text.match(CV_RE)?.[1];
  if (cv) return { kind: "article", cvId: cv };

  // 裸 BV 号
  if (/^BV[0-9A-Za-z]+$/i.test(text.trim())) {
    return { kind: "video", bvid: text.trim() };
  }
  return null;
}

export function resolveCommentInput(params: BiliCommentParams): CommentInput {
  // 1. oid + type 直传（二者必须同填）
  const hasOid = params.oid !== undefined && params.oid !== null && params.oid !== "";
  const hasType = params.type !== undefined && params.type !== null;
  if (hasOid || hasType) {
    if (!hasOid || !hasType) {
      throw new InvalidParamsError("oid 与 type 必须成对传入", { scope: SCOPE });
    }
    const oid = cleanDigits(params.oid);
    const type = Math.floor(Number(params.type));
    if (!oid || !Number.isFinite(type)) {
      throw new InvalidParamsError("oid/type 取值非法", { scope: SCOPE });
    }
    return { kind: "direct", oid, type };
  }

  // 2. 显式视频
  const bvid = cleanBvid(params.bvid);
  if (bvid) return { kind: "video", bvid };
  const aid = cleanDigits(params.aid);
  if (aid) return { kind: "video", aid };

  // 3. 显式专栏 cv
  const cvId = cleanDigits(params.cvId);
  if (cvId) return { kind: "article", cvId };

  // 4. 显式 opus
  const opusId = cleanDigits(params.opusId);
  if (opusId) return { kind: "opus", opusId };

  // 5. URL / 简写
  const url = (params.url ?? "").trim();
  if (url) {
    const parsed = parseFromText(url);
    if (parsed) return parsed;
    // 纯数字 URL 兜底：按长度区分 opus / cv
    const digits = cleanDigits(url);
    if (digits) {
      return digits.length >= OPUS_ID_MIN_DIGITS
        ? { kind: "opus", opusId: digits }
        : { kind: "article", cvId: digits };
    }
  }

  throw new InvalidParamsError(
    "需要传入 bvid/aid/cvId/opusId/url 或 oid+type 指定评论区",
    { scope: SCOPE },
  );
}
