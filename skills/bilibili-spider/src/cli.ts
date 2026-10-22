#!/usr/bin/env node
/**
 * CLI runner — Bilibili Spider Skills 入口
 *
 * 用法：
 *   node scripts/index.js --list
 *   node scripts/index.js bili-search '{"keyword":"搞笑","kind":"video","maxPages":1}'
 *   node scripts/index.js bili-video '{"bvid":"BV..."}'
 */
import "reflect-metadata";
import { runCLI } from "@spider/core";
import { createDefaultRegistry } from "@src/skills";

runCLI((browserURL, storageRoot) => createDefaultRegistry(undefined, browserURL, storageRoot), {
  name: "bilibili-spider",
  example:
    'node index.js bili-video \'{"bvid":"BV1Ty5L6bE3X","download":false}\'',
  silent: true,
});
