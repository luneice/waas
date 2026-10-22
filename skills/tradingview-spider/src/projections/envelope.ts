/**
 * tradingview-spider 通用 AI-Ready 信封
 *
 * 全包四个 Skill 共用这一种信封形态，Agent 拿到任何 Skill 的 `.data` 都能用同一套
 * 读法：先读 `meta` + `insights` 压缩上下文，再按需下钻 `items`。
 *
 * body 字段名统一为 `items` —— 四个 Skill 的输出都是「逐标的 / 逐行」的记录列表，
 * 保持 `jq '.data.items[]'` 在全包一致。`TvPayloadEnvelope` 为将来的多面板场景预留，
 * 首版未使用。
 *
 * `units` 跟随 bilibili-spider 的写法放在 `meta` 内，不与 meta 平级。
 */

export interface TvEnvelopeMeta {
  /** 产出该信封的 skill-id */
  skill: string;
  /**
   * 这组数字的统计口径，一句中文说清。
   * Agent 回写给用户时只允许用这个口径，不得自造词 —— 所以必须由投影层给出。
   */
  semantics: string;
  /** 采集时间（ISO 8601） */
  crawledAt: string;
  /** 数值字段单位字典，如 `{ changePercent: "%（原值）" }` */
  units?: Record<string, string>;
}

export interface TvEnvelope<TMeta extends object = object> {
  meta: TMeta & TvEnvelopeMeta;
  /** 中文要点数组，供 Agent 优先读取 */
  insights: string[];
}

/** 列表型信封（全包统一使用） */
export type TvListEnvelope<
  TItem,
  TMeta extends object = object,
> = TvEnvelope<TMeta> & {
  items: TItem[];
};

/** 多面板 / ID 产出型信封（首版未使用，为二期预留） */
export type TvPayloadEnvelope<
  TPayload,
  TMeta extends object = object,
> = TvEnvelope<TMeta> & { payload: TPayload };

/**
 * 传输层诊断信息（贴在 meta.transport）。
 *
 * ⚠️ 刻意**不含** WS 握手返回的 session_id —— 那个值会泄露上游基础设施拓扑
 * （机房/集群标识），只保留在运行期诊断对象里供排查，绝不进对外信封。
 */
export interface TvTransportMeta {
  /** 翻页 / 轮询轮数 */
  rounds: number;
  /** drain 调用次数 */
  drainCalls: number;
  /** 因缓冲上限被丢弃的帧数（>0 说明取数速度跟不上推送，需调大缓冲） */
  droppedFrames: number;
  /** 收到但未识别的协议消息名（协议漂移的早期信号） */
  unknownMessageKinds: string[];
}

// ============================================================================
// 格式化小工具 —— 仅供 insights 拼接与投影使用
// ============================================================================

/** Date | string → ISO 8601 字符串 */
export function isoTime(value: Date | string | null | undefined): string {
  if (!value) return new Date().toISOString();
  return value instanceof Date ? value.toISOString() : String(value);
}

/**
 * 秒级时间戳 → ISO 8601。
 *
 * ⚠️ 只把 `null` / `undefined` / `NaN` 视为空 —— **0 与负数都是合法时间**
 * （负数 = 1970 年之前，本站的长历史序列确实存在这类点）。用 `!ts` 判空是这里
 * 最容易犯的错。
 */
export function fromUnixSec(ts: number | null | undefined): string | null {
  if (ts === null || ts === undefined || !Number.isFinite(ts)) return null;
  return new Date(ts * 1000).toISOString();
}

/** 秒级时间戳 → `YYYY-MM-DD`（insights 里给人读的锚点） */
export function toDateStr(ts: number | null | undefined): string | null {
  const iso = fromUnixSec(ts);
  return iso ? iso.slice(0, 10) : null;
}

/** 百分比格式化。**保留上游原值**，不做 /100（§3.5） */
export function pct(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

/** 数值格式化，空值统一显示为破折号 */
export function num(n: number | null | undefined, digits = 4): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return Number.isInteger(n)
    ? String(n)
    : n.toFixed(digits).replace(/\.?0+$/, "");
}

/** 大数分档：>= 1 亿走「亿」，>= 1 万走「万」，否则原值 */
export function wan(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 100_000_000) return `${(n / 100_000_000).toFixed(2)} 亿`;
  if (Math.abs(n) >= 10_000) return `${(n / 10_000).toFixed(1)} 万`;
  return String(n);
}
