import type {
  BiliArticleContent,
  BiliArticleImage,
  BiliArticleParagraph,
} from "@src/types/article.types";

/**
 * 专栏正文 → Markdown 渲染（纯函数）。
 *
 * 布局：H1 标题 → 作者/发布时间行 → 按 paragraphs 顺序渲染。
 * 图片优先用本地相对路径（已下载），否则回退远程 URL，保证离线可读。
 * 链接卡默认跳过；includeLinkCards=true 时渲染为引用行。
 */

export interface RenderOptions {
  includeLinkCards: boolean;
}

export function renderArticleMarkdown(
  content: BiliArticleContent,
  options: RenderOptions,
): string {
  const lines: string[] = [];

  lines.push(`# ${content.title || "(无标题)"}`);
  lines.push("");

  const meta = buildMetaLine(content);
  if (meta) {
    lines.push(meta);
    lines.push("");
  }

  for (const para of content.paragraphs) {
    const block = renderParagraph(para, options);
    if (block === null) continue;
    lines.push(block);
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function buildMetaLine(content: BiliArticleContent): string | null {
  const parts: string[] = [];
  if (content.author.name) parts.push(`作者：${content.author.name}`);
  if (content.author.pubTime) parts.push(`发布：${content.author.pubTime}`);
  if (parts.length === 0) return null;
  return `> ${parts.join(" · ")}`;
}

function renderParagraph(
  para: BiliArticleParagraph,
  options: RenderOptions,
): string | null {
  switch (para.type) {
    case "text": {
      const text = (para.text ?? "").trim();
      return text ? text : null;
    }
    case "image":
      return renderImages(para.images ?? []);
    case "link_card":
      return options.includeLinkCards ? renderLinkCard(para) : null;
    case "unknown":
    default:
      return null;
  }
}

function renderImages(images: BiliArticleImage[]): string | null {
  const rendered = images
    .map((img) => {
      const src = img.localPath ?? img.url;
      if (!src) return null;
      const alt = (img.comment ?? "").replace(/[\[\]]/g, "");
      return `![${alt}](${src})`;
    })
    .filter((x): x is string => x !== null);
  return rendered.length > 0 ? rendered.join("\n\n") : null;
}

function renderLinkCard(para: BiliArticleParagraph): string | null {
  const card = para.card;
  if (!card) return null;
  const segs: string[] = [];
  if (card.title) segs.push(card.title);
  if (card.price) segs.push(card.price);
  if (card.jumpUrl) segs.push(card.jumpUrl);
  if (segs.length === 0) return null;
  const icon = card.kind === "LINK_CARD_TYPE_GOODS" ? "🛒 " : "🔗 ";
  return `> ${icon}${segs.join(" · ")}`;
}
