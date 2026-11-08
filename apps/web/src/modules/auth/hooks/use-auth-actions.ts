import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { authApi } from '../api/auth.api';

export function useSignIn() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; password: string; captcha: string | null }) =>
      authApi.signIn({ email: input.email, password: input.password }, input.captcha),
    onSuccess: async (result) => {
      // With two-factor on, the password only gets you to the second step (A4).
      if ((result.data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) {
        await navigate({ to: '/two-factor' });
        return;
      }
      queryClient.clear();
      await navigate({ to: '/' });
    },
  });
}

/** Passkey sign-in (A4): a full sign-in on its own, so there's no second step. */
export function useSignInWithPasskey() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.signInWithPasskey(),
    onSuccess: async () => {
      queryClient.clear();
      await navigate({ to: '/' });
    },
  });
}

export function useSignUp() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; email: string; password: string; captcha: string | null }) =>
      authApi.signUp({ name: input.name, email: input.email, password: input.password }, input.captcha),
    onSuccess: async () => {
      queryClient.clear();
      await navigate({ to: '/onboarding' });
    },
  });
}

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: (input: { email: string; captcha: string | null }) => authApi.requestPasswordReset(input.email, input.captcha),
  });
}

export function useResetPassword() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (input: { token: string; password: string }) => authApi.resetPassword(input.token, input.password),
    onSuccess: () => navigate({ to: '/sign-in' }),
  });
}

export function useSignOut() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.signOut(),
    onSettled: async () => {
      queryClient.clear();
      await navigate({ to: '/sign-in' });
    },
  });
}

/** The second step of signing in: a code (or a backup code), then into the app. */
export function useVerifyTwoFactor() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { code: string; backup: boolean; trustDevice: boolean }) =>
      input.backup ? authApi.verifyBackupCode(input.code, input.trustDevice) : authApi.verifyTotp(input.code, input.trustDevice),
    onSuccess: async () => {
      queryClient.clear();
      await navigate({ to: '/' });
    },
  });
}
