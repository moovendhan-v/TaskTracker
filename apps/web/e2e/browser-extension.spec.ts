import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, expect, test, type BrowserContext, type Page } from '@playwright/test';
import { clientIpHeaders, WEB_URL } from './support/stack';

/**
 * E6.3 browser extension, loaded for real into Chromium: connect it to TaskFlow (PKCE approval in
 * a TaskFlow tab), capture console and network on a shop page, report from it, and find the
 * report in TaskFlow with its screenshot and diagnostics.
 *
 * Built first with `pnpm --filter @taskflow/extension build`. The browser's permission prompt
 * can't be clicked by automation, so a copy of the built extension grants its host access up
 * front (in real use, the popup asks for exactly your TaskFlow address).
 */
const BUILT = resolve(import.meta.dirname, '../../extension/dist/chrome');
const SHOP = `${WEB_URL}/__e2e-shop`;
const shot = async (target: Page, name: string) => {
  if (process.env['E2E_SCREENSHOTS']) await target.screenshot({ path: `../../docs/screenshots/v2/${name}.png` });
};

test.describe.configure({ mode: 'serial' });
test.skip(!existsSync(join(BUILT, 'manifest.json')), 'Build the extension first: pnpm --filter @taskflow/extension build');

let context: BrowserContext;
let page: Page;
let extensionId = '';
let workspaceId = '';

test.beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'taskflow-extension-'));
  cpSync(BUILT, dir, { recursive: true });
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as Record<string, unknown>;
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ ...manifest, host_permissions: ['<all_urls>'] }));
  context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'taskflow-profile-')), {
    // Extensions need the full browser (new headless), not the headless shell.
    channel: process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE'] ? undefined : 'chromium',
    executablePath: process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE'] || undefined,
    headless: true,
    extraHTTPHeaders: clientIpHeaders(),
    viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${dir}`, `--load-extension=${dir}`],
  });
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  extensionId = new URL(worker.url()).host;
  // A small shop page with a bug: its checkout logs an error and its API answers 500.
  await context.route(`${SHOP}*`, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><title>Acme shop</title><h1>Cart</h1><label>Coupon <input name="coupon"></label><label>Password <input type="password" name="password"></label>
        <button id="pay">Checkout</button><p id="out"></p>
        <script>document.getElementById('pay').onclick = async () => {
          console.error('Checkout failed: token=sk_live_abcdef1234567890');
          const r = await fetch('/__e2e-shop-api/checkout?session=secret-session', { method: 'POST', body: JSON.stringify({ card: '4242 4242 4242 4242' }) });
          document.getElementById('out').textContent = 'Error ' + r.status;
        };</script>`,
    }),
  );
  await context.route(`${WEB_URL}/__e2e-shop-api/**`, (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"payment service down"}' }));
  page = context.pages()[0] ?? (await context.newPage());
});

test.afterAll(async () => {
  await context?.close();
});

