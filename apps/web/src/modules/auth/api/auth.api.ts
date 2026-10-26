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

  async signOut() {
    return throwOnError(await authClient.signOut());
  },
};
