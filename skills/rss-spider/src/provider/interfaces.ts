/**
 * Feed 来源层接口
 *
 * 策略模式：不同来源各自实现 IFeedProvider.fetch()，
 * 上层无需关心来源差异。
 */
import type { RssFeed, RssParams } from "@src/types";

/**
 * Feed 来源 — 策略接口
 */
export interface IFeedProvider {
  /** 来源类型标识 */
  readonly type: string;
  /** 实际请求的 URL（用于调试 / 日志） */
  readonly sourceUrl: string;
  /** 获取 Feed 数据 */
  fetch(): Promise<RssFeed>;
}

/**
 * Feed 来源工厂 — 将来源创建逻辑从 Skill 中分离
 */
export interface IFeedProviderFactory {
  /**
   * 根据参数创建对应的 FeedProvider
   * @throws Error 参数不合法时抛出异常
   */
  create(params: Record<string, unknown>): IFeedProvider;
}
