import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { captchaSatisfied, TurnstileWidget } from '@/core/auth/turnstile-widget';
import { getErrorMessage } from '@/lib/errors';
import { AuthLayout } from '../components/auth-layout';
import { PASSWORD_MIN, signUpSchema, type SignUpValues } from '../components/auth-schemas';
import { FormError } from '../components/form-error';
import { useSignUp } from '../hooks/use-auth-actions';

export function SignUpPage() {
  const [captcha, setCaptcha] = useState<string | null>(null);
  const signUp = useSignUp();
  const form = useForm<SignUpValues>({ resolver: zodResolver(signUpSchema), defaultValues: { name: '', email: '', password: '' } });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => signUp.mutate({ ...values, captcha }));

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start organising your team's work in minutes."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/sign-in" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <FormError message={signUp.error ? getErrorMessage(signUp.error) : null} />
        <FormField id="name" label="Full name" error={errors.name?.message}>
          <Input id="name" autoComplete="name" aria-invalid={!!errors.name} {...form.register('name')} />
        </FormField>
        <FormField id="email" label="Work email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...form.register('email')} />
        </FormField>
        <FormField id="password" label="Password" error={errors.password?.message} hint={`At least ${PASSWORD_MIN} characters.`}>
          <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...form.register('password')} />
        </FormField>
        <TurnstileWidget action="sign-up" onToken={setCaptcha} />
        <Button type="submit" disabled={signUp.isPending || !captchaSatisfied(captcha)}>
          {signUp.isPending ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  );
}
