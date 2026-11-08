import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { hasFieldErrors, useServerForm } from '@/core/forms/use-server-form';
import { captchaSatisfied, TurnstileWidget } from '@/core/auth/turnstile-widget';
import { getErrorMessage } from '@/lib/errors';
import { AuthLayout } from '../components/auth-layout';
import type { SignInValues } from '../components/auth-schemas';
import { FormError } from '../components/form-error';
import { githubErrorMessage, OtherSignIn } from '../components/other-sign-in';
import { useSignIn } from '../hooks/use-auth-actions';

export function SignInPage() {
  const [captcha, setCaptcha] = useState<string | null>(null);
  const signIn = useSignIn();
  const { form, applyServerErrors } = useServerForm<SignInValues>('auth.signIn', { defaultValues: { email: '', password: '' } });
  const { errors } = form.formState;
  // Set when GitHub sign-in came back with an error (A4).
  const [githubError] = useState(() => githubErrorMessage(window.location.search));

  const onSubmit = form.handleSubmit((values) => signIn.mutate({ ...values, captcha }, { onError: applyServerErrors }));

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue to your workspace."
      footer={
        <>
          New to TaskFlow?{' '}
          <Link to="/sign-up" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <OtherSignIn passkey />
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <FormError message={signIn.error && !hasFieldErrors(signIn.error) ? getErrorMessage(signIn.error) : githubError} />
        <FormField id="email" label="Email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...form.register('email')} />
        </FormField>
        <FormField id="password" label="Password" error={errors.password?.message}>
          <Input id="password" type="password" autoComplete="current-password" aria-invalid={!!errors.password} {...form.register('password')} />
        </FormField>
        <div className="-mt-2 text-right">
          <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">
            Forgot password?
          </Link>
        </div>
        <TurnstileWidget action="sign-in" onToken={setCaptcha} />
        <Button type="submit" disabled={signIn.isPending || !captchaSatisfied(captcha)}>
          {signIn.isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  );
}
