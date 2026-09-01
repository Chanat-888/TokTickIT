import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Multiple lab-02 API test files share the toktickit_test database and
    // truncate it in their own beforeEach; running files in parallel races
    // one file's truncation against another's in-flight seed/assertions.
    fileParallelism: false,
  },
});
