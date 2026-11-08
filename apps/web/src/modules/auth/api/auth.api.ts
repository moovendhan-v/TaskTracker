import { SignInOptionsDocument } from '@taskflow/sdk';
import { graphql } from '@/core/api/graphql-client';
import { authClient, captchaHeaders } from '@/core/auth/auth-client';

interface AuthResult {
  error: { message?: string | undefined; fields?: unknown } | null;
}

/** A Better Auth failure; `fields` holds per-field validation messages when the API sent them. */
export class AuthRequestError extends Error {
  constructor(
    message: string,
    readonly fields: unknown,
  ) {
    super(message);
    this.name = 'AuthRequestError';
  }
}

/** Turns Better Auth's `{ error }` result into a thrown error, so callers can use mutations. */
function throwOnError<T extends AuthResult>(result: T): T {
  if (result.error) throw new AuthRequestError(result.error.message || 'Request failed', result.error.fields);
  return result;
}

export const authApi = {
  async signIn(input: { email: string; password: string }, captcha: string | null) {
    return throwOnError(await authClient.signIn.email({ ...input, fetchOptions: { headers: captchaHeaders(captcha) } }));
  },

  async signUp(input: { name: string; email: string; password: string }, captcha: string | null) {
    // The confirmation link in the sign-up email brings the user back to the app.
    return throwOnError(await authClient.signUp.email({ ...input, callbackURL: '/', fetchOptions: { headers: captchaHeaders(captcha) } }));
  },

  async requestPasswordReset(email: string, captcha: string | null) {
    return throwOnError(
      await authClient.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/reset-password`,
        fetchOptions: { headers: captchaHeaders(captcha) },
      }),
    );
  },

  async resetPassword(token: string, newPassword: string) {
    return throwOnError(await authClient.resetPassword({ token, newPassword }));
  },

  /** Second step of signing in (A4): a code from the authenticator app, or one backup code. */
  async verifyTotp(code: string, trustDevice: boolean) {
    return throwOnError(await authClient.twoFactor.verifyTotp({ code, trustDevice }));
  },

  async verifyBackupCode(code: string, trustDevice: boolean) {
    return throwOnError(await authClient.twoFactor.verifyBackupCode({ code, trustDevice }));
  },

  /** Starts turning two-factor on: returns the authenticator link and the backup codes; a code confirms it. */
  async enableTwoFactor(password: string) {
    return throwOnError(await authClient.twoFactor.enable({ password, issuer: 'TaskFlow' })).data!;
  },

  async disableTwoFactor(password: string) {
    return throwOnError(await authClient.twoFactor.disable({ password }));
  },

  async newBackupCodes(password: string) {
    return throwOnError(await authClient.twoFactor.generateBackupCodes({ password })).data!;
  },

  /** Whether the signed-in person has two-factor on. */
  async twoFactorEnabled() {
    const session = await authClient.getSession();
    return Boolean((session.data?.user as { twoFactorEnabled?: boolean | null } | undefined)?.twoFactorEnabled);
  },

  /** Which ways of signing in the server offers (A4); asked before anyone is signed in. */
  async signInOptions() {
    return (await graphql(SignInOptionsDocument, {})).signInOptions;
  },

  /**
   * Starts "Sign in with GitHub": the browser leaves for GitHub and comes back signed in, or to
   * the sign-in page with `?error=` when GitHub's email already belongs to a password account.
   */
  async signInWithGithub() {
    return throwOnError(await authClient.signIn.social({ provider: 'github', callbackURL: '/', errorCallbackURL: '/sign-in' }));
  },

  /** Connects GitHub to the signed-in account; the browser comes back to the Security page. */
  async connectGithub(returnTo: string) {
    return throwOnError(await authClient.linkSocial({ provider: 'github', callbackURL: returnTo, errorCallbackURL: returnTo }));
  },

  /** Removes one sign-in method by its account id; the server refuses to remove the last one. */
  async unlinkAccount(accountId: string) {
    return throwOnError(await authClient.unlinkAccount({ accountId }));
  },

  /** The sign-in methods on the signed-in account: `credential` (password) and providers like `github`. */
  async linkedAccounts() {
    return (throwOnError(await authClient.listAccounts()).data ?? []).map((account) => ({ id: account.id, providerId: account.providerId }));
  },

  async signOut() {
    return throwOnError(await authClient.signOut());
  },
};
