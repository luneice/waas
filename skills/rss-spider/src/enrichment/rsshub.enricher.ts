/**
 * RSSHub Enricher — item 级策略 A
 *
 * 策略：Discovery 检测 item URL → 有匹配路由 → Runtime 获取结构化数据
 * 优先级高于浏览器提取（更快、更准确）。
 */
import type { IItemEnricher } from "./interfaces";
import type { IRsshubDiscovery, IRsshubRuntime } from "@src/rsshub/interfaces";
import type { Configuration } from "@src/config";
import type { RssItem } from "@src/types";

/** RsshubEnricher 依赖 */
export interface RsshubEnricherDeps {
  discovery: IRsshubDiscovery;
  runtime: IRsshubRuntime;
  config: Configuration;
}

export class RsshubEnricher implements IItemEnricher {
  private readonly discovery: IRsshubDiscovery;
  private readonly runtime: IRsshubRuntime;
  private readonly config: Configuration;

  constructor(deps: RsshubEnricherDeps) {
    this.discovery = deps.discovery;
    this.runtime = deps.runtime;
    this.config = deps.config;
  }

  async tryEnrich(item: RssItem): Promise<RssItem | null> {
    if (!item.link) return null;

    // 检测 URL 是否有对应的 RSSHub 路由
    const detections = this.discovery.detect(item.link);
    if (detections.length === 0 || detections[0].confidence < 0.7) {
      return null;
    }

    const route = detections[0].resolvedPath;
    const rssFeed = await this.runtime.fetchRoute(route);
    const minLength = this.config.minContentLength;

    // 在 RSSHub 返回的 feed 中匹配当前条目
    const matched = rssFeed.items.find(
      (fi) => fi.link === item.link || fi.title === item.title,
    );

    if (
      !matched?.description ||
      plainTextLength(matched.description) < minLength
    ) {
      return null;
    }

    return {
      ...item,
      title: matched.title || item.title,
      description: matched.description,
      author: matched.author || item.author,
      pubDate: matched.pubDate || item.pubDate,
    };
  }
}

function plainTextLength(content?: string): number {
  if (!content) return 0;
  return content
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim().length;
}
