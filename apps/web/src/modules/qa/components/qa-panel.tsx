import { BarChart3Icon, ClipboardCheckIcon, ListChecksIcon } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePermissions } from '@/modules/workspaces';
import { useQaCoverage } from '../hooks/use-qa';
import { QaCases } from './qa-cases';
import { QaPlans } from './qa-plans';

/** A project's QA (E6.4): test cases, test plans with runs and sign-off, and coverage. */
export function QaPanel({ workspaceId, spaceId, onOpenTask }: { workspaceId: string; spaceId: string; onOpenTask: (taskId: string) => void }) {
  const { canIn } = usePermissions(workspaceId);
  const canEdit = canIn(spaceId, 'task.update');
  const canApprove = canIn(spaceId, 'space.manage');
  return (
    <div className="mx-auto max-w-6xl">
      <Tabs defaultValue="plans">
        <TabsList>
          <TabsTrigger value="plans">
            <ClipboardCheckIcon className="mr-1.5 size-4" /> Test plans
          </TabsTrigger>
          <TabsTrigger value="cases">
            <ListChecksIcon className="mr-1.5 size-4" /> Test cases
          </TabsTrigger>
          <TabsTrigger value="coverage">
            <BarChart3Icon className="mr-1.5 size-4" /> Coverage
          </TabsTrigger>
        </TabsList>
        <TabsContent value="plans" className="mt-4">
          <QaPlans workspaceId={workspaceId} spaceId={spaceId} canEdit={canEdit} canApprove={canApprove} onOpenTask={onOpenTask} />
        </TabsContent>
        <TabsContent value="cases" className="mt-4">
          <QaCases workspaceId={workspaceId} spaceId={spaceId} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="coverage" className="mt-4">
          <Coverage workspaceId={workspaceId} spaceId={spaceId} onOpenTask={onOpenTask} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Coverage({ workspaceId, spaceId, onOpenTask }: { workspaceId: string; spaceId: string; onOpenTask: (taskId: string) => void }) {
  const coverage = useQaCoverage(workspaceId, spaceId);
  const data = coverage.data;
  if (!data) return null;
  const percent = data.features ? Math.round((data.coveredFeatures / data.features) * 100) : null;
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" role="list" aria-label="Coverage figures">
        <Stat label="Features with a test" value={percent === null ? '—' : `${percent}%`} detail={`${data.coveredFeatures} of ${data.features}`} />
        <Stat label="Ready test cases" value={String(data.readyCases)} detail={`${data.cases} in all`} />
        <Stat label="Never run" value={String(data.neverRun)} detail="ready cases without a result" />
        <Stat label="Flaky" value={String(data.flaky.length)} detail="passed and failed lately" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-lg border bg-card p-4">
          <h3 className="mb-2 text-sm font-semibold">Features without a test case</h3>
          {data.uncovered.length ? (
            <ul aria-label="Uncovered features" className="grid gap-1 text-sm">
              {data.uncovered.map((task) => (
                <li key={task.taskId}>
                  <button type="button" className="text-left hover:underline" onClick={() => onOpenTask(task.taskId)}>
                    <span className="text-muted-foreground">#{task.number}</span> {task.title}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{data.features ? 'Every feature has at least one ready test case.' : 'No tasks of type Feature in this project.'}</p>
          )}
        </section>
        <section className="rounded-lg border bg-card p-4">
          <h3 className="mb-2 text-sm font-semibold">Flaky test cases</h3>
          {data.flaky.length ? (
            <ul aria-label="Flaky cases" className="grid gap-1 text-sm">
              {data.flaky.map((item) => (
                <li key={item.caseId}>
                  <span className="font-mono text-xs text-muted-foreground">C-{item.number}</span> {item.title}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">None: no case both passed and failed in its last five runs.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div role="listitem" className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
