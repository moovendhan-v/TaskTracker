import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { authApi } from '../api/auth.api';

export function useSignIn() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; password: string; captcha: string | null }) =>
      authApi.signIn({ email: input.email, password: input.password }, input.captcha),
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
