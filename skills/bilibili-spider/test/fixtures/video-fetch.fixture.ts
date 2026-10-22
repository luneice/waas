/**
 * bili-video fixture —— L2 专用，上游原始响应 + 真实媒体字节。
 *
 * 与其它模块不同：本模块除了 JSON 端点响应（nav/view/playurl/subtitles），
 * 还涉及媒体分片下载与 ffmpeg 合并。fixture 提供：
 *   - `TEST_VIDEO_M4S_BASE64` / `TEST_AUDIO_M4S_BASE64`：用 ffmpeg 生成的
 *     真实最小 mp4 分片（64x64 5fps H.264 + 8kHz AAC 静音）。视频/音频下载走
 *     `page.evaluate` 内 fetch，由 `FakeUpstream.route()` 正常应答即可（见
 *     test/module/bili-video.test.ts），可用真实 ffmpeg 验证合并路径；
 *   - `stubSubtitleContentFetch()`：字幕正文下载（`downloadSubtitle`）用的是
 *     裸 Node `fetch`（不经浏览器上下文），`FakeUpstream` 拦截不到，须用
 *     `vi.stubGlobal("fetch", ...)` 桩替。
 *
 * 脱敏三律同 search-upstream.fixture.ts 文件头。
 */
export { biliOk, biliErr } from "./search-upstream.fixture";

/** ffmpeg 生成的最小 H.264 视频分片（64x64, 1s, 5fps）。 */
export const TEST_VIDEO_M4S_BASE64 =
  "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";

/** ffmpeg 生成的最小 AAC 音频分片（8kHz 静音，1s）。 */
export const TEST_AUDIO_M4S_BASE64 =
  "AAAAHGZ0eXBpc29tAAACAGlzb21pc28ybXA0MQAAAAhmcmVlAAAAPW1kYXTeAgBMYXZjNjIuMjguMTAyAAIwQA4BGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwAAAzNtb292AAAAbG12aGQAAAAAAAAAAAAAAAAAAAPoAAAD6AABAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAACXXRyYWsAAABcdGtoZAAAAAMAAAAAAAAAAAAAAAEAAAAAAAAD6AAAAAAAAAAAAAAAAQEAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAACRlZHRzAAAAHGVsc3QAAAAAAAAAAQAAA+gAAAQAAAEAAAAAAdVtZGlhAAAAIG1kaGQAAAAAAAAAAAAAAAAAAB9AAAAjQFXEAAAAAAAtaGRscgAAAAAAAAAAc291bgAAAAAAAAAAAAAAAFNvdW5kSGFuZGxlcgAAAAGAbWluZgAAABBzbWhkAAAAAAAAAAAAAAAkZGluZgAAABxkcmVmAAAAAAAAAAEAAAAMdXJsIAAAAAEAAAFEc3RibAAAAH5zdHNkAAAAAAAAAAEAAABubXA0YQAAAAAAAAABAAAAAAAAAAAAAQAQAAAAAB9AAAAAAAA2ZXNkcwAAAAADgICAJQABAASAgIAXQBUAAAAAALuAAAABdwWAgIAFFYhW5QAGgICAAQIAAAAUYnRydAAAAAAAALuAAAABdwAAACBzdHRzAAAAAAAAAAIAAAAIAAAEAAAAAAEAAANAAAAAHHN0c2MAAAAAAAAAAQAAAAEAAAAJAAAAAQAAADhzdHN6AAAAAAAAAAAAAAAJAAAAFQAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAAFHN0Y28AAAAAAAAAAQAAACwAAAAac2dwZAEAAAByb2xsAAAAAgAAAAH//wAAABxzYmdwAAAAAHJvbGwAAAABAAAACQAAAAEAAABidWR0YQAAAFptZXRhAAAAAAAAACFoZGxyAAAAAAAAAABtZGlyYXBwbAAAAAAAAAAAAAAAAC1pbHN0AAAAJal0b28AAAAdZGF0YQAAAAEAAAAATGF2ZjYyLjEyLjEwMg==";

// ============================================================================
// nav —— WBI 密钥来源
// ============================================================================

export const navFixture = {
  wbi_img: {
    img_url: "https://img.example.invalid/bfs/wbi/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png",
    sub_url: "https://img.example.invalid/bfs/wbi/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.png",
  },
};

