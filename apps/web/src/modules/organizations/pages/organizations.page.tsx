import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { ORG_NAME_MAX } from '@taskflow/shared-types';
import { Building2Icon, ChevronRightIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/common/page-header';
import { notify } from '@/components/kit/notify';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { organizationKeys, organizationsApi } from '../api/organizations.api';
import { ROLE_LABEL } from '../lib/labels';

/** Organizations you're in (A3), and a way to start one. */
export function OrganizationsPage({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const organizations = useQuery({ queryKey: organizationKeys.all, queryFn: organizationsApi.list });
  const [name, setName] = useState('');
  const create = useMutation({
    mutationFn: () => organizationsApi.create(name),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: organizationKeys.all });
      setName('');
      void navigate({ to: '/w/$workspaceId/organizations/$organizationId', params: { workspaceId, organizationId: created.id } });
    },
    onError: (error) => notify.error(error),
  });
  const list = organizations.data ?? [];

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader title="Organizations" description="Workspaces run together, with shared security rules" icon={<Building2Icon className="size-5 text-muted-foreground" />} />
      <div className="mx-auto grid max-w-2xl grid-cols-[minmax(0,1fr)] gap-6 p-4 md:p-6">
        {list.length ? (
          <ul aria-label="Your organizations" className="divide-y rounded-xl border bg-card">
            {list.map((org) => (
              <li key={org.id}>
                <Link
                  to="/w/$workspaceId/organizations/$organizationId"
                  params={{ workspaceId, organizationId: org.id }}
                  className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/50"
                >
                  <span aria-hidden className="grid size-8 place-items-center rounded-lg bg-primary-soft font-semibold text-ring">
                    {org.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{org.name}</span>
                    <span className="block text-xs text-muted-foreground">{ROLE_LABEL[org.role]}</span>
                  </span>
                  <ChevronRightIcon aria-hidden className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        ) : organizations.isLoading ? null : (
          <p className="text-sm text-muted-foreground">You aren’t in an organization yet.</p>
        )}
        <Card>
          <CardHeader>
            <CardTitle>New organization</CardTitle>
            <CardDescription>You’ll be its owner. Add workspaces you manage and people to run it with you.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (name.trim()) create.mutate();
              }}
            >
              <div className="grid gap-1.5">
                <Label htmlFor="organization-name">Name</Label>
                <Input id="organization-name" value={name} maxLength={ORG_NAME_MAX} onChange={(event) => setName(event.target.value)} placeholder="e.g. Northwind" className="w-64" />
              </div>
              <Button type="submit" disabled={!name.trim() || create.isPending}>
                <PlusIcon /> Create
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
