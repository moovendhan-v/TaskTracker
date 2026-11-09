import { defineConfig, devices } from '@playwright/test';
import { API_DIR, API_PORT, LIVEKIT_BINARY, LIVEKIT_PORT, WEB_PORT, WEB_URL, apiEnv, livekitConfig } from './e2e/support/stack';

/**
 * Browser tests against the real stack: the built API (migrated first) on a
 * dedicated test database, and the Vite dev server proxying /api to it.
 * Run `pnpm --filter @taskflow/api build` first. Locally, set
 * PLAYWRIGHT_CHROMIUM_EXECUTABLE to use an existing Chromium.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env['CI']),
  retries: 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1400, height: 900 },
        // Fake camera and microphone, allowed without asking, for calls (D2).
        launchOptions: { executablePath: process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE'] || undefined, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
      },
    },
  ],
  webServer: [
    ...(LIVEKIT_BINARY
      ? [
          {
            command: `"${LIVEKIT_BINARY}" --config-body "$LIVEKIT_CONFIG_BODY"`,
            env: { LIVEKIT_CONFIG_BODY: livekitConfig() },
            url: `http://127.0.0.1:${LIVEKIT_PORT}`,
            reuseExistingServer: false,
            timeout: 60_000,
          },
        ]
      : []),
    {
      command: 'node dist/cli/run-migrations.js && node dist/main.js',
      cwd: API_DIR,
      env: apiEnv() as Record<string, string>,
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `pnpm exec vite --port ${WEB_PORT} --strictPort --host 127.0.0.1`,
      env: { API_PROXY_TARGET: `http://127.0.0.1:${API_PORT}` },
      url: WEB_URL,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
