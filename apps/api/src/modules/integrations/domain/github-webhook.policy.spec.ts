import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { taskReferences } from '@taskflow/shared-types';
import { GithubWebhookPolicy } from './github-webhook.policy.js';

describe('GithubWebhookPolicy', () => {
  const body = Buffer.from('{"zen":"Keep it logically awesome."}');
  const sign = (secret: string) => `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

  it('accepts only the right signature over the exact body', () => {
    expect(GithubWebhookPolicy.signatureMatches('s3cret', body, sign('s3cret'))).toBe(true);
    expect(GithubWebhookPolicy.signatureMatches('s3cret', body, sign('other'))).toBe(false);
    expect(GithubWebhookPolicy.signatureMatches('s3cret', Buffer.from(`${body.toString()} `), sign('s3cret'))).toBe(false);
    expect(GithubWebhookPolicy.signatureMatches('s3cret', body, undefined)).toBe(false);
    expect(GithubWebhookPolicy.signatureMatches('s3cret', body, 'sha256=abc')).toBe(false);
  });

  it('reads pull requests and their state, and refuses odd payloads', () => {
    const event = GithubWebhookPolicy.parsePullRequest({
      action: 'closed',
      repository: { full_name: 'acme/web' },
      pull_request: { number: 7, title: 'TF-3 fix', html_url: 'https://github.com/acme/web/pull/7', state: 'closed', merged: true, head: { ref: 'tf-3' }, user: { login: 'dev' } },
    });
    expect(event).toMatchObject({ number: 7, state: 'merged', repo: 'acme/web', branch: 'tf-3', author: 'dev' });
    expect(GithubWebhookPolicy.parsePullRequest({ pull_request: { number: 7, html_url: 'javascript:alert(1)' } })).toBeNull();
    expect(GithubWebhookPolicy.parsePullRequest({ pull_request: { number: '7', html_url: 'https://github.com/a/b/pull/7' } })).toBeNull();
    expect(GithubWebhookPolicy.parsePullRequest('nope')).toBeNull();
  });

  it('finds task references by prefix in titles, bodies and branches', () => {
    expect(taskReferences('TF', 'TF-12: fix login', 'Also closes tf-7 and TF-12', 'feature/TF-9-thing')).toEqual([12, 7, 9]);
    expect(taskReferences('TF', 'ATF-12 and TF-12x and TF-')).toEqual([]);
    expect(taskReferences('WEB', 'TF-1 WEB-2')).toEqual([2]);
  });
});
