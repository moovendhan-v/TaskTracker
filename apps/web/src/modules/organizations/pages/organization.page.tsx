import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { canManageOrg, ORG_NAME_MAX, ORG_ROLES, TWO_STEP_REQUIREMENTS, type OrgRole, type TwoStepRequirement } from '@taskflow/shared-types';
import { Building2Icon, ShieldCheckIcon, ShieldOffIcon, Trash2Icon, UserPlusIcon } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { PageHeader } from '@/components/common/page-header';
import { UserAvatar } from '@/components/common/user-avatar';
import { notify } from '@/components/kit/notify';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCurrentUser } from '@/core/auth/use-current-user';
import { cn } from '@/lib/cn';
import { timeAgo } from '@/lib/relative-time';
import { organizationKeys, organizationsApi } from '../api/organizations.api';
import { SsoCard } from '../components/sso-card';
import { describeActivity, ROLE_LABEL, TWO_STEP_LABEL } from '../lib/labels';

type Tab = 'workspaces' | 'people' | 'security' | 'activity';
const SELECT = 'h-9 rounded-md border bg-background px-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

/**
 * One organization (A3): its workspaces (by name; being in the organization doesn't let you
 * into them), its people and their roles, the two-step rule for all its workspaces, and
 * what happened. Members see; owners and admins run it.
 */
export function OrganizationPage({ workspaceId, organizationId }: { workspaceId: string; organizationId: string }) {
  const organization = useQuery({ queryKey: organizationKeys.one(organizationId), queryFn: () => organizationsApi.get(organizationId) });
  const [tab, setTab] = useState<Tab>('workspaces');
  const org = organization.data;
  if (organization.isError) {
    return <p className="p-6 text-sm text-muted-foreground">This organization doesn’t exist, or you’re not in it.</p>;
  }
  if (!org) return null;
  const manage = canManageOrg(org.role);
  const tabs: [Tab, string][] = [
    ['workspaces', 'Workspaces'],
    ['people', 'People'],
    ...(manage ? ([['security', 'Security'], ['activity', 'Activity']] as [Tab, string][]) : []),
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader title={org.name} description={`You’re ${ROLE_LABEL[org.role].toLowerCase()} · ${TWO_STEP_LABEL[org.twoStepRequired]} two-step`} icon={<Building2Icon className="size-5 text-muted-foreground" />} />
      <div className="mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-4 p-4 md:p-6">
        <div role="tablist" aria-label="Organization" className="flex gap-1 border-b">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn('-mb-px border-b-2 px-3 py-2 text-sm transition-colors', tab === key ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}
            >
              {label}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="animate-in fade-in-0">
          {tab === 'workspaces' ? <WorkspacesTab organizationId={organizationId} workspaceId={workspaceId} /> : null}
          {tab === 'people' ? <PeopleTab organizationId={organizationId} myRole={org.role} workspaceId={workspaceId} /> : null}
          {tab === 'security' && manage ? <SecurityTab organizationId={organizationId} name={org.name} current={org.twoStepRequired} isOwner={org.role === 'owner'} workspaceId={workspaceId} /> : null}
          {tab === 'activity' && manage ? <ActivityTab organizationId={organizationId} /> : null}
        </div>
      </div>
    </div>
  );
}

function WorkspacesTab({ organizationId, workspaceId }: { organizationId: string; workspaceId: string }) {
  const workspaces = useQuery({ queryKey: organizationKeys.workspaces(organizationId), queryFn: () => organizationsApi.workspaces(organizationId) });
  const list = workspaces.data ?? [];
  return (
    <div className="grid gap-3">
      {list.length ? (
        <ul aria-label="Workspaces in this organization" className="grid gap-2 sm:grid-cols-2">
          {list.map((workspace) => (
            <li key={workspace.id} className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-sm">
              <span aria-hidden className="size-3 rounded-full" style={{ backgroundColor: workspace.color }} />
              <span className="truncate font-medium">{workspace.name}</span>
            </li>
          ))}
        </ul>
      ) : workspaces.isLoading ? null : (
        <p className="text-sm text-muted-foreground">No workspaces yet.</p>
      )}
      <p className="text-xs text-muted-foreground">
        Add a workspace you manage from its{' '}
        <Link to="/w/$workspaceId/settings" params={{ workspaceId }} className="underline">
          workspace settings
        </Link>
        . Being in the organization doesn’t let anyone into its workspaces.
      </p>
    </div>
  );
}

