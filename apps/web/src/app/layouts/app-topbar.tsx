import { PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RealtimeIndicator } from '@/core/realtime/realtime-indicator';
import { CommandSearch, NewTaskDialog, useOpenTask } from '@/modules/tasks';
import { TimerIndicator } from '@/modules/time';
import { usePermissions, WorkspaceSwitcher } from '@/modules/workspaces';

/** Workspace switcher, search, timer, live status and new task. Inbox, the panel toggle and the account are on the rail. */
export function AppTopbar({ workspaceId }: { workspaceId: string }) {
  const { can } = usePermissions(workspaceId);
  const openTask = useOpenTask();
  const [creating, setCreating] = useState(false);

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-background px-3">
      <WorkspaceSwitcher workspaceId={workspaceId} variant="chip" />
      <div className="flex min-w-0 flex-1 justify-center">
        <CommandSearch workspaceId={workspaceId} onOpen={openTask} />
      </div>
      <TimerIndicator workspaceId={workspaceId} onOpenTask={openTask} />
      <RealtimeIndicator />
      {can('task.create') ? (
        <Button size="sm" onClick={() => setCreating(true)}>
          <PlusIcon /> Task
        </Button>
      ) : null}
      {creating ? <NewTaskDialog workspaceId={workspaceId} open onOpenChange={setCreating} onCreated={openTask} /> : null}
    </header>
  );
}
