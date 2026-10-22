// ============================================================================
// Artifact — 管道产物的统一抽象
// ============================================================================

export interface Artifact {
  /** 完整存储键（相对 sink 根目录） */
  path: string;
  /** 相对 artifactPrefix 的路径（供 Markdown 引用） */
  relativePath?: string;
  /** 语义角色 */
  role: string;
  /** MIME 类型 */
  contentType: string;
  /** 原始来源 URL */
  sourceUrl?: string;
  /** 大小（字节） */
  sizeBytes: number;
  /** 是否复用了已有同 key 的文件（dedupe 命中时为 true） */
  reused?: boolean;
  /** 落盘内容的 SHA256（十六进制）；便于装饰器复用，免二次哈希 */
  contentSha256?: string;
}

// ============================================================================
// DocumentProvenance — 文档溯源事实（纯语义，与边车/布局格式无关）
// ============================================================================
//
// 描述"这份文档是什么"，不描述"边车怎么写、文件放哪"。采集侧 skill 只需如实
// 填写事实；边车格式由 SidecarStrategy 决定，目录布局由 LayoutStrategy 决定。
// core 不认识任何具体下游（intel 等）或具体数据源。
// ============================================================================

export interface DocumentProvenance {
  /** 原始发布时刻。ISO 8601，应带时区偏移。 */
  publishedAt?: string;
  /** publishedAt 的精度。上游只给到天时填 "day"，知情而非静默。 */
  publishedAtPrecision?: "second" | "day";
  /** 采集时刻。ISO 8601 带时区；省略时装饰器用落盘当下补齐。 */
  collectedAt?: string;
  /** 发布主体标识（自由字符串，如证券代码）。 */
  issuer?: string;
  /** 详情页原始 URL（区别于下载直链 sourceUrl）。 */
  documentUrl?: string;
  /** 采集器可挂任意扩展事实，策略按需取用（仅放策略会消费的事实）。 */
  extra?: Record<string, unknown>;
}

export interface ArtifactMeta {
  role: string;
  contentType: string;
  sourceUrl?: string;
  /** 文档溯源事实。存在时装饰器据此产出边车。 */
  provenance?: DocumentProvenance;
}

// ============================================================================
// LayoutStrategy — 目录布局策略（随数据源而异，core 外可替换）
// ============================================================================

export interface LayoutRequest {
  /** skill 给的语义 slug（如清洗过的标题），策略可用可弃 */
  slug: string;
  role: string;
  contentType: string;
  provenance?: DocumentProvenance;
  /** 源 id（court/bid/…），布局分类的主维度；具体值由拥有该源的 skill 定义 */
  sourceId?: string;
}

export interface LayoutStrategy {
  /**
   * 计算主文件的存储 key（相对 sink 根）。
   * 可不含扩展名——sink 会依据 contentType 补齐。
   */
  resolve(req: LayoutRequest): string;
}

// ============================================================================
// SidecarStrategy — 边车策略（随下游而异，core 外可替换）
// ============================================================================

export interface SidecarContext {
  /** 主文件相对 sink 根的最终路径（rename 后的真实值） */
  payloadPath: string;
  role: string;
  contentType: string;
  sizeBytes: number;
  contentSha256: string;
  provenance: DocumentProvenance;
  /** 下载直链（若 skill 提供）；策略可用作 uri 回退 */
  sourceUrl?: string;
  /** obs 诊断指针，装饰器从 trace 上下文注入 */
  traceId?: string;
}

export interface SidecarPlan {
  /** 边车文件的存储 key（相对 sink 根）。策略决定后缀与命名。 */
  key: string;
  /** 边车内容。策略决定 schema / 字段名 / 格式。 */
  data: string | Buffer;
  /** 边车 MIME（默认 application/json）。 */
  contentType?: string;
}

export interface SidecarStrategy {
  /** 返回 null = 本文档不写边车（策略自行判断触发条件）。 */
  plan(ctx: SidecarContext): SidecarPlan | null;
}

/**
 * 写入冲突策略 — 同一 key 已经写过时如何处理。
 *
 * - "rename"（默认）：在 basename 后追加 `_<n>` 直到唯一。最稳妥。
 * - "overwrite"：直接覆盖旧文件。
 * - "skip"     ：保留旧文件，新数据丢弃，返回原 Artifact 并标记 reused。
 * - "error"    ：抛出 SpiderError(pipeline-error)。多 skill 写同目录时强一致。
 * - "dedupe"   ：内容哈希对比；同 key 同内容 → reuse；同 key 不同内容 → 等价于 rename。
 */
export type ArtifactConflictPolicy =
  | "rename"
  | "overwrite"
  | "skip"
  | "error"
  | "dedupe";

export interface IArtifactSink {
  /**
   * 持久化一个产物。
   *
   * 实现必须保证：
   *   - 同实例内对同一 key 多次写入按 conflictPolicy 决策
   *   - 返回的 Artifact.path 反映**实际落盘**的路径（rename 后会变化）
   */
  write(
    key: string,
    data: Buffer | string,
    meta: ArtifactMeta,
  ): Promise<Artifact>;
}
