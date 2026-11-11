import { useMutation, useQuery } from '@tanstack/react-query';
import { FingerprintIcon, KeyRoundIcon } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { GithubMark } from '@/components/common/github-mark';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/errors';
import { authApi } from '../api/auth.api';
import { useSignInWithPasskey } from '../hooks/use-auth-actions';

export const signInOptionsQuery = { queryKey: ['auth', 'sign-in-options'] as const, queryFn: () => authApi.signInOptions(), staleTime: 5 * 60_000 };

/** Messages for the codes Better Auth sends back in `?error=`; anything else gets a generic line. */
const ERRORS: Record<string, string> = {
  account_not_linked: 'That email already has a TaskFlow account. Sign in with your password, then connect GitHub on the Security page.',
  access_denied: 'GitHub sign-in was cancelled.',
  email_does_not_match: "Your GitHub account's email isn't the one you use here, so it can't be connected.",
  account_already_linked_to_different_user: 'That GitHub account is already connected to another TaskFlow account.',
  email_not_found: 'GitHub did not share an email address. Add a verified email on GitHub and try again.',
  sso_account_unconfirmed: 'An unconfirmed account uses that email. Confirm it (or reset its password) first, then use single sign-on.',
  sso_email_outside_domain: 'Your identity provider signed you in with an email outside your organization’s domain.',
};

/** The `?error=` GitHub sign-in came back with, as a sentence; only known codes are shown as such. */
export function githubErrorMessage(search: string): string | null {
  const code = new URLSearchParams(search).get('error');
  if (!code) return null;
  return ERRORS[code.toLowerCase().replace(/ /g, '_')] ?? 'That sign-in did not work. Try again, or use your email and password.';
}

/** Whether this browser can use passkeys at all. */
const passkeysSupported = () => typeof window !== 'undefined' && typeof window.PublicKeyCredential === 'function';

/**
 * The quicker ways in (A4), above the email form: a passkey (sign-in page only; a new account
 * adds one later from Security) and "Continue with GitHub" when the server has a GitHub app.
 */
export function OtherSignIn({ passkey = false }: { passkey?: boolean }) {
  const options = useQuery(signInOptionsQuery);
  const github = useMutation({ mutationFn: () => authApi.signInWithGithub() });
  const withPasskey = useSignInWithPasskey();
  const [ssoOpen, setSsoOpen] = useState(false);
  const [ssoEmail, setSsoEmail] = useState('');
  const sso = useMutation({ mutationFn: () => authApi.signInWithSso(ssoEmail) });
  const showPasskey = passkey && passkeysSupported();
  const error = github.error ?? withPasskey.error ?? sso.error;
  // The sign-in page always offers single sign-on; sign-up only GitHub, when it's set up.
  if (!passkey && !options.data?.github) return null;
  return (
    <div className="mb-4 grid gap-3">
      {showPasskey ? (
        <Button type="button" variant="outline" disabled={withPasskey.isPending} onClick={() => withPasskey.mutate()}>
          <FingerprintIcon /> {withPasskey.isPending ? 'Waiting for your passkey…' : 'Sign in with a passkey'}
        </Button>
      ) : null}
      {options.data?.github ? (
        <Button type="button" variant="outline" disabled={github.isPending} onClick={() => github.mutate()}>
          <GithubMark /> {github.isPending ? 'Opening GitHub…' : 'Continue with GitHub'}
        </Button>
      ) : null}
      {passkey ? (
        ssoOpen ? (
          <form
            className="flex gap-2 animate-in fade-in-0 slide-in-from-top-1"
            onSubmit={(event) => {
              event.preventDefault();
              if (ssoEmail.includes('@')) sso.mutate();
            }}
          >
            <Input type="email" aria-label="Work email for single sign-on" placeholder="you@company.com" autoComplete="email" value={ssoEmail} onChange={(event) => setSsoEmail(event.target.value)} autoFocus />
            <Button type="submit" variant="outline" disabled={sso.isPending || !ssoEmail.includes('@')}>
              {sso.isPending ? 'Opening…' : 'Continue'}
            </Button>
          </form>
        ) : (
          <Button type="button" variant="outline" onClick={() => setSsoOpen(true)}>
            <KeyRoundIcon /> Sign in with SSO
          </Button>
        )
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {getErrorMessage(error)}
        </p>
      ) : null}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or with email <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
