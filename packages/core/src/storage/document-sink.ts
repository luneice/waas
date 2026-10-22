// ============================================================================
// DocumentArtifactSink — 文档产物装饰器（布局 + 边车一体）
// ============================================================================
//
// 包装任意 IArtifactSink，为「文档类」产物提供高层入口 writeDocument：
//   ① LayoutStrategy 决定主文件放哪（随数据源）
//   ② inner.write 落盘（继承冲突策略 / 事件 emit / 路径解析）
//   ③ SidecarStrategy 决定边车格式并紧挨主文件落盘（随下游）
//
// 三个变化维度（布局 / 边车 / 溯源事实）彼此正交，且全部在 core 之外可替换。
// 非文档产物（图片 / 字幕等）仍走底层 write，不受影响。
// ============================================================================

import { createHash } from "crypto";
import type {
  IArtifactSink,
  Artifact,
  ArtifactMeta,
  DocumentProvenance,
  LayoutStrategy,
  SidecarStrategy,
} from "./interfaces";
import { currentTraceFrame } from "../observability/trace-context";

export interface WriteDocumentInput {
  /** 语义 slug（如清洗前的标题）；最终路径由 LayoutStrategy 决定 */
  slug: string;
  role: string;
  contentType: string;
  data: string | Buffer;
  provenance?: DocumentProvenance;
  /** 源 id（由拥有该源的 skill 用常量传入） */
  sourceId?: string;
  /** 下载直链（若与详情页 URL 不同）；供边车 uri 回退 */
  sourceUrl?: string;
}

export class DocumentArtifactSink implements IArtifactSink {
  constructor(
    private readonly inner: IArtifactSink,
    private readonly layout: LayoutStrategy,
    private readonly sidecar?: SidecarStrategy,
  ) {}

  /** 透传底层 write，供非文档产物（图片 / 字幕）使用。 */
  write(
    key: string,
    data: Buffer | string,
    meta: ArtifactMeta,
  ): Promise<Artifact> {
    return this.inner.write(key, data, meta);
  }

  /** 文档类高层入口：布局 → 落盘 → 边车。 */
  async writeDocument(input: WriteDocumentInput): Promise<Artifact> {
    const key = this.layout.resolve({
      slug: input.slug,
      role: input.role,
      contentType: input.contentType,
      provenance: input.provenance,
      sourceId: input.sourceId,
    });

    // collectedAt 缺省时补落盘当下（带本地时区偏移）
    const provenance: DocumentProvenance | undefined = input.provenance
      ? {
          ...input.provenance,
          collectedAt: input.provenance.collectedAt ?? nowWithOffset(),
        }
      : undefined;

    const artifact = await this.inner.write(key, input.data, {
      role: input.role,
      contentType: input.contentType,
      sourceUrl: input.sourceUrl ?? provenance?.documentUrl,
      provenance,
    });

    if (this.sidecar && provenance) {
      const contentSha256 =
        artifact.contentSha256 ?? sha256Of(input.data);
      const plan = this.sidecar.plan({
        payloadPath: artifact.path,
        role: artifact.role,
        contentType: artifact.contentType,
        sizeBytes: artifact.sizeBytes,
        contentSha256,
        provenance,
        sourceUrl: input.sourceUrl ?? provenance.documentUrl,
        traceId: currentTraceFrame()?.traceId,
      });
      if (plan) {
        await this.inner.write(plan.key, plan.data, {
          role: "sidecar",
          contentType: plan.contentType ?? "application/json",
        });
      }
    }

    return artifact;
  }
}

function sha256Of(data: string | Buffer): string {
  const buf = typeof data === "string" ? Buffer.from(data, "utf-8") : data;
  return createHash("sha256").update(buf).digest("hex");
}

/** 当前时刻 ISO 8601，带本地时区偏移（非 UTC 的 Z 形态）。 */
function nowWithOffset(d: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const abs = Math.abs(off);
  const oh = pad(Math.floor(abs / 60));
  const om = pad(abs % 60);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${oh}:${om}`
  );
}