function PeopleTab({ organizationId, myRole, workspaceId }: { organizationId: string; myRole: OrgRole; workspaceId: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const key = organizationKeys.members(organizationId);
  const members = useQuery({ queryKey: key, queryFn: () => organizationsApi.members(organizationId) });
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<OrgRole>('member');
  const manage = canManageOrg(myRole);
  const update = (list: Awaited<ReturnType<typeof organizationsApi.members>>) => queryClient.setQueryData(key, list);
  const add = useMutation({
    mutationFn: () => organizationsApi.addMember(organizationId, email, role),
    onSuccess: (list) => {
      update(list);
      setEmail('');
      notify.success('Added');
    },
    onError: (error) => notify.error(error),
  });
  const changeRole = useMutation({
    mutationFn: ({ userId, next }: { userId: string; next: OrgRole }) => organizationsApi.setRole(organizationId, userId, next),
    onSuccess: update,
    onError: (error) => notify.error(error),
  });
  const remove = useMutation({
    mutationFn: (userId: string) => organizationsApi.removeMember(organizationId, userId),
    onSuccess: (list, userId) => {
      update(list);
      if (list.length === 0 || !list.some((member) => member.userId === userId)) notify.success('Removed');
    },
    onError: (error) => notify.error(error),
  });
  const leave = useMutation({
    mutationFn: (userId: string) => organizationsApi.removeMember(organizationId, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: organizationKeys.all });
      void navigate({ to: '/w/$workspaceId/organizations', params: { workspaceId } });
    },
    onError: (error) => notify.error(error),
  });
  // Admins pick admin or member; owners can also make owners.
  const assignable = ORG_ROLES.filter((option) => option !== 'owner' || myRole === 'owner');
  const list = members.data ?? [];

  return (
    <div className="grid gap-4">
      <ul aria-label="People in this organization" className="divide-y rounded-xl border bg-card">
        {list.map((member) => {
          const canChange = manage && (member.role !== 'owner' || myRole === 'owner');
          return (
            <li key={member.userId} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
              <UserAvatar name={member.name} className="size-7 text-[10px]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{member.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{member.email}</span>
              </span>
              <span className={cn('inline-flex items-center gap-1 text-xs', member.hasTwoStep ? 'text-good' : 'text-muted-foreground')} title={member.hasTwoStep ? 'Has two-step sign-in' : 'No two-step sign-in'}>
                {member.hasTwoStep ? <ShieldCheckIcon className="size-3.5" /> : <ShieldOffIcon className="size-3.5" />}
                <span className="sr-only">{member.hasTwoStep ? 'Has two-step sign-in' : 'No two-step sign-in'}</span>
              </span>
              {canChange ? (
                <select
                  aria-label={`Role of ${member.name}`}
                  value={member.role}
                  disabled={changeRole.isPending}
                  onChange={(event) => changeRole.mutate({ userId: member.userId, next: event.target.value as OrgRole })}
                  className={SELECT}
                >
                  {assignable.map((option) => (
                    <option key={option} value={option}>
                      {ROLE_LABEL[option]}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs text-muted-foreground">{ROLE_LABEL[member.role]}</span>
              )}
              {canChange ? (
                <Button size="icon-sm" variant="ghost" aria-label={`Remove ${member.name}`} disabled={remove.isPending} onClick={() => remove.mutate(member.userId)}>
                  <Trash2Icon />
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {manage ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (email.trim()) add.mutate();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="org-member-email">Add by email</Label>
            <Input id="org-member-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" className="w-64" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="org-member-role">As</Label>
            <select id="org-member-role" value={role} onChange={(event) => setRole(event.target.value as OrgRole)} className={SELECT}>
              {assignable.map((option) => (
                <option key={option} value={option}>
                  {ROLE_LABEL[option]}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={!email.trim() || add.isPending}>
            <UserPlusIcon /> Add
          </Button>
        </form>
      ) : null}
      <LeaveButton onLeave={(userId) => leave.mutate(userId)} />
    </div>
  );
}

/** Anyone can leave; an organization's last owner has to hand over first (the server says so). */
function LeaveButton({ onLeave }: { onLeave: (userId: string) => void }) {
  const { data: me } = useCurrentUser();
  if (!me) return null;
  return (
    <div>
      <ConfirmDialog
        trigger={
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            Leave the organization
          </Button>
        }
        title="Leave the organization?"
        description="You keep your workspaces; you just stop seeing this organization. Someone in it can add you back."
        confirmLabel="Leave"
        onConfirm={() => onLeave(me.id)}
      />
    </div>
  );
}

function SecurityTab({ organizationId, name, current, isOwner, workspaceId }: { organizationId: string; name: string; current: TwoStepRequirement; isOwner: boolean; workspaceId: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [picked, setPicked] = useState<TwoStepRequirement | null>(null);
  const [newName, setNewName] = useState(name);
  const value = picked ?? current;
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: organizationKeys.all });
    void queryClient.invalidateQueries({ queryKey: ['workspaces'] });
  };
  const save = useMutation({
    mutationFn: () => organizationsApi.setTwoStep(organizationId, value),
    onSuccess: () => {
      setPicked(null);
      refresh();
      notify.success('Saved');
    },
    onError: (error) => notify.error(error),
  });
  const rename = useMutation({
    mutationFn: () => organizationsApi.rename(organizationId, newName),
    onSuccess: () => {
      refresh();
      notify.success('Renamed');
    },
    onError: (error) => notify.error(error),
  });
  const remove = useMutation({
    mutationFn: () => organizationsApi.remove(organizationId),
    onSuccess: () => {
      refresh();
      void navigate({ to: '/w/$workspaceId/organizations', params: { workspaceId } });
    },
    onError: (error) => notify.error(error),
  });

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheckIcon className="size-4 text-muted-foreground" /> Two-step sign-in in all workspaces
          </CardTitle>
          <CardDescription>Applies in every workspace of the organization, on top of each workspace’s own rule; the stricter one counts.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="org-two-step">Require it of</Label>
            <select id="org-two-step" value={value} onChange={(event) => setPicked(event.target.value as TwoStepRequirement)} className={SELECT}>
              {TWO_STEP_REQUIREMENTS.map((option) => (
                <option key={option} value={option}>
                  {TWO_STEP_LABEL[option]}
                </option>
              ))}
            </select>
          </div>
          <Button disabled={value === current || save.isPending} onClick={() => save.mutate()}>
            Save
          </Button>
        </CardContent>
      </Card>
      <SsoCard organizationId={organizationId} isOwner={isOwner} />
      <Card>
        <CardHeader>
          <CardTitle>Name</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (newName.trim() && newName.trim() !== name) rename.mutate();
            }}
          >
            <Input aria-label="Organization name" value={newName} maxLength={ORG_NAME_MAX} onChange={(event) => setNewName(event.target.value)} className="w-64" />
            <Button type="submit" variant="outline" disabled={!newName.trim() || newName.trim() === name || rename.isPending}>
              Rename
            </Button>
          </form>
        </CardContent>
      </Card>
      {isOwner ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Delete organization</CardTitle>
            <CardDescription>Its workspaces stay as they are, on their own; their organization-wide rules stop applying.</CardDescription>
          </CardHeader>
          <CardContent>
            <ConfirmDialog
              trigger={
                <Button variant="destructive">
                  <Trash2Icon /> Delete organization
                </Button>
              }
              title={`Delete ${name}?`}
              description="Members lose it from their list. Workspaces are kept."
              confirmLabel="Delete"
              onConfirm={() => remove.mutateAsync()}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function ActivityTab({ organizationId }: { organizationId: string }) {
  const activity = useQuery({ queryKey: organizationKeys.activity(organizationId), queryFn: () => organizationsApi.activity(organizationId) });
  const list = activity.data ?? [];
  if (!list.length) return activity.isLoading ? null : <p className="text-sm text-muted-foreground">Nothing yet.</p>;
  return (
    <ol aria-label="Organization activity" className="grid gap-2">
      {list.map((entry) => (
        <li key={entry.id} className="flex items-baseline gap-2 text-sm">
          <span className="font-medium">{entry.actorName ?? 'Someone'}</span>
          <span className="text-muted-foreground">{describeActivity(entry.action, entry.metadata as Record<string, unknown>)}</span>
          <span className="ml-auto shrink-0 text-xs text-subtle-foreground">{timeAgo(entry.createdAt)}</span>
        </li>
      ))}
    </ol>
  );
}
