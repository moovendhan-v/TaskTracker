import { PalmtreeIcon } from 'lucide-react';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/modules/workspaces';
import { LeaveBalanceCard } from '../components/leave-balance-card';
import { LeaveCalendar } from '../components/leave-calendar';
import { LeaveRequestDialog } from '../components/leave-request-dialog';
import { LeaveStatusBadge } from '../components/leave-status-badge';
import { useLeaveMutations, useLeaveTypes, useMyBalances, useMyLeave } from '../hooks/use-hr';
import { formatDay } from '../lib/hr-labels';

export function TimeOffPage({ workspaceId }: { workspaceId: string }) {
  const year = new Date().getFullYear();
  const today = new Date().toISOString().slice(0, 10);
  const { data: leaveTypes = [] } = useLeaveTypes(workspaceId);
  const { data: balances = [] } = useMyBalances(workspaceId, year);
  const { data: requests = [] } = useMyLeave(workspaceId);
  const mutations = useLeaveMutations(workspaceId);
  const { can } = usePermissions(workspaceId);

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader
        title="Time off"
        description={`Your balances for ${year}`}
        icon={<PalmtreeIcon className="size-5 text-muted-foreground" />}
        actions={can('leave.request') ? <LeaveRequestDialog leaveTypes={leaveTypes} onSubmit={(values) => mutations.request.mutateAsync(values)} /> : null}
      />
      <div className="mx-auto grid max-w-5xl gap-8 p-6">
        {leaveTypes.length === 0 ? (
          <EmptyState icon={<PalmtreeIcon />} title="No leave types yet" description="An HR manager needs to set up leave types first." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {balances.map((balance) => (
              <LeaveBalanceCard key={balance.leaveTypeId} balance={balance} />
            ))}
          </div>
        )}
        {can('hr.view') ? <LeaveCalendar workspaceId={workspaceId} /> : null}
        <section className="grid gap-3">
          <h2 className="text-sm font-semibold">Your requests</h2>
          {requests.length === 0 ? <p className="text-sm text-muted-foreground">No requests yet.</p> : null}
          <ul className="divide-y rounded-xl border bg-card">
            {requests.map((request) => {
              const cancellable = request.status === 'pending' || (request.status === 'approved' && request.startDate > today);
              return (
                <li key={request.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {request.leaveTypeName} · {request.days} day{request.days === 1 ? '' : 's'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDay(request.startDate)} – {formatDay(request.endDate)}
                      {request.decisionNote ? ` · “${request.decisionNote}”` : ''}
                    </p>
                  </div>
                  <LeaveStatusBadge status={request.status} />
                  {cancellable ? (
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="sm">
                          Cancel
                        </Button>
                      }
                      title="Cancel this request?"
                      description={request.status === 'approved' ? 'The days go back into your balance.' : 'Your approver won’t see it any more.'}
                      confirmLabel="Cancel request"
                      onConfirm={() => mutations.cancel.mutateAsync(request.id)}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
