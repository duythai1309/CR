import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/e2e/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Các bước phụ thuộc nhau theo thứ tự nên phải chạy tuần tự.
    fileParallelism: false,
    sequence: { concurrent: false },
  },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
