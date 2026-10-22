/**
 * Goal: Bilibili 视频解析（view + playurl）
 *
 * 声明式合并原 info + playurl 两个 Goal，对齐 xhs-spider Goal 范式：
 *   - `@Endpoint fetchNav`                → WBI imgKey/subKey
 *   - `@Endpoint fetchView`               → /x/web-interface/view 取 cid / 分 P / 标题
 *   - `@Endpoint @Expanded fetchPlayUrls` → 按 part/partMode 选分 P，逐个签名请求 playurl
 *   - `@Aggregate aggregate`              → 每个分 P 选出 DASH video/audio 流
 *
 * 媒体落盘与 ffmpeg 合并属于副作用，不在 Goal 内完成 —— 由 BiliVideoDownloadSkill
 * 覆写 fetchData（混合模式）在解析结果之上执行。
 */
import {
  Aggregate,
  BaseGoal,
  Endpoint,
  Expanded,
  Goal,
  InvalidParamsError,
  UpstreamShapeChangedError,
  type GoalContext,
} from "@spider/core";
import { BILIBILI_API_BASE, BILIBILI_WWW } from "@src/constants";
import { BILI_GOAL_DEFAULTS } from "@src/thrall/shared";
import { extractWbiKey, signWbiParams, type WbiKeys } from "@src/thrall/wbi";
import {
  dashUnavailableReason,
  selectDashStreams,
  type CodecPreference,
} from "@src/thrall/video/stream-selection";
import {
  deobfuscateSubtitleUrl,
  parseSubtitleViewProtobuf,
} from "@src/thrall/video/subtitle-cipher";
import type { BiliApiResponse } from "@src/types/search.types";
import type {
  BiliPlayUrlData,
  BiliResolvedPage,
  BiliSubtitleMeta,
  BiliVideoInfoResult,
  BiliVideoOwner,
  BiliVideoPage,
  BiliVideoResolveResult,
} from "@src/types/video.types";

const DEFAULT_QN = 80;
const DEFAULT_FNVAL = 4048;

export interface BiliVideoGoalParams extends Record<string, unknown> {
  bvid?: string;
  aid?: number;
  part?: number;
  partMode?: "selected" | "all";
  qn?: number;
  fnval?: number;
  preferCodec?: CodecPreference;
}

interface RawBiliVideoInfo {
  aid?: number;
  bvid?: string;
  title?: string;
  desc?: string;
  pic?: string;
  owner?: { mid?: number; name?: string; face?: string };
  pages?: Array<{ cid?: number; page?: number; part?: string; duration?: number }>;
  [key: string]: unknown;
}

interface WbiNavData {
  wbi_img?: { img_url?: string; sub_url?: string };
}

/** @Expanded 单个 playurl 的方法体产物。 */
interface BiliRawPlayUrlPage {
  page: BiliVideoPage;
  /** playurl 数据；付费未购买 / 未转码完成时上游可能非 0 码或无 data，置 null。 */
  data: BiliPlayUrlData | null;
  /** data 为 null 时的上游说明，便于诊断。 */
  error: string | null;
}

/** @Expanded 单个分 P 字幕元数据的方法体产物。 */
interface BiliRawSubtitlePage {
  page: BiliVideoPage;
  subtitles: BiliSubtitleMeta[];
}

interface RawBiliSubtitleItem {
  id_str?: string;
  id?: number | string;
  lan?: string;
  lan_doc?: string;
  subtitle_url?: string;
  ai_type?: number;
  ai_status?: number;
  type?: number;
}

interface BiliPlayerV2Data {
  subtitle?: { subtitles?: RawBiliSubtitleItem[] };
}

/** 按 part / partMode 选择要解析的分 P。 */
export function selectPages(
  info: BiliVideoInfoResult,
  params: BiliVideoGoalParams,
): BiliVideoPage[] {
  if (params.partMode === "all") return info.pages;
  const part = Math.max(1, Math.floor(Number(params.part ?? 1)));
  const page = info.pages.find((p) => p.page === part) ?? info.pages[part - 1];
  if (!page) {
    throw new InvalidParamsError(
      `part=${part} 超出视频分 P 范围，当前共有 ${info.pages.length} P`,
      { scope: "bili-video-download", details: { part, pageCount: info.pages.length } },
    );
  }
  return [page];
}

