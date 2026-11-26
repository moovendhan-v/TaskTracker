import { createServer, type Server } from 'node:http';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { WEB_URL } from './support/stack';

/**
 * E6.3 public feedback, end to end in a browser:
 * - the feedback widget on another site (127.0.0.1, so a real cross-origin page) files a report
 *   with that site's console error and failed request;
 * - the hosted portal takes a report from someone signed out, who follows it with their link;
 * - a member shares a full read-only link that works signed out.
 */
const SHOP_PORT = 5199;
const SHOP_ORIGIN = `http://127.0.0.1:${SHOP_PORT}`;
let shopServer: Server | null = null;
const shot = async (target: Page, name: string, locator?: ReturnType<Page['locator']>) => {
  if (!process.env['E2E_SCREENSHOTS']) return;
  const path = `../../docs/screenshots/v2/${name}.png`;
  if (locator) await locator.screenshot({ path });
  else await target.screenshot({ path });
};

test.describe.configure({ mode: 'serial' });

let context: BrowserContext;
let page: Page;
let workspaceId = '';
let spaceId = '';
let key = '';
let trackingPath = '';

async function signedOut(browser: Browser): Promise<Page> {
  const fresh = await browser.newContext({ viewport: { width: 1100, height: 850 } });
  return fresh.newPage();
}

const graphql = async <T,>(query: string, variables: object): Promise<T> => {
  const response = await page.request.post(`${WEB_URL}/api/graphql`, { data: { query, variables }, headers: { Origin: WEB_URL } });
  const body = (await response.json()) as { data: T; errors?: unknown };
  if (body.errors) throw new Error(JSON.stringify(body.errors));
  return body.data;
};

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  page = await context.newPage();
});

test.afterAll(async () => {
  await context?.close();
  await new Promise((resolve) => (shopServer ? shopServer.close(resolve) : resolve(undefined)));
});

test('sets up feedback for a project: the widget on our shop, and a feedback page', async () => {
  await page.goto(`${WEB_URL}/sign-up`);
  await page.getByLabel('Full name').fill('Robin Admin');
  await page.getByLabel('Work email').fill(`feedback-${Date.now()}@example.com`);
  await page.getByLabel('Password').fill('correct-horse-42');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('Set up your workspace')).toBeVisible();
  await page.waitForLoadState('networkidle');
  const name = page.getByLabel('Name');
  await expect(async () => {
    await name.fill('Acme');
    await expect(name).toHaveValue('Acme', { timeout: 500 });
  }).toPass();
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page).toHaveURL(/\/w\/[0-9a-f-]+$/);
  workspaceId = /\/w\/([0-9a-f-]+)/.exec(page.url())![1]!;
  await page.getByRole('button', { name: 'New space' }).click();
  await page.getByRole('menuitem', { name: 'Blank space' }).click();
  await page.getByRole('dialog').getByLabel('Name').fill('Webshop');
  await page.getByRole('button', { name: 'Create space' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  spaceId = (await graphql<{ spaces: { id: string }[] }>('query($w: ID!) { spaces(workspaceId: $w) { id } }', { w: workspaceId })).spaces[0]!.id;

  await page.goto(`${WEB_URL}/w/${workspaceId}/p/${spaceId}/settings`);
  const card = page.getByRole('region', { name: 'Feedback settings' });
  await card.getByLabel('Form title').fill('Tell Acme what went wrong');
  await card.getByLabel('Feedback button on my sites').click();
  await card.getByLabel('Sites allowed to show it (one per line)').fill(SHOP_ORIGIN);
  await card.getByLabel('Feedback page').click();
  await card.getByRole('button', { name: 'Save' }).click();
  const snippet = card.getByTestId('embed-snippet');
  await expect(snippet).toContainText('/embed/v1/feedback.js');
  key = /data-key="(tfk_[A-Za-z0-9_-]+)"/.exec((await snippet.textContent()) ?? '')![1]!;
  await page.setViewportSize({ width: 1280, height: 1500 });
  await shot(page, 'e6-feedback-settings', card);
  await page.setViewportSize({ width: 1280, height: 860 });
});

