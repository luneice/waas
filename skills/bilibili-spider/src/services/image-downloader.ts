import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, extname, join, relative } from "node:path";
import type { Page } from "puppeteer-core";
import { SpiderError } from "@spider/core";

/**
 * 专栏配图下载器 —— 浏览器页内 fetch（携带登录态 Cookie）一次性取整张图。
 *
 * 与视频分片下载（services/media-downloader.ts）不同：专栏图是 i0.hdslb.com
 * 这类公开静态资源，无签名、无短期有效期、体积小，无需 Range 分片。
 */

export interface ImageDownloadRequest {
  url: string;
  /** 落盘绝对路径所在目录（如 <articleDir>/images），文件名由 URL hash 决定 */
  imagesDir: string;
  referer: string;
  timeoutMs: number;
}

export interface DownloadedImage {
  /** 相对 rootDir 的路径，供 Markdown 与 Artifact 引用 */
  path: string;
  absolutePath: string;
  sizeBytes: number;
  contentType: string;
  sourceUrl: string;
}

/** 仅取字节，不落盘 —— 供内容湖 ingest 使用（内容寻址后再决定落盘位置）。 */
export interface ImageBytes {
  buffer: Buffer;
  contentType: string;
  /** 推断的扩展名（含点，如 ".jpg"），用于内容湖对象命名 */
  ext: string;
  sourceUrl: string;
}

interface BrowserFetchResult {
  ok: boolean;
  status?: number;
  statusText?: string;
  contentType?: string | null;
  bodyBase64?: string;
  errorName?: string;
  errorMessage?: string;
}

const CONTENT_TYPE_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/bmp": ".bmp",
  "image/svg+xml": ".svg",
};

export class BiliImageDownloader {
  async download(
    page: Page,
    request: ImageDownloadRequest,
    rootDir: string,
  ): Promise<DownloadedImage> {
    const { buffer, contentType, ext } = await this.downloadBytes(page, {
      url: request.url,
      referer: request.referer,
      timeoutMs: request.timeoutMs,
    });
    const fileName = buildFileName(request.url, contentType, ext);
    const absolutePath = join(request.imagesDir, fileName);

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, buffer);

    return {
      path: relative(rootDir, absolutePath),
      absolutePath,
      sizeBytes: buffer.length,
      contentType,
      sourceUrl: request.url,
    };
  }

  /** 取图字节但不落盘 —— 内容湖模式：先内容寻址入 objects，再在 view 建 symlink。 */
  async downloadBytes(
    page: Page,
    opts: { url: string; referer: string; timeoutMs: number },
  ): Promise<ImageBytes> {
    let fetched = await fetchImageInBrowser(page, {
      url: opts.url,
      referer: opts.referer,
      timeoutMs: opts.timeoutMs,
    });

    // 页内 fetch 受跨域限制：i0.hdslb.com 不返回 CORS 头，从 bilibili.com 上下文
    // 取图会抛 "Failed to fetch"（或 no-cors 不透明空响应）。配图为公开 CDN 资源，
    // 退化到 Node 侧 fetch（带 Referer）即可绕过 CORS。
    if (!fetched.ok && fetched.errorName !== "AbortError") {
      fetched = await fetchImageInNode({
        url: opts.url,
        referer: opts.referer,
        timeoutMs: opts.timeoutMs,
      });
    }

    if (!fetched.ok) {
      throw new SpiderError({
        kind: fetched.errorName === "AbortError" ? "endpoint-timeout" : "endpoint-http",
        message: `专栏配图下载失败: ${fetched.status ?? ""} ${
          fetched.statusText ?? fetched.errorMessage ?? ""
        }`.trim(),
        scope: "bili-image-download",
        phase: "download",
        details: { url: opts.url, status: fetched.status },
      });
    }

    const contentType = (fetched.contentType ?? "application/octet-stream")
      .split(";")[0]
      .trim()
      .toLowerCase();
    const buffer = Buffer.from(fetched.bodyBase64 ?? "", "base64");
    const ext = extFromUrl(opts.url) || CONTENT_TYPE_EXT[contentType] || ".img";
    return { buffer, contentType, ext, sourceUrl: opts.url };
  }
}

function buildFileName(url: string, contentType: string, knownExt?: string): string {
  const hash = createHash("sha256").update(url).digest("hex").slice(0, 16);
  const ext = knownExt || extFromUrl(url) || CONTENT_TYPE_EXT[contentType] || ".img";
  return `${hash}${ext}`;
}

/** 取 URL 路径末段的扩展名（去掉 @1192w 之类裁剪后缀）。 */
function extFromUrl(url: string): string {
  try {
    const pathname = new URL(toAbsolute(url)).pathname;
    const base = pathname.split("/").pop() ?? "";
    const clean = base.split("@")[0];
    const ext = extname(clean).toLowerCase();
    return /^\.[a-z0-9]{2,5}$/.test(ext) ? ext : "";
  } catch {
    return "";
  }
}

function toAbsolute(url: string): string {
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}

async function fetchImageInBrowser(
  page: Page,
  opts: { url: string; referer: string; timeoutMs: number },
): Promise<BrowserFetchResult> {
  return page.evaluate(async (raw): Promise<BrowserFetchResult> => {
    const options = raw as { url: string; referer: string; timeoutMs: number };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const response = await fetch(options.url, {
        method: "GET",
        credentials: "include",
        referrer: options.referer,
        referrerPolicy: "strict-origin-when-cross-origin",
        headers: { Accept: "image/*,*/*" },
        signal: controller.signal,
      });
      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          statusText: response.statusText,
        };
      }
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      const step = 0x8000;
      for (let i = 0; i < bytes.length; i += step) {
        binary += String.fromCharCode(...bytes.subarray(i, i + step));
      }
      return {
        ok: true,
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get("content-type"),
        bodyBase64: btoa(binary),
      };
    } catch (err) {
      const error = err as Error;
      return {
        ok: false,
        errorName: error.name,
        errorMessage: error.message || String(err),
      };
    } finally {
      clearTimeout(timer);
    }
  }, opts);
}

/**
 * Node 侧取图（绕过浏览器 CORS）。配图为 i0.hdslb.com 公开 CDN 资源，无需登录态，
 * 仅需携带 Referer 通过防盗链校验。
 */
async function fetchImageInNode(opts: {
  url: string;
  referer: string;
  timeoutMs: number;
}): Promise<BrowserFetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const response = await fetch(toAbsolute(opts.url), {
      method: "GET",
      headers: {
        Referer: opts.referer,
        Accept: "image/*,*/*",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        statusText: response.statusText,
      };
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    return {
      ok: true,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get("content-type"),
      bodyBase64: bytes.toString("base64"),
    };
  } catch (err) {
    const error = err as Error;
    return {
      ok: false,
      errorName: error.name,
      errorMessage: error.message || String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}
