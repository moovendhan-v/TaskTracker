import { describe, expect, it } from 'vitest';
import { TestUser } from './support/api-client.js';

/** GETs a Better Auth endpoint with this user's cookies (or none). */
async function authGet(user: TestUser, path: string): Promise<Response> {
  return fetch(`${user.baseUrl}/api/auth/${path}`, { headers: { 'X-Forwarded-For': user.ip, ...(user.cookieHeader() && { Cookie: user.cookieHeader() }) } });
}

/** A4: passkeys. The ceremony itself runs in the browser test with a virtual authenticator. */
describe('passkeys', () => {
  it('are added only by someone signed in, for this site, with the person verified', async () => {
    const stranger = new TestUser('Passkey stranger');
    expect((await authGet(stranger, 'passkey/generate-register-options')).status).toBe(401);
    expect((await authGet(stranger, 'passkey/list-user-passkeys')).status).toBe(401);

    const user = await TestUser.signUp('Passkey owner');
    const response = await authGet(user, 'passkey/generate-register-options');
    expect(response.status).toBe(200);
    const options = (await response.json()) as { challenge: string; rp: { id: string; name: string }; user: { name: string }; authenticatorSelection: { userVerification: string } };
    expect(options.challenge.length).toBeGreaterThan(20);
    expect(options.rp).toEqual({ id: 'localhost', name: 'TaskFlow' });
    expect(options.user.name).toBe(user.email);
    expect(options.authenticatorSelection.userVerification).toBe('required');
    expect(await (await authGet(user, 'passkey/list-user-passkeys')).json()).toEqual([]);
  });

  it('refuses a made-up registration and an overlong name', async () => {
    const user = await TestUser.signUp('Passkey forger');
    await authGet(user, 'passkey/generate-register-options');
    const forged = { response: { id: 'x', rawId: 'x', type: 'public-key', response: { clientDataJSON: 'e30', attestationObject: 'e30' }, clientExtensionResults: {} } };
    expect((await user.auth('passkey/verify-registration', { ...forged, name: 'Laptop' })).status).toBe(400);
    const long = await user.auth('passkey/verify-registration', { ...forged, name: 'x'.repeat(61) });
    expect(long.status).toBe(400);
    expect(await long.text()).toMatch(/at most 60 characters/);
    expect(await (await authGet(user, 'passkey/list-user-passkeys')).json()).toEqual([]);
  });

  it('signs nobody in with a made-up answer', async () => {
    const visitor = new TestUser('Passkey visitor');
    const options = (await (await authGet(visitor, 'passkey/generate-authenticate-options')).json()) as { challenge: string; userVerification: string; rpId: string };
    expect(options.rpId).toBe('localhost');
    expect(options.userVerification).toBe('required');
    const answer = await visitor.auth('passkey/verify-authentication', {
      response: { id: 'nope', rawId: 'nope', type: 'public-key', response: { clientDataJSON: 'e30', authenticatorData: 'e30', signature: 'e30' }, clientExtensionResults: {} },
    });
    expect(answer.status).toBeGreaterThanOrEqual(400);
    expect((await visitor.gql<{ me: { id: string } | null }>('{ me { id } }')).data?.me ?? null).toBeNull();
  });

  it("can't remove someone else's passkey", async () => {
    const user = await TestUser.signUp('Passkey remover');
    expect((await user.auth('passkey/delete-passkey', { id: 'not-yours' })).status).not.toBe(200);
  });
});
