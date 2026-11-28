import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { clientIpHeaders, WEB_URL } from './support/stack';

/**
 * E6.4 QA in the browser: write test cases in a suite, plan a release, run the cases step by
 * step, watch a failure file a bug, retest it after the fix, approve the plan, and see coverage.
 */
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

const graphql = async <T,>(query: string, variables: object): Promise<T> => {
  const response = await page.request.post(`${WEB_URL}/api/graphql`, { data: { query, variables }, headers: { Origin: WEB_URL } });
  const body = (await response.json()) as { data: T; errors?: unknown };
  if (body.errors) throw new Error(JSON.stringify(body.errors));
  return body.data;
};

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext({ extraHTTPHeaders: clientIpHeaders(), viewport: { width: 1360, height: 900 } });
  page = await context.newPage();
});

test.afterAll(async () => {
  await context?.close();
});

test('sets up a project with a feature to test', async () => {
  await page.goto(`${WEB_URL}/sign-up`);
  await page.getByLabel('Full name').fill('Quinn QA');
  await page.getByLabel('Work email').fill(`qa-${Date.now()}@example.com`);
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
  await page.getByRole('dialog').getByLabel('Name').fill('Checkout');
  await page.getByRole('button', { name: 'Create space' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  spaceId = (await graphql<{ spaces: { id: string }[] }>('query($w: ID!) { spaces(workspaceId: $w) { id } }', { w: workspaceId })).spaces[0]!.id;
  await graphql('mutation($w: ID!, $s: ID!) { createTaskInSpace(workspaceId: $w, spaceId: $s, input: { title: "Pay by card", type: feature }) { id } }', { w: workspaceId, s: spaceId });
});

test('writes test cases in a suite', async () => {
  await page.goto(`${WEB_URL}/w/${workspaceId}/p/${spaceId}/qa`);
  await page.getByRole('tab', { name: 'Test cases' }).click();
  await page.getByLabel('New suite name').fill('Payments');
  await page.getByRole('button', { name: 'Add suite' }).click();
  await page.getByRole('navigation', { name: 'Suites' }).getByRole('button', { name: /Payments/ }).click();

  await page.getByRole('button', { name: 'New test case' }).click();
  let dialog = page.getByRole('dialog', { name: 'New test case' });
  await dialog.getByLabel('Title').fill('Pay with a saved card');
  await dialog.getByLabel('Priority').click();
  await page.getByRole('option', { name: 'Critical' }).click();
  await dialog.getByLabel('Covers feature').click();
  await page.getByRole('option', { name: /Pay by card/ }).click();
  await dialog.getByLabel('Preconditions').fill('A cart with one item, signed in');
  await dialog.getByLabel('Step 1 action').fill('Open the cart and press Pay');
  await dialog.getByLabel('Step 1 expected').fill('The saved card is selected');
  await dialog.getByRole('button', { name: 'Add step' }).click();
  await dialog.getByLabel('Step 2 action').fill('Confirm the payment');
  await dialog.getByLabel('Step 2 expected').fill('“Order placed” shows with an order number');
  await shot(page, 'e6-qa-case', dialog);
  await dialog.getByRole('button', { name: 'Create test case' }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: 'New test case' }).click();
  dialog = page.getByRole('dialog', { name: 'New test case' });
  await dialog.getByLabel('Title').fill('Refund a payment');
  await dialog.getByLabel('Step 1 action').fill('Open the order and press Refund');
  await dialog.getByLabel('Step 1 expected').fill('The refund is confirmed');
  await dialog.getByRole('button', { name: 'Create test case' }).click();
  await expect(dialog).toBeHidden();

  const list = page.getByRole('list', { name: 'Test cases' });
  await expect(list.getByRole('listitem')).toHaveCount(2);
  await expect(list).toContainText('covers “Pay by card”');
});

test('plans a release, runs it, and a failure files a bug', async () => {
  await page.getByRole('tab', { name: 'Test plans' }).click();
  await page.getByRole('button', { name: 'New test plan' }).click();
  const create = page.getByRole('dialog', { name: 'New test plan' });
  await create.getByLabel('Name').fill('Release 3.0');
  await create.getByLabel('Release (optional)').fill('3.0.0');
  await create.getByRole('button', { name: 'Create plan' }).click();
  const cases = page.getByRole('list', { name: 'Plan cases' });
  await expect(cases.getByRole('listitem')).toHaveCount(2);
  await expect(page.getByTestId('readiness-verdict')).toHaveText('Not ready to release');

  // C-1 passes, step by step.
  await page.getByRole('button', { name: 'Run C-1' }).click();
  let run = page.getByRole('dialog', { name: /Run C-1/ });
  await expect(run).toContainText('Before you start: A cart with one item, signed in');
  await run.getByLabel('Build (optional)').fill('3.0.0-rc1');
  await shot(page, 'e6-qa-run', run);
  await run.getByRole('button', { name: 'Save result: Passed' }).click();
  await expect(run).toBeHidden();

  // C-2 fails at its step: a bug is filed.
  await page.getByRole('button', { name: 'Run C-2' }).click();
  run = page.getByRole('dialog', { name: /Run C-2/ });
  await run.getByRole('radiogroup', { name: 'Step 1 result' }).getByRole('radio', { name: 'Failed' }).click();
  await run.getByLabel('Step 1 what happened').fill('Error 500 from the refunds API');
  await run.getByRole('button', { name: 'Save result: Failed' }).click();
  await expect(page.getByText(/Failed: bug #\d+ filed/)).toBeVisible();
  await expect(cases.getByRole('listitem').filter({ hasText: 'Refund a payment' })).toContainText(/bug #\d+/);
  await expect(page.getByRole('list', { name: 'Readiness checks' })).toContainText('1 failing');
  await shot(page, 'e6-qa-plan');
});

test('retests after the fix, approves, and the release is ready', async () => {
  const { qaPlans } = await graphql<{ qaPlans: { id: string }[] }>('query($w: ID!, $s: ID!) { qaPlans(workspaceId: $w, spaceId: $s) { id } }', { w: workspaceId, s: spaceId });
  const { qaPlanCases } = await graphql<{ qaPlanCases: { number: number; bugTaskId: string | null }[] }>('query($w: ID!, $p: ID!) { qaPlanCases(workspaceId: $w, planId: $p) { number bugTaskId } }', { w: workspaceId, p: qaPlans[0]!.id });
  const bug = qaPlanCases.find((item) => item.bugTaskId)!.bugTaskId!;
  // The developer fixes it.
  for (const state of ['confirmed', 'fixed']) await graphql('mutation($w: ID!, $t: ID!, $s: String!) { setBugQaState(workspaceId: $w, taskId: $t, state: $s) { qaState } }', { w: workspaceId, t: bug, s: state });

  await page.reload();
  await page.getByRole('list', { name: 'Test plans' }).getByText('Release 3.0').click();
  await page.getByRole('button', { name: 'Retest C-2' }).click();
  const run = page.getByRole('dialog', { name: /Run C-2/ });
  await run.getByRole('button', { name: 'Save result: Passed' }).click();
  await expect(page.getByText(/Passed: bug #\d+ verified/)).toBeVisible();

  await page.getByRole('button', { name: 'Approve' }).click();
  await page.getByRole('dialog', { name: 'Approve this plan?' }).getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByTestId('readiness-verdict')).toHaveText('Ready to release');
  await expect(page.getByRole('button', { name: /Run C-1|Run again/ })).toHaveCount(0);
  await shot(page, 'e6-qa-ready', page.getByRole('region', { name: 'Release readiness' }));

  await page.getByRole('tab', { name: 'Coverage' }).click();
  const figures = page.getByRole('list', { name: 'Coverage figures' });
  await expect(figures).toContainText('100%');
  await expect(figures).toContainText('1 of 1');
});
