/**
 * Bilibili 专栏（opus 图文）提取类型
 *
 * 正文来自专栏详情页主文档内联的 `window.__INITIAL_STATE__.detail`（SSR），
 * 不走独立 JSON 接口，故无需 WBI / playurl。详见 docs/article-extract-analysis.md。
 */

export interface BiliArticleParams {
  // ── 入口（任一即可）──
  /** 专栏 URL：/opus/{opusId} 或 /read/cv{cvId} */
  url?: string;
  /** 旧版专栏 cv 号（纯数字或 cvXXXX） */
  cvId?: string;
  /** opus 主键（动态/图文数字串） */
  opusId?: string;
  /** 兼容简写：opus 数字串 / cvXXXX / 纯数字 */
  id?: string;

  // ── 输出控制 ──
  /** 是否下载配图并本地化引用，默认 true；false 时正文保留远程原图 URL */
  downloadImages?: boolean;
  /** 是否在 Markdown 渲染链接卡/商品卡，默认 false */
  includeLinkCards?: boolean;
  /** 输出目录；不传使用 storageRoot/bilibili */
  outputDir?: string;
  /** 单图下载超时（毫秒），默认 30000 */
  imageTimeoutMs?: number;
}

export interface BiliArticleImage {
  /** 原图远程 URL（已升级为 https） */
  url: string;
  /** 落盘后相对 outputDir 的本地路径；未下载或下载失败时为空 */
  localPath?: string;
  width?: number;
  height?: number;
  /** 图注，可空 */
  comment?: string;
  sizeBytes?: number;
}

export interface BiliArticleLinkCard {
  /** 原始 card.type，如 LINK_CARD_TYPE_GOODS */
  kind: string;
  title?: string;
  jumpUrl?: string;
  price?: string;
}

export interface BiliArticleParagraph {
  type: "text" | "image" | "link_card" | "unknown";
  /** type=text：所有 node 拼接后的纯文本 */
  text?: string;
  /** type=image：该段所有图片 */
  images?: BiliArticleImage[];
  /** type=link_card：链接卡摘要 */
  card?: BiliArticleLinkCard;
  /** 原始 para_type，便于诊断与未知类型回溯 */
  rawParaType: number;
}

export interface BiliArticleStat {
  like?: number;
  coin?: number;
  favorite?: number;
  forward?: number;
  comment?: number;
}

/** parseOpusInitialState 的纯解析输出（无副作用） */
export interface BiliArticleContent {
  /** detail.id_str —— opus 主键 */
  opusId: string;
  /** detail.basic.comment_id_str —— 旧版 cv 号；现代图文可能为空 */
  cvId: string | null;
  /** detail.basic.article_type */
  articleType: number | null;
  title: string;
  author: {
    mid: number | null;
    name: string | null;
    pubTime: string | null;
  };
  stat: BiliArticleStat;
  paragraphs: BiliArticleParagraph[];
  /** 解析过程中遇到的未知 para_type / node 类型告警 */
  warnings: string[];
}

/** fetchData 的输出（含落盘副作用产物） */
export interface BiliArticleExtractResult {
  source: { mode: "direct"; input: string };
  content: BiliArticleContent;
  /** 落盘文件（相对 outputDir） */
  files: {
    markdown: string;
    meta: string;
    images: string[];
  };
  outputDir: string;
}

export type { BiliArticleExtractAiReady } from "@src/projections/article-extract.ai-ready";
import type { BiliArticleExtractAiReady as _AiReady } from "@src/projections/article-extract.ai-ready";

/** 对外投影 = AI-Ready 信封（meta + insights + content） */
export type BiliArticleProjected = _AiReady;
