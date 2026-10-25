import { CalendarRangeIcon, PlusIcon } from 'lucide-react';
import { ErrorState } from '@/components/common/error-state';
import { FullPageSpinner } from '@/components/common/full-page-spinner';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { useSpaces } from '@/modules/spaces';
import { useOpenTask } from '@/modules/tasks';
import { usePermissions } from '@/modules/workspaces';
import { BacklogPanel } from '../components/backlog-panel';
import { SprintCard } from '../components/sprint-card';
import { SprintFormDialog } from '../components/sprint-form-dialog';
import { useSprintMutations, useSprints } from '../hooks/use-sprints';

interface SprintsPageProps {
  workspaceId: string;
  spaceId: string;
}

export function SprintsPage({ workspaceId, spaceId }: SprintsPageProps) {
  const { data: spaces = [] } = useSpaces(workspaceId);
  const sprints = useSprints(workspaceId, spaceId);
  const mutations = useSprintMutations(workspaceId, spaceId);
  const { can } = usePermissions(workspaceId);
  const canManage = can('sprint.manage');
  const space = spaces.find((item) => item.id === spaceId);

  const all = sprints.data ?? [];
  const active = all.filter((sprint) => sprint.status === 'active');
  const planned = all.filter((sprint) => sprint.status === 'planned');
  const completed = all.filter((sprint) => sprint.status === 'completed');
  const openTask = useOpenTask();

  const cardFor = (sprint: (typeof all)[number]) => (
    <SprintCard
      key={sprint.id}
      workspaceId={workspaceId}
      sprint={sprint}
      plannedSprints={planned}
      canManage={canManage}
      onStart={() => mutations.start.mutateAsync(sprint.id)}
      onComplete={(moveOpenTasksToSprintId) => mutations.complete.mutateAsync({ sprintId: sprint.id, body: { moveOpenTasksToSprintId } })}
      onUpdate={(values) => mutations.update.mutateAsync({ sprintId: sprint.id, body: values })}
      onDelete={() => mutations.remove.mutateAsync(sprint.id)}
    />
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader
        title={`${space?.name ?? 'Space'} sprints`}
        description="Plan the backlog into sprints, then run one at a time."
        icon={<CalendarRangeIcon className="size-5 text-muted-foreground" />}
        actions={
          canManage ? (
            <SprintFormDialog
              formName="sprint.create"
              trigger={
                <Button size="sm">
                  <PlusIcon /> New sprint
                </Button>
              }
              title="New sprint"
              submitLabel="Create sprint"
              defaultValues={{ name: `Sprint ${all.length + 1}` }}
              onSubmit={(values) => mutations.create.mutateAsync(values)}
            />
          ) : null
        }
      />
      <div className="mx-auto grid max-w-6xl gap-8 p-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="grid content-start gap-6">
          {sprints.isLoading ? <FullPageSpinner /> : null}
          {sprints.isError ? <ErrorState error={sprints.error} onRetry={() => void sprints.refetch()} /> : null}
          {active.length > 0 ? <Section title="Active">{active.map(cardFor)}</Section> : null}
          <Section title="Planned" empty="No planned sprints. Create one to start planning.">
            {planned.map(cardFor)}
          </Section>
          {completed.length > 0 ? <Section title="Completed">{completed.map(cardFor)}</Section> : null}
        </div>
        <BacklogPanel
          workspaceId={workspaceId}
          spaceId={spaceId}
          openSprints={[...active, ...planned]}
          canPlan={canManage}
          onOpenTask={openTask}
        />
      </div>
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty?: string; children: React.ReactNode[] }) {
  return (
    <section className="grid gap-3">
      <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
      {children.length === 0 && empty ? <p className="text-sm text-muted-foreground">{empty}</p> : children}
    </section>
  );
}
