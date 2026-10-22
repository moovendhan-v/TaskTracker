import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { API_DIR, apiEnv } from './support/stack';

/**
 * One person's first day in TaskFlow, end to end in a real browser: sign-up,
 * workspace setup, tasks, sprints, docs, HR, roles, the audit log and the
 * platform admin console. Steps share one page and run in order.
 */
test.describe.configure({ mode: 'serial' });

const run = randomUUID().slice(0, 8);
const email = `dana+${run}@example.com`;
let page: Page;
const consoleErrors: string[] = [];

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  page.on('console', (message) => message.type() === 'error' && consoleErrors.push(message.text()));
  page.on('pageerror', (error) => consoleErrors.push(error.message));
});

test.afterAll(async () => {
  await page.close();
});

test('redirects to sign-in when signed out', async () => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/sign-in$/);
});

test('validates the sign-up form in the browser', async () => {
  await page.goto('/sign-up');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('Enter your name')).toBeVisible();
});

test('signs up and lands on onboarding', async () => {
  await page.getByLabel('Full name').fill('Dana Reyes');
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password').fill('correct-horse-42');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
});

test('creates a workspace, a space and a list', async () => {
  await page.getByLabel('Name').fill('Northwind Studio');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page).toHaveURL(/\/w\/[0-9a-f-]+$/);
  await expect(page.getByText('Create your first space')).toBeVisible();

  await page.getByRole('button', { name: 'New space' }).click();
  await page.getByRole('dialog').getByLabel('Name').fill('Product');
  await page.getByRole('button', { name: 'Create space' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  const nav = page.getByRole('navigation');
  await expect(nav.getByText('Product')).toBeVisible();

  await nav.getByText('Product').hover();
  await page.getByRole('button', { name: 'New list in Product' }).click();
  await page.getByRole('dialog').getByLabel('Name').fill('Launch plan');
  await page.getByRole('button', { name: 'Create list' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await nav.getByRole('link', { name: 'Launch plan' }).click();
  await expect(page).toHaveURL(/\/l\//);
});

test('quick-adds tasks and changes status from the list', async () => {
  await page.getByRole('button', { name: 'Add task' }).first().click();
  for (const title of ['Write release notes', 'Fix sign-in bug', 'Design onboarding emails']) {
    await page.getByLabel('New task name').fill(title);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: title })).toBeVisible();
  }
  await page.keyboard.press('Escape');

  const row = page.locator('div.group', { has: page.getByRole('button', { name: 'Fix sign-in bug' }) });
  await row.getByRole('button', { name: /Status:/ }).click();
  await page.getByRole('menuitem', { name: 'In progress' }).click();
  await expect(page.locator('section', { hasText: 'In progress' }).getByRole('button', { name: 'Fix sign-in bug' })).toBeVisible();
});

test('filters tasks by search', async () => {
  await page.getByLabel('Search tasks').fill('release');
  await expect(page.getByRole('button', { name: 'Design onboarding emails' })).toBeHidden();
  await page.getByLabel('Search tasks').fill('');
  await expect(page.getByRole('button', { name: 'Design onboarding emails' })).toBeVisible();
});

test('edits a task and renders comments as text, never HTML', async () => {
  await page.getByRole('button', { name: 'Write release notes' }).click();
  await expect(page).toHaveURL(/task=/);
  const panel = page.getByRole('dialog');
  await panel.getByLabel('Description').fill('Summarise the changes for customers.');
  await panel.getByLabel('Task title').click();
  await panel.getByRole('button', { name: /Priority:/ }).click();
  await page.getByRole('menuitem', { name: 'High' }).click();

  const comment = '<script>alert(1)</script> drafting now';
  await panel.getByLabel('New comment').fill(comment);
  await panel.getByRole('button', { name: 'Comment' }).click();
  await expect(panel.getByRole('listitem').filter({ hasText: comment })).toBeVisible();
  await expect(panel.getByLabel('New comment')).toHaveValue('');
  expect(await page.locator('ol script').count()).toBe(0);

  await page.keyboard.press('Escape');
  await expect(page).not.toHaveURL(/task=/);
});

test('drags a card to Done on the board, and it stays there after reload', async () => {
  await page.getByRole('tab', { name: 'Board' }).click();
  const done = page.getByRole('region', { name: 'Done' });
  await page.locator('article', { hasText: 'Design onboarding emails' }).dragTo(done);
  await expect(done.locator('article', { hasText: 'Design onboarding emails' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Done' }).locator('article', { hasText: 'Design onboarding emails' })).toBeVisible();
});

test('plans, starts and completes a sprint', async () => {
  await page.getByRole('navigation').getByRole('link', { name: 'Sprints' }).click();
  await expect(page).toHaveURL(/\/sprints/);
  await page.getByRole('button', { name: 'New sprint' }).click();
  await page.getByRole('dialog').getByLabel('Goal').fill('Ship the launch notes');
  await page.getByRole('button', { name: 'Create sprint' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Sprint 1' })).toBeVisible();

  await page.getByRole('combobox', { name: 'Plan Write release notes into a sprint' }).click();
  await page.getByRole('option', { name: 'Sprint 1' }).click();
  await expect(page.getByText('0 of 1 done')).toBeVisible();
  await page.getByRole('button', { name: 'Start sprint' }).click();
  await expect(page.getByText('Active', { exact: true }).first()).toBeVisible();

  await page.getByRole('link', { name: 'Board' }).first().click();
  await expect(page).toHaveURL(/\/sprints\/[0-9a-f-]+/);
  await expect(page.locator('article', { hasText: 'Write release notes' })).toBeVisible();
  await page.getByRole('link', { name: 'All sprints' }).click();
  await page.getByRole('button', { name: 'Complete sprint' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Complete sprint' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByText('Completed', { exact: true }).first()).toBeVisible();
  // The unfinished task went back to the backlog.
  await expect(page.getByRole('button', { name: 'Write release notes' })).toBeVisible();
});

test('writes a doc with autosave and a preview that drops unsafe markup', async () => {
  await page.getByRole('link', { name: 'Docs' }).click();
  await page.getByRole('button', { name: 'New page' }).first().click();
  await expect(page).toHaveURL(/\/docs\/[0-9a-f-]+/);
  await page.getByLabel('Page title').fill('Team handbook');
  await page.getByLabel('Page content (markdown)').fill(
    '# Welcome\n\nRead the **basics** first.\n\n- One\n- Two\n\n[click me](javascript:alert(1)) <img src=x onerror=alert(1)>',
  );
  await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 10_000 });

  await page.getByRole('tab', { name: 'Preview' }).click();
  const preview = page.getByRole('tabpanel');
  await expect(preview.getByRole('heading', { name: 'Welcome' })).toBeVisible();
  await expect(preview.getByText('click me')).toBeVisible();
  expect(await preview.locator('img').count()).toBe(0);
  const unsafeUrls = await page.evaluate(
    () =>
      [...document.querySelectorAll('[href],[src]')].filter((element) =>
        /^\s*(javascript|data|vbscript):/i.test(element.getAttribute('href') ?? element.getAttribute('src') ?? ''),
      ).length,
  );
  expect(unsafeUrls).toBe(0);
});

test('adds a sub-page that survives a reload', async () => {
  const parentUrl = page.url();
  await page.getByRole('treeitem', { name: /Team handbook/ }).hover();
  await page.getByRole('button', { name: 'Add a page inside Team handbook' }).click();
  await expect(page).not.toHaveURL(parentUrl);
  await expect(page.getByLabel('Page title')).toHaveValue('Untitled');
  await page.getByLabel('Page title').fill('First week');
  await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 10_000 });
  await page.reload();
  await expect(page.getByRole('treeitem', { name: /First week/ })).toBeVisible();
});

test('sets up leave types, a department and a profile', async () => {
  await page.getByRole('link', { name: 'Leave types' }).click();
  await page.getByRole('button', { name: 'New leave type' }).click();
  await page.getByLabel('Name').fill('Annual leave');
  await page.getByLabel('Days per year').fill('20');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button', { name: 'New leave type' }).click();
  await page.getByLabel('Name').fill('Wellbeing day');
  await page.getByLabel('Days per year').fill('2');
  await page.getByLabel('Needs approval').click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Auto-approved')).toBeVisible();

  await page.getByRole('link', { name: 'Departments' }).click();
  await page.getByRole('button', { name: 'New department' }).click();
  await page.getByRole('dialog').getByLabel('Name').fill('Product');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('heading', { name: 'Product' })).toBeVisible();

  await page.getByRole('link', { name: 'Directory' }).click();
  await page.getByRole('button', { name: "Edit Dana Reyes's profile" }).click();
  await page.getByLabel('Job title').fill('Head of Product');
  await page.getByLabel('Department').click();
  await page.getByRole('option', { name: 'Product' }).click();
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('cell', { name: /Head of Product/ })).toBeVisible();
});

test("requests time off, can't approve it themselves, and auto-approved leave updates the balance", async () => {
  await page.getByRole('link', { name: 'Time off' }).click();
  await page.getByRole('button', { name: 'Request time off' }).click();
  await page.getByLabel('First day').fill('2026-12-07');
  await page.getByLabel('Last day').fill('2026-12-11');
  await expect(page.getByText('5 working days')).toBeVisible();
  await page.getByRole('button', { name: 'Send request' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByText('Pending', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Approvals' }).click();
  await expect(page.getByText('someone else needs to decide')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0);

  await page.getByRole('link', { name: 'Time off' }).click();
  await page.getByRole('button', { name: 'Request time off' }).click();
  await page.getByLabel('Type').click();
  await page.getByRole('option', { name: 'Wellbeing day' }).click();
  await page.getByLabel('First day').fill('2026-12-14');
  await page.getByLabel('Last day').fill('2026-12-14');
  await expect(page.getByText('approved automatically')).toBeVisible();
  await page.getByRole('button', { name: 'Send request' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByText('Approved', { exact: true })).toBeVisible();
  await expect(page.getByText('of 2 days left')).toBeVisible();
});

test('creates a custom role and lists members', async () => {
  await page.getByRole('link', { name: 'Roles' }).click();
  await page.getByRole('button', { name: 'New role' }).click();
  await page.getByLabel('Role name').fill('Contractor');
  await page.getByRole('button', { name: 'Save role' }).click();
  await expect(page.getByText('Contractor')).toBeVisible();

  await page.getByRole('link', { name: 'Members' }).click();
  await expect(page.getByRole('main').getByRole('heading', { name: 'Members' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('listitem').filter({ hasText: 'Dana Reyes' })).toBeVisible();
});

test('shows the workspace audit log without IP addresses', async () => {
  await page.getByRole('link', { name: 'Audit log' }).click();
  await expect(page.getByRole('cell', { name: 'workspace.create' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'IP' })).toHaveCount(0);
});

test('opens the platform admin console after promotion by the operator CLI', async () => {
  const output = execFileSync('node', ['dist/cli/promote-super-admin.js', email], { cwd: API_DIR, env: apiEnv() }).toString();
  expect(output).toContain('Granted SUPER_ADMIN');

  await page.reload();
  await page.getByRole('button', { name: /Dana Reyes/ }).click();
  await page.getByRole('menuitem', { name: 'Platform admin' }).click();
  await expect(page).toHaveURL(/\/admin\/users/);
  await page.getByLabel('Search name or email').fill(`dana+${run}`);
  const row = page.getByRole('listitem').filter({ hasText: email });
  await expect(row.getByText('You')).toBeVisible();
  await expect(row.getByRole('button', { name: /Manage/ })).toHaveCount(0);

  await page.getByRole('link', { name: 'Workspaces', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Northwind Studio' }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Audit log' }).click();
  await expect(page.getByRole('columnheader', { name: 'IP' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'admin.user.promote' }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Back to workspaces' }).click();
  await expect(page).toHaveURL(/\/w\//);
});

test('signs out', async () => {
  await page.getByRole('button', { name: /Dana Reyes/ }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
});

test('logged no browser errors along the way', () => {
  expect(consoleErrors).toEqual([]);
});
