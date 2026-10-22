import { ScrollTextIcon } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { PageHeader } from '@/components/common/page-header';
import { AuditFilter, AuditLogTable } from '@/modules/audit-log';
import { useAdminAuditLog } from '../hooks/use-admin';

export function AdminAuditLogPage() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const deferredAction = useDeferredValue(action);
  const { data } = useAdminAuditLog({ page, pageSize: 50, ...(deferredAction && { action: deferredAction }) });

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader
        title="Platform audit log"
        description="All workspaces, including platform admin actions and IP addresses."
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
        <AuditLogTable data={data} showIp onPage={setPage} />
      </div>
    </div>
  );
}
