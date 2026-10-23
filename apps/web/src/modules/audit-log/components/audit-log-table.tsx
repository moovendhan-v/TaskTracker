import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import type { AuditLogEntryResponse, Paginated } from '@taskflow/shared-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const timestamp = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

interface AuditLogTableProps {
  data: Paginated<AuditLogEntryResponse> | undefined;
  showIp: boolean;
  onPage: (page: number) => void;
}

/** Read-only audit table, shared by the workspace view and the platform admin console. */
export function AuditLogTable({ data, showIp, onPage }: AuditLogTableProps) {
  const items = data?.items ?? [];
  const lastPage = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="grid gap-3">
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">When</th>
              <th scope="col" className="px-4 py-2 font-medium">Who</th>
              <th scope="col" className="px-4 py-2 font-medium">Action</th>
              <th scope="col" className="px-4 py-2 font-medium">Details</th>
              {showIp ? <th scope="col" className="px-4 py-2 font-medium">IP</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((entry) => (
              <tr key={entry.id} className="align-top">
                <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">{timestamp.format(new Date(entry.createdAt))}</td>
                <td className="px-4 py-2">{entry.actorName}</td>
                <td className="px-4 py-2">
                  <Badge variant="secondary" className="font-mono">
                    {entry.action}
                  </Badge>
                </td>
                <td className="max-w-md px-4 py-2">
                  {/* Metadata is rendered as escaped text, never as HTML. */}
                  <code className="line-clamp-2 text-xs break-all text-muted-foreground">{JSON.stringify(entry.metadata)}</code>
                </td>
                {showIp ? <td className="px-4 py-2 font-mono text-xs">{entry.ip ?? '—'}</td> : null}
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={showIp ? 5 : 4} className="px-4 py-8 text-center text-muted-foreground">
                  No entries match.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
        <span>
          Page {data?.page ?? 1} of {lastPage} · {data?.total ?? 0} entries
        </span>
        <Button variant="outline" size="icon-sm" aria-label="Previous page" disabled={!data || data.page <= 1} onClick={() => onPage((data?.page ?? 1) - 1)}>
          <ChevronLeftIcon />
        </Button>
        <Button variant="outline" size="icon-sm" aria-label="Next page" disabled={!data || data.page >= lastPage} onClick={() => onPage((data?.page ?? 1) + 1)}>
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  );
}
