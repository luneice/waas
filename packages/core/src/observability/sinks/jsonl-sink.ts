// ============================================================================
// JsonlSink — 按天滚动的 NDJSON 文件
// ============================================================================
//
// 路径：<obsDir>/traces/YYYY-MM-DD.jsonl
// 写入：append（fs.appendFileSync 同步、容错）
//
// 同步写避免事件乱序，性能足够（每事件 < 1KB，秒级数千条无压力）。
// ============================================================================

import { mkdirSync, appendFileSync } from "fs";
import { join } from "path";
import type { ObsSink } from "../bus";
import type { ObsEvent } from "../events";

export interface JsonlSinkOptions {
  /** 输出目录 — 默认 <obsDir>/traces */
  dir: string;
}

export class JsonlSink implements ObsSink {
  readonly name = "jsonl";
  private readonly dir: string;
  private currentDate?: string;

  constructor(opts: JsonlSinkOptions) {
    this.dir = opts.dir;
    try {
      mkdirSync(this.dir, { recursive: true });
    } catch {
      /* ignore */
    }
  }

  write(event: ObsEvent): void {
    const date = event.ts.slice(0, 10); // YYYY-MM-DD
    if (date !== this.currentDate) {
      this.currentDate = date;
    }
    const file = join(this.dir, `${date}.jsonl`);
    try {
      appendFileSync(file, JSON.stringify(event) + "\n");
    } catch {
      /* swallow */
    }
  }
}
