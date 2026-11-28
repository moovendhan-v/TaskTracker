import { BUG_ENVIRONMENT_LABELS, BUG_ENVIRONMENTS, planProgress, QA_LIMITS, QA_RESULT_LABELS, QA_RESULTS, type BugEnvironment, type QaPlanCaseResponse, type QaPlanResponse, type QaResult, type QaStepResult } from '@taskflow/shared-types';
import { ArrowLeftIcon, CheckCircle2Icon, CircleXIcon, ClipboardCheckIcon, PlayIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import { timeAgo } from '@/lib/relative-time';
import { qaApi } from '../api/qa.api';
import { useQaCases, useQaMutation, useQaPlanCases, useQaPlans, useQaReadiness, useQaSuites } from '../hooks/use-qa';
import { overallResult, RESULT_TONE } from '../lib/qa-meta';
import { Choice, ResultChip } from './qa-cases';

const PLAN_STATUS: Record<QaPlanResponse['status'], { label: string; tone: string }> = {
  open: { label: 'In progress', tone: 'bg-chart-1/15 text-chart-1' },
  approved: { label: 'Approved', tone: 'bg-good text-white' },
  rejected: { label: 'Rejected', tone: 'bg-critical/15 text-critical' },
};

/** A stacked bar: passed, failed, blocked, skipped, not run. */
export function ProgressBar({ counts }: { counts: QaPlanResponse['counts'] }) {
  if (!counts.total) return <div className="h-2 rounded-full bg-muted" />;
  const part = (n: number) => `${(n / counts.total) * 100}%`;
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${counts.passed} passed, ${counts.failed} failed, ${counts.blocked} blocked, ${counts.skipped} skipped, ${counts.notRun} not run`}>
      <span className="bg-good" style={{ width: part(counts.passed) }} />
      <span className="bg-critical" style={{ width: part(counts.failed) }} />
      <span className="bg-warning" style={{ width: part(counts.blocked) }} />
      <span className="bg-muted-foreground/40" style={{ width: part(counts.skipped) }} />
    </div>
  );
}

export function QaPlans({ workspaceId, spaceId, canEdit, canApprove, onOpenTask }: { workspaceId: string; spaceId: string; canEdit: boolean; canApprove: boolean; onOpenTask: (taskId: string) => void }) {
  const plans = useQaPlans(workspaceId, spaceId);
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const selected = plans.data?.find((plan) => plan.id === open);
  if (selected) return <PlanDetail workspaceId={workspaceId} spaceId={spaceId} plan={selected} canEdit={canEdit} canApprove={canApprove} onBack={() => setOpen(null)} onOpenTask={onOpenTask} />;

  return (
    <div className="grid gap-3">
      <div className="flex justify-end">
        {canEdit ? (
          <Button size="sm" onClick={() => setCreating(true)}>
            <PlusIcon className="mr-1 size-4" /> New test plan
          </Button>
        ) : null}
      </div>
      {plans.data?.length === 0 ? (
        <EmptyState icon={<ClipboardCheckIcon />} title="No test plans yet" description="A test plan is what to test for a sprint or a release: pick the cases, run them, and sign it off." />
      ) : (
        <ul aria-label="Test plans" className="divide-y rounded-lg border bg-card">
          {(plans.data ?? []).map((plan) => {
            const { done, passRate } = planProgress(plan.counts);
            return (
              <li key={plan.id}>
                <button type="button" onClick={() => setOpen(plan.id)} className="grid w-full gap-2 px-3 py-2.5 text-left hover:bg-muted/50">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{plan.name}</span>
                    {plan.release ? <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{plan.release}</span> : null}
                    <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', PLAN_STATUS[plan.status].tone)}>{PLAN_STATUS[plan.status].label}</span>
                    <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                      {done}% run{passRate === null ? '' : ` · ${passRate}% passing`} · {plan.counts.total} cases
                    </span>
                  </span>
                  <ProgressBar counts={plan.counts} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {creating ? <PlanDialog workspaceId={workspaceId} spaceId={spaceId} onClose={() => setCreating(false)} onCreated={setOpen} /> : null}
    </div>
  );
}

function PlanDialog({ workspaceId, spaceId, onClose, onCreated }: { workspaceId: string; spaceId: string; onClose: () => void; onCreated: (planId: string) => void }) {
  const [name, setName] = useState('');
  const [release, setRelease] = useState('');
  const [description, setDescription] = useState('');
  const [includeAll, setIncludeAll] = useState(true);
  const create = useQaMutation(workspaceId, async () => {
    const plan = await qaApi.savePlan(workspaceId, spaceId, null, { name, release: release || null, description });
    if (includeAll) await qaApi.addCases(workspaceId, plan.id, { allReady: true });
    return plan;
  }, (plan) => `Created “${plan.name}”`);
  return (
    <Dialog open onOpenChange={(value) => (value ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New test plan</DialogTitle>
          <DialogDescription>What to test for a sprint or a release.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate(undefined, {
              onSuccess: (plan) => {
                onClose();
                onCreated(plan.id);
              },
            });
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="qa-plan-name">Name</Label>
            <Input id="qa-plan-name" maxLength={QA_LIMITS.name} value={name} onChange={(event) => setName(event.target.value)} autoFocus placeholder="e.g. Release 2.4 regression" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="qa-plan-release">Release (optional)</Label>
            <Input id="qa-plan-release" maxLength={QA_LIMITS.release} value={release} onChange={(event) => setRelease(event.target.value)} placeholder="e.g. 2.4.0" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="qa-plan-description">Notes (optional)</Label>
            <Textarea id="qa-plan-description" rows={2} maxLength={QA_LIMITS.description} value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={includeAll} onCheckedChange={(value) => setIncludeAll(value === true)} /> Include every ready test case
          </label>
          <DialogFooter>
            <Button type="submit" disabled={!name.trim() || create.isPending}>
              Create plan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PlanDetail({ workspaceId, spaceId, plan, canEdit, canApprove, onBack, onOpenTask }: { workspaceId: string; spaceId: string; plan: QaPlanResponse; canEdit: boolean; canApprove: boolean; onBack: () => void; onOpenTask: (taskId: string) => void }) {
  const cases = useQaPlanCases(workspaceId, plan.id);
  const readiness = useQaReadiness(workspaceId, plan.id);
  const suites = useQaSuites(workspaceId, spaceId);
  const allCases = useQaCases(workspaceId, spaceId, {});
  const [running, setRunning] = useState<QaPlanCaseResponse | null>(null);
  const [deciding, setDeciding] = useState<'approved' | 'rejected' | null>(null);
  const add = useQaMutation(workspaceId, (input: { suiteId?: string; allReady?: boolean }) => qaApi.addCases(workspaceId, plan.id, input), (count) => (count ? `Added ${count} case${count === 1 ? '' : 's'}` : 'Those cases are already in the plan'));
  const reopen = useQaMutation(workspaceId, () => qaApi.decide(workspaceId, plan.id, 'open', null), () => 'Reopened');
  const frozen = plan.status === 'approved';
  const { done, passRate } = planProgress(plan.counts);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeftIcon className="mr-1 size-4" /> Plans
        </Button>
        <h2 className="text-lg font-semibold">{plan.name}</h2>
        {plan.release ? <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{plan.release}</span> : null}
        <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', PLAN_STATUS[plan.status].tone)}>{PLAN_STATUS[plan.status].label}</span>
        <span className="ml-auto flex gap-2">
          {canEdit && !frozen ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <PlusIcon className="mr-1 size-4" /> Add cases
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => add.mutate({ allReady: true })}>Every ready case ({allCases.data?.filter((item) => item.status === 'ready').length ?? 0})</DropdownMenuItem>
                {(suites.data ?? []).map((suite) => (
                  <DropdownMenuItem key={suite.id} onSelect={() => add.mutate({ suiteId: suite.id })}>
                    Suite “{suite.name}” ({suite.caseCount})
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          {canApprove && !frozen ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setDeciding('rejected')}>
                Reject
              </Button>
              <Button size="sm" onClick={() => setDeciding('approved')}>
                Approve
              </Button>
            </>
          ) : null}
          {canApprove && plan.status !== 'open' ? (
            <Button size="sm" variant="outline" onClick={() => reopen.mutate()}>
              Reopen
            </Button>
          ) : null}
        </span>
      </div>

      <section aria-label="Release readiness" className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="grid content-start gap-2">
          <p className={cn('flex items-center gap-2 text-base font-semibold', readiness.data?.ready ? 'text-good' : 'text-foreground')} data-testid="readiness-verdict">
            {readiness.data?.ready ? <CheckCircle2Icon className="size-5" /> : <CircleXIcon className="size-5 text-critical" />}
            {readiness.data?.ready ? 'Ready to release' : 'Not ready to release'}
          </p>
          <ProgressBar counts={plan.counts} />
          <p className="text-xs text-muted-foreground tabular-nums">
            {done}% run · {passRate === null ? 'nothing run yet' : `${passRate}% passing`} · {plan.counts.passed} passed, {plan.counts.failed} failed, {plan.counts.blocked} blocked, {plan.counts.skipped} skipped, {plan.counts.notRun} not run
          </p>
          {plan.decidedByName ? (
            <p className="text-xs text-muted-foreground">
              {plan.status === 'approved' ? 'Approved' : 'Rejected'} by {plan.decidedByName} {plan.decidedAt ? timeAgo(plan.decidedAt) : ''}
              {plan.decisionNote ? `: “${plan.decisionNote}”` : ''}
            </p>
          ) : null}
        </div>
        <ul aria-label="Readiness checks" className="grid gap-1 text-sm">
          {(readiness.data?.checks ?? []).map((check) => (
            <li key={check.key} className="flex items-center gap-2">
              {check.ok ? <CheckCircle2Icon className="size-4 shrink-0 text-good" /> : <CircleXIcon className="size-4 shrink-0 text-critical" />}
              <span className={check.ok ? 'text-muted-foreground' : ''}>{check.detail}</span>
            </li>
          ))}
          {readiness.data?.openBugs.map((bug) => (
            <li key={bug.taskId} className="pl-6 text-xs">
              <button type="button" className="text-primary hover:underline" onClick={() => onOpenTask(bug.taskId)}>
                #{bug.number} {bug.title}
              </button>{' '}
              <span className="text-muted-foreground">
                · {bug.severity} · {bug.qaState}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {cases.data?.length === 0 ? (
        <EmptyState title="No cases in this plan" description="Add every ready case, or a suite, from “Add cases”." />
      ) : (
        <ul aria-label="Plan cases" className="divide-y rounded-lg border bg-card">
          {(cases.data ?? []).map((item) => (
            <li key={item.caseId} className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto_auto] items-center gap-3 px-3 py-2">
              <span className="font-mono text-xs text-muted-foreground">C-{item.number}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{item.title}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {item.suiteName ?? 'No suite'}
                  {item.executedAt ? ` · ${item.executedByName ?? 'someone'} ${timeAgo(item.executedAt)}` : ''}
                  {item.runs > 1 ? ` · ${item.runs} runs` : ''}
                  {item.bugTaskId ? (
                    <>
                      {' · '}
                      <button type="button" className="text-primary hover:underline" onClick={() => onOpenTask(item.bugTaskId!)}>
                        bug #{item.bugNumber}
                      </button>
                      {item.bugQaState ? ` (${item.bugQaState})` : ''}
                    </>
                  ) : null}
                </span>
              </span>
              <ResultChip result={item.result} />
              {canEdit && !frozen ? (
                <Button size="sm" variant={item.result ? 'outline' : 'default'} onClick={() => setRunning(item)} aria-label={`${item.result ? 'Retest' : 'Run'} C-${item.number}`}>
                  <PlayIcon className="mr-1 size-3.5" /> {item.result && item.result !== 'passed' ? 'Retest' : item.result ? 'Run again' : 'Run'}
                </Button>
              ) : (
                <span />
              )}
            </li>
          ))}
        </ul>
      )}
      {running ? <RunDialog workspaceId={workspaceId} spaceId={spaceId} planId={plan.id} planCase={running} onClose={() => setRunning(null)} /> : null}
      {deciding ? <DecideDialog workspaceId={workspaceId} plan={plan} decision={deciding} onClose={() => setDeciding(null)} /> : null}
    </div>
  );
}

function RunDialog({ workspaceId, spaceId, planId, planCase, onClose }: { workspaceId: string; spaceId: string; planId: string; planCase: QaPlanCaseResponse; onClose: () => void }) {
  const cases = useQaCases(workspaceId, spaceId, {});
  const testCase = cases.data?.find((item) => item.id === planCase.caseId);
  const [steps, setSteps] = useState<QaStepResult[] | null>(null);
  const [overall, setOverall] = useState<QaResult | null>(null);
  const [actual, setActual] = useState('');
  const [environment, setEnvironment] = useState<BugEnvironment>('staging');
  const [build, setBuild] = useState('');
  const [fileBug, setFileBug] = useState(true);
  const stepResults = steps ?? (testCase?.steps ?? []).map(() => ({ result: 'passed' as QaResult, actual: '' }));
  const result = overall ?? overallResult(stepResults) ?? 'passed';
  const record = useQaMutation(
    workspaceId,
    () => qaApi.record(workspaceId, { planId, caseId: planCase.caseId, result, stepResults, actual, environment, build: build || null, fileBug }),
    (saved) => (saved.result === 'failed' && saved.bugNumber ? `Failed: bug #${saved.bugNumber} ${saved.bugQaState === 'reopened' ? 'reopened' : 'filed'}` : saved.result === 'passed' && saved.bugQaState === 'verified' ? `Passed: bug #${saved.bugNumber} verified` : saved.result ? QA_RESULT_LABELS[saved.result] : 'Saved'),
  );
  const setStep = (index: number, patch: Partial<QaStepResult>) => {
    setOverall(null);
    setSteps(stepResults.map((step, at) => (at === index ? { ...step, ...patch } : step)));
  };

  return (
    <Dialog open onOpenChange={(value) => (value ? undefined : onClose())}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Run C-{planCase.number} {planCase.title}
          </DialogTitle>
          <DialogDescription>{testCase?.preconditions ? `Before you start: ${testCase.preconditions}` : 'Go through each step and mark what happened.'}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            record.mutate(undefined, { onSuccess: onClose });
          }}
        >
          <ol aria-label="Steps" className="grid gap-3">
            {(testCase?.steps ?? []).map((step, index) => (
              <li key={index} className="grid gap-2 rounded-md border p-3">
                <div className="grid gap-1 text-sm sm:grid-cols-2">
                  <p>
                    <span className="mr-1 text-muted-foreground">{index + 1}.</span>
                    {step.action}
                  </p>
                  <p className="text-muted-foreground">Expect: {step.expected || '—'}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label={`Step ${index + 1} result`}>
                  {QA_RESULTS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={stepResults[index]?.result === value}
                      onClick={() => setStep(index, { result: value })}
                      className={cn('rounded-md border px-2 py-0.5 text-xs', stepResults[index]?.result === value ? cn(RESULT_TONE[value], 'border-transparent font-semibold') : 'text-muted-foreground hover:bg-muted')}
                    >
                      {QA_RESULT_LABELS[value]}
                    </button>
                  ))}
                  {stepResults[index]?.result !== 'passed' ? (
                    <Input aria-label={`Step ${index + 1} what happened`} placeholder="What happened?" className="h-7 min-w-48 flex-1 text-xs" maxLength={QA_LIMITS.stepText} value={stepResults[index]?.actual ?? ''} onChange={(event) => setStep(index, { actual: event.target.value })} />
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
          <div className="grid gap-3 sm:grid-cols-3">
            <Choice label="Result" value={result} onChange={(value) => setOverall(value as QaResult)} options={QA_RESULTS.map((value) => [value, QA_RESULT_LABELS[value]])} />
            <Choice label="Environment" value={environment} onChange={(value) => setEnvironment(value as BugEnvironment)} options={BUG_ENVIRONMENTS.map((value) => [value, BUG_ENVIRONMENT_LABELS[value]])} />
            <div className="grid gap-1.5">
              <Label htmlFor="qa-run-build">Build (optional)</Label>
              <Input id="qa-run-build" maxLength={QA_LIMITS.build} value={build} onChange={(event) => setBuild(event.target.value)} placeholder="e.g. 2.4.0-rc1" />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="qa-run-actual">Notes</Label>
            <Textarea id="qa-run-actual" rows={2} maxLength={QA_LIMITS.text} value={actual} onChange={(event) => setActual(event.target.value)} />
          </div>
          {result === 'failed' ? (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={fileBug} onCheckedChange={(value) => setFileBug(value === true)} /> File a bug with these details{planCase.bugTaskId ? ' (or reopen the one already filed)' : ''}
            </label>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={record.isPending || !testCase}>
              Save result: {QA_RESULT_LABELS[result]}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DecideDialog({ workspaceId, plan, decision, onClose }: { workspaceId: string; plan: QaPlanResponse; decision: 'approved' | 'rejected'; onClose: () => void }) {
  const [note, setNote] = useState('');
  const decide = useQaMutation(workspaceId, () => qaApi.decide(workspaceId, plan.id, decision, note.trim() || null), () => (decision === 'approved' ? 'Plan approved' : 'Plan rejected'));
  const issues = plan.counts.failed + plan.counts.blocked;
  return (
    <Dialog open onOpenChange={(value) => (value ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{decision === 'approved' ? 'Approve this plan?' : 'Reject this plan?'}</DialogTitle>
          <DialogDescription>
            {decision === 'approved'
              ? issues
                ? `${issues} case${issues === 1 ? ' is' : 's are'} failing or blocked. Say why it can still be approved.`
                : 'Every case has been run. Approving freezes the plan.'
              : 'Say what has to change before it can be approved.'}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            decide.mutate(undefined, { onSuccess: onClose });
          }}
        >
          <Textarea aria-label="Note" rows={3} maxLength={QA_LIMITS.description} value={note} onChange={(event) => setNote(event.target.value)} placeholder={decision === 'approved' ? 'Optional unless something failed' : 'Required'} />
          <DialogFooter>
            <Button type="submit" variant={decision === 'approved' ? 'default' : 'destructive'} disabled={decide.isPending}>
              {decision === 'approved' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
