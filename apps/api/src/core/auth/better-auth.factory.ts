import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { captcha, twoFactor } from 'better-auth/plugins';
import type { Pool } from 'pg';
import type { Env } from '../../config/env.schema.js';
import { PASSWORD_MAX, PASSWORD_MIN, validateAuthBody } from './auth-forms.js';
import type { Mailer } from './mailer/mailer.port.js';

const PUBLIC_AUTH_FORMS = ['/sign-up/email', '/sign-in/email', '/request-password-reset'];

/**
 * `validateSchema: false` is for the migration command: Better Auth otherwise checks the tables at
 * start-up and logs "schema mismatch" for exactly the tables that command is about to create.
 */
export function createAuth(env: Env, pool: Pool, mailer: Mailer, { validateSchema = true }: { validateSchema?: boolean } = {}) {
  const isProduction = env.NODE_ENV === 'production';

  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: '/api/auth',
    database: pool,
    trustedOrigins: env.CORS_ORIGINS,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: PASSWORD_MIN,
      maxPasswordLength: PASSWORD_MAX,
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
    // "Sign in with GitHub" (A4), only when an OAuth app is configured. A first GitHub
    // sign-in creates an account. It never merges into an existing account with the same email on
    // its own (that sign-in is refused): you connect GitHub from the Security page while signed in,
    // and only a GitHub account with the same email. No CAPTCHA here: /sign-in/social only hands
    // back GitHub's URL, and GitHub's own sign-in page is the human check. A GitHub sign-in is a
    // complete sign-in of its own, so it doesn't ask for the authenticator code (GitHub has its
    // own two-step); the Security page says so.
    ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
      ? { socialProviders: { github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET } } }
      : {}),
    account: {
      accountLinking: { enabled: true, trustedProviders: [], allowDifferentEmails: false, disableImplicitLinking: true },
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
    // The same rules the web app gets from formSchemas('auth.*'), with the same per-field messages.
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        const fields = await validateAuthBody(ctx.path, ctx.body);
        if (fields.length > 0) throw new APIError('BAD_REQUEST', { code: 'VALIDATION_FAILED', message: fields[0]?.message ?? 'Invalid input', fields });
      }),
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
        // Six digits are guessable without a tight limit (A4).
        '/two-factor/verify-totp': { window: 60, max: 5 },
        '/two-factor/verify-backup-code': { window: 60, max: 5 },
        '/two-factor/enable': { window: 60, max: 5 },
        '/two-factor/disable': { window: 60, max: 5 },
        '/sign-in/social': { window: 60, max: 10 },
        '/link-social': { window: 60, max: 5 },
        '/unlink-account': { window: 60, max: 5 },
      },
    },
    advanced: {
      // Better Auth skips its origin and callback-URL checks when NODE_ENV=test; keep them on so the
      // e2e suite runs the same checks as production (no redirects to other sites).
      disableOriginCheck: false,
      database: { validateSchema },
      useSecureCookies: isProduction,
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', secure: isProduction },
      ipAddress: { ipAddressHeaders: env.TRUST_PROXY > 0 ? ['x-forwarded-for'] : [] },
    },
    plugins: [
      // A4: two-step sign-in with an authenticator app (TOTP) and one-time backup codes.
      // The secret and the backup codes are stored encrypted with BETTER_AUTH_SECRET; turning
      // it on or off needs the password, and signing in asks for a code only once the first
      // step has succeeded.
      twoFactor({ issuer: 'TaskFlow', skipVerificationOnEnable: false, backupCodeOptions: { amount: 10, length: 10 } }),
      ...(env.TURNSTILE_SECRET_KEY
        ? [
            captcha({
              provider: 'cloudflare-turnstile',
              secretKey: env.TURNSTILE_SECRET_KEY,
              endpoints: PUBLIC_AUTH_FORMS,
            }),
          ]
        : []),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
