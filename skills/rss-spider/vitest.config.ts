import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    name: "rss",
    include: ["test/**/*.test.ts"],
    env: { TZ: "Asia/Shanghai" },
    testTimeout: 20_000,
  },
});
