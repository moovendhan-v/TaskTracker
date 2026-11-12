import type { PullRequestState } from '@taskflow/shared-types';
import type { PullRequestEvent } from './github-webhook.policy.js';

/** GitHub's answers are untrusted: these read only what sync uses, checked and trimmed. */
const text = (value: unknown, max: number): string => (typeof value === 'string' ? value.slice(0, max) : '');
const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
const count = (value: unknown): number | null => (typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null);
const date = (value: unknown): Date | null => {
  const parsed = typeof value === 'string' ? new Date(value) : null;
  return parsed && Number.isFinite(parsed.getTime()) ? parsed : null;
};
const githubUrl = (value: unknown): string | null => {
  const url = text(value, 500);
  return url.startsWith('https://github.com/') ? url : null;
};
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** owner/name as GitHub allows them: an account login, and a name that isn't "." or "..". */
export function isRepoName(value: string): boolean {
  const match = /^([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9_.-]{1,100})$/.exec(value);
  return match !== null && match[2] !== '.' && match[2] !== '..';
}

export interface PolledPull extends Omit<PullRequestEvent, 'action'> {
  updatedAt: Date;
}

export interface PolledIssue {
  number: number;
  title: string;
  closed: boolean;
  url: string;
  updatedAt: Date;
}

export interface InstallationSummary {
  id: number;
  accountLogin: string;
  accountType: 'User' | 'Organization';
}

export const GithubAppPolicy = {
  /** One item of GET /repos/{repo}/pulls. */
  parsePull(item: unknown, repo: string): PolledPull | null {
    const pr = record(item);
    const number = count(pr['number']);
    const url = githubUrl(pr['html_url']);
    const updatedAt = date(pr['updated_at']);
    if (!number || !url || !updatedAt) return null;
    const state: PullRequestState = pr['state'] === 'closed' ? (pr['merged_at'] ? 'merged' : 'closed') : 'open';
    return {
      repo,
      number,
      title: text(pr['title'], 300),
      body: text(pr['body'], 65_536),
      url,
      branch: text(record(pr['head'])['ref'], 255),
      author: text(record(pr['user'])['login'], 100),
      state,
      updatedAt,
    };
  },

  /** One item of GET /repos/{repo}/issues; pull requests (which that list includes) are skipped. */
  parseIssue(item: unknown): PolledIssue | null {
    const issue = record(item);
    if (issue['pull_request'] !== undefined) return null;
    const number = count(issue['number']);
    const url = githubUrl(issue['html_url']);
    const updatedAt = date(issue['updated_at']);
    if (!number || !url || !updatedAt) return null;
    return { number, title: text(issue['title'], 300), closed: issue['state'] === 'closed', url, updatedAt };
  },

  /** GET /user/installations: the installations the signed-in person can reach. */
  parseUserInstallations(body: unknown): InstallationSummary[] {
    return list(record(body)['installations']).flatMap((item) => {
      const installation = record(item);
      const id = count(installation['id']);
      const account = record(installation['account']);
      const login = text(account['login'], 100);
      if (!id || !login) return [];
      return [{ id, accountLogin: login, accountType: account['type'] === 'Organization' ? ('Organization' as const) : ('User' as const) }];
    });
  },

  /** GET /installation/repositories: owner/name of each repository the installation can reach. */
  parseRepositories(body: unknown): string[] {
    return list(record(body)['repositories']).flatMap((item) => {
      const name = text(record(item)['full_name'], 201);
      return isRepoName(name) ? [name] : [];
    });
  },

  /** POST /repos/{repo}/issues answer. */
  parseCreatedIssue(body: unknown): { number: number; url: string } | null {
    const issue = record(body);
    const number = count(issue['number']);
    const url = githubUrl(issue['html_url']);
    return number && url ? { number, url } : null;
  },
};
