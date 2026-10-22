import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import type { BrowserEndpoint } from "./interfaces";

/**
 * 浏览器端点配置加载
 *
 * 优先级（高 → 低）：
 * 1. 代码传入的 endpoints 参数
 * 2. 环境变量 BROWSER_ENDPOINTS（JSON 数组）
 * 3. 配置文件 browser-endpoints.json（当前目录或 __dirname 向上查找）
 * 4. 从 browserURL 生成单个 endpoint
 * 5. 兜底 [{ id: "local", url: "http://127.0.0.1:4444" }]
 */
export function loadBrowserEndpoints(options?: {
  endpoints?: BrowserEndpoint[];
  browserURL?: string;
}): BrowserEndpoint[] {
  // 1. 代码直接传入
  if (options?.endpoints?.length) {
    return validateEndpoints(options.endpoints);
  }

  // 2. 环境变量
  const envValue = process.env.BROWSER_ENDPOINTS?.trim();
  if (envValue) {
    try {
      const parsed = JSON.parse(envValue);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return validateEndpoints(parsed);
      }
    } catch {
      // 解析失败 — 忽略，走下一级
    }
  }

  // 3. 配置文件
  const configFile = findConfigFile("browser-endpoints.json");
  if (configFile) {
    try {
      const content = readFileSync(configFile, "utf-8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return validateEndpoints(parsed);
      }
    } catch {
      // 文件解析失败 — 忽略
    }
  }

  // 4. 从 browserURL 生成单个 endpoint
  if (options?.browserURL) {
    return [{ id: "default", url: options.browserURL }];
  }

  // 5. 兜底
  return [{ id: "local", url: "http://127.0.0.1:4444" }];
}

/** 验证并规范化端点配置 */
function validateEndpoints(raw: unknown[]): BrowserEndpoint[] {
  const endpoints: BrowserEndpoint[] = [];
  const ids = new Set<string>();

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const ep = item as Record<string, unknown>;

    const id = typeof ep.id === "string" ? ep.id.trim() : "";
    const url = typeof ep.url === "string" ? ep.url.trim() : "";
    if (!id || !url) continue;

    // 防止重复 ID
    if (ids.has(id)) continue;
    ids.add(id);

    // 验证 URL 格式
    try {
      new URL(url);
    } catch {
      continue;
    }

    endpoints.push({
      id,
      url,
      tags: Array.isArray(ep.tags)
        ? (ep.tags as unknown[]).filter(
            (t): t is string => typeof t === "string",
          )
        : undefined,
      maxConcurrency:
        typeof ep.maxConcurrency === "number" ? ep.maxConcurrency : undefined,
      healthCheckIntervalMs:
        typeof ep.healthCheckIntervalMs === "number"
          ? ep.healthCheckIntervalMs
          : undefined,
    });
  }

  return endpoints.length > 0
    ? endpoints
    : [{ id: "local", url: "http://127.0.0.1:4444" }];
}

/** 从 cwd 向上查找配置文件 */
function findConfigFile(filename: string): string | null {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    const candidate = resolve(dir, filename);
    if (existsSync(candidate)) return candidate;
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
