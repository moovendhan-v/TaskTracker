import { PencilIcon, PlusIcon, TagsIcon, TrashIcon } from 'lucide-react';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { PageHeader } from '@/components/common/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LeaveTypeDialog } from '../components/leave-type-dialog';
import { useLeaveTypeMutations, useLeaveTypes } from '../hooks/use-hr';

export function LeaveTypesPage({ workspaceId }: { workspaceId: string }) {
  const { data: leaveTypes = [] } = useLeaveTypes(workspaceId);
  const mutations = useLeaveTypeMutations(workspaceId);

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader
        title="Leave types"
        description="What people can request, and how many days a year."
        icon={<TagsIcon className="size-5 text-muted-foreground" />}
        actions={
          <LeaveTypeDialog
            trigger={
              <Button size="sm">
                <PlusIcon /> New leave type
              </Button>
            }
            onSave={(body) => mutations.create.mutateAsync(body)}
          />
        }
      />
      <ul className="mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-2 p-4 md:p-6">
        {leaveTypes.map((type) => (
          <li key={type.id} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
            <span className="size-3 rounded-full" style={{ backgroundColor: type.color }} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{type.name}</p>
              <p className="text-xs text-muted-foreground">
                {type.annualAllowanceDays === null ? 'Unlimited' : `${type.annualAllowanceDays} days a year`}
              </p>
            </div>
            {type.requiresApproval ? <Badge variant="secondary">Needs approval</Badge> : <Badge variant="outline">Auto-approved</Badge>}
            <LeaveTypeDialog
              leaveType={type}
              trigger={
                <Button variant="ghost" size="icon-sm" aria-label={`Edit ${type.name}`}>
                  <PencilIcon />
                </Button>
              }
              onSave={(body) => mutations.update.mutateAsync({ leaveTypeId: type.id, body })}
            />
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="icon-sm" aria-label={`Delete ${type.name}`}>
                  <TrashIcon />
                </Button>
              }
              title={`Delete ${type.name}?`}
              description="Types that have requests can't be deleted."
              confirmLabel="Delete"
              onConfirm={() => mutations.remove.mutateAsync(type.id).catch(() => undefined)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
