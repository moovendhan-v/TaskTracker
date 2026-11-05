import { CheckIcon, InboxIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import type { LeaveRequestResponse } from '@taskflow/shared-types';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { UserAvatar } from '@/components/common/user-avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useCurrentUser } from '@/core/auth/use-current-user';
import { useLeaveMutations, useLeaveQueue } from '../hooks/use-hr';
import { formatDay } from '../lib/hr-labels';

export function ApprovalsPage({ workspaceId }: { workspaceId: string }) {
  const { data } = useLeaveQueue(workspaceId, 'pending');
  const pending = data?.items ?? [];

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader
        title="Time-off approvals"
        description={`${data?.total ?? 0} waiting, oldest first`}
        icon={<InboxIcon className="size-5 text-muted-foreground" />}
      />
      <div className="mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-3 p-4 md:p-6">
        {pending.length === 0 ? <EmptyState icon={<InboxIcon />} title="All caught up" description="New requests appear here." /> : null}
        {pending.map((request) => (
          <ApprovalCard key={request.id} workspaceId={workspaceId} request={request} />
        ))}
      </div>
    </div>
  );
}

function ApprovalCard({ workspaceId, request }: { workspaceId: string; request: LeaveRequestResponse }) {
  const [note, setNote] = useState('');
  const { decide } = useLeaveMutations(workspaceId);
  const { data: me } = useCurrentUser();
  const own = request.userId === me?.id;

  return (
    <Card className="grid gap-3 p-4">
      <div className="flex items-start gap-3">
        <UserAvatar name={request.userName} className="size-9" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{request.userName}</p>
          <p className="text-sm text-muted-foreground">
            {request.leaveTypeName} · {request.days} day{request.days === 1 ? '' : 's'} · {formatDay(request.startDate)} – {formatDay(request.endDate)}
          </p>
          {request.reason ? <p className="mt-1 text-sm">“{request.reason}”</p> : null}
        </div>
      </div>
      {own ? (
        <p className="text-xs text-muted-foreground">This is your own request; someone else needs to decide on it.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Note (optional)" aria-label={`Note for ${request.userName}`} className="h-8 flex-1" />
          <Button
            size="sm"
            variant="outline"
            disabled={decide.isPending}
            onClick={() => decide.mutate({ requestId: request.id, body: { decision: 'rejected', note } })}
          >
            <XIcon /> Reject
          </Button>
          <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ requestId: request.id, body: { decision: 'approved', note } })}>
            <CheckIcon /> Approve
          </Button>
        </div>
      )}
    </Card>
  );
}
