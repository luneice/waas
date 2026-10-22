#!/usr/bin/env node
/**
 * CLI runner — Xueqiu Spider Skills 入口
 *
 * 用法：
 *   node scripts/index.js --list
 *   node scripts/index.js xueqiu-income '{"symbol":"SH601127"}'
 */
import "reflect-metadata";
import { runCLI } from "@spider/core";
import { createDefaultRegistry } from "@src/registry";

runCLI(
  (browserURL, storageRoot) =>
    createDefaultRegistry(undefined, browserURL, storageRoot),
  {
    name: "xueqiu-spider",
    example:
      'node scripts/index.js xueqiu-income \'{"symbol":"SH601127","type":"all","maxPages":8}\'',
    silent: true,
  },
);