test('signs up and makes a project to report into', async () => {
  await page.goto(`${WEB_URL}/sign-up`);
  await page.getByLabel('Full name').fill('Sam Tester');
  await page.getByLabel('Work email').fill(`ext-${Date.now()}@example.com`);
  await page.getByLabel('Password').fill('correct-horse-42');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('Set up your workspace')).toBeVisible();
  await page.waitForLoadState('networkidle');
  const name = page.getByLabel('Name');
  await expect(async () => {
    await name.fill('Acme QA');
    await expect(name).toHaveValue('Acme QA', { timeout: 500 });
  }).toPass();
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page).toHaveURL(/\/w\/[0-9a-f-]+$/);
  workspaceId = /\/w\/([0-9a-f-]+)/.exec(page.url())![1]!;
  await page.getByRole('button', { name: 'New space' }).click();
  await page.getByRole('menuitem', { name: 'Blank space' }).click();
  await page.getByRole('dialog').getByLabel('Name').fill('Storefront');
  await page.getByRole('button', { name: 'Create space' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('connects the extension: allow in TaskFlow, and the extension finishes on its own', async () => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.setViewportSize({ width: 340, height: 420 });
  await popup.getByLabel('TaskFlow address').fill(WEB_URL);
  await shot(popup, 'e6-extension-connect');
  const approval = context.waitForEvent('page');
  await popup.getByRole('button', { name: 'Connect' }).click();
  await expect(popup.getByText('Allow it in TaskFlow')).toBeVisible();

  const taskflow = await approval;
  await expect(taskflow).toHaveURL(/\/extension\/connect\?challenge=[A-Za-z0-9_-]{43}&name=/);
  const card = taskflow.getByRole('region', { name: 'Connect the browser extension' });
  await expect(card).toContainText('TaskFlow extension (Chrome)');
  await shot(taskflow, 'e6-extension-allow');
  await card.getByRole('button', { name: 'Allow' }).click();
  await expect(card.getByRole('status')).toContainText('Connected');
  await taskflow.close();

  // The popup was polling: it switches to the connected view.
  await expect(popup.getByRole('heading', { name: 'Acme QA' })).toBeVisible({ timeout: 15_000 });
  await expect(popup.locator('body')).toContainText('Sam Tester');
  await popup.close();
});

test('captures the shop page, reports from it, and the report lands in TaskFlow', async () => {
  const shop = await context.newPage();
  await shop.goto(SHOP);
  const extension = await context.newPage();
  await extension.goto(`chrome-extension://${extensionId}/popup.html`);
  // What the popup's "Capture console & network on this tab" button sends, for the shop's tab.
  const target = await extension.evaluate(async (url) => {
    const api = (globalThis as unknown as { chrome: { tabs: { query(q: object): Promise<{ id: number; windowId: number; url?: string }[]> }; runtime: { sendMessage(m: object): Promise<{ ok: boolean; error?: string }> } } }).chrome;
    const [tab] = (await api.tabs.query({})).filter((item) => (item.url ?? '').startsWith(url));
    const started = await api.runtime.sendMessage({ type: 'startCapture', tabId: tab!.id });
    return { tabId: tab!.id, windowId: tab!.windowId, started };
  }, SHOP);
  expect(target.started).toEqual({ ok: true });

  // The bug happens.
  await shop.bringToFront();
  await shop.getByLabel('Coupon').fill('SPRING10');
  await shop.getByLabel('Password').fill('hunter2-secret');
  await shop.getByRole('button', { name: 'Checkout' }).click();
  await expect(shop.getByText('Error 500')).toBeVisible();

  // "Report a bug on this page".
  const reportOpened = context.waitForEvent('page');
  const sent = await extension.evaluate(
    (message) => (globalThis as unknown as { chrome: { runtime: { sendMessage(m: object): Promise<unknown> } } }).chrome.runtime.sendMessage(message),
    { type: 'report', tabId: target.tabId, windowId: target.windowId, pick: false },
  );
  expect(sent).toEqual({ ok: true });
  const report = await reportOpened;
  await report.setViewportSize({ width: 1280, height: 900 });
  await expect(report.getByRole('heading', { name: 'Report a bug' })).toBeVisible();
  await expect(report.getByLabel('Project')).toHaveValue(/.+/);
  await expect(report.locator('form')).toContainText(/1 console line \(1 error\), \d+ requests? \(1 failed\)/);

  // Mark up the screenshot, fill in the report, file it.
  const canvas = report.getByLabel('Screenshot (draw on it to point at the problem)');
  const box = (await canvas.boundingBox())!;
  await report.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
  await report.mouse.down();
  await report.mouse.move(box.x + box.width * 0.12, box.y + box.height * 0.2, { steps: 5 });
  await report.mouse.up();
  await report.getByLabel('Title').fill('Checkout fails with a 500');
  await report.getByLabel('Severity').selectOption('P1');
  await report.getByLabel('Expected result').fill('The order is placed');
  await report.getByLabel('Actual result').fill('“Error 500” under the button');
  await shot(report, 'e6-extension-report');
  await report.getByRole('button', { name: 'File report' }).click();
  await expect(report.getByRole('heading', { name: /Filed #\d+/ })).toBeVisible({ timeout: 20_000 });
  await expect(report.getByText(/didn’t upload/)).toHaveCount(0);

  // In TaskFlow: from the extension, with the screenshot and the redacted diagnostics.
  const graphql = async <T,>(query: string, variables: object): Promise<T> => {
    const response = await page.request.post(`${WEB_URL}/api/graphql`, { data: { query, variables }, headers: { Origin: WEB_URL } });
    return ((await response.json()) as { data: T }).data;
  };
  const { spaces } = await graphql<{ spaces: { id: string }[] }>('query($w: ID!) { spaces(workspaceId: $w) { id } }', { w: workspaceId });
  const { bugs } = await graphql<{ bugs: { taskId: string; title: string; source: string; severity: string; consoleErrors: number; failedRequests: number; pageUrl: string; steps: { text: string }[] }[] }>(
    'query($w: ID!, $s: ID!) { bugs(workspaceId: $w, spaceId: $s) { taskId title source severity consoleErrors failedRequests pageUrl steps { text } } }',
    { w: workspaceId, s: spaces[0]!.id },
  );
  expect(bugs).toEqual([expect.objectContaining({ title: 'Checkout fails with a 500', source: 'extension', severity: 'P1', consoleErrors: 1, failedRequests: 1 })]);
  const bug = bugs[0]!;
  expect(bug.steps.map((step) => step.text)).toEqual(expect.arrayContaining(['Type “SPRING10” into “Coupon”', 'Fill in “Password”', 'Click “Checkout”']));
  const { bugCapture } = await graphql<{ bugCapture: string }>('query($w: ID!, $t: ID!) { bugCapture(workspaceId: $w, taskId: $t) }', { w: workspaceId, t: bug.taskId });
  for (const secret of ['sk_live_abcdef1234567890', 'secret-session', 'hunter2-secret', '4242 4242 4242 4242']) expect(bugCapture).not.toContain(secret);
  expect(bugCapture).toContain('payment service down');
  const { taskAttachments } = await graphql<{ taskAttachments: { fileName: string; isImage: boolean }[] }>('query($w: ID!, $t: ID!) { taskAttachments(workspaceId: $w, taskId: $t) { fileName isImage } }', { w: workspaceId, t: bug.taskId });
  expect(taskAttachments).toEqual([expect.objectContaining({ isImage: true, fileName: expect.stringMatching(/^screenshot-.*\.png$/) })]);
});

test('lists the connection under Security, and Disconnect stops it at once', async () => {
  await page.bringToFront();
  await page.goto(`${WEB_URL}/w/${workspaceId}/security`);
  const card = page.getByRole('region', { name: 'Browser extension' });
  await expect(card.getByRole('list', { name: 'Connected extensions' })).toContainText('TaskFlow extension (Chrome)');
  await card.getByRole('button', { name: 'Disconnect' }).click();
  await expect(card).toContainText('No extension is connected');

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.getByText('This connection was disconnected or expired')).toBeVisible();
});

test('serves the latest extension for the browser asking', async () => {
  const firefox = 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0';
  const chrome = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';
  const latest = async (userAgent: string, query = '') => {
    const response = await page.request.get(`${WEB_URL}/downloads/extension/latest${query}`, { headers: { 'User-Agent': userAgent }, maxRedirects: 0 });
    return { status: response.status(), location: response.headers()['location'] ?? '' };
  };
  expect(await latest(firefox)).toEqual({ status: 302, location: '/downloads/extension/taskflow-extension-firefox.zip' });
  expect(await latest(chrome)).toEqual({ status: 302, location: '/downloads/extension/taskflow-extension-chrome.zip' });
  expect((await latest(chrome, '?browser=firefox')).location).toBe('/downloads/extension/taskflow-extension-firefox.zip');

  const zip = await page.request.get(`${WEB_URL}/downloads/extension/latest`, { headers: { 'User-Agent': firefox } });
  expect(zip.headers()['content-type']).toBe('application/zip');
  const bytes = await zip.body();
  expect(bytes.subarray(0, 2).toString()).toBe('PK');
  expect(bytes.includes(Buffer.from('manifest.json'))).toBe(true);
  const info = (await (await page.request.get(`${WEB_URL}/downloads/extension/latest.json`)).json()) as { version: string; files: Record<string, string> };
  expect(info.files).toEqual({ chrome: `taskflow-extension-chrome-${info.version}.zip`, firefox: `taskflow-extension-firefox-${info.version}.zip` });

  await page.goto(`${WEB_URL}/w/${workspaceId}/security`);
  const download = page.getByTestId('extension-download');
  await expect(download.getByRole('link', { name: 'Download for Chrome' })).toHaveAttribute('href', '/downloads/extension/latest?browser=chrome');
  await expect(download).toContainText(`Version ${info.version}`);
  if (process.env['E2E_SCREENSHOTS']) await page.getByRole('region', { name: 'Browser extension' }).screenshot({ path: '../../docs/screenshots/v2/e6-extension-download.png' });
});
