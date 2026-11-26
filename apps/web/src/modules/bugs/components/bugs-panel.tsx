import {
  BUG_ENVIRONMENT_LABELS,
  BUG_ENVIRONMENTS,
  BUG_KIND_LABELS,
  BUG_KINDS,
  BUG_QA_STATE_LABELS,
  BUG_QA_STATES,
  BUG_SEVERITIES,
  BUG_SEVERITY_LABELS,
  type BugEnvironment,
  type BugFilter,
  type BugKind,
  type BugQaState,
  type BugSeverity,
} from '@taskflow/shared-types';
import { BugIcon, CopyIcon, GlobeIcon, PlusIcon, SearchIcon, TerminalIcon } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/cn';
import { timeAgo } from '@/lib/relative-time';
import { useBugs } from '../hooks/use-bugs';
import { QA_TONE, SEVERITY_TONE } from '../lib/bug-meta';
import { BugDetail } from './bug-detail';
import { ReportBugDialog } from './report-bug-dialog';

const OPEN_STATES: BugQaState[] = ['new', 'confirmed', 'fixed', 'retest', 'reopened'];
const ALL = 'all';

/** A project's bug reports and feedback, most severe first, with QA filters. */
export function BugsPanel({ workspaceId, spaceId, onOpenTask }: { workspaceId: string; spaceId: string; onOpenTask: (taskId: string) => void }) {
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<string>(ALL);
  const [severity, setSeverity] = useState<string>(ALL);
  const [environment, setEnvironment] = useState<string>(ALL);
  const [state, setState] = useState<string>('open');
  const [reporting, setReporting] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);

  const filter: BugFilter = {
    kinds: kind === ALL ? null : [kind as BugKind],
    severities: severity === ALL ? null : [severity as BugSeverity],
    environments: environment === ALL ? null : [environment as BugEnvironment],
    qaStates: state === ALL ? null : state === 'open' ? OPEN_STATES : [state as BugQaState],
    search: deferredSearch.trim() || null,
  };
  const bugs = useBugs(workspaceId, spaceId, filter);

  return (
    <div className="mx-auto grid max-w-5xl gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search reports" placeholder="Search by title or #number" value={search} onChange={(event) => setSearch(event.target.value)} className="h-8 pl-8" />
        </div>
        <Filter label="QA state" value={state} onChange={setState} options={[['open', 'Open'], [ALL, 'Any state'], ...BUG_QA_STATES.map((value): [string, string] => [value, BUG_QA_STATE_LABELS[value]])]} />
        <Filter label="Severity" value={severity} onChange={setSeverity} options={[[ALL, 'Any severity'], ...BUG_SEVERITIES.map((value): [string, string] => [value, BUG_SEVERITY_LABELS[value]])]} />
        <Filter label="Kind" value={kind} onChange={setKind} options={[[ALL, 'Any kind'], ...BUG_KINDS.map((value): [string, string] => [value, BUG_KIND_LABELS[value]])]} />
        <Filter label="Environment" value={environment} onChange={setEnvironment} options={[[ALL, 'Any environment'], ...BUG_ENVIRONMENTS.map((value): [string, string] => [value, BUG_ENVIRONMENT_LABELS[value]])]} />
        <Button size="sm" data-bug-capture-ignore="" onClick={() => setReporting(true)}>
          <PlusIcon className="mr-1 size-4" /> Report a bug
        </Button>
      </div>

      {bugs.isError ? <ErrorState error={bugs.error} onRetry={() => void bugs.refetch()} /> : null}
      {bugs.data && bugs.data.length === 0 ? (
        <EmptyState
          icon={<BugIcon />}
          title={filter.search || kind !== ALL || severity !== ALL || environment !== ALL || state !== 'open' ? 'No reports match' : 'No open reports'}
          description="Reports carry a screenshot or recording, the steps, and the page's console and network, so they can be fixed without a back-and-forth."
          action={
            <Button size="sm" onClick={() => setReporting(true)}>
              Report a bug
            </Button>
          }
        />
      ) : null}
      {bugs.data?.length ? (
        <ul aria-label="Bug reports" className="divide-y rounded-lg border bg-card">
          {bugs.data.map((bug) => (
            <li key={bug.taskId}>
              <button type="button" onClick={() => setSelected(bug.taskId)} className="grid w-full grid-cols-[2.5rem_1fr_auto] items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none">
                <span className={cn('rounded px-1.5 py-0.5 text-center text-xs font-semibold', SEVERITY_TONE[bug.severity])}>{bug.severity}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    <span className="mr-1 text-muted-foreground">#{bug.number}</span>
                    {bug.title}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    {BUG_KIND_LABELS[bug.kind]} · {BUG_ENVIRONMENT_LABELS[bug.environment]}
                    {bug.module ? ` · ${bug.module}` : ''} · {timeAgo(bug.createdAt)}
                    {bug.consoleErrors ? (
                      <span className="flex items-center gap-0.5 text-critical" title="Console errors">
                        <TerminalIcon className="size-3" /> {bug.consoleErrors}
                      </span>
                    ) : null}
                    {bug.failedRequests ? (
                      <span className="flex items-center gap-0.5 text-critical" title="Failed requests">
                        <GlobeIcon className="size-3" /> {bug.failedRequests}
                      </span>
                    ) : null}
                    {bug.duplicateOfTaskId ? (
                      <span className="flex items-center gap-0.5" title="Duplicate">
                        <CopyIcon className="size-3" /> duplicate
                      </span>
                    ) : null}
                  </span>
                </span>
                <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', QA_TONE[bug.qaState])}>{BUG_QA_STATE_LABELS[bug.qaState]}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {reporting ? <ReportBugDialog workspaceId={workspaceId} spaceId={spaceId} open={reporting} onOpenChange={setReporting} onCreated={setSelected} onOpenExisting={(taskId) => {
        setReporting(false);
        setSelected(taskId);
      }} /> : null}
      <BugDetail
        workspaceId={workspaceId}
        taskId={selected}
        onClose={() => setSelected(null)}
        onOpenBug={setSelected}
        onOpenTask={(taskId) => {
          setSelected(null);
          onOpenTask(taskId);
        }}
      />
    </div>
  );
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: [string, string][] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="h-8 w-auto min-w-32 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([option, text]) => (
          <SelectItem key={option} value={option}>
            {text}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
