/**
 * 评论 → Markdown 渲染（纯函数）。
 *
 * 布局：H1 概览 → 置顶评论区 → 主楼列表。每条评论渲染作者/IP 属地/点赞/时间元行、
 * 文字正文、配图（优先本地相对路径，回退远程 URL），楼中楼以缩进引用块呈现。
 */
import type {
  BiliCommentItem,
  BiliCommentsResult,
} from "@src/types/comment.types";

function formatTime(ts: number): string {
  if (!ts) return "";
  return new Date(ts * 1000).toISOString().replace("T", " ").slice(0, 19);
}

function renderImages(item: BiliCommentItem, indent: string): string[] {
  return item.images
    .map((img) => {
      const src = img.localPath ?? img.url;
      return src ? `${indent}![评论配图](${src})` : null;
    })
    .filter((x): x is string => x !== null);
}

function renderMetaLine(item: BiliCommentItem): string {
  const parts: string[] = [];
  if (item.user.name) parts.push(`**${item.user.name}**`);
  if (item.location) parts.push(`IP属地 ${item.location}`);
  parts.push(`👍 ${item.like}`);
  const time = formatTime(item.publishedAt);
  if (time) parts.push(time);
  return parts.join(" · ");
}

function renderItem(item: BiliCommentItem, lines: string[], depth: number): void {
  if (depth === 0) {
    lines.push(`### ${renderMetaLine(item)}`);
    lines.push("");
    if (item.message.trim()) {
      lines.push(item.message.trim());
      lines.push("");
    }
    const imgs = renderImages(item, "");
    if (imgs.length) {
      lines.push(imgs.join("\n\n"));
      lines.push("");
    }
    if (item.replies.length) {
      for (const child of item.replies) renderItem(child, lines, depth + 1);
      lines.push("");
    }
  } else {
    lines.push(`> ${renderMetaLine(item)}`);
    if (item.message.trim()) {
      lines.push(`> ${item.message.trim().replace(/\n/g, "\n> ")}`);
    }
    const imgs = renderImages(item, "> ");
    for (const img of imgs) lines.push(img);
    lines.push(">");
  }
}

export function renderCommentsMarkdown(result: BiliCommentsResult): string {
  const lines: string[] = [];
  const { source, meta } = result;

  lines.push(`# Bilibili 评论（${source.origin} · oid=${source.oid} type=${source.type}）`);
  lines.push("");
  const overview: string[] = [];
  if (meta.total !== null) overview.push(`评论总数 ${meta.total}`);
  overview.push(`抓取 ${result.returnedCount} 条`);
  overview.push(`${result.pagesFetched} 页`);
  overview.push(`排序 ${source.mode === 2 ? "时间" : "热度"}`);
  lines.push(`> ${overview.join(" · ")}`);
  lines.push("");

  if (result.topItems.length) {
    lines.push("## 置顶评论");
    lines.push("");
    for (const item of result.topItems) renderItem(item, lines, 0);
  }

  lines.push("## 评论");
  lines.push("");
  for (const item of result.items) renderItem(item, lines, 0);

  return `${lines.join("\n").trimEnd()}\n`;
}
