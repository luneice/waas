/**
 * 包级 barrel —— 对外导出类型与组装入口
 */

export { createDefaultRegistry } from "./registry";
export type { RegistryDeps } from "./registry";
export { TvSkillBase } from "./skills/tv-skill-base";
export type { TvSkillDeps } from "./skills/tv-skill-base";

export * from "./types/search.types";
export * from "./types/scan.types";
export * from "./types/quote.types";
export * from "./types/history.types";
export * from "./types/ws.types";
export * from "./types/projected.types";

export * from "./projections/envelope";
export * from "./projections/id-namespace";
