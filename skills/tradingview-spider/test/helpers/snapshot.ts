import { testing } from "@spider/core";

/**
 * 快照工具 —— 全包共用。
 *
 * 默认易变字段（crawledAt / durationMs / traceId 等）由 core 统一处理，
 * 本包无额外的时间戳字段名，故不需要 extraVolatileKeys。
 */
export const { expectSnapshot, snapshotPath } = testing.createSnapshotter(__dirname + "/..");
