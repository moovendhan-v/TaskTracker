import { useQuery } from '@tanstack/react-query';
import {
  BUG_ENVIRONMENT_LABELS,
  BUG_ENVIRONMENTS,
  BUG_KIND_LABELS,
  BUG_KINDS,
  BUG_QA_STATE_LABELS,
  BUG_QA_TRANSITIONS,
  BUG_SEVERITIES,
  BUG_SEVERITY_LABELS,
  type BugQaState,
  type BugResponse,
} from '@taskflow/shared-types';
import { CopyIcon, ExternalLinkIcon, GlobeIcon, MonitorIcon } from 'lucide-react';
import { ErrorState } from '@/components/common/error-state';
import { FullPageSpinner } from '@/components/common/full-page-spinner';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/cn';
import { queryKeys } from '@/lib/query-keys';
import { timeAgo } from '@/lib/relative-time';
import { attachmentsApi } from '@/modules/tasks';
import { useBug, useBugCapture, useBugMutations, useSimilarBugs } from '../hooks/use-bugs';
import { isVideo, QA_ACTION, QA_TONE, SEVERITY_TONE } from '../lib/bug-meta';
import { CaptureView } from './capture-view';

/**
 * One report: QA actions, details, screenshots and recordings, steps, environment, and the
 * captured console / network / actions. Comments, assignment and history live on the task, one
 * click away, so nothing is duplicated.
 */
