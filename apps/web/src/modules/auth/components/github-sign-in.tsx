import { useMutation, useQuery } from '@tanstack/react-query';
import { GithubMark } from '@/components/common/github-mark';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/errors';
import { authApi } from '../api/auth.api';

export const signInOptionsQuery = { queryKey: ['auth', 'sign-in-options'] as const, queryFn: () => authApi.signInOptions(), staleTime: 5 * 60_000 };

/** Messages for the codes Better Auth sends back in `?error=`; anything else gets a generic line. */
const ERRORS: Record<string, string> = {
  account_not_linked: 'That email already has a TaskFlow account. Sign in with your password, then connect GitHub on the Security page.',
  access_denied: 'GitHub sign-in was cancelled.',
  email_does_not_match: "Your GitHub account's email isn't the one you use here, so it can't be connected.",
  account_already_linked_to_different_user: 'That GitHub account is already connected to another TaskFlow account.',
  email_not_found: 'GitHub did not share an email address. Add a verified email on GitHub and try again.',
};

/** The `?error=` GitHub sign-in came back with, as a sentence; only known codes are shown as such. */
export function githubErrorMessage(search: string): string | null {
  const code = new URLSearchParams(search).get('error');
  if (!code) return null;
  return ERRORS[code.toLowerCase().replace(/ /g, '_')] ?? 'GitHub sign-in did not work. Try again, or use your email and password.';
}

/** "Continue with GitHub" (A4), shown only when the server has a GitHub app configured. */
export function GithubSignIn() {
  const options = useQuery(signInOptionsQuery);
  const start = useMutation({ mutationFn: () => authApi.signInWithGithub() });
  if (!options.data?.github) return null;
  return (
    <div className="mb-4 grid gap-3">
      <Button type="button" variant="outline" disabled={start.isPending} onClick={() => start.mutate()}>
        <GithubMark /> {start.isPending ? 'Opening GitHub…' : 'Continue with GitHub'}
      </Button>
      {start.error ? <p className="text-xs text-destructive">{getErrorMessage(start.error)}</p> : null}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or with email <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
