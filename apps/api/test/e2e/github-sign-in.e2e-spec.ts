import { describe, expect, it } from 'vitest';
import { TestUser } from './support/api-client.js';

/** A4: sign in with GitHub. The tests run with a placeholder OAuth app and never reach GitHub. */
describe('sign in with GitHub', () => {
  it('is offered on the sign-in page before anyone is signed in', async () => {
    const visitor = new TestUser('Visitor');
    const result = await visitor.gql<{ signInOptions: { github: boolean } }>('{ signInOptions { github } }');
    expect(result.errors).toBeUndefined();
    expect(result.data?.signInOptions.github).toBe(true);
  });

  it("sends you to GitHub's authorize page with a state that the callback checks", async () => {
    const visitor = new TestUser('GitHub visitor');
    const response = await visitor.auth('sign-in/social', { provider: 'github', callbackURL: '/', errorCallbackURL: '/sign-in' });
    expect(response.status).toBe(200);
    const { url, redirect } = (await response.json()) as { url: string; redirect: boolean };
    expect(redirect).toBe(true);
    const authorize = new URL(url);
    expect(authorize.origin + authorize.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(authorize.searchParams.get('client_id')).toBe('e2e-github-client');
    expect(authorize.searchParams.get('state')).toBeTruthy();

    // A callback with a made-up state (as from a forged link) signs nobody in.
    const forged = await fetch(`${visitor.baseUrl}/api/auth/callback/github?code=x&state=forged`, { redirect: 'manual', headers: { 'X-Forwarded-For': visitor.ip } });
    expect(forged.status).toBe(302);
    expect(forged.headers.get('location')).toMatch(/error=/);
    expect(forged.headers.getSetCookie().some((cookie) => cookie.includes('session_token=') && !cookie.includes('session_token=;'))).toBe(false);
  });

  it('only sends you back to the app afterwards', async () => {
    const visitor = new TestUser('GitHub redirect');
    expect((await visitor.auth('sign-in/social', { provider: 'github', callbackURL: 'https://evil.example.com/' })).status).toBe(403);
    expect((await visitor.auth('sign-in/social', { provider: 'github', callbackURL: '/', errorCallbackURL: 'https://evil.example.com/' })).status).toBe(403);
  });

  it('connects to an account only while signed in', async () => {
    const stranger = new TestUser('GitHub stranger');
    expect((await stranger.auth('link-social', { provider: 'github', callbackURL: '/' })).status).toBe(401);

    const user = await TestUser.signUp('GitHub linker');
    const response = await user.auth('link-social', { provider: 'github', callbackURL: '/' });
    expect(response.status).toBe(200);
    expect(new URL(((await response.json()) as { url: string }).url).hostname).toBe('github.com');
  });

  it('keeps your only way in', async () => {
    const user = await TestUser.signUp('GitHub unlinker');
    const accounts = (await (await fetch(`${user.baseUrl}/api/auth/list-accounts`, { headers: { Cookie: user.cookieHeader(), 'X-Forwarded-For': user.ip } })).json()) as { id: string; providerId: string }[];
    expect(accounts.map((account) => account.providerId)).toEqual(['credential']);
    expect((await user.auth('unlink-account', { accountId: accounts[0]!.id })).status).toBe(400);
  });
});
