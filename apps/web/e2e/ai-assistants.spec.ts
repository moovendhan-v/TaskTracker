import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { clientIpHeaders, WEB_URL } from './support/stack';

/**
 * E6.5 in the browser: make an AI assistant token under Security, use it as an MCP client would,
 * and see the agent's change and comment marked "AI" on the task.
 */
test.describe.configure({ mode: 'serial' });

let context: BrowserContext;
let page: Page;
let workspaceId = '';
let token = '';

const shot = async (target: ReturnType<Page['locator']>, name: string) => {
  if (process.env['E2E_SCREENSHOTS']) await target.screenshot({ path: `../../docs/screenshots/v2/${name}.png` });
};

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext({ extraHTTPHeaders: clientIpHeaders(), viewport: { width: 1280, height: 1100 } });
  page = await context.newPage();
});

test.afterAll(async () => {
  await context?.close();
});

test('creates an AI assistant token with setup instructions', async () => {
  await page.goto(`${WEB_URL}/sign-up`);
  await page.getByLabel('Full name').fill('Avery Agent');
  await page.getByLabel('Work email').fill(`agent-${Date.now()}@example.com`);
  await page.getByLabel('Password').fill('correct-horse-42');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('Set up your workspace')).toBeVisible();
  await page.waitForLoadState('networkidle');
  const name = page.getByLabel('Name');
  await expect(async () => {
    await name.fill('Acme AI');
    await expect(name).toHaveValue('Acme AI', { timeout: 500 });
  }).toPass();
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page).toHaveURL(/\/w\/[0-9a-f-]+$/);
  workspaceId = /\/w\/([0-9a-f-]+)/.exec(page.url())![1]!;
  await page.getByRole('button', { name: 'New space' }).click();
  await page.getByRole('menuitem', { name: 'Blank space' }).click();
  await page.getByRole('dialog').getByLabel('Name').fill('Mobile app');
  await page.getByRole('button', { name: 'Create space' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();

  await page.goto(`${WEB_URL}/w/${workspaceId}/security`);
  const card = page.getByRole('region', { name: 'AI assistants' });
  await card.getByLabel('Token name').fill('Claude Code');
  await card.getByLabel('Access').click();
  await page.getByRole('option', { name: 'Read and change' }).click();
  await card.getByRole('button', { name: 'Create token' }).click();
  token = (await card.getByTestId('agent-token').textContent())!.trim();
  expect(token).toMatch(/^tfx_/);
  await expect(card).toContainText(`claude mcp add --transport http taskflow ${WEB_URL}/api/mcp --header "Authorization: Bearer ${token}"`);
  await expect(card.getByRole('list', { name: 'AI assistant tokens' })).toContainText('Read and change');
});

test('an MCP client files a bug and comments; the task shows it was the AI', async () => {
  const mcp = async (method: string, params: object) => {
    const response = await page.request.post(`${WEB_URL}/api/mcp`, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'MCP-Protocol-Version': '2025-06-18' }, data: { jsonrpc: '2.0', id: 1, method, params } });
    return (await response.json()) as { result: { structuredContent?: { result: unknown }; isError?: boolean; tools?: { name: string }[] } };
  };
  const tools = (await mcp('tools/list', {})).result.tools!.map((tool) => tool.name);
  expect(tools).toEqual(expect.arrayContaining(['spaces', 'reportBug', 'createComment']));
  const spaces = (await mcp('tools/call', { name: 'spaces', arguments: {} })).result.structuredContent!.result as { id: string }[];
  const filed = await mcp('tools/call', { name: 'reportBug', arguments: { input: { spaceId: spaces[0]!.id, title: 'Login button unresponsive on Android', severity: 'P1' } } });
  expect(filed.result.isError).toBe(false);
  const bug = filed.result.structuredContent!.result as { taskId: string };
  await mcp('tools/call', { name: 'createComment', arguments: { taskId: bug.taskId, input: { body: 'Seen on Pixel 8, Android 15.' } } });

  await page.goto(`${WEB_URL}/w/${workspaceId}/t/${bug.taskId}`);
  const comment = page.getByRole('listitem').filter({ hasText: 'Seen on Pixel 8, Android 15.' });
  await expect(comment.getByTestId('agent-badge')).toHaveText('AI · Claude Code');
  await shot(comment, 'e6-agent-comment');

  await page.goto(`${WEB_URL}/w/${workspaceId}/security`);
  await shot(page.getByRole('region', { name: 'AI assistants' }), 'e6-ai-assistants');
});
