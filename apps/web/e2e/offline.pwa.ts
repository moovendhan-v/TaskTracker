import { expect, test } from '@playwright/test';

/** F1: TaskFlow installs as an app and opens offline, without keeping anyone's data. */
test('is installable, opens offline from its saved shell, and never keeps API responses', async ({ page, context }) => {
  // No API runs here: the shell is enough (it renders before any data loads).
  await page.goto('/sign-in');
  await expect(page).toHaveTitle('TaskFlow');

  // An install-worthy manifest, with icons that load.
  const manifest = (await (await page.request.get('/manifest.webmanifest')).json()) as { name: string; display: string; start_url: string; icons: { src: string; purpose: string }[] };
  expect(manifest).toMatchObject({ name: 'TaskFlow', display: 'standalone', start_url: '/' });
  expect(manifest.icons.map((icon) => icon.purpose)).toContain('maskable');
  for (const icon of manifest.icons) expect((await page.request.get(icon.src)).status()).toBe(200);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');

  // The service worker takes over this page.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

  // Offline: the app still opens from the saved shell and built files (the banner is drawn by
  // the app's own code, so it proves the scripts came from the cache), and says it's offline.
  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveTitle('TaskFlow');
  await expect(page.getByRole('status').filter({ hasText: 'You’re offline' })).toBeVisible();
  await context.setOffline(false);

  // Nothing from the API was saved: only the shell and built files.
  const saved = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const key of await caches.keys()) for (const request of await (await caches.open(key)).keys()) urls.push(new URL(request.url).pathname);
    return urls;
  });
  expect(saved.length).toBeGreaterThan(3);
  expect(saved.filter((path) => path.startsWith('/api/'))).toEqual([]);
  expect(saved.every((path) => path === '/' || path.startsWith('/assets/') || path.startsWith('/icons/') || ['/manifest.webmanifest', '/favicon.svg'].includes(path))).toBe(true);
});