export function BugDetail({ workspaceId, taskId, onClose, onOpenTask, onOpenBug }: { workspaceId: string; taskId: string | null; onClose: () => void; onOpenTask: (taskId: string) => void; onOpenBug: (taskId: string) => void }) {
  const bug = useBug(workspaceId, taskId);
  return (
    <Sheet open={Boolean(taskId)} onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent className="sm:max-w-3xl">
        {bug.isLoading ? <FullPageSpinner /> : null}
        {bug.isError ? <ErrorState error={bug.error} onRetry={() => void bug.refetch()} /> : null}
        {bug.data ? <BugBody workspaceId={workspaceId} bug={bug.data} onOpenTask={onOpenTask} onOpenBug={onOpenBug} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function BugBody({ workspaceId, bug, onOpenTask, onOpenBug }: { workspaceId: string; bug: BugResponse; onOpenTask: (taskId: string) => void; onOpenBug: (taskId: string) => void }) {
  const mutations = useBugMutations(workspaceId);
  const capture = useBugCapture(workspaceId, bug.taskId);
  const files = useQuery({ queryKey: [...queryKeys.tasksRoot(workspaceId), 'attachments', bug.taskId], queryFn: () => attachmentsApi.list(workspaceId, bug.taskId) });
  const similar = useSimilarBugs(workspaceId, bug.spaceId, bug.title, bug.taskId);
  const media = (files.data ?? []).filter((file) => file.isImage || isVideo(file.fileName));
  const update = (input: Parameters<typeof mutations.update.mutate>[0]['input']) => mutations.update.mutate({ taskId: bug.taskId, input });
  const move = (state: BugQaState) => mutations.setQaState.mutate({ taskId: bug.taskId, state }, { onSuccess: () => toast.success(BUG_QA_STATE_LABELS[state]) });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="grid gap-2 border-b px-6 pt-5 pb-4 pr-12">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={cn('rounded px-1.5 py-0.5 font-semibold', SEVERITY_TONE[bug.severity])}>{bug.severity}</span>
          <span className={cn('rounded px-1.5 py-0.5 font-medium', QA_TONE[bug.qaState])}>{BUG_QA_STATE_LABELS[bug.qaState]}</span>
          <span className="text-muted-foreground">
            #{bug.number} · {BUG_KIND_LABELS[bug.kind]} · {bug.statusName} · filed {timeAgo(bug.createdAt)}
          </span>
        </div>
        <SheetTitle className="text-lg">{bug.title}</SheetTitle>
        <SheetDescription className="sr-only">Bug report details</SheetDescription>
        <div className="flex flex-wrap items-center gap-2">
          {BUG_QA_TRANSITIONS[bug.qaState].map((state) => (
            <Button key={state} size="sm" variant={state === 'verified' || state === 'fixed' || state === 'confirmed' ? 'default' : 'outline'} disabled={mutations.setQaState.isPending} onClick={() => move(state)}>
              {QA_ACTION[state]}
            </Button>
          ))}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => onOpenTask(bug.taskId)}>
            <ExternalLinkIcon className="mr-1 size-4" /> Open task (comments, assignee, history)
          </Button>
        </div>
        {bug.duplicateOfTaskId ? (
          <p className="text-xs text-muted-foreground">
            Duplicate of{' '}
            <button type="button" className="text-primary hover:underline" onClick={() => onOpenBug(bug.duplicateOfTaskId!)}>
              the original report
            </button>
          </p>
        ) : null}
      </header>

      <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto px-6 py-5">
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Severity" value={bug.severity} options={BUG_SEVERITIES.map((value) => [value, BUG_SEVERITY_LABELS[value]])} onChange={(value) => update({ severity: value })} />
          <Field label="Environment" value={bug.environment} options={BUG_ENVIRONMENTS.map((value) => [value, BUG_ENVIRONMENT_LABELS[value]])} onChange={(value) => update({ environment: value })} />
          <Field label="Kind" value={bug.kind} options={BUG_KINDS.map((value) => [value, BUG_KIND_LABELS[value]])} onChange={(value) => update({ kind: value })} />
        </section>

        {media.length ? (
          <section aria-label="Screenshots and recordings" className="grid gap-3">
            {media.map((file) =>
              isVideo(file.fileName) ? (
                <video key={file.id} src={file.url} controls preload="metadata" className="max-h-96 w-full rounded-lg border bg-black" aria-label={file.fileName} />
              ) : (
                <a key={file.id} href={file.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border bg-muted">
                  <img src={file.url} alt={file.fileName} className="max-h-96 w-full object-contain" />
                </a>
              ),
            )}
          </section>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2">
          <Text title="Expected" text={bug.expected} />
          <Text title="Actual" text={bug.actual} />
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">Steps to reproduce</h3>
          {bug.steps.length ? (
            <ol className="grid list-decimal gap-1 pl-5 text-sm">
              {bug.steps.map((step, index) => (
                <li key={index}>
                  {step.text}
                  {step.source === 'captured' ? <span className="ml-1 text-xs text-muted-foreground">(recorded)</span> : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">No steps yet.</p>
          )}
        </section>

        <section className="grid gap-1 text-sm">
          <h3 className="mb-1 text-sm font-semibold">Where</h3>
          {bug.pageUrl ? (
            <p className="flex min-w-0 items-center gap-2">
              <GlobeIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate" title={bug.pageUrl}>
                {bug.pageUrl}
              </span>
              <Button variant="ghost" size="icon" className="size-6" aria-label="Copy page address" onClick={() => void navigator.clipboard.writeText(bug.pageUrl!).then(() => toast.success('Copied'))}>
                <CopyIcon className="size-3.5" />
              </Button>
            </p>
          ) : null}
          <p className="flex items-center gap-2 text-muted-foreground">
            <MonitorIcon className="size-4" /> {[bug.browser, bug.os, bug.viewport].filter(Boolean).join(' · ') || 'Unknown browser'}
            {bug.module ? ` · module ${bug.module}` : ''} · {BUG_ENVIRONMENT_LABELS[bug.environment]}
          </p>
          {bug.reporterName ? <p className="text-muted-foreground">Reported by {bug.reporterName}</p> : null}
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">Diagnostics</h3>
          {capture.data ? <CaptureView capture={capture.data} /> : capture.isError ? <ErrorState error={capture.error} onRetry={() => void capture.refetch()} /> : <p className="text-sm text-muted-foreground">Loading…</p>}
        </section>

        {similar.data?.length && bug.qaState !== 'duplicate' ? (
          <section>
            <h3 className="mb-2 text-sm font-semibold">Possible duplicates</h3>
            <ul className="grid gap-1 text-sm">
              {similar.data.map((other) => (
                <li key={other.taskId} className="flex items-center gap-2">
                  <button type="button" className="min-w-0 flex-1 truncate text-left hover:underline" onClick={() => onOpenBug(other.taskId)}>
                    #{other.number} {other.title} <span className="text-xs text-muted-foreground">· {Math.round(other.score * 100)}% alike · {BUG_QA_STATE_LABELS[other.qaState]}</span>
                  </button>
                  <Button size="sm" variant="outline" disabled={mutations.markDuplicate.isPending} onClick={() => mutations.markDuplicate.mutate({ taskId: bug.taskId, ofTaskId: other.taskId }, { onSuccess: () => toast.success(`Marked as a duplicate of #${other.number}`) })}>
                    Duplicate of this
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function Field<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (value: T) => void }) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <Select value={value} onValueChange={(next) => onChange(next as T)}>
        <SelectTrigger aria-label={label} className="h-8 text-foreground">
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
    </label>
  );
}

function Text({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold">{title}</h3>
      <p className={cn('text-sm whitespace-pre-wrap', !text && 'text-muted-foreground')}>{text || 'Not given.'}</p>
    </div>
  );
}
