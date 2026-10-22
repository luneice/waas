// ============================================================================
// Observability 配置 — 全部走环境变量，零侵入
// ============================================================================
//
//  SPIDER_OBS_DIR              存储根目录（默认 ~/.spider，跨 cwd 共享）
//  SPIDER_OBS_DISABLE          "1" 完全禁用
//  SPIDER_OBS_SINKS            "jsonl" 逗号分隔（默认 jsonl）
//  SPIDER_OBS_BODY_MAX_BYTES   单 body 最大保存字节（默认 5MB；超过截断）
//  SPIDER_OBS_REDACT_KEYS      额外脱敏字段名（逗号分隔，默认含常见敏感字）
//  SPIDER_OBS_PREVIEW_BYTES    text body preview 长度（默认 256）
//
//  与 logger 的关系：
//    logger 仅保留向后兼容，默认 silent；obs bootstrap 不注册 logger sink。
// ============================================================================

import { resolve } from "path";
import { homedir } from "os";

export interface ObsConfig {
  enabled: boolean;
  dir: string;
  sinks: ReadonlyArray<"jsonl" | "logger">;
  bodyMaxBytes: number;
  previewBytes: number;
  redactKeys: ReadonlyArray<string>;
  /** logger 是否被显式启用（兼容字段；默认不输出） */
  loggerExplicit: boolean;
}

const DEFAULT_REDACT_KEYS = [
  "password",
  "passwd",
  "pwd",
  "secret",
  "token",
  "access_token",
  "refresh_token",
  "apikey",
  "api_key",
  "authorization",
  "cookie",
  "set-cookie",
  "ctoken",
  "x-token",
];

let cached: ObsConfig | undefined;

export function getObsConfig(): ObsConfig {
  if (cached) return cached;
  const env = process.env;
  const enabled = env.SPIDER_OBS_DISABLE !== "1";
  // 默认放在 ~/.spider —— 用户全局共享，跨 cwd 一致，方便 `obs` 子命令查询。
  const dir = resolve(env.SPIDER_OBS_DIR ?? `${homedir()}/.spider`);

  const rawSinks = (env.SPIDER_OBS_SINKS ?? "jsonl")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean) as ObsConfig["sinks"][number][];
  const sinks = rawSinks.filter((s) =>
    ["jsonl", "logger"].includes(s),
  ) as ObsConfig["sinks"];

  const bodyMaxBytes = Number(env.SPIDER_OBS_BODY_MAX_BYTES ?? 5_000_000);
  const previewBytes = Number(env.SPIDER_OBS_PREVIEW_BYTES ?? 256);
  const extra = (env.SPIDER_OBS_REDACT_KEYS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const redactKeys = Array.from(new Set([...DEFAULT_REDACT_KEYS, ...extra]));

  cached = {
    enabled,
    dir,
    sinks,
    bodyMaxBytes: Number.isFinite(bodyMaxBytes) ? bodyMaxBytes : 5_000_000,
    previewBytes: Number.isFinite(previewBytes) ? previewBytes : 256,
    redactKeys,
    loggerExplicit: !!env.SPIDER_LOG_LEVEL,
  };
  return cached;
}

/** 测试用：清缓存 */
export function _resetObsConfigCache(): void {
  cached = undefined;
}
