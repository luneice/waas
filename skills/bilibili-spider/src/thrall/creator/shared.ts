import { InvalidParamsError, UpstreamShapeChangedError } from "@spider/core";
import { extractWbiKey, type WbiKeys } from "@src/thrall/wbi";

/**
 * 创作者 thrall 公共层：mid 归一化 + WBI nav key 提取。
 *
 * 各创作者 Goal 的 retry/interval/concurrency 口径复用 BILI_GOAL_DEFAULTS
 * （见 src/thrall/shared.ts），本文件只承载入口/签名相关的共享逻辑。
 *
 * 注：fetchNav 端点未抽成基类——core 的 Goal 元数据沿原型链共享 store，
 * 子类 @Goal 会污染父类 store，故继承不可用；各 Goal 自行声明 fetchNav。
 */

interface WbiNavData {
  wbi_img?: { img_url?: string; sub_url?: string };
}

interface WbiNavResponse {
  data?: WbiNavData;
  code?: number;
  message?: string;
}

/**
 * 从 `/x/web-interface/nav` 响应提取 WBI imgKey/subKey。
 *
 * 与搜索 Goal 的 fetchNav 等价；登录态缺失时 nav 仍返回 wbi_img，可用于签名。
 */
export function extractWbiKeysFromNav(response: WbiNavResponse): WbiKeys {
  const imgUrl = response?.data?.wbi_img?.img_url;
  const subUrl = response?.data?.wbi_img?.sub_url;
  if (!imgUrl || !subUrl) {
    throw new UpstreamShapeChangedError(
      "Bilibili nav response missing data.wbi_img.{img_url,sub_url}",
      {
        scope: "bili-creator",
        details: { code: response?.code, message: response?.message },
      },
    );
  }
  return { imgKey: extractWbiKey(imgUrl), subKey: extractWbiKey(subUrl) };
}

/**
 * 把用户输入（主页 URL / `space.bilibili.com/{mid}` / 纯数字）归一为 mid 字符串。
 */
export function normalizeMid(input: unknown, scope: string): string {
  if (input === undefined || input === null || input === "") {
    throw new InvalidParamsError("mid 为必填参数", { scope });
  }
  const raw = String(input).trim();

  // 纯数字
  if (/^\d+$/.test(raw)) return raw;

  // URL 形式：取 space.bilibili.com/{mid} 路径首段数字
  const urlMatch = raw.match(/space\.bilibili\.com\/(\d+)/);
  if (urlMatch?.[1]) return urlMatch[1];

  // 兜底：任意位置的连续数字
  const numMatch = raw.match(/(\d{3,})/);
  if (numMatch?.[1]) return numMatch[1];

  throw new InvalidParamsError(`无法从输入解析 mid: ${raw}`, { scope });
}

/**
 * 由 page + maxPages 生成要抓取的页号数组（@Expanded 的 source）。
 * 与搜索 Goal 的 buildPageNumbers 等价。
 */
export function buildPageNumbers(params: {
  page?: unknown;
  maxPages?: unknown;
}): number[] {
  const start = Math.max(1, Math.floor(Number(params.page ?? 1)) || 1);
  const count = Math.max(1, Math.floor(Number(params.maxPages ?? 1)) || 1);
  return Array.from({ length: count }, (_, i) => start + i);
}
