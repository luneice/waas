/**
 * 快照断言 —— core 版 `createSnapshotter` 的薄封装（与 dedao/bilibili/cninfo 同构）。
 *
 *   expectSnapshot("income-envelope", result)
 *     → 快照落在 test/__snapshots__/<name>.json
 *
 * 契约有意变更后用 `UPDATE_SNAPSHOTS=1 yarn test` 刷新，diff 进 review。
 */
import { testing } from "@spider/core";

export const { expectSnapshot, snapshotPath } = testing.createSnapshotter(
  __dirname + "/..",
);
