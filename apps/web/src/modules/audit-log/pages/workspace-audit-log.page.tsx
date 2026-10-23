import { ScrollTextIcon } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { PageHeader } from '@/components/common/page-header';
import { AuditFilter } from '../components/audit-filter';
import { AuditLogTable } from '../components/audit-log-table';
import { useWorkspaceAuditLog } from '../hooks/use-audit-log';

export function WorkspaceAuditLogPage({ workspaceId }: { workspaceId: string }) {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const deferredAction = useDeferredValue(action);
  const { data } = useWorkspaceAuditLog(workspaceId, { page, pageSize: 50, ...(deferredAction && { action: deferredAction }) });

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader
        title="Audit log"
        description="Every change to members, roles, structure and HR records in this workspace."
        icon={<ScrollTextIcon className="size-5 text-muted-foreground" />}
        actions={
          <AuditFilter
            value={action}
            onChange={(value) => {
              setAction(value);
              setPage(1);
            }}
          />
        }
      />
      <div className="mx-auto max-w-6xl p-6">
        <AuditLogTable data={data} showIp={false} onPage={setPage} />
      </div>
    </div>
  );
}
