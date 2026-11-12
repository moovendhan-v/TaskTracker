import { describe, expect, it } from 'vitest';
import { actionFor } from './github-app-sync.js';
import { repoPath } from './github-app.service.js';
import { GithubAppPolicy } from '../domain/github-app.policy.js';

describe('GithubAppPolicy', () => {
  const pull = { number: 7, title: 'TF-3 fix', body: 'b', html_url: 'https://github.com/acme/app/pull/7', state: 'closed', merged_at: '2026-11-01T00:00:00Z', head: { ref: 'fix' }, user: { login: 'octocat' }, updated_at: '2026-11-01T00:00:00Z' };

  it('reads a pull request, telling merged from closed', () => {
    expect(GithubAppPolicy.parsePull(pull, 'acme/app')).toMatchObject({ number: 7, state: 'merged', branch: 'fix', author: 'octocat', repo: 'acme/app' });
    expect(GithubAppPolicy.parsePull({ ...pull, merged_at: null }, 'acme/app')?.state).toBe('closed');
    expect(GithubAppPolicy.parsePull({ ...pull, state: 'open', merged_at: null }, 'acme/app')?.state).toBe('open');
  });

  it('refuses links outside github.com and malformed items', () => {
    expect(GithubAppPolicy.parsePull({ ...pull, html_url: 'https://evil.example.com/x' }, 'acme/app')).toBeNull();
    expect(GithubAppPolicy.parsePull({ ...pull, number: -1 }, 'acme/app')).toBeNull();
    expect(GithubAppPolicy.parsePull({ ...pull, updated_at: 'yesterday' }, 'acme/app')).toBeNull();
    expect(GithubAppPolicy.parsePull('nonsense', 'acme/app')).toBeNull();
  });

  it('skips pull requests in the issues list and trims long titles', () => {
    const issue = { number: 9, title: 'x'.repeat(500), state: 'closed', html_url: 'https://github.com/acme/app/issues/9', updated_at: '2026-11-01T00:00:00Z' };
    expect(GithubAppPolicy.parseIssue(issue)).toMatchObject({ number: 9, closed: true });
    expect(GithubAppPolicy.parseIssue(issue)!.title).toHaveLength(300);
    expect(GithubAppPolicy.parseIssue({ ...issue, pull_request: {} })).toBeNull();
  });

  it('reads installations and repositories, dropping anything malformed', () => {
    expect(GithubAppPolicy.parseUserInstallations({ installations: [{ id: 1, account: { login: 'acme', type: 'Organization' } }, { id: 'x' }, { id: 2, account: {} }] })).toEqual([{ id: 1, accountLogin: 'acme', accountType: 'Organization' }]);
    expect(GithubAppPolicy.parseRepositories({ repositories: [{ full_name: 'acme/app' }, { full_name: '../etc' }, { full_name: 'acme/..' }, { full_name: 'acme/my.site' }, {}] })).toEqual(['acme/app', 'acme/my.site']);
    expect(() => repoPath('acme/..')).toThrow(/Not a GitHub repository/);
    expect(repoPath('acme/my.site')).toBe('/repos/acme/my.site');
    expect(GithubAppPolicy.parseCreatedIssue({ number: 3, html_url: 'https://github.com/acme/app/issues/3' })).toEqual({ number: 3, url: 'https://github.com/acme/app/issues/3' });
    expect(GithubAppPolicy.parseCreatedIssue({ number: 3, html_url: 'javascript:alert(1)' })).toBeNull();
  });
});

describe('actionFor', () => {
  it('judges what happened from the state TaskFlow last saw', () => {
    expect(actionFor(null, 'open')).toBe('opened');
    expect(actionFor('closed', 'open')).toBe('reopened');
    expect(actionFor('open', 'merged')).toBe('closed');
    expect(actionFor(null, 'closed')).toBe('closed');
    expect(actionFor('open', 'open')).toBe('edited');
  });
});
