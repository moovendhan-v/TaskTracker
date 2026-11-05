import { BuildingIcon } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { PageHeader } from '@/components/common/page-header';
import { formatLongDate } from '@/lib/dates';
import { Pager } from '../components/pager';
import { SearchBox } from '../components/search-box';
import { useAdminWorkspaces } from '../hooks/use-admin';

const PAGE_SIZE = 25;

export function AdminWorkspacesPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim());
  const { data } = useAdminWorkspaces({ page, pageSize: PAGE_SIZE, ...(deferredSearch && { search: deferredSearch }) });

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader
        title="Workspaces"
        description="Every workspace, newest first."
        icon={<BuildingIcon className="size-5 text-muted-foreground" />}
        actions={
          <SearchBox
            label="Search workspaces"
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
          />
        }
      />
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-3 p-4 md:p-6">
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">Workspace</th>
                <th scope="col" className="px-4 py-2 font-medium">Owner</th>
                <th scope="col" className="px-4 py-2 font-medium">Members</th>
                <th scope="col" className="px-4 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data?.items.map((workspace) => (
                <tr key={workspace.id}>
                  <td className="px-4 py-2 font-medium">{workspace.name}</td>
                  <td className="px-4 py-2">{workspace.ownerName}</td>
                  <td className="px-4 py-2 tabular-nums">{workspace.memberCount}</td>
                  <td className="px-4 py-2 text-muted-foreground">{formatLongDate(workspace.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data ? <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} /> : null}
      </div>
    </div>
  );
}
