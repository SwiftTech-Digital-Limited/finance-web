import { transformAsync } from "@babel/core";
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [{
    name: "compile-money-form-regressions",
    enforce: "pre",
    async transform(code, id) {
      if (!id.replaceAll("\\", "/").endsWith("/src/components/add-money-page.tsx")) return;
      // Match Next.js memoization: uncompiled forms hide reset bugs.
      const result = await transformAsync(code, {
        filename: id,
        babelrc: false,
        configFile: false,
        parserOpts: { plugins: ["typescript", "jsx"] },
        plugins: ["babel-plugin-react-compiler"],
        sourceMaps: true,
      });
      return result && { code: result.code, map: result.map };
    },
  }],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    restoreMocks: true,
    maxWorkers: 1,
    fileParallelism: false,
    pool: "threads",
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
