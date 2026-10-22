/**
 * 快照断言 —— core 版 `createSnapshotter` 的薄封装（与 bilibili/cninfo 同构）。
 *
 * 实现（易变字段归一、UPDATE_SNAPSHOTS 刷新、首跑自动生成）在
 * `@spider/core` 的 testing 模块，这里只绑定本包的快照根目录。
 *
 *   expectSnapshot("route-discover", result)
 *     → 快照落在 test/__snapshots__/<name>.json
 */
import { testing } from "@spider/core";

export const { expectSnapshot, snapshotPath } = testing.createSnapshotter(
  __dirname + "/..",
);
