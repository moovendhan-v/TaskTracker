import { defineConfig, devices } from '@playwright/test';

const PORT = 4175;

/**
 * The installable app and offline shell (F1). The service worker only runs in production builds,
 * so this builds the app and serves the build; no API is needed (the sign-in page is enough).
 */
export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.pwa.ts',
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'off' },
  projects: [{ name: 'chromium', use: { ...devices['Pixel 7'], launchOptions: { executablePath: process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE'] || undefined } } }],
  webServer: {
    command: `pnpm exec vite build && pnpm exec vite preview --port ${PORT} --strictPort --host localhost`,
    url: `http://localhost:${PORT}/sign-in`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
