// ============================================================================
// Bootstrap — 根据 ObsConfig 装配 Sink，CLI 入口处调用
// ============================================================================

import { join } from "path";
import { getObservabilityBus } from "./bus";
import { getObsConfig } from "./config";
import { JsonlSink } from "./sinks/jsonl-sink";

let booted = false;
let installedNames: string[] = [];

/**
 * 装配 sink。可重复调用，仅首次生效。
 * 返回当前装配的 sink 名称数组（便于 CLI 输出诊断）。
 */
export function bootstrapObservability(): string[] {
  if (booted) return installedNames;
  booted = true;

  const cfg = getObsConfig();
  if (!cfg.enabled) return installedNames;

  const bus = getObservabilityBus();

  if (cfg.sinks.includes("jsonl")) {
    bus.register(new JsonlSink({ dir: join(cfg.dir, "traces") }));
    installedNames.push("jsonl");
  }
  return installedNames;
}

export async function shutdownObservability(): Promise<void> {
  if (!booted) return;
  await getObservabilityBus().close();
  booted = false;
  installedNames = [];
}
