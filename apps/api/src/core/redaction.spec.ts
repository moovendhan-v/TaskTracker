import { describe, expect, it } from 'vitest';
import { isSensitiveField, REDACTED, redactBody, redactHeaders, redactText, redactUrl } from '@taskflow/shared-types';
import { stepsFromActions } from '@taskflow/shared-types';

describe('redaction', () => {
  it('removes credentials from headers, URLs, bodies and free text', () => {
    expect(redactHeaders({ Authorization: 'Bearer abc.def.ghi', Cookie: 'sid=1', 'Content-Type': 'application/json', 'X-Request-Id': '42' })).toEqual({
      authorization: REDACTED,
      cookie: REDACTED,
      'content-type': 'application/json',
      'x-request-id': '42',
    });
    const url = redactUrl('https://user:pw@api.example.com/v1/items?page=2&access_token=abc123&apiKey=zzz#id_token=eyJx');
    expect(url.startsWith('https://api.example.com/v1/items?page=2&')).toBe(true);
    expect(url).not.toMatch(/user|pw@|abc123|zzz|eyJx/);
    expect(JSON.parse(redactBody('{"email":"a@b.co","password":"hunter2","nested":{"refresh_token":"x","items":[{"cardNumber":"4242424242424242"}]}}')!)).toEqual({
      email: 'a@b.co',
      password: REDACTED,
      nested: { refresh_token: REDACTED, items: [{ cardNumber: REDACTED }] },
    });
    expect(redactBody('username=dana&password=secret1')).toBe('username=dana&password=[redacted]');
    const text = redactText('failed with Bearer abcdefghijklmnop and token=s3cr3tvalue; jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NSJ9.abcdefghijklmnop card 4242 4242 4242 4242 key ghp_abcdefghijklmnopqrstuvwxyz0123');
    expect(text).not.toMatch(/abcdefghijklmnop\b|s3cr3tvalue|eyJhbGci|4242 4242|ghp_/);
    expect(text).toContain('Bearer [redacted]');
  });

  it('flags fields whose values must never be captured', () => {
    expect(isSensitiveField({ type: 'password' })).toBe(true);
    expect(isSensitiveField({ type: 'text', autocomplete: 'cc-number' })).toBe(true);
    expect(isSensitiveField({ type: 'text', name: 'api_key' })).toBe(true);
    expect(isSensitiveField({ type: 'email', name: 'email' })).toBe(false);
  });
});

describe('steps from captured actions', () => {
  it('writes readable steps and collapses typing in one field', () => {
    expect(
      stepsFromActions([
        { type: 'navigate', at: 0, url: 'https://app.example.com/settings?tab=profile' },
        { type: 'click', at: 10, target: 'Edit profile' },
        { type: 'input', at: 20, target: 'Display name', value: 'D' },
        { type: 'input', at: 30, target: 'Display name', value: 'Dana' },
        { type: 'key', at: 40, value: 'a' },
        { type: 'click', at: 50, target: 'Save' },
      ]).map((step) => step.text),
    ).toEqual(['Go to /settings?…', 'Click “Edit profile”', 'Type “Dana” into “Display name”', 'Click “Save”']);
  });
});
