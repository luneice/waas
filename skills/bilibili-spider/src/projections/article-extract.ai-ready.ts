import {
  isoTime,
  type BiliContentEnvelope,
} from "@src/projections/envelope";
import type {
  BiliArticleExtractResult,
  BiliArticleLinkCard,
  BiliArticleParagraph,
  BiliArticleStat,
} from "@src/types/article.types";

/**
 * 专栏提取 AI-ready 投影。
 * 仅做信封封装；落盘副作用在 Skill.fetchData 内完成。
 */

/** 投影后的段落 —— 图片统一给 `src`（本地化后指向落盘文件，否则回退远程 URL） */
export type BiliArticleParagraphProjected =
  | { type: "text"; text: string }
  | {
      type: "image";
      images: {
        src: string;
        remoteUrl: string;
        localized: boolean;
        comment: string | null;
        width: number | null;
        height: number | null;
      }[];
    }
  | { type: "link_card"; card: BiliArticleLinkCard | null }
  | { type: "unknown"; rawParaType: number };

export type BiliArticleExtractAiReady = BiliContentEnvelope<
  BiliArticleParagraphProjected[],
  {
    source: BiliArticleExtractResult["source"];
    opusId: string;
    cvId: string | null;
    articleType: number | null;
    title: string;
    author: { mid: number | null; name: string | null; pubTime: string | null };
    stat: BiliArticleStat;
    outputDir: string;
    files: BiliArticleExtractResult["files"];
    paragraphs: { total: number; text: number; image: number; linkCard: number; unknown: number };
    warnings: string[];
  }
>;

export function projectBiliArticleExtractAiReady(
  data: BiliArticleExtractResult,
): BiliArticleExtractAiReady {
  const { content } = data;
  const counts = countParagraphs(content.paragraphs);

  return {
    meta: {
      skill: "bili-article",
      semantics: `Bilibili 专栏图文提取：「${content.title}」`,
      source: data.source,
      opusId: content.opusId,
      cvId: content.cvId,
      articleType: content.articleType,
      title: content.title,
      author: content.author,
      stat: content.stat,
      outputDir: data.outputDir,
      files: data.files,
      paragraphs: counts,
      warnings: content.warnings,
      crawledAt: isoTime(undefined),
    },
    insights: buildInsights(data, counts),
    content: content.paragraphs.map(projectParagraph),
  };
}

function projectParagraph(
  para: BiliArticleParagraph,
): BiliArticleParagraphProjected {
  switch (para.type) {
    case "text":
      return { type: "text", text: para.text ?? "" };
    case "image":
      return {
        type: "image",
        images: (para.images ?? []).map((img) => ({
          src: img.localPath ?? img.url,
          remoteUrl: img.url,
          localized: Boolean(img.localPath),
          comment: img.comment ?? null,
          width: img.width ?? null,
          height: img.height ?? null,
        })),
      };
    case "link_card":
      return {
        type: "link_card",
        card: para.card ?? null,
      };
    case "unknown":
    default:
      return { type: "unknown", rawParaType: para.rawParaType };
  }
}

function countParagraphs(paragraphs: BiliArticleParagraph[]) {
  const counts = { total: paragraphs.length, text: 0, image: 0, linkCard: 0, unknown: 0 };
  for (const p of paragraphs) {
    if (p.type === "text") counts.text++;
    else if (p.type === "image") counts.image++;
    else if (p.type === "link_card") counts.linkCard++;
    else counts.unknown++;
  }
  return counts;
}

function buildInsights(
  data: BiliArticleExtractResult,
  counts: ReturnType<typeof countParagraphs>,
): string[] {
  const { content } = data;
  const out: string[] = [];
  out.push(
    `专栏「${content.title}」提取完成：${counts.total} 段（文字 ${counts.text} / 图片 ${counts.image} / 链接卡 ${counts.linkCard}）。`,
  );
  const imageCount = data.files.images.length;
  if (imageCount > 0) {
    out.push(`下载并本地化配图 ${imageCount} 张。`);
  } else if (counts.image > 0) {
    out.push("正文含配图，但本次未下载（downloadImages=false 或下载失败），正文保留远程 URL。");
  }
  if (content.warnings.length > 0) {
    out.push(`解析告警 ${content.warnings.length} 条（未知段落/节点类型已降级保留）。`);
  }
  if (!content.cvId) {
    out.push("该专栏无 cv 号（纯 opus 图文）。");
  }
  return out;
}
