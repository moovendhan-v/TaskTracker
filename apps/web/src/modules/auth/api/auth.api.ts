import { authClient, captchaHeaders } from '@/core/auth/auth-client';

interface AuthResult {
  error: { message?: string | undefined } | null;
}

/** Turns Better Auth's `{ error }` result into a thrown Error, so callers can use mutations. */
function throwOnError<T extends AuthResult>(result: T): T {
  if (result.error) throw new Error(result.error.message || 'Request failed');
  return result;
}

export const authApi = {
  async signIn(input: { email: string; password: string }, captcha: string | null) {
    return throwOnError(await authClient.signIn.email({ ...input, fetchOptions: { headers: captchaHeaders(captcha) } }));
  },

  async signUp(input: { name: string; email: string; password: string }, captcha: string | null) {
    return throwOnError(await authClient.signUp.email({ ...input, fetchOptions: { headers: captchaHeaders(captcha) } }));
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