export const navMissingWbiFixture = { isLogin: false };

// ============================================================================
// view —— /x/web-interface/view（视频基础信息 + 分 P 列表）
// ============================================================================

export const viewSinglePageFixture = {
  aid: 113000000000401,
  bvid: "BV1ff4y1f7f1",
  title: "测试视频甲",
  desc: "测试简介",
  pic: "//img.example.invalid/bfs/archive/mock-cover-401.jpg",
  owner: { mid: 546195, name: "测试UP主甲", face: "//img.example.invalid/bfs/face/mock-546195.jpg" },
  pages: [{ cid: 900000001, page: 1, part: "P1 正片", duration: 300 }],
};

export const viewTwoPagesFixture = {
  ...viewSinglePageFixture,
  pages: [
    { cid: 900000001, page: 1, part: "P1 正片", duration: 300 },
    { cid: 900000002, page: 2, part: "P2 花絮", duration: 120 },
  ],
};

/** 契约漂移：view 缺 aid/bvid */
export const viewMissingIdentityFixture = {
  title: "测试视频甲",
  owner: { mid: 546195, name: "测试UP主甲" },
  pages: [{ cid: 900000001, page: 1, part: "P1 正片", duration: 300 }],
};

/** 契约漂移：pages 缺 cid（归一化后过滤为空） */
export const viewMissingPagesFixture = {
  ...viewSinglePageFixture,
  pages: [{ page: 1, part: "P1 正片", duration: 300 }],
};

export const viewNotFoundFixture = { code: -404, message: "啥都木有" };

// ============================================================================
// playurl —— /x/player/wbi/playurl（DASH 流选择）
// ============================================================================

function dashVideoStream(o: { id: number; height: number; codecs: string; codecid: number; bandwidth: number }) {
  return {
    id: o.id,
    baseUrl: `https://cdn.example.invalid/video/mock-${o.id}.m4s`,
    backupUrl: [],
    bandwidth: o.bandwidth,
    mimeType: "video/mp4",
    codecs: o.codecs,
    width: Math.round((o.height * 16) / 9),
    height: o.height,
    frameRate: "30",
    codecid: o.codecid,
  };
}

function dashAudioStream(o: { id: number; bandwidth: number }) {
  return {
    id: o.id,
    baseUrl: `https://cdn.example.invalid/audio/mock-${o.id}.m4s`,
    backupUrl: [],
    bandwidth: o.bandwidth,
    mimeType: "audio/mp4",
    codecs: "mp4a.40.2",
  };
}

export const playUrlFixture = {
  quality: 80,
  format: "hdflv2",
  timelength: 300000,
  accept_quality: [80, 64, 32],
  accept_description: ["高清 1080P", "高清 720P", "清晰 480P"],
  dash: {
    duration: 300,
    video: [
      dashVideoStream({ id: 80, height: 1080, codecs: "avc1.640028", codecid: 7, bandwidth: 1_500_000 }),
      dashVideoStream({ id: 64, height: 720, codecs: "avc1.640028", codecid: 7, bandwidth: 800_000 }),
    ],
    audio: [dashAudioStream({ id: 30280, bandwidth: 192_000 })],
  },
};

/** 付费未购买：code=0 但 data 为空对象（无 dash） */
export const playUrlUnavailableFixture = {};

/** 契约漂移：code≠0（软失败，Goal 层退化为 streamUnavailable，不抛错） */
export const playUrlErrorCode = -404;

// ============================================================================
// player/wbi/v2 —— 字幕元信息（明文 subtitle_url）
// ============================================================================

export const subtitleV2Fixture = {
  subtitle: {
    subtitles: [
      {
        id_str: "1000001",
        lan: "ai-zh",
        lan_doc: "中文（自动生成）",
        subtitle_url: "//aisubtitle.example.invalid/bfs/ai_subtitle/prod/mock-sub-001.json",
        ai_type: 1,
        ai_status: 1,
        type: 1,
      },
    ],
  },
};

export const subtitleV2EmptyFixture = { subtitle: { subtitles: [] } };

/** 字幕 JSON 正文（Node 侧 fetch 拉取） */
export const subtitleContentFixture = {
  font_size: 0.4,
  font_color: "#FFFFFF",
  body: [{ from: 0, to: 3, content: "测试字幕内容" }],
};

