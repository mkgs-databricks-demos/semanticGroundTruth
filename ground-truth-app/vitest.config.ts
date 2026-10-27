import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Two projects (session 26, build 4):
//   node   — server/**, shared/** and client logic tests (*.test.ts), no DOM.
//   client — React component tests (client/**/*.test.tsx) in jsdom, with
//            jest-dom + axe matchers from client/src/test/setup.ts.
// Root options are inherited by both projects (extends: true).
export default defineConfig({
  test: {
    passWithNoTests: true,
    globals: true,
    // Session 36: print console output only for failing tests. Error-path tests
    // log JSON lines with "level":"error" on purpose; the Apps build runs
    // vitest in prebuild, and those lines landed in the app's BUILD logs as
    // ERROR rows that the runtime gate counts. Failing tests still show logs.
    silent: 'passed-only',
    exclude: ['**/node_modules/**', '**/dist/**', '**/.databricks/**', '**/.venv/**'],
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'client',
          environment: 'jsdom',
          include: ['client/**/*.test.tsx'],
          setupFiles: ['./client/src/test/setup.ts'],
          // appkit-ui's ESM build imports 'echarts-for-react/esm/core' without a
          // file extension, which Node's ESM resolver rejects. Inlining lets
          // Vite resolve it, as it does in the real client build.
          server: { deps: { inline: ['@databricks/appkit-ui'] } },
        },
      },
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
    },
  },
});
