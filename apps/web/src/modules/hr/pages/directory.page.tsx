import { SearchIcon, UsersRoundIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ErrorState } from '@/components/common/error-state';
import { FullPageSpinner } from '@/components/common/full-page-spinner';
import { PageHeader } from '@/components/common/page-header';
import { UserAvatar } from '@/components/common/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { usePermissions } from '@/modules/workspaces';
import { ProfileDialog } from '../components/profile-dialog';
import { useDepartments, useEmployees, useUpsertProfile } from '../hooks/use-hr';
import { EMPLOYMENT_LABELS, formatDay } from '../lib/hr-labels';

export function DirectoryPage({ workspaceId }: { workspaceId: string }) {
  const [search, setSearch] = useState('');
  const employees = useEmployees(workspaceId);
  const { data: departments = [] } = useDepartments(workspaceId);
  const upsert = useUpsertProfile(workspaceId);
  const { can } = usePermissions(workspaceId);
  const people = employees.data ?? [];
  const names = useMemo(() => new Map(people.map((person) => [person.userId, person.name])), [people]);

  const filtered = people.filter((person) => {
    const needle = search.trim().toLowerCase();
    return !needle || [person.name, person.email, person.jobTitle ?? '', person.departmentName ?? ''].some((v) => v.toLowerCase().includes(needle));
  });

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader
        title="Team directory"
        description={`${people.length} people`}
        icon={<UsersRoundIcon className="size-5 text-muted-foreground" />}
        actions={
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people" aria-label="Search people" className="h-8 w-56 pl-8" />
          </div>
        }
      />
      <div className="mx-auto max-w-5xl p-6">
        {employees.isLoading ? <FullPageSpinner /> : null}
        {employees.isError ? <ErrorState error={employees.error} onRetry={() => void employees.refetch()} /> : null}
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Person</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="hidden px-4 py-2 font-medium md:table-cell">Manager</th>
                <th className="hidden px-4 py-2 font-medium lg:table-cell">Started</th>
                <th className="w-12 px-4 py-2" aria-label="Actions" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((person) => (
                <tr key={person.userId}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={person.name} className="size-8" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{person.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{person.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p>{person.jobTitle ?? <span className="text-muted-foreground">—</span>}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {person.departmentName ? <Badge variant="secondary">{person.departmentName}</Badge> : null}
                      {person.employmentType ? <Badge variant="outline">{EMPLOYMENT_LABELS[person.employmentType]}</Badge> : null}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">{(person.managerUserId && names.get(person.managerUserId)) || '—'}</td>
                  <td className="hidden px-4 py-3 lg:table-cell">{formatDay(person.startDate)}</td>
                  <td className="px-4 py-3">
                    {can('hr.manage') ? (
                      <ProfileDialog
                        employee={person}
                        departments={departments}
                        people={people}
                        onSave={(body) => upsert.mutateAsync({ userId: person.userId, body })}
                      />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
