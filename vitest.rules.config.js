import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["database.rules.test.js"], environment: "node", fileParallelism: false } });
