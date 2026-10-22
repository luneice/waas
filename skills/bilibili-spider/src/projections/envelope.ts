/**
 * bilibili-spider 通用 AI-Ready 信封
 *
 * 全包各模块的 `*.ai-ready.ts` 共用这三种信封形态，Agent 拿到任何 Skill 的
 * `.data` 都能用同一套读法：先读 `meta` + `insights` 压缩上下文，再按需下钻明细。
 *
 * body 字段名三选一（与 `claude/rules/bili-output-format.md` 对齐）：
 *   - `items`   列表型（搜索、投稿、动态、合集…）
 *   - `content` 提取型（专栏正文、视频分 P 产物）
 *   - `detail`  单对象（创作者名片）
 *
 * `units` 跟随本包既有写法放在 `meta` 内（见 search.ai-ready.ts），不与 meta 平级。
 */

export interface BiliEnvelopeMeta {
  /** 产出该信封的 skill-id */
  skill: string;
  /**
   * 这组数字的统计口径，一句中文说清。
   * Agent 回写给用户时只允许用这个口径，不得自造词 —— 所以必须由投影层给出。
   */
  semantics: string;
  /** 采集时间（ISO 8601） */
  crawledAt: string;
  /** 数值字段单位字典，如 `{ view: "次" }` */
  units?: Record<string, string>;
}

export interface BiliEnvelope<TMeta extends object = object> {
  meta: TMeta & BiliEnvelopeMeta;
  /** 中文要点数组，供 Agent 优先读取 */
  insights: string[];
}

/** 列表型信封 */
export type BiliListEnvelope<
  TItem,
  TMeta extends object = object,
> = BiliEnvelope<TMeta> & { items: TItem[] };

/** 提取型信封（正文 / 落盘产物） */
export type BiliContentEnvelope<
  TContent,
  TMeta extends object = object,
> = BiliEnvelope<TMeta> & { content: TContent };

/** 单对象信封 */
export type BiliDetailEnvelope<
  TDetail,
  TMeta extends object = object,
> = BiliEnvelope<TMeta> & { detail: TDetail };

// ============================================================================
// 格式化小工具 —— 仅供 insights 拼接使用
// ============================================================================

/** Date | string → ISO 8601 字符串 */
export function isoTime(value: Date | string | null | undefined): string {
  if (!value) return new Date().toISOString();
  return value instanceof Date ? value.toISOString() : String(value);
}

/** 大数分档：>= 1 亿走「亿」，>= 1 万走「万」，否则原值 */
export function wan(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 100_000_000) return `${(n / 100_000_000).toFixed(2)} 亿`;
  if (Math.abs(n) >= 10_000) return `${(n / 10_000).toFixed(1)} 万`;
  return String(n);
}

/** 秒 → `H:MM:SS` / `M:SS` */
export function hms(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return null;
  }
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (x: number) => String(x).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** 秒级时间戳 → ISO 8601；0 / 空值 → null */
export function fromUnix(ts: number | null | undefined): string | null {
  if (!ts || !Number.isFinite(ts)) return null;
  return new Date(ts * 1000).toISOString();
}
