import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { PASSWORD, TestUser } from './support/api-client.js';

/** RFC 4648 base32, as authenticator apps read the secret. */
function base32(secret: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of secret.replace(/=+$/, '').toUpperCase()) bits += alphabet.indexOf(char).toString(2).padStart(5, '0');
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

/** The 6-digit code an authenticator app shows now (RFC 6238, 30 s steps, SHA-1). */
function totp(secret: string, at = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const hmac = createHmac('sha1', base32(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;
  const value = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(value).padStart(6, '0');
}

const signedIn = async (user: TestUser) => (await user.gql<{ me: { id: string } }>('{ me { id } }')).data?.me?.id ?? null;

/** A4: two-step sign-in with an authenticator app and backup codes. */
describe('two-step sign-in', () => {
  it('turns on with the password and a first code, then asks for a code at every sign-in', async () => {
    const user = await TestUser.signUp('Two step');
    // Turning it on needs the password.
    expect((await user.auth('two-factor/enable', { password: 'wrong-password-1' })).status).toBe(400);
    const started = (await (await user.auth('two-factor/enable', { password: PASSWORD })).json()) as { totpURI: string; backupCodes: string[] };
    const secret = new URL(started.totpURI).searchParams.get('secret')!;
    expect(started.totpURI).toMatch(/^otpauth:\/\/totp\/TaskFlow:/);
    expect(started.backupCodes).toHaveLength(10);

    // Not on until a code from the app confirms it: signing in still needs only the password.
    const before = new TestUser(user.name, user.email);
    expect(((await (await before.auth('sign-in/email', { email: user.email, password: PASSWORD })).json()) as { twoFactorRedirect?: boolean }).twoFactorRedirect).toBeUndefined();
    expect((await user.auth('two-factor/verify-totp', { code: totp(secret) })).status).toBe(200);

    // From now on the password alone gets no session.
    const fresh = new TestUser(user.name, user.email);
    const step1 = (await (await fresh.auth('sign-in/email', { email: user.email, password: PASSWORD })).json()) as { twoFactorRedirect?: boolean };
    expect(step1.twoFactorRedirect).toBe(true);
    expect(await signedIn(fresh)).toBeNull();
    expect((await fresh.auth('two-factor/verify-totp', { code: totp(secret, Date.now() - 10 * 60_000) })).status).toBe(401);
    expect(await signedIn(fresh)).toBeNull();
    expect((await fresh.auth('two-factor/verify-totp', { code: totp(secret) })).status).toBe(200);
    expect(await signedIn(fresh)).toBe(user.id);

    // A backup code works once.
    const lost = new TestUser(user.name, user.email);
    await lost.auth('sign-in/email', { email: user.email, password: PASSWORD });
    expect((await lost.auth('two-factor/verify-backup-code', { code: started.backupCodes[0] })).status).toBe(200);
    expect(await signedIn(lost)).toBe(user.id);
    const again = new TestUser(user.name, user.email);
    await again.auth('sign-in/email', { email: user.email, password: PASSWORD });
    expect((await again.auth('two-factor/verify-backup-code', { code: started.backupCodes[0] })).status).toBe(401);
    expect(await signedIn(again)).toBeNull();

    // A code can't be checked without the password step first.
    const stranger = new TestUser(user.name, user.email);
    expect([401, 403]).toContain((await stranger.auth('two-factor/verify-totp', { code: totp(secret) })).status);

    // Turning it off needs the password too; then the password alone is enough again.
    expect((await fresh.auth('two-factor/disable', { password: 'wrong-password-1' })).status).toBe(400);
    expect((await fresh.auth('two-factor/disable', { password: PASSWORD })).status).toBe(200);
    const after = new TestUser(user.name, user.email);
    await after.auth('sign-in/email', { email: user.email, password: PASSWORD });
    expect(await signedIn(after)).toBe(user.id);
  });

  it('limits code guesses', async () => {
    const user = await TestUser.signUp('Two step guesser');
    const { totpURI } = (await (await user.auth('two-factor/enable', { password: PASSWORD })).json()) as { totpURI: string };
    await user.auth('two-factor/verify-totp', { code: totp(new URL(totpURI).searchParams.get('secret')!) });
    const guesser = new TestUser(user.name, user.email);
    await guesser.auth('sign-in/email', { email: user.email, password: PASSWORD });
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 7; attempt++) statuses.push((await guesser.auth('two-factor/verify-totp', { code: String(100000 + attempt) })).status);
    expect(statuses).toContain(429);
  });
});
