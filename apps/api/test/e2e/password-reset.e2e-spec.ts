import { describe, expect, it } from 'vitest';
import { PASSWORD, TestUser } from './support/api-client.js';
import { messagesTo, RESET_PASSWORD_SUBJECT, waitForMessageTo } from './support/mailbox.js';
import { TEST_ORIGIN } from './support/test-env.js';

const NEW_PASSWORD = 'battery-staple-77';

describe('password reset by email', () => {
  it('emails a single-use link that sets a new password and signs out old sessions', async () => {
    const user = await TestUser.signUp('Forgetful');
    const oldSession = new TestUser(user.name, user.email);
    await oldSession.auth('sign-in/email', { email: user.email, password: PASSWORD });
    expect((await oldSession.data<{ me: { id: string } }>('{ me { id } }')).me.id).toBe(user.id);

    const request = await user.auth('request-password-reset', { email: user.email, redirectTo: `${TEST_ORIGIN}/reset-password` });
    expect(request.status).toBe(200);

    const message = await waitForMessageTo(user.email, RESET_PASSWORD_SUBJECT);
    const link = /https?:\/\/\S+\/api\/auth\/reset-password\/\S+/.exec(message)?.[0];
    expect(link).toBeDefined();

    // Following the emailed link redirects to the web app's reset page with the token.
    const redirect = await fetch(link as string, { redirect: 'manual' });
    const token = new URL(redirect.headers.get('location') ?? '', TEST_ORIGIN).searchParams.get('token');
    expect(token).toBeTruthy();

    expect((await user.auth('reset-password', { token, newPassword: NEW_PASSWORD })).status).toBe(200);
    expect((await user.auth('reset-password', { token, newPassword: 'another-pass-99' })).status).toBe(400);

    const fresh = new TestUser(user.name, user.email);
    expect((await fresh.auth('sign-in/email', { email: user.email, password: PASSWORD })).status).toBe(401);
    expect((await fresh.auth('sign-in/email', { email: user.email, password: NEW_PASSWORD })).status).toBe(200);
    expect((await oldSession.error('{ me { id } }')).code).toBe('UNAUTHENTICATED');
  });

  it('answers the same for an unknown email and sends nothing', async () => {
    const stranger = new TestUser('Nobody');
    const response = await stranger.auth('request-password-reset', { email: stranger.email, redirectTo: `${TEST_ORIGIN}/reset-password` });
    expect(response.status).toBe(200);
    await new Promise((done) => setTimeout(done, 500));
    expect(messagesTo(stranger.email, RESET_PASSWORD_SUBJECT)).toEqual([]);
  });
});
