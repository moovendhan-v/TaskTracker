import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { hasFieldErrors, useServerForm } from '@/core/forms/use-server-form';
import { getErrorMessage } from '@/lib/errors';
import { AuthLayout } from '../components/auth-layout';
import type { ResetPasswordValues } from '../components/auth-schemas';
import { FormError } from '../components/form-error';
import { useResetPassword } from '../hooks/use-auth-actions';

export function ResetPasswordPage({ token }: { token: string | undefined }) {
  const reset = useResetPassword();
  const { form, applyServerErrors } = useServerForm<ResetPasswordValues>('auth.resetPassword', { defaultValues: { password: '', confirm: '' } });
  const { errors } = form.formState;

  if (!token) {
    return (
      <AuthLayout title="Link not valid" subtitle="This reset link is missing or has expired.">
        <Button asChild>
          <Link to="/forgot-password">Request a new link</Link>
        </Button>
      </AuthLayout>
    );
  }

  const onSubmit = form.handleSubmit((values) => reset.mutate({ token, password: values.password }, { onError: applyServerErrors }));

  return (
    <AuthLayout title="Choose a new password" subtitle="You'll be signed out of other devices.">
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <FormError message={reset.error && !hasFieldErrors(reset.error) ? getErrorMessage(reset.error) : null} />
        <FormField id="password" label="New password" error={errors.password?.message}>
          <Input id="password" type="password" autoComplete="new-password" {...form.register('password')} />
        </FormField>
        <FormField id="confirm" label="Confirm password" error={errors.confirm?.message}>
          <Input id="confirm" type="password" autoComplete="new-password" {...form.register('confirm')} />
        </FormField>
        <Button type="submit" disabled={reset.isPending}>
          Update password
        </Button>
      </form>
    </AuthLayout>
  );
}
