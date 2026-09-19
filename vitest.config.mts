import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

/**
 * Two projects, one command.
 *
 * `*.test.ts` runs in Node for actions, services, and helpers; `*.test.tsx`
 * runs in a DOM for components. Both load `test/db.ts` before the test file
 * itself, so every test runs against the throwaway MongoDB rather than the
 * cluster named in `.env.local`.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    // The first run on a machine downloads the MongoDB binary, and a cold
    // `mongod` start is slower than a normal hook, so hooks get room for it.
    hookTimeout: 60_000,
    testTimeout: 20_000,
    // A run that finds no test file fails instead of passing quietly.
    passWithNoTests: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: ["**/*.test.ts"],
          exclude: ["**/node_modules/**", "**/.next/**"],
          setupFiles: ["./test/db.ts"],
        },
      },
      {
        plugins: [react()],
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["**/*.test.tsx"],
          exclude: ["**/node_modules/**", "**/.next/**"],
          setupFiles: ["./test/db.ts", "./test/setup.ts"],
        },
      },
    ],
  },
});
