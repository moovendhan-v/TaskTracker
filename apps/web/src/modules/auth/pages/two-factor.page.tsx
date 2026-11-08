import { Link } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { getErrorMessage } from '@/lib/errors';
import { AuthLayout } from '../components/auth-layout';
import { FormError } from '../components/form-error';
import { useVerifyTwoFactor } from '../hooks/use-auth-actions';

/**
 * The second step of signing in (A4): the six-digit code from an authenticator app,
 * or one of the backup codes. Only reachable after the password was right; the
 * server keeps that state, so this page can't skip the first step.
 */
export function TwoFactorPage() {
  const [backup, setBackup] = useState(false);
  const [code, setCode] = useState('');
  const [trust, setTrust] = useState(false);
  const verify = useVerifyTwoFactor();
  const cleaned = backup ? code.trim() : code.replace(/\D/g, '');
  const ready = backup ? cleaned.length >= 8 : cleaned.length === 6;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (ready) verify.mutate({ code: cleaned, backup, trustDevice: trust });
  };

  return (
    <AuthLayout
      title="Two-step sign-in"
      subtitle={backup ? 'Enter one of the backup codes you saved. Each works once.' : 'Enter the 6-digit code from your authenticator app.'}
      footer={
        <Link to="/sign-in" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={submit} className="grid gap-4" noValidate>
        <FormError message={verify.error ? getErrorMessage(verify.error) : null} />
        <FormField id="two-factor-code" label={backup ? 'Backup code' : 'Code'}>
          <Input
            id="two-factor-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            autoComplete="one-time-code"
            inputMode={backup ? 'text' : 'numeric'}
            maxLength={backup ? 24 : 9}
            autoFocus
            className="text-center font-mono text-lg tracking-[0.35em]"
            placeholder={backup ? 'XXXXX-XXXXX' : '000 000'}
          />
        </FormField>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={trust} onCheckedChange={(value) => setTrust(value === true)} />
          Trust this device for 30 days
        </label>
        <Button type="submit" disabled={!ready || verify.isPending}>
          {verify.isPending ? 'Checking…' : 'Verify'}
        </Button>
        <button
          type="button"
          onClick={() => {
            setBackup((value) => !value);
            setCode('');
          }}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {backup ? 'Use the authenticator app instead' : 'Lost your device? Use a backup code'}
        </button>
      </form>
    </AuthLayout>
  );
}
