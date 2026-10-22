/**
 * Bilibili thrall 公共层 — 统一所有 Goal 的默认执行参数与公共构造。
 *
 * 对齐 xhs-spider/src/thrall/shared.ts：所有 Bilibili Goal 的 retry / interval /
 * concurrency / timeout 口径集中在此，避免每个 Goal 重复声明 defaults。
 */
import type { GoalContext } from "@spider/core";

export { BILIBILI_API_BASE, BILIBILI_SITE, BILIBILI_WWW } from "@src/constants";

/** 所有 Bilibili Goal 的默认执行参数（防风控：串行 + 间隔）。 */
export const BILI_GOAL_DEFAULTS = {
  retry: { count: 3, delay: 1000 },
  interval: 1000,
  concurrency: 1,
  timeout: 30000,
} as const;

/**
 * B 站 WebGL 环境指纹占位参数（dm_*）。
 *
 * `/x/space/wbi/arc/search` 等强风控接口缺这组参数会返回 code=-352「风控校验失败」。
 * 它们是浏览器 WebGL 渲染器信息的 base64 占位值，需与其它查询参数一起参与 WBI 签名。
 * 取值对齐社区成熟实现（Bili23-Downloader / downkyicore）的固定占位。
 */
export const BILI_DM_FINGERPRINT = {
  dm_img_list: "[]",
  dm_img_str: "V2ViR0wgMS4wIChPcGVuR0wgRVMgMi4wIENocm9taXVtKQ",
  dm_cover_img_str:
    "QU5HTEUgKE5WSURJQSwgTlZJRElBIEdlRm9yY2UgUlRYIDQwNjAgTGFwdG9wIEdQVSAoMHgwMDAwMjhFMCkgRGlyZWN0M0QxMSB2c181XzAgcHNfNV8wLCBEM0QxMSlHb29nbGUgSW5jLiAoTlZJRElBKQ",
  dm_img_inter: '{"ds":[],"wh":[3688,4546,12],"of":[119,238,119]}',
} as const;

/** 宽松转数字：非有限值（NaN/Infinity/null/undefined/非数字串）一律归 0。 */
export function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** 读取 ctx.params.mid 并归一为字符串（空值 → ""）。 */
export function midOf(ctx: GoalContext): string {
  return String(ctx.params.mid ?? "");
}

/** 读取 ctx.params 上某个键并归一为字符串（空值 → fallback）。 */
export function paramStr(ctx: GoalContext, key: string, fallback = ""): string {
  return String(ctx.params[key] ?? fallback);
}

/**
 * 按主键去重：保序累积、跳过重复主键，并统计重复数。
 *
 * @param items   待去重项
 * @param keyOf   主键选择器；返回 falsy（0/""/null/undefined）的项视为「无主键」直接保留
 */
export function dedupeBy<T, K>(
  items: Iterable<T>,
  keyOf: (item: T) => K,
): { items: T[]; duplicates: number } {
  const seen = new Set<K>();
  const out: T[] = [];
  let duplicates = 0;
  for (const item of items) {
    const key = keyOf(item);
    if (key) {
      if (seen.has(key)) {
        duplicates += 1;
        continue;
      }
      seen.add(key);
    }
    out.push(item);
  }
  return { items: out, duplicates };
}
