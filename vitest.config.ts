import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Bộ kiểm thử tích hợp cần mạng và cơ sở dữ liệu thật: chạy bằng `npm run test:e2e`.
    exclude: ["tests/e2e/**"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
