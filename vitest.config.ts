import { defineConfig } from "vitest/config";

// 只聚合门禁层（L1/L2）的包级 project。e2e 配置独立成文件
// （vitest.e2e.config.ts / vitest.live.config.ts，M3/M4 落地），
// 不在这里引用——从机制上保证 `vitest run` / PR 门禁永远跑不到它们。
// glob 未匹配到 vitest.config.ts 的包自动跳过，不需要手工维护清单。
export default defineConfig({
  test: {
    projects: ["packages/core/vitest.config.ts", "skills/*/vitest.config.ts"],
  },
});
