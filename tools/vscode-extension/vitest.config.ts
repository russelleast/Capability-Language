import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    restoreMocks: true,
    include: ["test/**/*.test.ts"],
  },
  resolve: {
    alias: {
      vscode: "./test/mocks/vscode.ts",
    },
  },
});
