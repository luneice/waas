#!/usr/bin/env node
/**
 * CLI 入口 — RSS 情报采集 Skill 入口
 *
 * 用法：
 *   node index.js --list
 *   node index.js <skill-id> [params-json]
 *
 * RSSHub 内嵌 runtime 在首次 route 请求时自动懒初始化，无需显式启动。
 */
import "reflect-metadata";
import { config as loadEnv } from "dotenv";
import { resolve } from "path";

// 加载 .env
loadEnv({ path: resolve(__dirname, "../.env") });
loadEnv({ path: resolve(process.cwd(), ".env") });

// Polyfill for __name (required by some tslib helpers)
(global as any).__name = (d: any, n: any) => {
  d.displayName = n;
  return d;
};

import { runCLI } from "@spider/core";
import { createDefaultRegistry } from "@src/skill/registry";
import { Configuration } from "@src/config";

/** 输出 JSON 到 stdout 并退出 */
function fatal(message: string): never {
  process.stdout.write(
    JSON.stringify({ success: false, error: message }) + "\n",
  );
  process.exit(1);
}

// ── 主入口 ──

const config = new Configuration();

async function main() {
  // 委托核心 runCLI 处理 Skill 调用
  runCLI(
    (browserURL, storageRoot) =>
      createDefaultRegistry(undefined, browserURL, storageRoot),
    {
      name: "rsshub-spider",
      example:
        'node index.js rss-intelligence \'{"route":"/github/trending/daily/javascript"}\'',
      chromeHost: config.browserHost,
      chromePort: config.browserPort,
      timeoutMs: config.globalTimeout,
      silent: true,
    },
  );
}

main().catch((err) => {
  fatal(err instanceof Error ? err.message : String(err));
});
