import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
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

  // Attach an image: it's uploaded, checked, and shown on the task.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await panel.getByLabel('Attach files to this task').setInputFiles({ name: 'release.png', mimeType: 'image/png', buffer: png });
  const thumbnail = panel.getByRole('img', { name: 'release.png' });
  await expect(thumbnail).toBeVisible();
  await expect.poll(() => thumbnail.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBe(1);

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

  // The approved day shows on the team calendar, dates and names only; the pending week doesn't.
  const months = (2026 - new Date().getFullYear()) * 12 + 11 - new Date().getMonth();
  for (let step = 0; step < Math.abs(months); step++) await page.getByRole('button', { name: months > 0 ? 'Next month' : 'Previous month' }).click();
  const calendar = page.getByRole('table', { name: /Who’s away, December 2026/ });
  await expect(calendar.getByRole('cell', { name: /December 14: .+ away$/ })).toBeVisible();
  await expect(calendar.getByRole('cell', { name: /December 8: nobody away$/ })).toBeVisible();
});

test('clocks in, takes a break, clocks out, and shows on the team week', async () => {
  await page.getByRole('link', { name: 'Attendance' }).click();
  await expect(page.getByRole('heading', { name: 'You’re not clocked in' })).toBeVisible();
  await page.getByRole('button', { name: 'Clock in' }).click();
  await expect(page.getByRole('heading', { name: /^Working since / })).toBeVisible();
  await page.getByRole('button', { name: 'Start break' }).click();
  await expect(page.getByRole('heading', { name: /^On a break since / })).toBeVisible();
  await page.getByRole('button', { name: 'End break' }).click();
  await expect(page.getByRole('heading', { name: /^Working since / })).toBeVisible();
  const team = page.getByRole('table', { name: /^Team attendance/ });
  await expect(team.getByText('In now')).toBeVisible();
  await page.getByRole('button', { name: 'Clock out' }).click();
  await expect(page.getByRole('heading', { name: 'You’re not clocked in' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Your recent shifts' }).getByRole('listitem')).toHaveCount(1);
  await expect(page.getByRole('list', { name: 'Your recent shifts' })).toContainText('1 break');
  await expect(team.getByText('In now')).toHaveCount(0);
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

test('checks access and says which policy decides', async () => {
  await page.getByRole('link', { name: 'Access', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Access' })).toBeVisible();
  const result = page.getByRole('region', { name: 'Result' });
  await expect(result.getByText('Allowed', { exact: true })).toBeVisible();
  await expect(result.getByRole('list', { name: 'Why' }).getByRole('listitem').first()).toContainText(/allow.*Full access/i);
  // Owners can delete the workspace; the answer names the role and the permission.
  await page.getByLabel('Permission').selectOption('workspace.manage');
  await expect(result).toContainText('role Owner');
  await expect(result.getByText('Allowed', { exact: true })).toBeVisible();
});

test('shows the workspace audit log without IP addresses', async () => {
  await page.getByRole('link', { name: 'Audit log' }).click();
  await expect(page.getByRole('cell', { name: 'workspace.create' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'IP' })).toHaveCount(0);
});

test('connects GitHub with a status mapping, a sync log and a pull request inbox', async () => {
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Connect a repository' }).click();
  const connect = page.getByRole('dialog', { name: 'Connect a GitHub repository' });
  await connect.getByLabel('Repository').fill('acme/web');
  await connect.getByLabel('When: Closed without merging').click();
  await page.getByRole('option', { name: 'Move to “Active”' }).click();
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  const secret = page.getByRole('dialog', { name: 'Add the webhook to acme/web' });
  await expect(secret).toBeVisible();
  await page.keyboard.press('Escape');

  const mapping = page.getByRole('table', { name: 'Status mapping' });
  await expect(mapping.getByRole('row').filter({ hasText: 'Closed without merging' })).toContainText('Active');
  await page.getByRole('button', { name: 'Sync log' }).click();
  await expect(page.getByRole('dialog', { name: 'acme/web: sync log' }).getByText('Nothing received yet.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: 'Pull requests without a task' })).toContainText('Every pull request mentions a task');
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

test('configures a Home block: its own title, colour and closed work, kept after a reload', async () => {
  await page.getByRole('navigation', { name: 'Apps' }).getByRole('link', { name: 'Home', exact: true }).click();
  const block = page.locator('section', { has: page.getByRole('heading', { name: 'Open work by status', exact: true }) }).last();
  await block.hover();
  await block.getByRole('button', { name: 'Block options' }).click();
  await page.getByRole('menuitem', { name: 'Configure…' }).click();
  const drawer = page.getByRole('dialog', { name: /Configure/ });
  await drawer.getByLabel('Title').fill('Team status');
  await drawer.getByRole('radio', { name: 'violet' }).click();
  await drawer.getByLabel('Include closed work').click();
  await drawer.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('heading', { name: 'Team status' })).toBeVisible();
  const renamed = page.locator('section', { has: page.getByRole('heading', { name: 'Team status', exact: true }) }).last();
  await expect(renamed.getByText('Done')).toBeVisible();
  // Saved with the layout (debounced), so it survives a reload.
  await page.waitForTimeout(1_500);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Team status' })).toBeVisible();
});

test('narrows a task list block to my urgent work and picks its columns', async () => {
  const block = page.locator('section', { has: page.getByRole('heading', { name: 'Overdue', exact: true }) }).last();
  await block.hover();
  await block.getByRole('button', { name: 'Block options' }).click();
  await page.getByRole('menuitem', { name: 'Configure…' }).click();
  const drawer = page.getByRole('dialog', { name: /Configure/ });
  await drawer.getByLabel('Only tasks assigned to me').click();
  await drawer.getByRole('group', { name: 'Priority' }).getByRole('button', { name: 'Urgent' }).click();
  // Show the number, hide the project, and put the date before the status.
  const columns = drawer.getByRole('list', { name: 'Columns' });
  await columns.getByRole('listitem').filter({ hasText: 'Number' }).getByRole('checkbox').click();
  await columns.getByRole('listitem').filter({ hasText: 'Project' }).getByRole('checkbox').click();
  await drawer.getByRole('button', { name: 'Move Date up' }).click();
  // Rows: Number, Title, then the columns in order.
  await expect(columns.getByRole('listitem').nth(2)).toContainText('Date');
  await drawer.getByRole('button', { name: 'Done' }).click();
  await expect(block.getByText('Mine · Urgent')).toBeVisible();
  await page.waitForTimeout(1_500);
  await page.reload();
  await expect(page.locator('section', { has: page.getByRole('heading', { name: 'Overdue', exact: true }) }).last().getByText('Mine · Urgent')).toBeVisible();
});

test('draws Hours per day as a line instead of bars', async () => {
  const block = page.locator('section', { has: page.getByRole('heading', { name: 'Hours per day', exact: true }) }).last();
  await block.hover();
  await block.getByRole('button', { name: 'Block options' }).click();
  await page.getByRole('menuitem', { name: 'Configure…' }).click();
  const drawer = page.getByRole('dialog', { name: /Configure/ });
  await drawer.getByRole('radiogroup', { name: 'Chart' }).getByRole('radio', { name: 'Line' }).click();
  await drawer.getByRole('button', { name: 'Done' }).click();
  await expect(block.getByText('8 h day')).toBeVisible();
});

test('a block follows the person picked on the page, and another narrows to chosen people', async () => {
  const blockNamed = (title: string) => page.locator('section', { has: page.getByRole('heading', { name: title, exact: true }) }).last();
  const configure = async (title: string) => {
    const block = blockNamed(title);
    await block.hover();
    await block.getByRole('button', { name: 'Block options' }).click();
    await page.getByRole('menuitem', { name: 'Configure…' }).click();
    return page.getByRole('dialog', { name: /Configure/ });
  };
  let drawer = await configure('Recently updated');
  await drawer.getByLabel("Follow the page's selection").click();
  await drawer.getByRole('button', { name: 'Done' }).click();

  drawer = await configure('Due in the next 14 days');
  await drawer.getByRole('group', { name: 'Assigned to' }).getByRole('button', { name: 'Dana Reyes' }).click();
  await drawer.getByRole('button', { name: 'Done' }).click();
  await expect(blockNamed('Due in the next 14 days').getByText('Dana Reyes', { exact: true })).toBeVisible();

  // Pick Dana in the team workload: the following block links to her, the others don't move.
  await blockNamed('Team workload').getByRole('button', { name: 'Dana Reyes' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'in blocks that follow the page' })).toContainText('Dana Reyes');
  await expect(blockNamed('Recently updated').getByText('Linked to Dana Reyes')).toBeVisible();
  await expect(blockNamed('Overdue').getByText(/Linked to/)).toHaveCount(0);
  // The chip clears it, like the bar does.
  await blockNamed('Recently updated').getByRole('button', { name: 'Clear the page selection' }).click();
  await expect(blockNamed('Recently updated').getByText(/Linked to/)).toHaveCount(0);
  await expect(page.getByText('in blocks that follow the page')).toHaveCount(0);
});

test('a named dashboard remembers its date range, and tiles show trends', async () => {
  await expect(page.getByRole('img', { name: /^Tasks created per week, last 8 weeks: Week of/ })).toBeVisible();
  await page.getByRole('button', { name: 'New dashboard' }).click();
  const dialog = page.getByRole('dialog', { name: 'New dashboard' });
  await dialog.getByLabel('Dashboard name').fill('Monthly review');
  await dialog.getByRole('button', { name: 'Create' }).click();
  const period = page.getByRole('radiogroup', { name: 'Period' });
  await period.getByRole('radio', { name: 'Last month' }).click();
  await expect(page.getByText(/saved with this dashboard/)).toBeVisible();
  await page.waitForTimeout(500);
  await page.reload();
  // The overview keeps its own range; the dashboard opens with the saved one.
  await expect(period.getByRole('radio', { name: 'This week' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('navigation', { name: 'Dashboards' }).getByText('Monthly review').click();
  await expect(period.getByRole('radio', { name: 'Last month' })).toHaveAttribute('aria-checked', 'true');

  // A custom range: any days, both ends included; it's saved with the dashboard too.
  await page.getByRole('button', { name: 'Custom…' }).click();
  const range = page.getByRole('dialog').filter({ hasText: 'Custom range' });
  await range.getByLabel('From', { exact: true }).fill('2026-03-10');
  await range.getByLabel('To', { exact: true }).fill('2026-03-01');
  await expect(range.getByText('The range must end on or after its first day.')).toBeVisible();
  await expect(range.getByRole('button', { name: 'Apply' })).toBeDisabled();
  await range.getByLabel('To', { exact: true }).fill('2026-03-16');
  await expect(range.getByText('7 days, both ends included.')).toBeVisible();
  await range.getByRole('button', { name: 'Apply' }).click();
  const custom = page.getByRole('button', { name: /^Mar 10 – Mar 16$/ });
  await expect(custom).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('03/10/26 – 03/16/26')).toBeVisible();
  await expect(period.getByRole('radio', { name: 'Last month' })).toHaveAttribute('aria-checked', 'false');

  // Share it with Dana's team (her department), not the whole workspace.
  await page.getByRole('button', { name: 'Monthly review options' }).click();
  await page.getByRole('menuitemradio', { name: 'Team: Product' }).click();
  await expect(page.getByRole('navigation', { name: 'Dashboards' }).getByRole('button', { name: /Monthly review/ })).toHaveAttribute('title', 'Shared with Product');
  await page.waitForTimeout(500);
  await page.reload();
  await page.getByRole('navigation', { name: 'Dashboards' }).getByText('Monthly review').click();
  await expect(page.getByRole('button', { name: /^Mar 10 – Mar 16$/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Monthly review options' }).click();
  await expect(page.getByRole('menuitemradio', { name: 'Team: Product' })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await page.getByRole('navigation', { name: 'Dashboards' }).getByText('Overview').click();
});

test('goes back through layout versions and publishes the workspace default', async () => {
  await page.getByRole('button', { name: /Arrange/ }).click();
  // Move a block from the keyboard, which saves a second version.
  const first = page.getByRole('group', { name: /block, column/ }).first();
  await first.focus();
  await page.keyboard.press('Alt+ArrowDown');
  await page.waitForTimeout(1_500);
  await page.getByRole('button', { name: 'Layout' }).click();
  await page.getByRole('menuitem', { name: 'Version history…' }).click();
  const history = page.getByRole('dialog', { name: 'Version history' });
  await expect(history.getByRole('listitem').first()).toContainText('current');
  await history.getByRole('button', { name: 'Restore' }).last().click();
  await expect(page.getByText(/Restored version/)).toBeVisible();
  await page.getByRole('button', { name: 'Layout' }).click();
  await page.getByRole('menuitem', { name: 'Make this the workspace default' }).click();
  await expect(page.getByText('This is now the workspace default')).toBeVisible();
  await page.getByRole('button', { name: /^Done/ }).click();
});

test('exports the Home layout as a .tflow file and imports it back', async () => {
  await page.getByRole('button', { name: /Arrange/ }).click();
  await page.getByRole('button', { name: 'Layout' }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Export as .tflow' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('home-layout.tflow');
  const saved = await download.path();
  const file = JSON.parse(readFileSync(saved, 'utf8')) as { kind: string; payload: { pageKey: string; items: unknown[] } };
  expect(file).toMatchObject({ kind: 'dashboard-layout', payload: { pageKey: 'home' } });
  expect(file.payload.items.length).toBeGreaterThan(3);

  await page.getByLabel('Layout file to import').setInputFiles(saved);
  await expect(page.getByText('Layout imported. Undo puts the old one back.')).toBeVisible();
  // A file of another kind is refused with a reason.
  await page.getByLabel('Layout file to import').setInputFiles({ name: 'template.tflow', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ kind: 'project-template', version: 1, payload: {} })) });
  await expect(page.getByText('That file isn’t a dashboard layout')).toBeVisible();
  await page.getByRole('button', { name: /^Done/ }).click();
});

test('locks the workspace layout and previews what Reset brings back', async () => {
  await page.getByRole('button', { name: /Arrange/ }).click();
  await page.getByRole('button', { name: 'Layout' }).click();
  await page.getByRole('menuitem', { name: 'Lock it for everyone' }).click();
  await expect(page.getByText('Locked: everyone now sees the workspace default')).toBeVisible();

  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Reset this layout?' });
  await expect(confirm.getByRole('img', { name: /^What Reset brings back: / })).toBeVisible();
  await confirm.getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('button', { name: 'Layout' }).click();
  await page.getByRole('menuitem', { name: 'Unlock the workspace default' }).click();
  await expect(page.getByText('Unlocked: people can arrange the page again')).toBeVisible();
  await page.getByRole('button', { name: /^Done/ }).click();
});

test('pins a block for everyone, and unpins it', async () => {
  const block = page.locator('section', { has: page.getByRole('heading', { name: 'Priority', exact: true }) }).last();
  const options = async () => {
    await block.hover();
    await block.getByRole('button', { name: 'Block options' }).click();
  };
  await options();
  await page.getByRole('menuitem', { name: 'Pin for everyone' }).click();
  // A draft until it's published as the workspace default.
  await expect(block.getByText('Pinned for everyone once published')).toBeVisible();
  await options();
  await page.getByRole('menuitem', { name: 'Unpin for everyone' }).click();
  await expect(block.getByText('Pinned for everyone once published')).toHaveCount(0);
});

test('adds a section heading and stacks two blocks as tabs in one slot', async () => {
  await page.getByRole('button', { name: /Arrange/ }).click();
  await page.getByRole('button', { name: /Add block/ }).click();
  await page.getByRole('button', { name: 'Add Section' }).click();
  await expect(page.getByRole('heading', { name: 'Section', level: 2 })).toBeVisible();
  await page.getByRole('button', { name: /^Done/ }).click();

  // Take Team workload off the page, then stack it with Priority (from the block menus).
  const workload = page.locator('section', { has: page.getByRole('heading', { name: 'Team workload', exact: true }) }).last();
  await workload.hover();
  await workload.getByRole('button', { name: 'Block options' }).click();
  await page.getByRole('menuitem', { name: 'Remove' }).click();
  const priority = page.locator('section', { has: page.getByRole('heading', { name: 'Priority', exact: true }) }).last();
  await priority.hover();
  await priority.getByRole('button', { name: 'Block options' }).click();
  await page.getByRole('menuitem', { name: 'Stack another block here…' }).click();
  const library = page.getByRole('dialog', { name: 'Stack a block with Priority' });
  await library.getByRole('button', { name: 'Add Team workload' }).click();

  const tabs = page.getByRole('tablist', { name: 'Stacked blocks' });
  await expect(tabs.getByRole('tab')).toHaveCount(2);
  await tabs.getByRole('tab', { name: 'Team workload' }).click();
  await expect(page.getByRole('heading', { name: 'Team workload', exact: true })).toBeVisible();
  await expect(tabs.getByRole('tab', { name: 'Team workload' })).toHaveAttribute('aria-selected', 'true');

  // Move the section to the top (from the keyboard), then fold everything under it.
  await page.getByRole('button', { name: /Arrange/ }).click();
  const sectionBlock = page.getByRole('group', { name: /^Section block/ });
  await sectionBlock.focus();
  for (let row = 0; row < 60; row++) await sectionBlock.press('Alt+ArrowUp');
  await expect(sectionBlock).toHaveAttribute('aria-label', /row 1,/);
  await page.getByRole('button', { name: /^Done/ }).click();
  await page.getByRole('button', { name: 'Collapse Section' }).click();
  await expect(page.getByRole('button', { name: 'Show Section' })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByText(/\d+ blocks hidden/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Created vs closed', exact: true })).toHaveCount(0);
  // Remembered in this browser, and never part of the saved layout.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Show Section' })).toBeVisible();
  await page.getByRole('button', { name: 'Show Section' }).click();
  await expect(page.getByRole('heading', { name: 'Created vs closed', exact: true })).toBeVisible();
});

test('builds an automation flow with an if / else branch and gets it back', async () => {
  await page.getByRole('navigation', { name: 'Main' }).getByText('Ops', { exact: true }).click();
  await page.goto(page.url().replace(/\/p\/([^/?]+).*/, '/p/$1/automations'));
  await page.getByRole('button', { name: 'New automation' }).click();
  const builder = page.getByRole('dialog', { name: 'New automation' });
  await builder.getByLabel('Automation name').fill('Urgent triage');

  // Put an if / else in front of the starter step, then add a comment to its Yes branch.
  await builder.getByRole('button', { name: 'Add a step here' }).first().click();
  await page.getByRole('menuitem', { name: 'If / else' }).click();
  const yes = builder.getByRole('region', { name: /^Yes branch of/ });
  await yes.getByRole('button', { name: 'Add a step here' }).first().click();
  await page.getByRole('menuitem', { name: 'Action' }).click();
  await builder.getByLabel('Action type').click();
  await page.getByRole('option', { name: 'Add a comment' }).click();
  await builder.getByLabel('Comment text').fill('Triage {{task}} today');
  await expect(yes.getByRole('treeitem').filter({ hasText: 'Triage' })).toBeVisible();
  await expect(page.getByText(/When a task is created, then if priority is Urgent/)).toBeVisible();
  await builder.getByRole('button', { name: 'Create automation' }).click();
  await expect(builder).toBeHidden();

  // It comes back as the same flow.
  await page.getByRole('button', { name: 'Edit' }).first().click();
  const editor = page.getByRole('dialog', { name: 'Edit automation' });
  await expect(editor.getByRole('region', { name: /^Yes branch of/ }).getByRole('treeitem')).toContainText('Triage');
  await editor.getByRole('button', { name: 'Cancel' }).click();
});

test('schedules an overdue automation with a wait', async () => {
  await page.getByRole('button', { name: 'New automation' }).click();
  const builder = page.getByRole('dialog', { name: 'New automation' });
  await builder.getByLabel('Automation name').fill('Overdue nudge');
  await builder.getByLabel('Trigger').click();
  await page.getByRole('option', { name: 'A task becomes overdue' }).click();
  await expect(builder.getByText(/Fires once per open task and due date/)).toBeVisible();

  // Wait 2 hours before the starter step.
  await builder.getByRole('button', { name: 'Add a step here' }).first().click();
  await page.getByRole('menuitem', { name: 'Wait' }).click();
  await builder.getByLabel('Wait unit').click();
  await page.getByRole('option', { name: 'hours' }).click();
  await builder.getByLabel('Wait amount').fill('2');
  await expect(builder.getByRole('treeitem').filter({ hasText: 'Wait 2 hours' })).toBeVisible();
  await expect(page.getByText(/When a task becomes overdue, then wait 2 hours, then notify/)).toBeVisible();
  await builder.getByRole('button', { name: 'Create automation' }).click();
  await expect(builder).toBeHidden();

  await page.getByRole('button', { name: 'Edit' }).last().click();
  const editor = page.getByRole('dialog', { name: 'Edit automation' });
  await expect(editor.getByRole('treeitem').first()).toContainText('Wait 2 hours');
  await editor.getByRole('button', { name: 'Cancel' }).click();
});

test('starts an automation from a template and test-runs it on a task without changing it', async () => {
  await page.getByRole('button', { name: 'New automation' }).click();
  const builder = page.getByRole('dialog', { name: 'New automation' });
  await builder.getByLabel('Start from a template').click();
  await page.getByRole('option', { name: /Nudge, then escalate overdue work/ }).click();
  await expect(builder.getByLabel('Automation name')).toHaveValue('Nudge, then escalate overdue work');
  await expect(builder.getByRole('treeitem').filter({ hasText: 'Wait 1 day' })).toBeVisible();

  await builder.getByLabel('Test run').click();
  await page.getByRole('option').first().click();
  await expect(builder.getByRole('status').filter({ hasText: /Test run on #\d+/ })).toContainText('nothing was changed');
  await expect(builder.getByRole('treeitem').filter({ hasText: 'Wait 1 day' })).toContainText('Waited');
  await builder.getByRole('button', { name: 'Create automation' }).click();
  await expect(builder).toBeHidden();
  await expect(page.getByText('Nudge, then escalate overdue work', { exact: true })).toBeVisible();
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
  // The new task says where it came up in chat: here, the "created" line in the thread.
  await page.getByRole('tab', { name: /^Chat/ }).click();
  await expect(page.getByRole('list', { name: 'Chat messages about this task' }).getByRole('listitem')).toContainText(['release-train']);
  await page.keyboard.press('Escape');
  await expect(thread.getByText(/created/)).toBeVisible();
  await thread.getByRole('button', { name: 'Close thread' }).click();
  await expect(thread).toBeHidden();

  // @ suggests people; the message shows the name, never the stored id.
  await composer.fill('Thanks @Da');
  await page.getByRole('listbox', { name: 'People' }).getByRole('option', { name: /Dana Reyes/ }).click();
  await expect(composer).toHaveValue('Thanks @Dana Reyes ');
  await composer.press('Enter');
  const mention = page.getByRole('log', { name: 'Messages in #release-train' }).getByRole('article').filter({ hasText: 'Thanks' });
  await expect(mention).toContainText('Thanks @Dana Reyes');
  await expect(mention).not.toContainText('@{');

  // Quick reactions toggle on and off.
  await mention.hover();
  await mention.getByRole('button', { name: 'Add reaction' }).click();
  await page.getByRole('button', { name: 'React with 🎉' }).click();
  const party = mention.getByRole('button', { name: '🎉 1, including you' });
  await expect(party).toHaveAttribute('aria-pressed', 'true');
  await party.click();
  await expect(mention.getByRole('list', { name: 'Reactions' })).toHaveCount(0);

  // Search finds messages by the start of their words and opens the hit.
  await page.getByRole('button', { name: 'Search messages ( / )' }).click();
  const search = page.getByRole('combobox', { name: 'Search messages' });
  await search.fill('relea not');
  const hit = page.getByRole('listbox', { name: 'Results' }).getByRole('option').first();
  await expect(hit).toContainText('release notes');
  await expect(hit.locator('mark').first()).toHaveText('release');
  await search.press('Enter');
  await expect(page).toHaveURL(/\/chat\/[0-9a-f-]{36}\?thread=/);

  // Attach an image: it uploads, gets checked, and shows in the message once sent.
  await page.getByRole('button', { name: 'Close thread' }).click();
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64').subarray(8)]);
  await page.locator('section[aria-label="#release-train"] input[type="file"]').setInputFiles({ name: 'diagram.png', mimeType: 'image/png', buffer: png });
  const pending = page.getByRole('list', { name: 'Files to send' });
  await expect(pending.getByText(/B$/)).toBeVisible();
  await composer.press('Enter');
  await expect(pending).toHaveCount(0);
  const image = page.getByRole('log', { name: 'Messages in #release-train' }).getByRole('img', { name: 'diagram.png' });
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBe(1);

  // The owner renames the channel and gives it a topic.
  await page.getByRole('button', { name: 'Channel options' }).click();
  await page.getByRole('menuitem', { name: 'Edit name and topic' }).click();
  const edit = page.getByRole('dialog', { name: 'Edit channel' });
  await edit.getByLabel('Name').fill('Release Crew');
  await expect(edit.getByText('Will be saved as #release-crew')).toBeVisible();
  await edit.getByLabel('Topic').fill('Ship notes every Friday');
  await edit.getByRole('button', { name: 'Save' }).click();
  await expect(edit).toBeHidden();
  await expect(page.getByRole('heading', { name: 'release-crew', level: 2 })).toBeVisible();
  await expect(page.getByText('· Ship notes every Friday')).toBeVisible();
});

test('sets how long chat is kept, and chat says so', async () => {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Settings' }).click();
  await page.getByLabel('Keep chat for').selectOption('365');
  await page.getByRole('button', { name: 'Save' }).last().click();
  const confirm = page.getByRole('dialog', { name: 'Keep chat for 1 year?' });
  await expect(confirm).toContainText('deleted for everyone');
  await confirm.getByRole('button', { name: 'Delete older chat' }).click();
  await expect(page.getByText('Chat is kept for 1 year')).toBeVisible();
  await page.getByRole('navigation', { name: 'Apps' }).getByRole('link', { name: /^Chat/ }).click();
  await expect(page.getByText('Chat is kept for 1 year, then removed.')).toBeVisible();
});

test('fits a phone: bottom tabs, a menu drawer and a bottom-sheet new task', async () => {
  const desktop = page.viewportSize()!;
  await page.setViewportSize({ width: 390, height: 844 });
  try {
    const tabs = page.getByRole('navigation', { name: 'Main sections' });
    await tabs.getByRole('link', { name: 'My tasks' }).click();
    await expect(page.getByRole('heading', { name: 'My tasks', level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

    // The sidebar slides in from the menu button, and closes when you go somewhere.
    await page.getByRole('button', { name: 'Open menu' }).click();
    const drawer = page.getByRole('dialog', { name: 'Menu' });
    await expect(drawer).toBeVisible();
    await drawer.getByRole('link', { name: 'Docs' }).first().click();
    await expect(drawer).toBeHidden();
    await expect(page).toHaveURL(/\/docs/);

    // New task opens as a sheet along the bottom edge.
    await tabs.getByRole('button', { name: 'New task' }).click();
    const sheet = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Create Task' }) });
    await expect(sheet).toBeVisible();
    // Polled: the sheet slides up into place.
    await expect.poll(async () => sheet.boundingBox().then((box) => box && [Math.round(box.y + box.height), Math.round(box.width)])).toEqual([844, 390]);
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
  } finally {
    await page.setViewportSize(desktop);
  }
  await expect(page.getByRole('navigation', { name: 'Main sections' })).toBeHidden();
});

test('signs out', async () => {
  await page.getByRole('button', { name: /Dana Reyes/ }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
});

test('logged no browser errors along the way', () => {
  expect(consoleErrors).toEqual([]);
});
