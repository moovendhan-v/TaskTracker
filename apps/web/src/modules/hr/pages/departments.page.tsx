import { Building2Icon, PencilIcon, PlusIcon, TrashIcon } from 'lucide-react';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { EmptyState } from '@/components/common/empty-state';
import { NameDialog } from '@/components/common/name-dialog';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useMemberName } from '@/modules/members';
import { usePermissions } from '@/modules/workspaces';
import { useDepartmentMutations, useDepartments } from '../hooks/use-hr';

export function DepartmentsPage({ workspaceId }: { workspaceId: string }) {
  const { data: departments = [] } = useDepartments(workspaceId);
  const mutations = useDepartmentMutations(workspaceId);
  const memberName = useMemberName(workspaceId);
  const { can } = usePermissions(workspaceId);
  const canManage = can('hr.manage');

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader
        title="Departments"
        description="Group people by team. Set each person's department from the directory."
        icon={<Building2Icon className="size-5 text-muted-foreground" />}
        actions={
          canManage ? (
            <NameDialog
              trigger={
                <Button size="sm">
                  <PlusIcon /> New department
                </Button>
              }
              title="New department"
              submitLabel="Create"
              placeholder="e.g. Engineering"
              onSubmit={(values) => mutations.create.mutateAsync({ name: values.name })}
            />
          ) : null
        }
      />
      <div className="mx-auto grid max-w-5xl gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
        {departments.length === 0 ? (
          <EmptyState className="col-span-full" icon={<Building2Icon />} title="No departments yet" />
        ) : null}
        {departments.map((department) => (
          <Card key={department.id} className="grid gap-2 p-4">
            <div className="flex items-start gap-2">
              <h3 className="flex-1 font-semibold">{department.name}</h3>
              {canManage ? (
                <>
                  <NameDialog
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label={`Rename ${department.name}`}>
                        <PencilIcon />
                      </Button>
                    }
                    title="Rename department"
                    submitLabel="Save"
                    defaultValues={{ name: department.name }}
                    onSubmit={(values) => mutations.update.mutateAsync({ departmentId: department.id, body: { name: values.name } })}
                  />
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label={`Delete ${department.name}`}>
                        <TrashIcon />
                      </Button>
                    }
                    title={`Delete ${department.name}?`}
                    description="People in it will have no department until you set a new one."
                    confirmLabel="Delete"
                    onConfirm={() => mutations.remove.mutateAsync(department.id)}
                  />
                </>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              {department.memberCount} {department.memberCount === 1 ? 'person' : 'people'}
              {department.headUserId ? ` · led by ${memberName(department.headUserId)}` : ''}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
