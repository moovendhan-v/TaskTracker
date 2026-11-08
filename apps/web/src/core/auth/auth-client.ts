import { passkeyClient } from '@better-auth/passkey/client';
import { twoFactorClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

// Two-factor and passkeys (A4). Two-factor: sign-in answers "a code is needed" instead of redirecting; the sign-in hook routes to /two-factor.
export const authClient = createAuthClient({ basePath: '/api/auth', plugins: [twoFactorClient(), passkeyClient()] });

/** Header Better Auth's captcha plugin reads the Turnstile token from. */
export const CAPTCHA_HEADER = 'x-captcha-response';

export function captchaHeaders(token: string | null): Record<string, string> {
  return token ? { [CAPTCHA_HEADER]: token } : {};
}
