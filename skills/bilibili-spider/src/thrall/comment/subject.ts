/**
 * 评论区定位解析（策略模式 + 服务编排）。
 *
 * 把 CommentInput 解析为 BiliCommentSubject（oid + type）。不同入口形态对应不同
 * 策略：直传/专栏 cv 为纯解析，视频 bvid 与 opus 图文需一次页内网络请求换取 oid+type。
 * 页内请求复用已登录浏览器上下文（credentials:include），与 article/dom-extract 同源。
 *
 * 设计：
 *   - ICommentSubjectStrategy        策略接口（supports + resolve）
 *   - 四个具体策略类                  Direct / Article / Video / Opus
 *   - CommentSubjectResolver          按 input.kind 选策略并委派（依赖注入策略集）
 */
import { Page } from "puppeteer-core";
import { UpstreamShapeChangedError } from "@spider/core";
import type { CommentInput } from "@src/thrall/comment/input";
import type { BiliCommentSubject } from "@src/types/comment.types";

const SCOPE = "bili-comments-subject";

/** 视频评论区 type 固定为 1。 */
const VIDEO_COMMENT_TYPE = 1;
/** 老版专栏 cv 评论区 type 固定为 12。 */
const ARTICLE_COMMENT_TYPE = 12;

/** 评论区定位策略接口。 */
export interface ICommentSubjectStrategy {
  readonly kind: CommentInput["kind"];
  resolve(page: Page, input: CommentInput): Promise<BiliCommentSubject>;
}

/** 页内 GET JSON（携带登录态 Cookie）。 */
async function fetchJsonInPage<T>(page: Page, url: string): Promise<T> {
  return page.evaluate(async (u: string) => {
    const resp = await fetch(u, { credentials: "include" });
    return (await resp.json()) as unknown;
  }, url) as Promise<T>;
}

/** 直传 oid+type：纯解析。 */
export class DirectSubjectStrategy implements ICommentSubjectStrategy {
  readonly kind = "direct" as const;
  async resolve(_page: Page, input: CommentInput): Promise<BiliCommentSubject> {
    const i = input as Extract<CommentInput, { kind: "direct" }>;
    return { oid: i.oid, type: i.type, origin: "direct" };
  }
}

/** 专栏 cv：oid=cvId，type=12，纯解析。 */
export class ArticleSubjectStrategy implements ICommentSubjectStrategy {
  readonly kind = "article" as const;
  async resolve(_page: Page, input: CommentInput): Promise<BiliCommentSubject> {
    const i = input as Extract<CommentInput, { kind: "article" }>;
    return { oid: i.cvId, type: ARTICLE_COMMENT_TYPE, origin: "article" };
  }
}

interface RawViewResponse {
  code?: number;
  message?: string;
  data?: { aid?: number };
}

/** 视频：aid 直接用；bvid 经 view 接口换 aid。type=1。 */
export class VideoSubjectStrategy implements ICommentSubjectStrategy {
  readonly kind = "video" as const;
  async resolve(page: Page, input: CommentInput): Promise<BiliCommentSubject> {
    const i = input as Extract<CommentInput, { kind: "video" }>;
    if (i.aid) {
      return { oid: i.aid, type: VIDEO_COMMENT_TYPE, origin: "video" };
    }
    const url = `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(
      i.bvid ?? "",
    )}`;
    const json = await fetchJsonInPage<RawViewResponse>(page, url);
    const aid = json?.data?.aid;
    if (json?.code !== 0 || !aid) {
      throw new UpstreamShapeChangedError(
        `无法由 bvid 解析 aid：code=${json?.code} message=${json?.message ?? ""}`,
        { scope: SCOPE, details: { bvid: i.bvid, code: json?.code } },
      );
    }
    return { oid: String(aid), type: VIDEO_COMMENT_TYPE, origin: "video" };
  }
}

interface RawDynamicDetailResponse {
  code?: number;
  message?: string;
  data?: {
    item?: {
      basic?: { comment_id_str?: string; comment_type?: number };
    };
  };
}

/** opus 图文/动态：经 web-dynamic detail 取 basic.comment_id_str + comment_type。 */
export class OpusSubjectStrategy implements ICommentSubjectStrategy {
  readonly kind = "opus" as const;
  async resolve(page: Page, input: CommentInput): Promise<BiliCommentSubject> {
    const i = input as Extract<CommentInput, { kind: "opus" }>;
    const url =
      "https://api.bilibili.com/x/polymer/web-dynamic/v1/detail?id=" +
      encodeURIComponent(i.opusId) +
      "&features=itemOpusStyle";
    const json = await fetchJsonInPage<RawDynamicDetailResponse>(page, url);
    const basic = json?.data?.item?.basic;
    const oid = basic?.comment_id_str;
    const type = basic?.comment_type;
    if (json?.code !== 0 || !oid || typeof type !== "number") {
      throw new UpstreamShapeChangedError(
        `无法由 opusId 解析评论区：code=${json?.code} message=${json?.message ?? ""}`,
        { scope: SCOPE, details: { opusId: i.opusId, code: json?.code } },
      );
    }
    return { oid: String(oid), type, origin: "opus" };
  }
}

/** 评论区定位解析器：聚合策略集，按 input.kind 委派。 */
export class CommentSubjectResolver {
  private readonly strategies: Map<
    CommentInput["kind"],
    ICommentSubjectStrategy
  >;

  constructor(strategies?: ICommentSubjectStrategy[]) {
    const list = strategies ?? CommentSubjectResolver.defaultStrategies();
    this.strategies = new Map(list.map((s) => [s.kind, s]));
  }

  static defaultStrategies(): ICommentSubjectStrategy[] {
    return [
      new DirectSubjectStrategy(),
      new ArticleSubjectStrategy(),
      new VideoSubjectStrategy(),
      new OpusSubjectStrategy(),
    ];
  }

  async resolve(
    page: Page,
    input: CommentInput,
  ): Promise<BiliCommentSubject> {
    const strategy = this.strategies.get(input.kind);
    if (!strategy) {
      throw new UpstreamShapeChangedError(
        `未注册的评论区定位策略：${input.kind}`,
        { scope: SCOPE },
      );
    }
    return strategy.resolve(page, input);
  }
}
