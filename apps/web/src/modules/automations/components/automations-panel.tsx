import { CheckCircle2Icon, CircleSlashIcon, HistoryIcon, PencilIcon, PlusIcon, TrashIcon, XCircleIcon, ZapIcon } from 'lucide-react';
import { useState } from 'react';
import type { AutomationRuleResponse } from '@taskflow/shared-types';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { EmptyState } from '@/components/common/empty-state';
import { Modal } from '@/components/kit/modal';
import { Button } from '@/components/ui/button';
import { formatLongDate } from '@/lib/dates';
import { useLists } from '@/modules/lists';
import { useMemberName, useMembers } from '@/modules/members';
import { useStatuses } from '@/modules/tasks';
import { usePermissions } from '@/modules/workspaces';
import { toSaveRequest } from '../api/automations.api';
import { useAutomationMutations, useAutomationRuns, useAutomations } from '../hooks/use-automations';
import { describeRule } from '../lib/describe-rule';
import { AutomationBuilder } from './automation-builder';

interface AutomationsPanelProps {
  workspaceId: string;
  spaceId: string;
  onOpenTask: (taskId: string) => void;
}

/** A project's automations: what each one does, whether it's on, and how its runs went. */
export function AutomationsPanel({ workspaceId, spaceId, onOpenTask }: AutomationsPanelProps) {
  const automations = useAutomations(workspaceId, spaceId);
  const mutations = useAutomationMutations(workspaceId, spaceId);
  const { canIn } = usePermissions(workspaceId);
  const canManage = canIn(spaceId, 'automation.manage');
  const { data: statuses = [] } = useStatuses(workspaceId, spaceId);
  const { data: lists = [] } = useLists(workspaceId);
  const { data: members = [] } = useMembers(workspaceId);
  const nameOf = useMemberName(workspaceId);
  const [editing, setEditing] = useState<AutomationRuleResponse | 'new' | null>(null);
  const [history, setHistory] = useState<AutomationRuleResponse | null>(null);

  const names = {
    status: (id: string) => statuses.find((status) => status.id === id)?.name ?? 'a deleted status',
    list: (id: string) => lists.find((list) => list.id === id)?.name ?? 'a deleted list',
    person: (id: string) => members.find((member) => member.userId === id)?.name ?? 'a former member',
  };
  const rules = automations.data ?? [];

  return (
    <div className="mx-auto grid max-w-4xl gap-4 pb-10">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <ZapIcon className="size-4 text-primary" /> Automations
          </h2>
          <p className="text-sm text-muted-foreground">Let routine updates happen on their own: when something changes in this project, change a task or tell the team.</p>
        </div>
        {canManage ? (
          <Button size="sm" onClick={() => setEditing('new')}>
            <PlusIcon /> New automation
          </Button>
        ) : null}
      </div>

      {!automations.isLoading && rules.length === 0 ? (
        <EmptyState
          title="No automations yet"
          description={canManage ? 'Try “when a bug is created, make it high priority and assign it to the on-call person”.' : 'People who manage automations can add them here.'}
        />
      ) : null}

      <ul className="grid gap-3">
        {rules.map((rule) => (
          <li key={rule.id} className="grid gap-2 rounded-xl border bg-card p-4">
            <div className="flex items-start gap-3">
              <span className={rule.enabled ? 'mt-0.5 rounded-lg bg-primary/10 p-1.5 text-primary' : 'mt-0.5 rounded-lg bg-muted p-1.5 text-muted-foreground'}>
                <ZapIcon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{rule.name}</p>
                {describeRule(rule, names) !== rule.name ? <p className="text-sm text-muted-foreground">{describeRule(rule, names)}</p> : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  Runs as {nameOf(rule.createdById) ?? 'nobody (it will skip)'} · {rule.runCount} {rule.runCount === 1 ? 'run' : 'runs'}
                  {rule.lastRunAt ? ` · last ${formatLongDate(rule.lastRunAt)}` : ''}
                </p>
              </div>
              {canManage ? (
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    role="switch"
                    checked={rule.enabled}
                    onChange={(event) => mutations.setEnabled.mutate({ ruleId: rule.id, enabled: event.target.checked })}
                    className="peer sr-only"
                    aria-label={`${rule.name} is ${rule.enabled ? 'on' : 'off'}`}
                  />
                  <span className="relative h-5 w-9 rounded-full bg-muted transition peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-4" />
                  {rule.enabled ? 'On' : 'Off'}
                </label>
              ) : null}
            </div>
            {canManage ? (
              <div className="flex gap-1 pl-10">
                <Button variant="ghost" size="sm" onClick={() => setEditing(rule)}>
                  <PencilIcon /> Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setHistory(rule)}>
                  <HistoryIcon /> Runs
                </Button>
                <ConfirmDialog
                  trigger={
                    <Button variant="ghost" size="sm">
                      <TrashIcon /> Delete
                    </Button>
                  }
                  title={`Delete “${rule.name}”?`}
                  description="Its run history goes with it."
                  confirmLabel="Delete automation"
                  onConfirm={() => mutations.remove.mutateAsync(rule.id)}
                />
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {editing ? (
        <AutomationBuilder
          workspaceId={workspaceId}
          spaceId={spaceId}
          rule={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(body) => (editing === 'new' ? mutations.create.mutateAsync(toSaveRequest(body)) : mutations.update.mutateAsync({ ruleId: editing.id, body: toSaveRequest(body) }))}
        />
      ) : null}
      {history ? <RunHistory workspaceId={workspaceId} rule={history} onClose={() => setHistory(null)} onOpenTask={onOpenTask} /> : null}
    </div>
  );
}

const RUN_ICON = {
  succeeded: <CheckCircle2Icon className="size-4 text-good" aria-label="Succeeded" />,
  failed: <XCircleIcon className="size-4 text-critical" aria-label="Failed" />,
  skipped: <CircleSlashIcon className="size-4 text-muted-foreground" aria-label="Skipped" />,
};

function RunHistory({ workspaceId, rule, onClose, onOpenTask }: { workspaceId: string; rule: AutomationRuleResponse; onClose: () => void; onOpenTask: (taskId: string) => void }) {
  const runs = useAutomationRuns(workspaceId, rule.id);
  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title={`${rule.name}: recent runs`} size="md">
      <div className="p-5">
        {runs.data?.length === 0 ? <p className="text-sm text-muted-foreground">It hasn’t run yet.</p> : null}
        <ul className="divide-y">
          {runs.data?.map((run) => (
            <li key={run.id} className="flex items-start gap-3 py-2 text-sm">
              {RUN_ICON[run.status]}
              <div className="min-w-0 flex-1">
                <p className="capitalize">{run.status}</p>
                {run.message ? <p className="text-xs text-muted-foreground">{run.message}</p> : null}
              </div>
              {run.taskId ? (
                <Button variant="link" size="sm" className="h-auto p-0" onClick={() => onOpenTask(run.taskId as string)}>
                  Open task
                </Button>
              ) : null}
              <span className="text-xs whitespace-nowrap text-muted-foreground">{formatLongDate(run.createdAt)}</span>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
