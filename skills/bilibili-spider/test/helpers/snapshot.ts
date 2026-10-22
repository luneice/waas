/**
 * 快照断言 —— core 版 `createSnapshotter` 的薄封装。
 *
 * 实现（易变字段归一、UPDATE_SNAPSHOTS 刷新、首跑自动生成）已上移到
 * `@spider/core` 的 testing 模块，这里只绑定本包的快照根目录。
 *
 * 用法不变：expectSnapshot("bili-search", projected)
 *   → 快照落在 test/__snapshots__/<name>.json
 */
import { testing } from "@spider/core";

export const { expectSnapshot, snapshotPath } = testing.createSnapshotter(
  __dirname + "/..",
);
