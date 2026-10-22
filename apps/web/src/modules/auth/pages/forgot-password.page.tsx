import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from '@tanstack/react-router';
import { MailCheckIcon } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { captchaSatisfied, TurnstileWidget } from '@/core/auth/turnstile-widget';
import { getErrorMessage } from '@/lib/errors';
import { AuthLayout } from '../components/auth-layout';
import { forgotPasswordSchema, type ForgotPasswordValues } from '../components/auth-schemas';
import { FormError } from '../components/form-error';
import { useRequestPasswordReset } from '../hooks/use-auth-actions';

export function ForgotPasswordPage() {
  const [captcha, setCaptcha] = useState<string | null>(null);
  const request = useRequestPasswordReset();
  const form = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } });

  const onSubmit = form.handleSubmit((values) => request.mutate({ email: values.email, captcha }));
  const backToSignIn = (
    <Link to="/sign-in" className="font-medium text-primary hover:underline">
      Back to sign in
    </Link>
  );

  if (request.isSuccess) {
    // Same message whether or not the email has an account, so the form can't be used to find users.
    return (
      <AuthLayout title="Check your email" subtitle="If an account uses that address, we've sent a reset link." footer={backToSignIn}>
        <div className="flex items-center gap-3 rounded-lg border bg-card p-4 text-sm">
          <MailCheckIcon className="size-5 text-primary" />
          The link expires in 30 minutes.
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Reset your password" subtitle="We'll email you a link to choose a new one." footer={backToSignIn}>
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <FormError message={request.error ? getErrorMessage(request.error) : null} />
        <FormField id="email" label="Email" error={form.formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
        </FormField>
        <TurnstileWidget action="password-reset" onToken={setCaptcha} />
        <Button type="submit" disabled={request.isPending || !captchaSatisfied(captcha)}>
          Send reset link
        </Button>
      </form>
    </AuthLayout>
  );
}
