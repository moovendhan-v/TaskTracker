import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({ basePath: '/api/auth' });

/** Header Better Auth's captcha plugin reads the Turnstile token from. */
export const CAPTCHA_HEADER = 'x-captcha-response';

export function captchaHeaders(token: string | null): Record<string, string> {
  return token ? { [CAPTCHA_HEADER]: token } : {};
}
