import { mkdir, open, stat, unlink } from "node:fs/promises";
import { dirname, relative } from "node:path";
import { createHash } from "node:crypto";
import type { Page } from "puppeteer-core";
import { SpiderError } from "@spider/core";
import type { BiliDownloadedFile } from "@src/types/video.types";

export interface BrowserMediaDownloadRequest {
  role: "video" | "audio";
  urls: string[];
  outputPath: string;
  referer: string;
  chunkSizeBytes: number;
  timeoutMs: number;
}

interface BrowserRangeFetchResult {
  ok: boolean;
  status?: number;
  statusText?: string;
  contentRange?: string | null;
  contentLength?: string | null;
  contentType?: string | null;
  bodyBase64?: string;
  errorMessage?: string;
  errorName?: string;
}

export class BiliMediaDownloader {
  async download(
    page: Page,
    request: BrowserMediaDownloadRequest,
    rootDir: string,
  ): Promise<BiliDownloadedFile> {
    const errors: string[] = [];
    for (const url of request.urls.filter(Boolean)) {
      try {
        return await this.downloadFromUrl(page, { ...request, urls: [url] }, rootDir);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
        await unlink(request.outputPath).catch(() => undefined);
      }
    }

    throw new SpiderError({
      kind: "endpoint-http",
      message: `Bilibili ${request.role} 媒体下载失败，所有 CDN URL 都不可用`,
      scope: "bili-media-download",
      phase: "download",
      details: { role: request.role, attempts: errors },
    });
  }

  private async downloadFromUrl(
    page: Page,
    request: BrowserMediaDownloadRequest,
    rootDir: string,
  ): Promise<BiliDownloadedFile> {
    const sourceUrl = request.urls[0];
    await mkdir(dirname(request.outputPath), { recursive: true });
    const handle = await open(request.outputPath, "w");
    const hash = createHash("sha256");

    let totalSize: number | null = null;
    let offset = 0;
    let contentType = "application/octet-stream";
    // 页内 fetch 受跨域限制：bilivideo CDN 不返回 CORS 头，从 bilibili.com 上下文
    // 取流会抛 "Failed to fetch"。首个分片失败即切换到 Node 侧 Range 取流（带
    // Referer 过防盗链），后续分片沿用，保持分片流式落盘。
    let useNode = false;

    try {
      while (true) {
        const end = offset + request.chunkSizeBytes - 1;
        const range = `bytes=${offset}-${end}`;
        let fetched = useNode
          ? await fetchRangeInNode({
              url: sourceUrl,
              referer: request.referer,
              range,
              timeoutMs: request.timeoutMs,
            })
          : await fetchRangeInBrowser(page, {
              url: sourceUrl,
              referer: request.referer,
              range,
              timeoutMs: request.timeoutMs,
            });

        // 浏览器侧因 CORS 失败：切到 Node 侧重试同一分片
        if (!fetched.ok && !useNode && fetched.errorName !== "AbortError") {
          useNode = true;
          fetched = await fetchRangeInNode({
            url: sourceUrl,
            referer: request.referer,
            range,
            timeoutMs: request.timeoutMs,
          });
        }

        if (!fetched.ok) {
          throw new SpiderError({
            kind: fetched.errorName === "AbortError" ? "endpoint-timeout" : "endpoint-http",
            message: `媒体分片请求失败: ${fetched.status ?? ""} ${fetched.statusText ?? fetched.errorMessage ?? ""}`.trim(),
            scope: "bili-media-download",
            phase: "download",
            details: {
              role: request.role,
              status: fetched.status,
              range: `bytes=${offset}-${end}`,
              url: sourceUrl,
            },
          });
        }

        contentType = fetched.contentType ?? contentType;
        const bytes = Buffer.from(fetched.bodyBase64 ?? "", "base64");
        if (bytes.length === 0) break;

        await handle.write(bytes);
        offset += bytes.length;
        hash.update(bytes);

        const parsed = parseContentRange(fetched.contentRange);
        if (parsed?.total) totalSize = parsed.total;
        if (!totalSize && fetched.status === 200) {
          totalSize = Number(fetched.contentLength ?? bytes.length);
        }

        if (totalSize && offset >= totalSize) break;
        if (fetched.status === 200) break;
        if (!parsed?.total && bytes.length < request.chunkSizeBytes) break;
      }
    } finally {
      await handle.close();
    }

    const file = await stat(request.outputPath);
    if (totalSize && file.size !== totalSize) {
      throw new SpiderError({
        kind: "endpoint-http",
        message: `媒体文件大小校验失败: expected=${totalSize} actual=${file.size}`,
        scope: "bili-media-download",
        phase: "download",
        details: { role: request.role, path: request.outputPath },
      });
    }

    return {
      role: request.role,
      path: relative(rootDir, request.outputPath),
      absolutePath: request.outputPath,
      sizeBytes: file.size,
      contentType,
      sha256: hash.digest("hex"),
      sourceUrl,
    };
  }
}

async function fetchRangeInBrowser(
  page: Page,
  opts: {
    url: string;
    referer: string;
    range: string;
    timeoutMs: number;
  },
): Promise<BrowserRangeFetchResult> {
  return page.evaluate(
    async (raw): Promise<BrowserRangeFetchResult> => {
      const options = raw as {
        url: string;
        referer: string;
        range: string;
        timeoutMs: number;
      };
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs);
      try {
        const response = await fetch(options.url, {
          method: "GET",
          credentials: "include",
          referrer: options.referer,
          referrerPolicy: "strict-origin-when-cross-origin",
          headers: {
            Range: options.range,
            Accept: "*/*",
          },
          signal: controller.signal,
        });
        if (!response.ok && response.status !== 206) {
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
          contentRange: response.headers.get("content-range"),
          contentLength: response.headers.get("content-length"),
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
    },
    opts,
  );
}

/**
 * Node 侧 Range 取流（绕过浏览器 CORS）。bilivideo CDN 仅校验 Referer 防盗链，
 * 无需登录态 Cookie；保持分片 Range 语义以兼容上层流式落盘循环。
 */
async function fetchRangeInNode(opts: {
  url: string;
  referer: string;
  range: string;
  timeoutMs: number;
}): Promise<BrowserRangeFetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const response = await fetch(opts.url, {
      method: "GET",
      headers: {
        Range: opts.range,
        Accept: "*/*",
        Referer: opts.referer,
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
      signal: controller.signal,
    });
    if (!response.ok && response.status !== 206) {
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
      contentRange: response.headers.get("content-range"),
      contentLength: response.headers.get("content-length"),
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

function parseContentRange(
  value: string | null | undefined,
): { start: number; end: number; total: number | null } | null {
  if (!value) return null;
  const match = value.match(/bytes\s+(\d+)-(\d+)\/(\d+|\*)/i);
  if (!match) return null;
  return {
    start: Number(match[1]),
    end: Number(match[2]),
    total: match[3] === "*" ? null : Number(match[3]),
  };
}
