import { useQuery } from '@tanstack/react-query';
import { isSpaceScoped, type AccessVerdict } from '@taskflow/shared-types';
import { CheckCircle2Icon, KeyRoundIcon, SendIcon, XCircleIcon } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/common/page-header';
import { notify } from '@/components/kit/notify';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import { useCurrentUser } from '@/core/auth/use-current-user';
import { useMembers } from '@/modules/members';
import { useSpaces } from '@/modules/spaces';
import { usePermissions } from '@/modules/workspaces';
import { accessReviewApi } from '../api/access-review.api';
import { PERMISSION_GROUPS } from '../lib/permission-groups';

const VERDICT: Record<AccessVerdict, string> = {
  allowed: 'Allowed',
  'not-granted': 'Not allowed: no policy of the role grants it',
  denied: 'Not allowed: a policy denies it (a deny always wins)',
  'denied-in-space': 'Not allowed in this project: a policy takes it away here',
};

const SCOPE: Record<'workspace' | 'this-space' | 'other-spaces', string> = { workspace: 'everywhere', 'this-space': 'in this project', 'other-spaces': 'in other projects only' };

const label = (permission: string) => PERMISSION_GROUPS.flatMap((group) => group.permissions).find((item) => item.key === permission)?.label ?? permission;

export interface AccessCheck {
  userId?: string;
  permission?: string;
  spaceId?: string;
}

/**
 * Access (E3): check what someone can do and why. Everyone can check
 * themselves and ask for what they're missing; people who manage roles can
 * check any member (the policy simulator). Opened from an access request in
 * the inbox, it starts on that request.
 */
export function AccessPage({ workspaceId, initial = {} }: { workspaceId: string; initial?: AccessCheck }) {
  const { can } = usePermissions(workspaceId);
  const { data: me } = useCurrentUser();
  const manager = can('roles.manage');
  const { data: members = [] } = useMembers(workspaceId);
  const { data: spaces = [] } = useSpaces(workspaceId);
  const [userId, setUserId] = useState(initial.userId ?? '');
  const [permission, setPermission] = useState(initial.permission ?? 'task.update');
  const [spaceId, setSpaceId] = useState(initial.spaceId ?? '');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  const who = manager && userId && userId !== me?.id ? userId : null;
  const space = isSpaceScoped(permission) && spaceId ? spaceId : null;
  const result = useQuery({
    queryKey: ['workspaces', workspaceId, 'access-check', who ?? 'me', permission, space],
    queryFn: () => (who ? accessReviewApi.explain(workspaceId, who, permission, space) : accessReviewApi.mine(workspaceId, permission, space)),
    enabled: Boolean(me),
  });
  const explanation = result.data;
  const request = async () => {
    setSending(true);
    try {
      const asked = await accessReviewApi.request(workspaceId, { permission, spaceId: space, note: note.trim() || undefined });
      notify.success(`Asked ${asked} ${asked === 1 ? 'person' : 'people'} who manage roles`);
      setNote('');
    } catch (error) {
      notify.error(error);
    } finally {
      setSending(false);
    }
  };

  const select = 'h-9 w-full rounded-md border bg-background px-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';
  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader
        title="Access"
        description={manager ? 'Check what anyone in the workspace can do, and why' : 'Check what you can do here, and ask for what you need'}
        icon={<KeyRoundIcon className="size-5 text-muted-foreground" />}
      />
      <div className="mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-6 p-4 md:p-6">
        <section aria-label="What to check" className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-3">
          {manager ? (
            <div className="grid gap-1.5">
              <Label htmlFor="access-person">Person</Label>
              <select id="access-person" className={select} value={who ?? ''} onChange={(event) => setUserId(event.target.value)}>
                <option value="">Me</option>
                {members
                  .filter((member) => member.userId !== me?.id)
                  .map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.name}
                    </option>
                  ))}
              </select>
            </div>
          ) : null}
          <div className={cn('grid gap-1.5', !manager && 'sm:col-span-2')}>
            <Label htmlFor="access-permission">Permission</Label>
            <select id="access-permission" className={select} value={permission} onChange={(event) => setPermission(event.target.value)}>
              {PERMISSION_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.permissions.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="access-space">In</Label>
            <select id="access-space" className={select} value={space ?? ''} disabled={!isSpaceScoped(permission)} onChange={(event) => setSpaceId(event.target.value)}>
              <option value="">{isSpaceScoped(permission) ? 'Any project (the workspace)' : 'The whole workspace'}</option>
              {spaces.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        </section>

        {explanation ? (
          <section aria-label="Result" aria-live="polite" className="grid gap-3">
            <div className={cn('flex items-start gap-3 rounded-xl border p-4', explanation.allowed ? 'border-good/40 bg-good/5' : 'border-critical/40 bg-critical/5')}>
              {explanation.allowed ? <CheckCircle2Icon className="mt-0.5 size-5 text-good" /> : <XCircleIcon className="mt-0.5 size-5 text-critical" />}
              <div className="min-w-0">
                <p className="font-semibold">{VERDICT[explanation.verdict as AccessVerdict]}</p>
                <p className="text-sm text-muted-foreground">
                  {who ? (members.find((member) => member.userId === who)?.name ?? 'They') : 'You'} · role {explanation.roleName} · {label(explanation.permission)}
                  {space ? ` · in ${spaces.find((item) => item.id === space)?.name ?? 'this project'}` : ''}
                </p>
              </div>
            </div>
            {explanation.reasons.length ? (
              <ul aria-label="Why" className="divide-y rounded-xl border bg-card text-sm">
                {explanation.reasons.map((reason, index) => (
                  <li key={`${reason.source}-${index}`} className="flex items-center gap-3 px-4 py-2.5">
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold uppercase', reason.effect === 'allow' ? 'bg-good/10 text-good' : 'bg-critical/10 text-critical')}>{reason.effect}</span>
                    <span className="min-w-0 flex-1">{reason.source}</span>
                    <code className="font-mono text-xs text-muted-foreground">{reason.pattern}</code>
                    <span className="text-xs text-muted-foreground">{SCOPE[reason.scope as keyof typeof SCOPE]}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No statement of the role mentions this permission.</p>
            )}

            {!who && !explanation.allowed ? (
              <div className="grid gap-2 rounded-xl border bg-card p-4">
                <Label htmlFor="access-note">Ask for it</Label>
                <Textarea id="access-note" rows={2} maxLength={200} value={note} placeholder="What you need it for (optional)" onChange={(event) => setNote(event.target.value)} />
                <Button className="justify-self-start" disabled={sending} onClick={() => void request()}>
                  <SendIcon /> Request access
                </Button>
                <p className="text-xs text-muted-foreground">The people who manage roles get a notification. Nothing changes until one of them edits a role.</p>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
