import { REDACTED } from '@taskflow/shared-types';
import { describe, expect, it } from 'vitest';
import { BugPolicy } from './bug.policy.js';

describe('BugPolicy', () => {
  it('cleans and redacts a capture even when the client did not', () => {
    const capture = BugPolicy.capture({
      console: [
        { level: 'error', message: 'Login failed for token=abcdef123456', at: 120, stack: 'at main.js:1' },
        { level: 'nope' as never, message: 'x'.repeat(5_000), at: -5 },
      ],
      network: [
        { method: 'post', url: 'https://api.example.com/login?password=hunter2', status: 401, durationMs: 80, at: 100, requestHeaders: { Authorization: 'Bearer abc.def.ghi' }, requestBody: '{"email":"a@b.co","password":"hunter2"}', responseBody: 'x'.repeat(9_000) },
        { method: 'GET', url: 'https://api.example.com/items', status: 200, durationMs: 10, at: 50 },
        { method: 'GET', url: 'https://api.example.com/down', status: 0, durationMs: 0, at: 60, error: 'Failed to fetch' },
      ],
      actions: [{ type: 'input', at: 10, target: 'Email', value: 'a@b.co' }],
    });
    expect(capture.console[0]!.message).not.toContain('abcdef123456');
    expect(capture.console[1]).toMatchObject({ level: 'log', at: 0 });
    expect(capture.console[1]!.message.length).toBe(2_000);
    const login = capture.network[0]!;
    expect(login).toMatchObject({ method: 'POST', status: 401 });
    expect(login.url).not.toContain('hunter2');
    expect(login.requestHeaders).toEqual({ authorization: REDACTED });
    expect(login.requestBody).not.toContain('hunter2');
    expect(login.responseBody!.length).toBeLessThanOrEqual(2_000);
    expect(capture).toMatchObject({ consoleErrors: 1, failedRequests: 2 });
  });

  it('allows only the QA moves that make sense', () => {
    expect(() => BugPolicy.assertTransition('new', 'confirmed')).not.toThrow();
    expect(() => BugPolicy.assertTransition('fixed', 'retest')).not.toThrow();
    expect(() => BugPolicy.assertTransition('retest', 'reopened')).not.toThrow();
    expect(() => BugPolicy.assertTransition('closed', 'reopened')).not.toThrow();
    expect(() => BugPolicy.assertTransition('new', 'verified')).toThrow(/can't move/);
    expect(() => BugPolicy.assertTransition('verified', 'fixed')).toThrow(/can't move/);
  });

  it('reads the browser context defensively', () => {
    expect(BugPolicy.context({ pageUrl: 'https://app.example.com/a?token=zzz', viewport: '1440 x 900', browser: 'Chrome 132' })).toMatchObject({ viewport: '1440x900', browser: 'Chrome 132' });
    expect(BugPolicy.context({ viewport: '<script>' }).viewport).toBeNull();
    expect(BugPolicy.context({ pageUrl: 'https://app.example.com/a?token=zzz' }).pageUrl).not.toContain('zzz');
    expect(() => BugPolicy.title('   ')).toThrow(/title/);
  });
});
