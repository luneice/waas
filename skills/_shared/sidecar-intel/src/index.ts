// ============================================================================
// @spider/sidecar-intel — intel 情报系统的边车（X.meta.json）策略
// ============================================================================
//
// 把 core 中立的 DocumentProvenance 映射为 intel「接入新数据」契约要求的
// 边车 JSON。intel 的字段名 / 后缀 / 封闭枚举全部封装在此——intel 契约变化
// 只改本包，不触 @spider/core，也不触任何 skill。
//
// 各 skill 的 registry 用自己的源常量装配本策略：
//   new IntelSidecarStrategy({ sourceId: "court", genre: "judicial" })
// ============================================================================

import type {
  SidecarStrategy,
  SidecarContext,
  SidecarPlan,
} from "@spider/core";

/** intel 封闭体裁枚举（domain/document.py）。 */
export type IntelGenre =
  | "disclosure"
  | "judicial"
  | "tender"
  | "official_media";

/** intel 当前只消费 text；pdf/structured 暂缓。 */
export type IntelPayloadFormat = "text";

export interface IntelSidecarConfig {
  /** intel 已注册源 id（config/sources.toml），须与投递顶层目录一致。 */
  sourceId: string;
  /** intel 封闭体裁枚举。 */
  genre: IntelGenre;
  /** 载荷形态，默认 "text"。 */
  payloadFormat?: IntelPayloadFormat;
  /** 边车文件后缀，默认 ".meta.json"（intel 约定）。 */
  suffix?: string;
}

/** intel 边车 JSON 形态（README「接入新数据」§场景 A）。 */
export interface IntelSidecar {
  source_id: string;
  published_time?: string;
  collected_at: string;
  genre: IntelGenre;
  payload_format: IntelPayloadFormat;
  uri?: string;
  /** 披露体裁强烈建议填（正文自指归一）；其他体裁可省。 */
  issuer_code?: string;
}

export class IntelSidecarStrategy implements SidecarStrategy {
  private readonly suffix: string;
  private readonly payloadFormat: IntelPayloadFormat;

  constructor(private readonly config: IntelSidecarConfig) {
    this.suffix = config.suffix ?? ".meta.json";
    this.payloadFormat = config.payloadFormat ?? "text";
  }

  plan(ctx: SidecarContext): SidecarPlan | null {
    const p = ctx.provenance;
    const sidecar: IntelSidecar = {
      source_id: this.config.sourceId,
      published_time: p.publishedAt,
      collected_at: p.collectedAt ?? "",
      genre: this.config.genre,
      payload_format: this.payloadFormat,
      uri: p.documentUrl ?? ctx.sourceUrl,
      issuer_code: p.issuer,
    };
    return {
      key: `${ctx.payloadPath}${this.suffix}`,
      data: JSON.stringify(
        pruneUndefined(sidecar as unknown as Record<string, unknown>),
        null,
        2,
      ),
      contentType: "application/json",
    };
  }
}

/** 移除 undefined 键，避免边车出现 "field": undefined 噪声。 */
function pruneUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}