@Goal({
  id: "bili-video-resolve",
  name: "Bilibili 视频解析",
  baseURL: BILIBILI_API_BASE,
  defaults: BILI_GOAL_DEFAULTS,
})
export class BiliVideoGoal extends BaseGoal<
  BiliVideoResolveResult,
  BiliVideoGoalParams
> {
  @Endpoint("/x/web-interface/nav", { method: "GET" })
  fetchNav(response: BiliApiResponse<WbiNavData>): WbiKeys {
    const imgUrl = response?.data?.wbi_img?.img_url;
    const subUrl = response?.data?.wbi_img?.sub_url;
    if (!imgUrl || !subUrl) {
      throw new UpstreamShapeChangedError(
        "Bilibili nav response missing data.wbi_img.{img_url,sub_url}",
        {
          scope: "bili-video-resolve",
          details: { code: response?.code, message: response?.message },
        },
      );
    }
    return { imgKey: extractWbiKey(imgUrl), subKey: extractWbiKey(subUrl) };
  }

  @Endpoint("/x/web-interface/view", {
    method: "GET",
    query: (ctx) => {
      const query: Record<string, unknown> = {};
      if (ctx.params.bvid) query.bvid = ctx.params.bvid;
      if (ctx.params.aid) query.aid = ctx.params.aid;
      return query;
    },
  })
  fetchView(response: BiliApiResponse<RawBiliVideoInfo>): BiliVideoInfoResult {
    if (response.code !== 0 || !response.data) {
      throw new UpstreamShapeChangedError(
        `Bilibili view API returned code=${response.code} message=${response.message ?? response.msg ?? ""}`,
        {
          scope: "bili-video-resolve",
          details: { code: response.code, message: response.message ?? response.msg },
        },
      );
    }
    const raw = response.data;
    const aid = Number(raw.aid ?? 0);
    const bvid = String(raw.bvid ?? "");
    if (!aid || !bvid) {
      throw new UpstreamShapeChangedError(
        "Bilibili view response missing aid/bvid",
        { scope: "bili-video-resolve", details: { aid, bvid } },
      );
    }
    const pages = normalizePages(raw.pages);
    if (pages.length === 0) {
      throw new UpstreamShapeChangedError(
        "Bilibili view response missing pages[].cid",
        { scope: "bili-video-resolve", details: { aid, bvid } },
      );
    }
    return {
      aid,
      bvid,
      url: `${BILIBILI_WWW}/video/${bvid}/`,
      title: String(raw.title ?? bvid),
      desc: typeof raw.desc === "string" ? raw.desc : null,
      pic: typeof raw.pic === "string" ? raw.pic : null,
      owner: normalizeOwner(raw.owner),
      pages,
      raw,
    };
  }

  @Endpoint("/x/player/wbi/playurl", {
    method: "GET",
    dependencies: ["fetchNav", "fetchView"],
  })
  @Expanded<BiliVideoPage, BiliRawPlayUrlPage>({
    dependencies: ["fetchNav", "fetchView"],
    source: (ctx) =>
      selectPages(
        ctx.get<BiliVideoInfoResult>("fetchView"),
        ctx.params as BiliVideoGoalParams,
      ),
    params: (videoPage, _index, ctx) => {
      const info = ctx.get<BiliVideoInfoResult>("fetchView");
      const params = ctx.params as BiliVideoGoalParams;
      return signWbiParams(
        {
          avid: info.aid,
          bvid: info.bvid,
          cid: videoPage.cid,
          qn: Number(params.qn ?? DEFAULT_QN),
          fnver: 0,
          fnval: Number(params.fnval ?? DEFAULT_FNVAL),
          fourk: 1,
          voice_balance: 1,
          gaia_source: "pre-load",
          isGaiaAvoided: true,
          web_location: 1315873,
          dm_img_list: "[]",
          dm_img_str: "",
          dm_cover_img_str: "",
          dm_img_inter: '{"ds":[],"wh":[0,0,0],"of":[0,0,0]}',
        },
        ctx.get<WbiKeys>("fetchNav"),
      );
    },
    concurrency: 1,
  })
  fetchPlayUrls(
    response: BiliApiResponse<BiliPlayUrlData>,
    sourcePage: BiliVideoPage,
  ): BiliRawPlayUrlPage {
    // 媒体流是可选产物：付费视频未购买、新稿未转码完成时上游可能返回非 0 码
    // 或缺 data。此处退化为 data=null，绝不抛错阻断字幕等其它增强数据的解析。
    if (response.code !== 0 || !response.data) {
      return {
        page: sourcePage,
        data: null,
        error: `playurl code=${response.code} message=${response.message ?? response.msg ?? ""}`.trim(),
      };
    }
    return { page: sourcePage, data: response.data, error: null };
  }

  @Endpoint("/x/player/wbi/v2", {
    method: "GET",
    dependencies: ["fetchNav", "fetchView"],
  })
  @Expanded<BiliVideoPage, BiliRawSubtitlePage>({
    dependencies: ["fetchNav", "fetchView"],
    source: (ctx) =>
      selectPages(
        ctx.get<BiliVideoInfoResult>("fetchView"),
        ctx.params as BiliVideoGoalParams,
      ),
    params: (videoPage, _index, ctx) => {
      const info = ctx.get<BiliVideoInfoResult>("fetchView");
      return signWbiParams(
        {
          aid: info.aid,
          cid: videoPage.cid,
          isGaiaAvoided: false,
          web_location: 1315873,
          dm_img_list: "[]",
          dm_img_str: "",
          dm_cover_img_str: "",
          dm_img_inter: '{"ds":[],"wh":[0,0,0],"of":[0,0,0]}',
        },
        ctx.get<WbiKeys>("fetchNav"),
      );
    },
    concurrency: 1,
  })
  fetchSubtitles(
    response: BiliApiResponse<BiliPlayerV2Data>,
    sourcePage: BiliVideoPage,
  ): BiliRawSubtitlePage {
    // 字幕是可选增强：接口异常或无字幕都退化为空列表，绝不阻断视频解析。
    if (response.code !== 0 || !response.data) {
      return { page: sourcePage, subtitles: [] };
    }
    return {
      page: sourcePage,
      subtitles: normalizeSubtitles(response.data.subtitle?.subtitles),
    };
  }

  @Endpoint("/x/v2/subtitle/web/view", {
    method: "GET",
    responseType: "blob",
    dependencies: ["fetchView"],
  })
  @Expanded<BiliVideoPage, BiliRawSubtitlePage>({
    dependencies: ["fetchView"],
    source: (ctx) =>
      selectPages(
        ctx.get<BiliVideoInfoResult>("fetchView"),
        ctx.params as BiliVideoGoalParams,
      ),
    params: (videoPage, _index, ctx) => {
      const info = ctx.get<BiliVideoInfoResult>("fetchView");
      // 无需 WBI 签名；oid=cid, pid=aid。
      return {
        oid: videoPage.cid,
        pid: info.aid,
        type: 1,
        cur_production_type: 0,
        preferred_language: "ai-zh",
        context_ext: '{"video_type":1}',
      };
    },
    concurrency: 1,
  })
  fetchSubtitlesV2(
    payload: string,
    sourcePage: BiliVideoPage,
  ): BiliRawSubtitlePage {
    // 付费/受限视频 fallback：protobuf（base64）+ 混淆 URL 解密。
    // best-effort：任一步失败都退化为空列表，绝不阻断视频解析。
    if (typeof payload !== "string" || !payload) {
      return { page: sourcePage, subtitles: [] };
    }
    const parsed = parseSubtitleViewProtobuf(payload);
    const subtitles: BiliSubtitleMeta[] = [];
    for (const item of parsed) {
      const url = deobfuscateSubtitleUrl(item.obfuscatedUrl);
      if (!url) continue;
      subtitles.push({
        id: item.idStr,
        lan: item.lan,
        lanDoc: item.lanDoc,
        url,
        aiType: item.lan.startsWith("ai-") ? 1 : null,
        aiStatus: null,
        type: null,
      });
    }
    return { page: sourcePage, subtitles };
  }

  @Aggregate()
  aggregate(ctx: GoalContext<BiliVideoGoalParams>): BiliVideoResolveResult {
    const info = ctx.get<BiliVideoInfoResult>("fetchView");
    const rawPages = ctx.get<BiliRawPlayUrlPage[]>("fetchPlayUrls");
    const rawSubtitles = ctx.get<BiliRawSubtitlePage[]>("fetchSubtitles");
    const rawSubtitlesV2 = ctx.get<BiliRawSubtitlePage[]>("fetchSubtitlesV2");
    const qn = Number(ctx.params.qn ?? DEFAULT_QN);
    const preferCodec = (ctx.params.preferCodec ?? "avc") as CodecPreference;

    const subtitlesByCid = new Map<number, BiliSubtitleMeta[]>();
    for (const entry of rawSubtitles) {
      subtitlesByCid.set(entry.page.cid, entry.subtitles);
    }
    // wbi/v2 为空时（典型为付费/受限视频）回退 subtitle/web/view 解密结果。
    for (const entry of rawSubtitlesV2) {
      const existing = subtitlesByCid.get(entry.page.cid);
      if ((!existing || existing.length === 0) && entry.subtitles.length > 0) {
        subtitlesByCid.set(entry.page.cid, entry.subtitles);
      }
    }

    const pages: BiliResolvedPage[] = rawPages.map(({ page, data, error }) => {
      const selected = data
        ? selectDashStreams(data, qn, preferCodec)
        : null;
      const streamUnavailable = selected
        ? null
        : error ?? dashUnavailableReason(data);
      return {
        page,
        playUrl: {
          quality: data?.quality ?? null,
          acceptQuality: (data?.accept_quality ?? []).map(Number),
          acceptDescription: (data?.accept_description ?? []).map(String),
          timelength:
            data?.timelength !== undefined ? Number(data.timelength) : null,
        },
        selected,
        streamUnavailable,
        subtitles: subtitlesByCid.get(page.cid) ?? [],
      };
    });

    return { video: info, pages };
  }
}

