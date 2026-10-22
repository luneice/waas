// ============================================================================
// 敏感字段脱敏 — 用于 params/headers/body 落盘前
// ============================================================================

const REDACTED = "[REDACTED]";

/**
 * 深拷贝 + 脱敏。原对象不变。
 * 命中字段名（不区分大小写）的值替换为 "[REDACTED]"。
 */
export function redact(value: unknown, keys: ReadonlyArray<string>): unknown {
  const set = new Set(keys.map((k) => k.toLowerCase()));
  return walk(value, set, new WeakSet());
}

function walk(v: unknown, keys: Set<string>, seen: WeakSet<object>): unknown {
  if (v === null || v === undefined) return v;
  if (typeof v !== "object") return v;
  if (seen.has(v as object)) return "[Circular]";
  seen.add(v as object);

  if (Array.isArray(v)) return v.map((x) => walk(x, keys, seen));

  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (keys.has(k.toLowerCase())) {
      out[k] = REDACTED;
    } else {
      out[k] = walk(val, keys, seen);
    }
  }
  return out;
}