test('the widget on another site files a report with that page’s errors', async () => {
  // The shop: a real little site on another origin (127.0.0.1) with the line from the settings card.
  const html = `<!doctype html><html><head><title>Acme shop</title></head><body style="font-family:sans-serif;padding:24px">
        <h1>Acme shop</h1><p>Your cart: 2 items</p><button id="pay">Pay now</button><p id="out"></p>
        <script>document.getElementById('pay').onclick = async () => {
          console.error('Payment failed: token=sk_live_abcdef1234567890');
          const r = await fetch('/__shop-api/pay', { method: 'POST' }).catch(() => null);
          document.getElementById('out').textContent = 'Payment error ' + (r ? r.status : '');
        };</script>
        <script src="${WEB_URL}/embed/v1/feedback.js" data-key="${key}" data-label="Report a problem" async></script>
      </body></html>`;
  shopServer = createServer((request, response) => {
    if (request.url?.startsWith('/__shop-api/')) {
      response.writeHead(502, { 'Content-Type': 'application/json' });
      response.end('{"error":"gateway down"}');
      return;
    }
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end(html);
  });
  await new Promise<void>((resolve) => shopServer!.listen(SHOP_PORT, '127.0.0.1', resolve));

  const shop = await context.newPage();
  await shop.goto(`${SHOP_ORIGIN}/__shop`);
  const launcher = shop.getByRole('button', { name: 'Report a problem' });
  await expect(launcher).toBeVisible();
  await shop.getByRole('button', { name: 'Pay now' }).click();
  await expect(shop.getByText('Payment error 502')).toBeVisible();

  await launcher.click();
  const dialog = shop.getByRole('dialog', { name: 'Tell Acme what went wrong' });
  await dialog.getByLabel('Summary', { exact: true }).fill('Paying fails with an error');
  await dialog.getByLabel('Details', { exact: true }).fill('I pressed Pay now and nothing happened except an error');
  await dialog.getByLabel(/Email/).fill('pat@example.com');
  await expect(dialog.getByText(/Include technical details/)).toBeVisible();
  await shot(shop, 'e6-feedback-widget');
  await dialog.getByRole('button', { name: 'Send' }).click();
  // The panel is now titled by its thank-you heading.
  const thanks = shop.getByRole('dialog', { name: 'Thank you!' });
  await expect(thanks).toBeVisible();
  await expect(thanks.getByRole('link', { name: 'Follow its progress' })).toHaveAttribute('href', new RegExp(`^${WEB_URL}/f/track/tfs_`));

  const { bugs } = await graphql<{ bugs: { taskId: string; title: string; source: string; consoleErrors: number; failedRequests: number; pageUrl: string }[] }>(
    'query($w: ID!, $s: ID!) { bugs(workspaceId: $w, spaceId: $s) { taskId title source consoleErrors failedRequests pageUrl } }',
    { w: workspaceId, s: spaceId },
  );
  expect(bugs).toEqual([expect.objectContaining({ title: 'Paying fails with an error', source: 'sdk', consoleErrors: 1, failedRequests: 1, pageUrl: `${SHOP_ORIGIN}/__shop` })]);
  const capture = (await graphql<{ bugCapture: string }>('query($w: ID!, $t: ID!) { bugCapture(workspaceId: $w, taskId: $t) }', { w: workspaceId, t: bugs[0]!.taskId })).bugCapture;
  expect(capture).not.toContain('sk_live_abcdef1234567890');
  expect(capture).toContain('gateway down');
  await shop.close();
});

test('the feedback page takes a report from someone signed out, who follows it with their link', async ({ browser }) => {
  const visitor = await signedOut(browser);
  await visitor.goto(`${WEB_URL}/f/${key}`);
  const form = visitor.getByRole('region', { name: 'Feedback form' });
  await expect(form).toContainText('Tell Acme what went wrong');
  await form.getByLabel('This is').click();
  await visitor.getByRole('option', { name: 'A feature request' }).click();
  await form.getByLabel('Summary').fill('Export my invoices as PDF');
  await form.getByLabel('What happened?').fill('I can only download CSV today');
  await form.getByLabel('Your name (optional)').fill('Lee Client');
  await shot(visitor, 'e6-feedback-portal');
  await form.getByRole('button', { name: 'Send' }).click();
  const tracking = visitor.getByTestId('tracking-link');
  await expect(tracking).toBeVisible();
  trackingPath = new URL((await tracking.textContent())!).pathname;

  await visitor.goto(`${WEB_URL}${trackingPath}`);
  await expect(visitor.getByTestId('qa-state')).toHaveText('New');
  await expect(visitor.getByRole('heading', { name: 'Export my invoices as PDF' })).toBeVisible();
  // A status link shows no details.
  await expect(visitor.getByText('I can only download CSV today')).toHaveCount(0);

  // The team confirms it; the reporter sees it.
  const { bugs } = await graphql<{ bugs: { taskId: string; title: string; source: string; reporterName: string }[] }>('query($w: ID!, $s: ID!) { bugs(workspaceId: $w, spaceId: $s) { taskId title source reporterName } }', { w: workspaceId, s: spaceId });
  const request = bugs.find((bug) => bug.title === 'Export my invoices as PDF')!;
  expect(request).toMatchObject({ source: 'portal', reporterName: 'Lee Client' });
  await graphql('mutation($w: ID!, $t: ID!) { setBugQaState(workspaceId: $w, taskId: $t, state: "confirmed") { qaState } }', { w: workspaceId, t: request.taskId });
  await visitor.reload();
  await expect(visitor.getByTestId('qa-state')).toHaveText('Confirmed');
  await shot(visitor, 'e6-feedback-tracking');
  await visitor.context().close();
});

test('a member shares a full read-only link that works signed out, and revokes it', async ({ browser }) => {
  await page.goto(`${WEB_URL}/w/${workspaceId}/p/${spaceId}/bugs`);
  await page.getByRole('list', { name: 'Bug reports' }).getByText('Paying fails with an error').click();
  const detail = page.getByRole('dialog').filter({ hasText: 'Steps to reproduce' });
  await detail.getByRole('button', { name: 'Create read-only link' }).click();
  const link = await detail.getByTestId('share-link').textContent();
  expect(link).toMatch(new RegExp(`^${WEB_URL}/s/tfs_`));

  const outsider = await signedOut(browser);
  await outsider.goto(link!);
  const report = outsider.getByRole('region', { name: 'Report' });
  await expect(report.getByRole('heading', { name: 'Paying fails with an error' })).toBeVisible();
  await expect(report).toContainText('I pressed Pay now');
  await expect(report.getByRole('list', { name: 'Console' })).toContainText('Payment failed');
  await expect(report.getByRole('list', { name: 'Console' })).not.toContainText('sk_live_abcdef1234567890');
  await shot(outsider, 'e6-shared-bug');

  await detail.getByRole('list', { name: 'Active links' }).getByRole('listitem').filter({ hasText: 'Full link' }).getByRole('button', { name: 'Revoke' }).click();
  await expect(detail.getByRole('list', { name: 'Active links' }).getByRole('listitem').filter({ hasText: 'Full link' })).toHaveCount(0);
  await outsider.reload();
  await expect(outsider.getByText('This link doesn’t work any more')).toBeVisible();
  await outsider.context().close();
});