function normalizeOwner(raw: RawBiliVideoInfo["owner"]): BiliVideoOwner {
  return {
    mid: raw?.mid !== undefined ? Number(raw.mid) : null,
    name: raw?.name ? String(raw.name) : null,
    face: raw?.face ? String(raw.face) : null,
  };
}

function normalizePages(raw: RawBiliVideoInfo["pages"]): BiliVideoPage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p, index): BiliVideoPage | null => {
      const cid = Number(p.cid ?? 0);
      if (!cid) return null;
      return {
        cid,
        page: Number(p.page ?? index + 1),
        part: String(p.part ?? `P${index + 1}`),
        duration: p.duration !== undefined ? Number(p.duration) : null,
      };
    })
    .filter((p): p is BiliVideoPage => Boolean(p));
}

/** 规整字幕列表：补全协议、过滤无 URL 项；无字幕返回空数组。 */
function normalizeSubtitles(
  raw: RawBiliSubtitleItem[] | undefined,
): BiliSubtitleMeta[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): BiliSubtitleMeta | null => {
      const url = absolutizeUrl(item.subtitle_url);
      if (!url) return null;
      return {
        id: String(item.id_str ?? item.id ?? ""),
        lan: String(item.lan ?? "und"),
        lanDoc: String(item.lan_doc ?? item.lan ?? "字幕"),
        url,
        aiType: item.ai_type !== undefined ? Number(item.ai_type) : null,
        aiStatus: item.ai_status !== undefined ? Number(item.ai_status) : null,
        type: item.type !== undefined ? Number(item.type) : null,
      };
    })
    .filter((s): s is BiliSubtitleMeta => Boolean(s));
}

/** 字幕 URL 多为协议相对 //host/path，补 https。 */
function absolutizeUrl(url: string | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("http://")) return `https://${trimmed.slice("http://".length)}`;
  return trimmed;
}
