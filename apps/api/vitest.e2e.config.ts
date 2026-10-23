import { defineConfig } from 'vitest/config';

/**
 * Black-box end-to-end tests: the global setup builds nothing itself; run
 * `pnpm test:e2e`, which builds first. It migrates a dedicated test database,
 * starts `node dist/main.js` and the specs talk to it over HTTP, like a browser.
 */
export default defineConfig({
  test: {
    include: ['test/e2e/**/*.e2e-spec.ts'],
    environment: 'node',
    globalSetup: ['test/e2e/support/global-setup.ts'],
    // Specs share one API process; running them one at a time keeps rate limits and timing predictable.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
