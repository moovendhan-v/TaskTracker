import {
  QA_CASE_PRIORITIES,
  QA_CASE_PRIORITY_LABELS,
  QA_CASE_TYPE_LABELS,
  QA_CASE_TYPES,
  QA_LIMITS,
  QA_RESULT_LABELS,
  type QaCasePriority,
  type QaCaseResponse,
  type QaCaseStatus,
  type QaCaseType,
  type QaStep,
} from '@taskflow/shared-types';
import { FolderIcon, PlusIcon, SearchIcon, Trash2Icon } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import { timeAgo } from '@/lib/relative-time';
import { useTaskSearch } from '@/modules/tasks';
import { qaApi } from '../api/qa.api';
import { useQaCaseRuns, useQaCases, useQaMutation, useQaSuites } from '../hooks/use-qa';
import { PRIORITY_TONE, RESULT_TONE } from '../lib/qa-meta';

const NONE = 'none';

export function ResultChip({ result }: { result: QaCaseResponse['lastResult'] }) {
  return <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap', RESULT_TONE[result ?? 'not_run'])}>{result ? QA_RESULT_LABELS[result] : 'Not run'}</span>;
}

/** Test cases by suite, with search; a case opens in the editor (with its run history). */
export function QaCases({ workspaceId, spaceId, canEdit }: { workspaceId: string; spaceId: string; canEdit: boolean }) {
  const [suiteId, setSuiteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const deferred = useDeferredValue(search.trim());
  const suites = useQaSuites(workspaceId, spaceId);
  const cases = useQaCases(workspaceId, spaceId, { suiteId, search: deferred || null });
  const [editing, setEditing] = useState<QaCaseResponse | 'new' | null>(null);
  const [suiteName, setSuiteName] = useState('');
  const addSuite = useQaMutation(workspaceId, (name: string) => qaApi.saveSuite(workspaceId, spaceId, null, name), () => 'Suite added');

  return (
    <div className="grid gap-4 md:grid-cols-[14rem_minmax(0,1fr)]">
      <nav aria-label="Suites" className="grid content-start gap-1">
        <button type="button" onClick={() => setSuiteId(null)} className={cn('flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted', suiteId === null && 'bg-muted font-medium')}>
          <FolderIcon className="size-4 text-muted-foreground" /> All cases
        </button>
        {(suites.data ?? []).map((suite) => (
          <button key={suite.id} type="button" onClick={() => setSuiteId(suite.id)} className={cn('flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted', suiteId === suite.id && 'bg-muted font-medium')}>
            <FolderIcon className="size-4 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{suite.name}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{suite.caseCount}</span>
          </button>
        ))}
        {canEdit ? (
          <form
            className="mt-2 flex gap-1"
            onSubmit={(event) => {
              event.preventDefault();
              if (suiteName.trim()) addSuite.mutate(suiteName.trim(), { onSuccess: () => setSuiteName('') });
            }}
          >
            <Input aria-label="New suite name" placeholder="New suite" value={suiteName} onChange={(event) => setSuiteName(event.target.value)} className="h-8 text-xs" maxLength={QA_LIMITS.name} />
            <Button type="submit" size="sm" variant="outline" className="h-8 px-2" aria-label="Add suite" disabled={!suiteName.trim()}>
              <PlusIcon className="size-4" />
            </Button>
          </form>
        ) : null}
      </nav>

      <div className="grid content-start gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search test cases" placeholder="Search by title or C-number" value={search} onChange={(event) => setSearch(event.target.value)} className="h-8 pl-8" />
          </div>
          {canEdit ? (
            <Button size="sm" onClick={() => setEditing('new')}>
              <PlusIcon className="mr-1 size-4" /> New test case
            </Button>
          ) : null}
        </div>
        {cases.data?.length === 0 ? (
          <EmptyState title={deferred ? 'No test cases match' : 'No test cases yet'} description="A test case lists the steps to check and what should happen at each one. Group them in suites, then run them in a test plan." />
        ) : (
          <ul aria-label="Test cases" className="divide-y rounded-lg border bg-card">
            {(cases.data ?? []).map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => setEditing(item)} className="grid w-full grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 text-left hover:bg-muted/50">
                  <span className="font-mono text-xs text-muted-foreground">C-{item.number}</span>
                  <span className="min-w-0">
                    <span className={cn('block truncate text-sm font-medium', item.status === 'deprecated' && 'text-muted-foreground line-through')}>{item.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      <span className={PRIORITY_TONE[item.priority]}>{QA_CASE_PRIORITY_LABELS[item.priority]}</span> · {QA_CASE_TYPE_LABELS[item.type]} · {item.steps.length} step{item.steps.length === 1 ? '' : 's'}
                      {item.status === 'draft' ? ' · draft' : ''}
                      {item.coversTaskTitle ? ` · covers “${item.coversTaskTitle}”` : ''}
                    </span>
                  </span>
                  <ResultChip result={item.lastResult} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {editing ? <CaseDialog workspaceId={workspaceId} spaceId={spaceId} testCase={editing === 'new' ? null : editing} defaultSuiteId={suiteId} canEdit={canEdit} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function CaseDialog({ workspaceId, spaceId, testCase, defaultSuiteId, canEdit, onClose }: { workspaceId: string; spaceId: string; testCase: QaCaseResponse | null; defaultSuiteId: string | null; canEdit: boolean; onClose: () => void }) {
  const suites = useQaSuites(workspaceId, spaceId);
  const features = useTaskSearch(workspaceId, { spaceId }, { where: 'type[in]=feature', sort: [{ field: 'number', direction: 'asc' }] });
  const runs = useQaCaseRuns(workspaceId, testCase?.id ?? null);
  const [title, setTitle] = useState(testCase?.title ?? '');
  const [suiteId, setSuiteId] = useState<string>(testCase?.suiteId ?? defaultSuiteId ?? NONE);
  const [priority, setPriority] = useState<QaCasePriority>(testCase?.priority ?? 'medium');
  const [type, setType] = useState<QaCaseType>(testCase?.type ?? 'functional');
  const [status, setStatus] = useState<QaCaseStatus>(testCase?.status ?? 'ready');
  const [covers, setCovers] = useState<string>(testCase?.coversTaskId ?? NONE);
  const [preconditions, setPreconditions] = useState(testCase?.preconditions ?? '');
  const [steps, setSteps] = useState<QaStep[]>(testCase?.steps.length ? testCase.steps : [{ action: '', expected: '' }]);
  const save = useQaMutation(
    workspaceId,
    () => qaApi.saveCase(workspaceId, spaceId, testCase?.id ?? null, { title, suiteId: suiteId === NONE ? null : suiteId, priority, type, status, coversTaskId: covers === NONE ? null : covers, preconditions, steps }),
    (saved) => `Saved C-${saved.number}`,
  );
  const remove = useQaMutation(workspaceId, () => qaApi.deleteCase(workspaceId, testCase!.id), () => 'Test case deleted');
  const setStep = (index: number, patch: Partial<QaStep>) => setSteps((current) => current.map((step, at) => (at === index ? { ...step, ...patch } : step)));

  const editor = (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate(undefined, { onSuccess: onClose });
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="qa-case-title">Title</Label>
        <Input id="qa-case-title" maxLength={QA_LIMITS.title} value={title} onChange={(event) => setTitle(event.target.value)} disabled={!canEdit} autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Choice label="Suite" value={suiteId} onChange={setSuiteId} disabled={!canEdit} options={[[NONE, 'No suite'], ...(suites.data ?? []).map((suite): [string, string] => [suite.id, suite.name])]} />
        <Choice label="Priority" value={priority} onChange={(value) => setPriority(value as QaCasePriority)} disabled={!canEdit} options={QA_CASE_PRIORITIES.map((value) => [value, QA_CASE_PRIORITY_LABELS[value]])} />
        <Choice label="Type" value={type} onChange={(value) => setType(value as QaCaseType)} disabled={!canEdit} options={QA_CASE_TYPES.map((value) => [value, QA_CASE_TYPE_LABELS[value]])} />
        <Choice label="Status" value={status} onChange={(value) => setStatus(value as QaCaseStatus)} disabled={!canEdit} options={[['draft', 'Draft'], ['ready', 'Ready'], ['deprecated', 'Deprecated']]} />
      </div>
      <Choice label="Covers feature" value={covers} onChange={setCovers} disabled={!canEdit} options={[[NONE, 'Nothing in particular'], ...(features.data?.items ?? []).map((task): [string, string] => [task.id, `#${task.number} ${task.title}`])]} />
      <div className="grid gap-1.5">
        <Label htmlFor="qa-case-pre">Preconditions</Label>
        <Textarea id="qa-case-pre" rows={2} maxLength={QA_LIMITS.text} value={preconditions} onChange={(event) => setPreconditions(event.target.value)} disabled={!canEdit} placeholder="e.g. Signed in as a customer with one item in the cart" />
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Steps</legend>
        <ol className="grid gap-2">
          {steps.map((step, index) => (
            <li key={index} className="grid grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)_2rem] items-start gap-2">
              <span className="pt-2 text-right text-xs text-muted-foreground">{index + 1}.</span>
              <Textarea aria-label={`Step ${index + 1} action`} rows={1} placeholder="Do this" maxLength={QA_LIMITS.stepText} value={step.action} onChange={(event) => setStep(index, { action: event.target.value })} disabled={!canEdit} />
              <Textarea aria-label={`Step ${index + 1} expected`} rows={1} placeholder="Expect this" maxLength={QA_LIMITS.stepText} value={step.expected} onChange={(event) => setStep(index, { expected: event.target.value })} disabled={!canEdit} />
              {canEdit ? (
                <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`Remove step ${index + 1}`} onClick={() => setSteps((current) => current.filter((_, at) => at !== index))}>
                  <Trash2Icon className="size-4" />
                </Button>
              ) : null}
            </li>
          ))}
        </ol>
        {canEdit && steps.length < QA_LIMITS.steps ? (
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setSteps((current) => [...current, { action: '', expected: '' }])}>
            <PlusIcon className="mr-1 size-4" /> Add step
          </Button>
        ) : null}
      </fieldset>
      {canEdit ? (
        <DialogFooter className="items-center">
          {testCase ? (
            <Button type="button" variant="ghost" className="mr-auto text-critical" disabled={remove.isPending} onClick={() => remove.mutate(undefined, { onSuccess: onClose })}>
              Delete
            </Button>
          ) : null}
          <Button type="submit" disabled={save.isPending || !title.trim()}>
            {testCase ? 'Save' : 'Create test case'}
          </Button>
        </DialogFooter>
      ) : null}
    </form>
  );

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{testCase ? `C-${testCase.number} ${testCase.title}` : 'New test case'}</DialogTitle>
          <DialogDescription>Each step says what to do and what should happen.</DialogDescription>
        </DialogHeader>
        {testCase ? (
          <Tabs defaultValue="case">
            <TabsList>
              <TabsTrigger value="case">Case</TabsTrigger>
              <TabsTrigger value="history">History {runs.data?.length ? `(${runs.data.length})` : ''}</TabsTrigger>
            </TabsList>
            <TabsContent value="case" className="mt-3">
              {editor}
            </TabsContent>
            <TabsContent value="history" className="mt-3">
              {runs.data?.length ? (
                <ol aria-label="Run history" className="divide-y rounded-md border text-sm">
                  {runs.data.map((run) => (
                    <li key={run.id} className="grid gap-1 px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <ResultChip result={run.result} />
                        <span className="font-medium">{run.planName}</span>
                        <span className="text-xs text-muted-foreground">
                          {run.executedByName ?? 'Someone'} · {timeAgo(run.executedAt)}
                          {run.build ? ` · build ${run.build}` : ''}
                          {run.retestOf ? ' · retest' : ''}
                          {run.bugNumber ? ` · bug #${run.bugNumber}` : ''}
                        </span>
                      </div>
                      {run.actual ? <p className="text-xs whitespace-pre-wrap text-muted-foreground">{run.actual}</p> : null}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">Not run yet. Add it to a test plan to run it.</p>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          editor
        )}
      </DialogContent>
    </Dialog>
  );
}

export function Choice({ label, value, onChange, options, disabled }: { label: string; value: string; onChange: (value: string) => void; options: [string, string][]; disabled?: boolean }) {
  const id = `qa-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} aria-label={label}>
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
    </div>
  );
}
