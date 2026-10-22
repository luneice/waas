import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    name: "core",
    include: ["test/**/*.test.ts"],
    testTimeout: 20_000,
  },
});
