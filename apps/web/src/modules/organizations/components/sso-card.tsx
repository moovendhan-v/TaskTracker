import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2Icon, CopyIcon, KeyRoundIcon } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { notify } from '@/components/kit/notify';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { organizationKeys, organizationsApi } from '../api/organizations.api';

const EMPTY = { domain: '', issuer: '', clientId: '', clientSecret: '' };

/**
 * SSO (A4): sign-in through the organization's identity provider (OIDC). Owners set it up
 * (they need two-step sign-in); it works once a DNS record proves the email domain. People who
 * sign in through it join the organization. Owners and admins see it; the secret is never shown.
 */
export function SsoCard({ organizationId, isOwner }: { organizationId: string; isOwner: boolean }) {
  const queryClient = useQueryClient();
  const key = organizationKeys.sso(organizationId);
  const sso = useQuery({ queryKey: key, queryFn: () => organizationsApi.sso(organizationId) });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const save = useMutation({
    mutationFn: () => organizationsApi.setSso(organizationId, form),
    onSuccess: (saved) => {
      queryClient.setQueryData(key, saved);
      setEditing(false);
      setForm(EMPTY);
      notify.success('Saved. Add the DNS record, then verify.');
    },
    onError: (error) => notify.error(error),
  });
  const verify = useMutation({
    mutationFn: () => organizationsApi.verifySso(organizationId),
    onSuccess: (saved) => {
      queryClient.setQueryData(key, saved);
      notify.success('Domain verified: SSO is on');
    },
    onError: (error) => notify.error(error),
  });
  const remove = useMutation({
    mutationFn: () => organizationsApi.removeSso(organizationId),
    onSuccess: () => {
      queryClient.setQueryData(key, null);
      notify.success('SSO removed');
    },
    onError: (error) => notify.error(error),
  });
  const current = sso.data;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (form.domain && form.issuer && form.clientId && form.clientSecret) save.mutate();
  };
  const field = (name: keyof typeof EMPTY, label: string, props: Record<string, unknown> = {}) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`sso-${name}`}>{label}</Label>
      <Input id={`sso-${name}`} value={form[name]} onChange={(event) => setForm({ ...form, [name]: event.target.value })} {...props} />
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRoundIcon className="size-4 text-muted-foreground" /> Single sign-on
        </CardTitle>
        <CardDescription>People with your email domain sign in through your identity provider (Okta, Entra ID, Google Workspace…) and join the organization.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {current && !editing ? (
          <>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Domain</dt>
              <dd>{current.domain}</dd>
              <dt className="text-muted-foreground">Identity provider</dt>
              <dd className="truncate">{current.issuer}</dd>
              <dt className="text-muted-foreground">Client ID</dt>
              <dd className="truncate font-mono text-xs">{current.clientId}</dd>
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                {current.verified ? (
                  <span className="inline-flex items-center gap-1 text-good">
                    <CheckCircle2Icon className="size-3.5" /> On
                  </span>
                ) : (
                  'Waiting for the domain to be verified'
                )}
              </dd>
            </dl>
            {current.dnsRecord ? (
              <div className="grid gap-2 rounded-lg border bg-muted/40 p-3 text-xs">
                <p>Add this TXT record to {current.domain}’s DNS, then verify:</p>
                {(['name', 'value'] as const).map((part) => (
                  <div key={part} className="flex items-center gap-2">
                    <span className="w-12 text-muted-foreground capitalize">{part}</span>
                    <code className="min-w-0 flex-1 truncate rounded border bg-background px-1.5 py-0.5">{current.dnsRecord![part]}</code>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Copy the record ${part}`}
                      onClick={() => void navigator.clipboard.writeText(current.dnsRecord![part]).then(() => notify.success('Copied'))}
                    >
                      <CopyIcon />
                    </Button>
                  </div>
                ))}
                <div>
                  <Button size="sm" disabled={verify.isPending} onClick={() => verify.mutate()}>
                    {verify.isPending ? 'Checking…' : 'Verify domain'}
                  </Button>
                </div>
              </div>
            ) : null}
            {isOwner ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  Replace
                </Button>
                <ConfirmDialog
                  trigger={
                    <Button variant="ghost" size="sm">
                      Remove
                    </Button>
                  }
                  title="Remove single sign-on?"
                  description="People sign in with their passwords (or other ways) again. Accounts made through SSO stay."
                  confirmLabel="Remove"
                  onConfirm={() => remove.mutateAsync()}
                />
              </div>
            ) : null}
          </>
        ) : isOwner && (editing || (!current && !sso.isLoading)) ? (
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            {field('domain', 'Email domain', { placeholder: 'acme.com', autoComplete: 'off' })}
            {field('issuer', 'Issuer URL', { placeholder: 'https://acme.okta.com', autoComplete: 'off' })}
            {field('clientId', 'Client ID', { autoComplete: 'off' })}
            {field('clientSecret', 'Client secret', { type: 'password', autoComplete: 'new-password' })}
            <p className="text-xs text-muted-foreground sm:col-span-2">
              In your identity provider, add the redirect URL <code className="rounded bg-muted px-1">{`${window.location.origin}/api/auth/sso/callback/org-${organizationId}`}</code>. You need two-step sign-in to change this.
            </p>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={save.isPending || !form.domain || !form.issuer || !form.clientId || !form.clientSecret}>
                {save.isPending ? 'Saving…' : 'Save'}
              </Button>
              {editing ? (
                <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        ) : !current && !sso.isLoading ? (
          <p className="text-sm text-muted-foreground">Not set up. An owner can set it up.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
