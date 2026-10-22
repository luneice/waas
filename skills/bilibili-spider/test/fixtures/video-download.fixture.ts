/**
 * bili-video 投影 fixture —— 全 mock 数据（脱敏）。
 *
 * 覆盖点（totalBytes 双计回归的核心场景）：
 *   - P1 合并成功：merged 条目**同时**位于 files[]（与 download.skill.ts 的
 *     真实装配一致，page.merged 只是便捷引用）+ 保留分片 + 1 条字幕；
 *   - P2 无可用流（付费墙）：仅字幕。
 * 期望汇总：mediaCount=2（分片）、mergedCount=1、subtitleCount=2、
 *          totalBytes=5000+3000+1000+500+300=9800（每文件恰好一次）。
 */
import type {
  BiliDownloadedFile,
  BiliVideoDownloadResult,
} from "@src/types/video.types";

const P1_MERGED: BiliDownloadedFile = {
  role: "merged",
  path: "video/mock-P1.mp4",
  absolutePath: "/tmp/mock-store/video/mock-P1.mp4",
  sizeBytes: 5000,
  contentType: "video/mp4",
  sha256: "mock-sha-merged",
};

export const videoDownloadFixture: BiliVideoDownloadResult = {
  source: { mode: "direct", input: "MOCKBV0000001" },
  video: {
    aid: 111111,
    bvid: "MOCKBV0000001",
    url: "https://example.invalid/video/MOCKBV0000001",
    title: "测试视频甲",
    desc: null,
    pic: null,
    owner: { mid: 10001, name: "测试作者甲", face: null },
    pages: [
      { cid: 201, page: 1, part: "P1 测试", duration: 300 },
      { cid: 202, page: 2, part: "P2 测试", duration: 150 },
    ],
  },
  requested: {
    qn: 80,
    preferCodec: "avc",
    partMode: "all",
    download: true,
    subtitle: true,
    merge: true,
  },
  pages: [
    {
      page: { cid: 201, page: 1, part: "P1 测试", duration: 300 },
      playUrl: {
        quality: 80,
        acceptQuality: [80, 64],
        acceptDescription: ["高清 1080P", "高清 720P"],
        timelength: 300000,
      },
      selected: {
        video: {
          role: "video",
          id: 80,
          url: "https://example.invalid/stream/v.m4s",
          backupUrls: [],
          bandwidth: 1_500_000,
          mimeType: "video/mp4",
          codecs: "avc1.640028",
          width: 1920,
          height: 1080,
          frameRate: "30",
          codecid: 7,
        },
        audio: {
          role: "audio",
          id: 30280,
          url: "https://example.invalid/stream/a.m4s",
          backupUrls: [],
          bandwidth: 192_000,
          mimeType: "audio/mp4",
          codecs: "mp4a.40.2",
        },
      },
      streamUnavailable: null,
      files: [
        P1_MERGED,
        {
          role: "video",
          path: "video/mock-P1-video.m4s",
          absolutePath: "/tmp/mock-store/video/mock-P1-video.m4s",
          sizeBytes: 3000,
          contentType: "video/mp4",
          sha256: "mock-sha-video",
        },
        {
          role: "audio",
          path: "video/mock-P1-audio.m4s",
          absolutePath: "/tmp/mock-store/video/mock-P1-audio.m4s",
          sizeBytes: 1000,
          contentType: "audio/mp4",
          sha256: "mock-sha-audio",
        },
      ],
      merged: P1_MERGED,
      subtitles: [
        {
          lan: "zh-CN",
          lanDoc: "中文（中国）",
          path: "video/mock-P1.zh-CN.json",
          absolutePath: "/tmp/mock-store/video/mock-P1.zh-CN.json",
          sizeBytes: 500,
          contentType: "application/json",
          sourceUrl: "https://example.invalid/subtitle/p1.json",
        },
      ],
    },
    {
      page: { cid: 202, page: 2, part: "P2 测试", duration: 150 },
      playUrl: {
        quality: null,
        acceptQuality: [],
        acceptDescription: [],
        timelength: 150000,
      },
      selected: { video: null, audio: null },
      streamUnavailable: "大会员专享，未购买",
      files: [],
      merged: null,
      subtitles: [
        {
          lan: "zh-CN",
          lanDoc: "中文（中国）",
          path: "video/mock-P2.zh-CN.json",
          absolutePath: "/tmp/mock-store/video/mock-P2.zh-CN.json",
          sizeBytes: 300,
          contentType: "application/json",
          sourceUrl: "https://example.invalid/subtitle/p2.json",
        },
      ],
    },
  ],
  outputDir: "/tmp/mock-store/video",
};
