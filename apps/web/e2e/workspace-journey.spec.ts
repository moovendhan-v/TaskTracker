import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { API_DIR, apiEnv } from './support/stack';

/**
 * One person's first day in TaskFlow, end to end in a real browser: sign-up,
 * workspace setup, tasks, live updates, sprints, docs, HR, roles, the audit
 * log, the platform admin console and the inbox. Steps share one page and run in order.
 */
test.describe.configure({ mode: 'serial' });

const run = randomUUID().slice(0, 8);
const email = `dana+${run}@example.com`;
let context: BrowserContext;
let page: Page;
const consoleErrors: string[] = [];

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  page.on('console', (message) => message.type() === 'error' && consoleErrors.push(message.text()));
  page.on('pageerror', (error) => consoleErrors.push(error.message));
});

test.afterAll(async () => {
  await context.close();
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
  // New accounts are asked to confirm their email; invites only reach confirmed addresses.
  await expect(page.getByRole('status').filter({ hasText: 'Confirm your email' })).toBeVisible();

  await page.getByRole('button', { name: 'New space' }).click();
  await page.getByRole('menuitem', { name: 'Blank space' }).click();
  await page.getByRole('dialog').getByLabel('Name').fill('Product');
  await page.getByRole('button', { name: 'Create space' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  const nav = page.getByRole('complementary', { name: 'Workspace navigation' });
  await expect(nav.getByText('Product')).toBeVisible();

  await nav.getByText('Product').hover();
  await page.getByRole('button', { name: 'Add to Product' }).click();
  await page.getByRole('menuitem', { name: 'List' }).click();
  await page.getByRole('dialog').getByLabel('Name').fill('Launch plan');
  await page.getByRole('button', { name: 'Create list' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await nav.getByRole('link', { name: 'Launch plan' }).click();
  await expect(page).toHaveURL(/\/p\/[0-9a-f-]+\/list\?list=/);
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
  await row.getByRole('button', { name: /Status:/ }).first().click();
  await page.getByRole('menuitem', { name: 'In progress' }).click();
  await expect(page.locator('section', { hasText: 'In progress' }).getByRole('button', { name: 'Fix sign-in bug' })).toBeVisible();
});

test('filters tasks by search', async () => {
  await page.getByLabel('Search tasks').fill('release');
  await expect(page.getByRole('button', { name: 'Design onboarding emails' })).toBeHidden();
  await page.getByLabel('Search tasks').fill('');
  await expect(page.getByRole('button', { name: 'Design onboarding emails' })).toBeVisible();
});

test('shows changes made in another tab without reloading', async () => {
  await expect(page.getByRole('status').filter({ hasText: 'Live' })).toBeVisible();
  const otherTab = await context.newPage();
  await otherTab.goto(page.url());
  await otherTab.getByRole('button', { name: 'Add task' }).first().click();
  await otherTab.getByLabel('New task name').fill('Book the launch venue');
  await otherTab.keyboard.press('Enter');
  await expect(otherTab.getByRole('button', { name: 'Book the launch venue' })).toBeVisible();
  await otherTab.close();
  await expect(page.getByRole('button', { name: 'Book the launch venue' })).toBeVisible();
});

test('edits a task and renders comments as text, never HTML', async () => {
  await page.getByRole('button', { name: 'Write release notes', exact: true }).click();
  await expect(page).toHaveURL(/task=/);
  const panel = page.getByRole('dialog');
  await panel.getByRole('button', { name: 'Description' }).click();
  await panel.getByRole('textbox', { name: 'Description' }).fill('Summarise the changes for customers.');
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
  // Five status columns need a wide screen to all be in view; narrower ones scroll sideways.
  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.getByRole('navigation', { name: 'Project views' }).getByRole('link', { name: 'Board', exact: true }).click();
  const done = page.getByRole('region', { name: 'Done' });
  await page.locator('article', { hasText: 'Design onboarding emails' }).dragTo(done);
  await expect(done.locator('article', { hasText: 'Design onboarding emails' })).toBeVisible();
  await page.reload();
  // Closed tasks are hidden until "Show closed" is on.
  await expect(page.locator('article', { hasText: 'Design onboarding emails' })).toBeHidden();
  await page.getByRole('button', { name: 'Show closed' }).click();
  await expect(page.getByRole('region', { name: 'Done' }).locator('article', { hasText: 'Design onboarding emails' })).toBeVisible();
  await page.getByRole('button', { name: 'Show closed' }).click();
});

test('plans, starts and completes a sprint', async () => {
  // Sprints lives in the "More views" menu next to the core views.
  await page.getByRole('navigation', { name: 'Project views' }).getByRole('button', { name: 'More views and tools' }).click();
  await page.getByRole('menuitem', { name: /^Sprints/ }).click();
  await expect(page).toHaveURL(/\/sprints/);
  await page.getByRole('button', { name: 'New sprint' }).click();
  await page.getByRole('dialog').getByLabel('Goal').fill('Ship the launch notes');
  await page.getByRole('button', { name: 'Create sprint' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  const lane = page.getByRole('region', { name: 'Sprint 1', exact: true });
  await expect(lane).toBeVisible();

  // Plan the task from the backlog, then start the sprint from its lane.
  const backlog = page.getByRole('region', { name: 'Backlog' });
  await backlog.getByRole('checkbox', { name: 'Select Write release notes' }).click();
  await backlog.getByRole('button', { name: 'Move 1 to…' }).click();
  await page.getByRole('menuitem', { name: /Sprint 1/ }).click();
  await expect(lane.getByRole('button', { name: 'Write release notes', exact: true })).toBeVisible();
  await lane.getByRole('button', { name: 'Start' }).click();
  const activePanel = page.getByRole('region', { name: 'Active sprint: Sprint 1' });
  await expect(activePanel).toBeVisible();

  await lane.getByRole('link', { name: 'Board' }).click();
  await expect(page).toHaveURL(/\/sprints\/[0-9a-f-]+/);
  await expect(page.locator('article', { hasText: 'Write release notes' })).toBeVisible();
  await page.getByRole('link', { name: 'All sprints' }).click();
  // Completing is three steps: summary, where unfinished work goes (backlog by default here), review.
  await activePanel.getByRole('button', { name: 'Complete sprint…' }).click();
  const complete = page.getByRole('dialog');
  await complete.getByRole('button', { name: 'Next' }).click();
  await expect(complete.getByRole('combobox', { name: 'Destination for Write release notes' })).toHaveValue('backlog');
  await complete.getByRole('button', { name: 'Next' }).click();
  await expect(complete.getByText('Backlog')).toBeVisible();
  await complete.getByRole('button', { name: 'Complete sprint' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByText('Completed sprints')).toBeVisible();
  // The unfinished task went back to the backlog.
  await expect(page.getByRole('region', { name: 'Backlog' }).getByRole('button', { name: 'Write release notes', exact: true })).toBeVisible();
});

test('writes a doc with autosave and a preview that drops unsafe markup', async () => {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Docs' }).click();
  await page.getByRole('button', { name: 'New page' }).first().click();
  await expect(page).toHaveURL(/\/docs\/[0-9a-f-]+/);
  await page.getByLabel('Document title').fill('Team handbook');
  // The editor opens in Visual mode; the raw markdown is in Markdown mode.
  await page.getByRole('group', { name: 'Editor mode' }).getByRole('button', { name: 'Markdown' }).click();
  await page.getByLabel('Page content (markdown)').fill(
    '# Welcome\n\nRead the **basics** first.\n\n- One\n- Two\n\n[click me](javascript:alert(1)) <img src=x onerror=alert(1)>',
  );
  await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 10_000 });

  await page.getByRole('group', { name: 'Editor mode' }).getByRole('button', { name: 'Preview' }).click();
  const preview = page.getByRole('article', { name: 'Preview' });
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
  await page.getByRole('button', { name: 'Add inside Team handbook' }).click();
  await page.getByRole('menuitem', { name: 'New page' }).click();
  await expect(page).not.toHaveURL(parentUrl);
  await expect(page.getByLabel('Document title')).toHaveValue('Untitled');
  await page.getByLabel('Document title').fill('First week');
  await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 10_000 });
  await page.reload();
  await expect(page.getByRole('treeitem', { name: /First week/ })).toBeVisible();
});

test('makes a folder and drags a page into it', async () => {
  await page.getByRole('button', { name: 'New folder' }).first().click();
  await expect(page.getByLabel('Folder name')).toHaveValue('New folder');
  await page.getByLabel('Folder name').fill('Handbooks');
  await page.getByLabel('Folder name').press('Enter');
  const folder = page.getByRole('treeitem', { name: /Handbooks/ });
  await expect(folder).toBeVisible();
  await expect(page.getByText('This folder is empty.', { exact: false })).toBeVisible();

  const handbookRow = page.getByRole('treeitem', { name: /Team handbook/ }).locator('> div');
  await handbookRow.dragTo(folder.locator('> div'));
  await expect(folder.getByRole('treeitem', { name: /Team handbook/ })).toBeVisible();
  await expect(page.getByRole('article').getByRole('link', { name: /Team handbook/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('treeitem', { name: /Handbooks/ }).getByRole('treeitem', { name: /Team handbook/ })).toBeVisible();
});

test('creates a task in a project that has no lists yet', async () => {
  await page.getByRole('button', { name: 'New space' }).click();
  await page.getByRole('menuitem', { name: 'Blank space' }).click();
  await page.getByRole('dialog').getByLabel('Name').fill('Ops');
  await page.getByRole('button', { name: 'Create space' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button', { name: /^Task$|New task/ }).first().click();
  const dialog = page.getByRole('dialog', { name: 'New task' });
  await dialog.getByRole('button', { name: /^Project:/ }).click();
  await page.getByRole('option', { name: 'Ops' }).click();
  await dialog.getByLabel('Task name').fill('Renew the TLS certificate');
  await dialog.getByRole('button', { name: /^Priority:/ }).click();
  await page.getByRole('option', { name: 'High' }).click();
  await dialog.getByRole('button', { name: 'Create Task' }).click();
  await expect(dialog).toBeHidden();
  const task = page.getByRole('dialog', { name: 'Renew the TLS certificate' });
  await expect(task.getByLabel('Task title')).toHaveValue('Renew the TLS certificate');
  await page.keyboard.press('Escape');
  await page.getByRole('complementary', { name: 'Workspace navigation' }).getByText('Ops', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Renew the TLS certificate' })).toBeVisible();
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

test('opens an empty inbox', async () => {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Inbox' }).click();
  await expect(page).toHaveURL(/\/inbox$/);
  await expect(page.getByText('You’re all caught up')).toBeVisible();
});

test('docks the inbox as a side panel from the rail', async () => {
  const bell = page.getByRole('navigation', { name: 'Apps' }).getByRole('button', { name: /^Inbox/ });
  await bell.click();
  const panel = page.getByRole('complementary', { name: 'Inbox' });
  await expect(panel).toBeVisible();
  await expect(bell).toHaveAttribute('aria-pressed', 'true');
  await panel.getByRole('radio', { name: 'All' }).click();
  await panel.getByRole('button', { name: 'Close inbox' }).click();
  await expect(panel).toBeHidden();
});

test('chats in a channel, replies in a thread and turns a message into a task', async () => {
  await page.getByRole('navigation', { name: 'Apps' }).getByRole('link', { name: /^Chat/ }).click();
  await expect(page.getByText('Start a conversation')).toBeVisible();
  await page.getByRole('button', { name: 'New channel' }).first().click();
  const create = page.getByRole('dialog', { name: 'New channel' });
  await create.getByLabel('Name').fill('Release Train');
  await expect(create.getByText('Will be created as #release-train')).toBeVisible();
  await create.getByRole('button', { name: 'Create' }).click();
  await expect(page).toHaveURL(/\/chat\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name: 'Welcome to #release-train' })).toBeVisible();

  const composer = page.getByRole('combobox', { name: 'Message #release-train' });
  await composer.fill('Ship the **release notes** <img src=x onerror=alert(1)>');
  await composer.press('Enter');
  const message = page.getByRole('log', { name: 'Messages in #release-train' }).getByRole('article').filter({ hasText: 'Ship the release notes' });
  await expect(message.locator('strong')).toHaveText('release notes');
  await expect(message.locator('img')).toHaveCount(0);

  await message.hover();
  await message.getByRole('button', { name: 'Reply in thread' }).click();
  const thread = page.getByRole('complementary', { name: 'Thread' });
  await thread.getByRole('combobox', { name: 'Reply…' }).fill('On it');
  await thread.getByRole('combobox', { name: 'Reply…' }).press('Enter');
  await expect(thread.getByRole('log', { name: 'Replies' }).getByText('On it')).toBeVisible();
  await expect(thread.getByRole('combobox', { name: 'Reply…' })).toHaveValue('');
  await expect(message.getByRole('button', { name: /1 reply/ })).toBeVisible();

  await message.hover();
  await message.getByRole('button', { name: 'Create task' }).click();
  const dialog = page.getByRole('dialog', { name: 'Create task from message' });
  await dialog.getByRole('button', { name: 'Create task' }).click();
  await expect(page).toHaveURL(/[?&]task=[0-9a-f-]{36}/);
  await page.keyboard.press('Escape');
  await expect(thread.getByText(/created/)).toBeVisible();
  await thread.getByRole('button', { name: 'Close thread' }).click();
  await expect(thread).toBeHidden();
});

test('signs out', async () => {
  await page.getByRole('button', { name: /Dana Reyes/ }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
});

test('logged no browser errors along the way', () => {
  expect(consoleErrors).toEqual([]);
});
