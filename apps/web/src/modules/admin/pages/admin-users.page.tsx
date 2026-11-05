import { BanIcon, CheckCircle2Icon, MoreHorizontalIcon, ShieldCheckIcon, ShieldMinusIcon, UsersIcon } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { PageHeader } from '@/components/common/page-header';
import { UserAvatar } from '@/components/common/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useCurrentUser } from '@/core/auth/use-current-user';
import { formatLongDate } from '@/lib/dates';
import { Pager } from '../components/pager';
import { SearchBox } from '../components/search-box';
import { useAdminUsers, useUpdateAdminUser } from '../hooks/use-admin';

const PAGE_SIZE = 25;

export function AdminUsersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim());
  const { data } = useAdminUsers({ page, pageSize: PAGE_SIZE, ...(deferredSearch && { search: deferredSearch }) });
  const { data: me } = useCurrentUser();
  const update = useUpdateAdminUser();

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader
        title="Users"
        description="Every account on this TaskFlow instance."
        icon={<UsersIcon className="size-5 text-muted-foreground" />}
        actions={
          <SearchBox
            label="Search name or email"
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
          />
        }
      />
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-3 p-4 md:p-6">
        <ul className="divide-y rounded-xl border bg-card">
          {data?.items.map((user) => {
            const isMe = user.id === me?.id;
            return (
              <li key={user.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <UserAvatar name={user.name} className="size-9" />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {user.name}
                    {user.platformRole === 'SUPER_ADMIN' ? <Badge>Super admin</Badge> : null}
                    {user.suspended ? <Badge className="bg-destructive/10 text-destructive">Suspended</Badge> : null}
                    {isMe ? <Badge variant="muted">You</Badge> : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user.email} · {user.workspaceCount} workspace{user.workspaceCount === 1 ? '' : 's'} · joined {formatLongDate(user.createdAt)}
                  </p>
                </div>
                {isMe ? null : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Manage ${user.name}`}>
                        <MoreHorizontalIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {user.platformRole === 'SUPER_ADMIN' ? (
                        <DropdownMenuItem onSelect={() => update.mutate({ userId: user.id, body: { platformRole: 'USER' } })}>
                          <ShieldMinusIcon /> Remove super admin
                        </DropdownMenuItem>
                      ) : (
                        <ConfirmDialog
                          trigger={
                            <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                              <ShieldCheckIcon /> Make super admin
                            </DropdownMenuItem>
                          }
                          title={`Make ${user.name} a super admin?`}
                          description="They'll be able to see every workspace and user, and change platform access."
                          confirmLabel="Grant access"
                          destructive={false}
                          onConfirm={() => update.mutateAsync({ userId: user.id, body: { platformRole: 'SUPER_ADMIN' } })}
                        />
                      )}
                      {user.suspended ? (
                        <DropdownMenuItem onSelect={() => update.mutate({ userId: user.id, body: { suspended: false } })}>
                          <CheckCircle2Icon /> Reactivate
                        </DropdownMenuItem>
                      ) : (
                        <ConfirmDialog
                          trigger={
                            <DropdownMenuItem variant="destructive" onSelect={(event) => event.preventDefault()}>
                              <BanIcon /> Suspend
                            </DropdownMenuItem>
                          }
                          title={`Suspend ${user.name}?`}
                          description="They're signed out everywhere and can't sign in until reactivated."
                          confirmLabel="Suspend"
                          onConfirm={() => update.mutateAsync({ userId: user.id, body: { suspended: true } })}
                        />
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </li>
            );
          })}
        </ul>
        {data ? <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} /> : null}
      </div>
    </div>
  );
}
