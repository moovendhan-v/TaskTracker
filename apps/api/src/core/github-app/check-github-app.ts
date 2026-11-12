import type { Env } from '../../config/env.schema.js';
import { githubAppJwt, readGithubAppPrivateKey } from './github-app-credentials.js';

export const GITHUB_API = 'https://api.github.com';
const TIMEOUT_MS = 10_000;

/** What sync needs from the app; anything less and some of it can't work. */
const NEEDED: Record<string, 'read' | 'write'> = { issues: 'write', pull_requests: 'write', contents: 'read', metadata: 'read' };
const RANK = { read: 1, write: 2 } as const;

interface AppInfo {
  id: number;
  slug: string;
  client_id?: string;
  name: string;
  permissions?: Record<string, string>;
}

/**
 * Checks the GitHub App settings in .env against GitHub itself, without printing any secret:
 * the private key signs in as the app, and the App ID, slug, client id and permissions must
 * match what GitHub has. Run with: pnpm --filter @taskflow/api github-app:check
 */
export async function checkGithubApp(env: Env, { apiUrl = GITHUB_API, log = console.log }: { apiUrl?: string; log?: (line: string) => void } = {}): Promise<boolean> {
  if (!env.GITHUB_APP_ID || !env.GITHUB_APP_PRIVATE_KEY) {
    log('✗ The GitHub App isn’t set up: add GITHUB_APP_ID, GITHUB_APP_SLUG, GITHUB_APP_CLIENT_ID and GITHUB_APP_PRIVATE_KEY to .env.');
    return false;
  }
  const jwt = githubAppJwt(env.GITHUB_APP_ID, readGithubAppPrivateKey(env.GITHUB_APP_PRIVATE_KEY));
  const call = async <T>(path: string): Promise<{ status: number; body: T | null }> => {
    const response = await fetch(`${apiUrl}${path}`, {
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${jwt}`, 'User-Agent': 'TaskFlow', 'X-GitHub-Api-Version': '2022-11-28' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return { status: response.status, body: response.ok ? ((await response.json()) as T) : null };
  };

  const app = await call<AppInfo>('/app');
  if (!app.body) {
    log(
      app.status === 401
        ? '✗ GitHub refused the private key for this App ID. Check that GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY come from the same app, and the key wasn’t deleted.'
        : `✗ GitHub answered ${app.status}.`,
    );
    return false;
  }
  let ok = true;
  const check = (passed: boolean, good: string, bad: string) => {
    log(passed ? `✓ ${good}` : `✗ ${bad}`);
    ok &&= passed;
  };
  check(true, `Signed in as the app “${app.body.name}” (App ID ${app.body.id}) with the private key`, '');
  check(app.body.slug === env.GITHUB_APP_SLUG, 'GITHUB_APP_SLUG matches', `GITHUB_APP_SLUG should be “${app.body.slug}”`);
  check(!app.body.client_id || app.body.client_id === env.GITHUB_APP_CLIENT_ID, 'GITHUB_APP_CLIENT_ID matches', 'GITHUB_APP_CLIENT_ID isn’t this app’s Client ID');
  for (const [permission, level] of Object.entries(NEEDED)) {
    const has = app.body.permissions?.[permission] as 'read' | 'write' | undefined;
    const label = permission.replace('_', ' ');
    check(Boolean(has && RANK[has] >= RANK[level]), `Permission ${label}: ${has}`, `Permission ${label} should be ${level === 'write' ? 'Read and write' : 'Read-only'} (it’s ${has ?? 'No access'}) — change it under Permissions & events`);
  }
  const installations = await call<unknown[]>('/app/installations?per_page=100');
  if (installations.body) log(`• Installed on ${installations.body.length} account(s)${installations.body.length ? '' : ' (TaskFlow will offer an Install button)'}`);
  log(env.GITHUB_APP_WEBHOOK_SECRET ? '• Webhook secret set: changes from GitHub arrive instantly once the webhook is active' : '• No webhook secret: TaskFlow will check GitHub about every minute');
  log(env.GITHUB_APP_CLIENT_SECRET ? '• GITHUB_APP_CLIENT_SECRET set: it’s checked when someone installs the app from TaskFlow' : '• No GITHUB_APP_CLIENT_SECRET: sync works; installing from TaskFlow needs it');
  return ok;
}

