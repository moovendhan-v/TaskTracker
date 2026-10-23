import { betterAuth } from 'better-auth';
import { captcha } from 'better-auth/plugins';
import type { Pool } from 'pg';
import type { Env } from '../../config/env.schema.js';
import type { Mailer } from './mailer/mailer.port.js';

const PUBLIC_AUTH_FORMS = ['/sign-up/email', '/sign-in/email', '/request-password-reset'];

export function createAuth(env: Env, pool: Pool, mailer: Mailer) {
  const isProduction = env.NODE_ENV === 'production';

  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: '/api/auth',
    database: pool,
    trustedOrigins: env.CORS_ORIGINS,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 60 * 30,
      sendResetPassword: async ({ user, url }) => mailer.sendPasswordReset(user.email, url),
    },
    // Sign-in works before confirmation, but invites only reach confirmed emails (MembersService.add),
    // so nobody can claim someone else's address and inherit their workspace access.
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60 * 24,
      sendVerificationEmail: async ({ user, url }) => mailer.sendEmailVerification(user.email, url),
    },
    user: {
      additionalFields: {
        // input: false keeps both fields out of the sign-up and update-user payloads.
        platformRole: { type: 'string', required: false, defaultValue: 'USER', input: false },
        suspended: { type: 'boolean', required: false, defaultValue: false, input: false },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 60, max: 3 },
        '/request-password-reset': { window: 300, max: 3 },
        '/send-verification-email': { window: 300, max: 3 },
      },
    },
    advanced: {
      useSecureCookies: isProduction,
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', secure: isProduction },
      ipAddress: { ipAddressHeaders: env.TRUST_PROXY > 0 ? ['x-forwarded-for'] : [] },
    },
    plugins: env.TURNSTILE_SECRET_KEY
      ? [
          captcha({
            provider: 'cloudflare-turnstile',
            secretKey: env.TURNSTILE_SECRET_KEY,
            endpoints: PUBLIC_AUTH_FORMS,
          }),
        ]
      : [],
  });
}

export type Auth = ReturnType<typeof createAuth>;
