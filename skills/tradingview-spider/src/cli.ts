#!/usr/bin/env node
/**
 * CLI 入口 —— 构建产物的 entry point。
 *
 * 薄封装：注册表组装交给 registry.ts，子命令（--list / obs / --raw / 超时 /
 * License 闸门）由 core 的 runCLI 统一提供。
 *
 * stdout 只输出最终 JSON（`silent: true`）—— 任何日志都会污染 Agent 的解析。
 */
import "reflect-metadata";
import { runCLI } from "@spider/core";
import { createDefaultRegistry } from "@src/registry";

runCLI((browserURL) => createDefaultRegistry(undefined, browserURL), {
  name: "tradingview-spider",
  example:
    'node index.js tv-history \'{"symbols":["FRED:RRPONTSYAWARD"],"resolution":"1D","from":"2014-01-01"}\'',
  silent: true,
});