// ============================================================================
// v2/subtitle/web/view —— 付费视频字幕回退（protobuf，无条件请求，仅 wbi/v2
// 为空时聚合层才采信其结果）。`responseType: "blob"` 时 executor 会自己把
// response body 再 base64 编码一次喂给 fetchSubtitlesV2(payload)，所以这里
// fixture 的 FakeUpstream body 必须是**原始 protobuf 字节**（binary 编码
// 字符串），不能预先 base64——否则相当于套了两层 base64。
// ============================================================================

/** 空 protobuf（无字幕，回退路径也拿不到），body 为空字符串。 */
export const subtitleWebViewEmptyBody = "";

/**
 * 付费视频字幕回退 protobuf 原始字节（FakeUpstream body，binary 编码字符串），
 * 手写 protobuf 编码构造：field1(data) → field3(item,repeated) →
 * {field2:id_str, field3:lan, field4:lan_doc, field5:混淆 subtitle_url}。
 * 混淆 URL 用与 subtitle-meta.ts 相同的 42 字节 XOR key 生成，真实路径为
 * `bfs/ai_subtitle/prod/mock_paid_subtitle_0001`，已用 parseSubtitleView 验证可正确解密还原。
 */
export const subtitleWebViewPaidBody = Buffer.from(
  "CvQBGvEBEgcyMDAwMDAxGgVhaS16aCIY5Lit5paH77yI6Ieq5Yqo55Sf5oiQ77yJKsQBLy9zdWJ0aXRsZS5iaWxpYmlsaS5jb20vJTExJTExJTExJTExJTAwJTBmJTFmJTQ2JTAzJTAwJTMzJTFhJTM2JTE3JTBhJTI1JTU1JTE0JTE2JTUxJTE2JTJjJTQ5JTE2JTZmJTRhJTE5JTBiJTU2JTJlJTJkJTEwJTEyJTAxJTNhJTFkJTEyJTQ4JTA3JTJjJTEzJTMyJTBlJTJmJTEzJTdhJTUyJTU4P2F1dGhfa2V5PW1vY2twYWlkYXV0aGtleTEyMw==",
  "base64",
).toString("binary");

/** 该 protobuf 解密后还原出的真实字幕 URL（供 stubSubtitleContentFetch 场景参考）。 */
export const PAID_SUBTITLE_REAL_URL =
  "https://aisubtitle.hdslb.com/bfs/ai_subtitle/prod/mock_paid_subtitle_0001?auth_key=mockpaidauthkey123";

// ============================================================================
// 字幕正文下载 —— Node 侧裸 fetch（downloadSubtitle 用 credentials 无关的直连 fetch）
// ============================================================================
//
// 与视频/音频分片下载不同：那两者走 page.evaluate（由 FakeUpstream 正常应答，
// 见 test/module/bili-video.test.ts 里的 route(VIDEO_STREAM_URL/AUDIO_STREAM_URL)）。
// 字幕正文下载（downloadSubtitle）与付费字幕 protobuf 解析后的二次下载都调用
// **裸 Node fetch**（不经浏览器上下文），FakeUpstream 拦截不到，须用
// `vi.stubGlobal("fetch", ...)` 桩替 —— 用例结束后必须 `vi.unstubAllGlobals()`。

/** 桩替 `global.fetch`：仅应答字幕正文下载请求（Node 侧裸 fetch）。 */
export function stubSubtitleContentFetch(opts?: {
  status?: number;
}): (url: string) => Promise<Response> {
  const status = opts?.status ?? 200;
  return async (): Promise<Response> => {
    if (status !== 200) {
      return fakeResponse(status, "Not Found", Buffer.from(""), "application/json");
    }
    return fakeResponse(
      200,
      "OK",
      Buffer.from(JSON.stringify(subtitleContentFixture), "utf-8"),
      "application/json",
    );
  };
}

function fakeResponse(status: number, statusText: string, body: Buffer, contentType: string): Response {
  const ab = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: {
      get: (k: string) => (k.toLowerCase() === "content-type" ? contentType : null),
    },
    arrayBuffer: async () => ab,
    text: async () => body.toString("utf-8"),
    json: async () => JSON.parse(body.toString("utf-8")),
  } as unknown as Response;
}
