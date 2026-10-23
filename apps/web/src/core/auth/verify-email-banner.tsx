import { MailWarningIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { authClient } from './auth-client';
import { useCurrentUser } from './use-current-user';

/** Shown until the signed-in user confirms their email. Teammates can't add them to a workspace before that. */
export function VerifyEmailBanner() {
  const { data: me } = useCurrentUser();
  const [sending, setSending] = useState(false);
  if (!me || me.emailVerified) return null;

  async function resend(email: string) {
    setSending(true);
    try {
      const { error } = await authClient.sendVerificationEmail({ email, callbackURL: '/' });
      if (error) toast.error(error.message || 'Could not send the email. Try again in a few minutes.');
      else toast.success(`Sent a new link to ${email}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <div role="status" className="flex flex-wrap items-center gap-2 border-b border-amber-300/60 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100">
      <MailWarningIcon className="size-4 shrink-0" aria-hidden />
      <span className="flex-1">
        Confirm your email: we sent a link to <strong>{me.email}</strong>. Teammates can add you to their workspaces once it&apos;s confirmed.
      </span>
      <Button size="sm" variant="outline" disabled={sending} onClick={() => void resend(me.email)}>
        Send again
      </Button>
    </div>
  );
}
