import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { passkey } from '@better-auth/passkey';
import { sso } from '@better-auth/sso';
import { captcha, twoFactor } from 'better-auth/plugins';
import type { Pool } from 'pg';
import type { Env } from '../../config/env.schema.js';
import { PASSWORD_MAX, PASSWORD_MIN, validateAuthBody } from './auth-forms.js';
import type { Mailer } from './mailer/mailer.port.js';

/**
 * SSO (A4): the plugin's provider management is only reachable from TaskFlow's own API
 * (OrganizationsService, after its owner checks): over HTTP any signed-in user could register
 * a provider. SAML is off in this phase, so its endpoints are closed too.
 */
const SSO_SERVER_ONLY = ['/sso/register', '/sso/update-provider', '/sso/delete-provider', '/sso/request-domain-verification', '/sso/verify-domain', '/sso/providers', '/sso/get-provider'];
const SSO_CLOSED_PREFIX = '/sso/saml2/';

/** Whether an email address belongs to one of a provider's domains (exact, or a subdomain). */
export function emailInDomain(email: string, domains: string): boolean {
  const at = email.toLowerCase().split('@')[1];
  if (!at) return false;
  return domains
    .split(',')
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean)
    .some((domain) => at === domain || at.endsWith(`.${domain}`));
}

/** Adds someone who signed in through an organization's SSO to that organization (platform scope: server-side only). */
async function joinOrganization(pool: Pool, organizationId: string, userId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.scope', 'platform', true)`);
    await client.query(`INSERT INTO organization_member (organization_id, user_id, role) SELECT id, $2, 'member' FROM organization WHERE id = $1 ON CONFLICT DO NOTHING`, [organizationId, userId]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

const PASSKEY_NAME_PATHS = new Set(['/passkey/verify-registration', '/passkey/update-passkey']);
const PASSKEY_NAME_MAX = 60;
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
    // SSO identity providers are trusted origins too: the SSO plugin only fetches discovery from these.
    trustedOrigins: [...env.CORS_ORIGINS, ...env.SSO_TRUSTED_ISSUERS],
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
        // Requests from browsers carry a Request; TaskFlow's own server-side calls don't.
        if (ctx.request && (SSO_SERVER_ONLY.includes(ctx.path) || ctx.path.startsWith(SSO_CLOSED_PREFIX))) {
          throw new APIError('FORBIDDEN', { message: 'Not available' });
        }
        // Passkey names are free text the plugin doesn't bound; keep them short.
        if (PASSKEY_NAME_PATHS.has(ctx.path)) {
          const name = (ctx.body as { name?: unknown } | undefined)?.name;
          if (name !== undefined && (typeof name !== 'string' || name.trim().length > PASSKEY_NAME_MAX)) {
            throw new APIError('BAD_REQUEST', { code: 'VALIDATION_FAILED', message: `A passkey name is at most ${PASSKEY_NAME_MAX} characters` });
          }
        }
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
        '/sign-in/sso': { window: 60, max: 10 },
        '/passkey/generate-authenticate-options': { window: 60, max: 20 },
        '/passkey/verify-authentication': { window: 60, max: 10 },
        '/passkey/generate-register-options': { window: 60, max: 10 },
        '/passkey/verify-registration': { window: 60, max: 10 },
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
      // A4: passkeys. Bound to the app's own host (the WebAuthn relying party), added only from a
      // fresh session, and the authenticator must verify the person (PIN, fingerprint, face), so
      // a passkey is two factors in one and signing in with it skips the authenticator code.
      // A4: SSO (OIDC) per organization. Organization owners set it up through TaskFlow's API; it
      // works only once the organization proved it owns the email domain (DNS TXT record). Someone
      // signing in through it joins the organization; an existing account with the same confirmed
      // email is linked, never an unconfirmed one (someone could have registered it first).
      sso({
        domainVerification: { enabled: true },
        organizationProvisioning: { disabled: true },
        provisionUserOnEveryLogin: true,
        provisionUser: async ({ user, provider }) => {
          if (provider.organizationId) await joinOrganization(pool, provider.organizationId, user.id);
        },
        resolveUser: async (input, { database }) => {
          const provider = (await database.findOne({ model: 'ssoProvider', where: [{ field: 'providerId', value: input.providerId }] })) as {
            domain: string;
            domainVerified?: boolean;
          } | null;
          if (!provider?.domainVerified || !emailInDomain(input.providerUser.email, provider.domain)) {
            return { action: 'reject', code: 'SSO_EMAIL_OUTSIDE_DOMAIN', message: 'Sign in with your work email address' };
          }
          const existing = (await database.findOne({ model: 'user', where: [{ field: 'email', value: input.providerUser.email.toLowerCase() }] })) as {
            id: string;
            emailVerified: boolean;
          } | null;
          if (!existing) return { action: 'continue' };
          if (!existing.emailVerified) {
            return { action: 'reject', code: 'SSO_ACCOUNT_UNCONFIRMED', message: 'An unconfirmed account uses this email: confirm it or reset its password first' };
          }
          return { action: 'link', userId: existing.id, profile: 'preserve' };
        },
      }),
      passkey({
        rpID: new URL(env.BETTER_AUTH_URL).hostname,
        rpName: 'TaskFlow',
        authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
      }),
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
