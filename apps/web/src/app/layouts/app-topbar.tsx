import { MenuIcon, PlusIcon } from 'lucide-react';
import { useNavDrawer } from '@/core/layout/use-viewport';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RealtimeIndicator } from '@/core/realtime/realtime-indicator';
import { CommandSearch, NewTaskDialog, useOpenTask } from '@/modules/tasks';
import { TimerIndicator } from '@/modules/time';
import { usePermissions, WorkspaceSwitcher } from '@/modules/workspaces';

/** Workspace switcher, search, timer, live status and new task. Inbox, the panel toggle and the account are on the rail. */
export function AppTopbar({ workspaceId, compact = false, showMenu = false }: { workspaceId: string; compact?: boolean; showMenu?: boolean }) {
  const openMenu = () => useNavDrawer.getState().setOpen(true);
  const { can } = usePermissions(workspaceId);
  const openTask = useOpenTask();
  const [creating, setCreating] = useState(false);

  return (
    <header className={compact ? 'flex h-12 shrink-0 items-center gap-2 border-b bg-background px-2' : 'flex h-12 shrink-0 items-center gap-3 border-b bg-background px-3'}>
      {showMenu ? (
        <Button variant="ghost" size="icon" aria-label="Open menu" onClick={openMenu}>
          <MenuIcon />
        </Button>
      ) : null}
      <WorkspaceSwitcher workspaceId={workspaceId} variant="chip" />
      <div className="flex min-w-0 flex-1 justify-center">
        <CommandSearch workspaceId={workspaceId} onOpen={openTask} />
      </div>
      <TimerIndicator workspaceId={workspaceId} onOpenTask={openTask} />
      {compact ? null : <RealtimeIndicator />}
      {/* On phones the bottom bar has the new-task button. */}
      {can('task.create') && !compact ? (
        <Button size="sm" onClick={() => setCreating(true)}>
          <PlusIcon /> Task
        </Button>
      ) : null}
      {creating ? <NewTaskDialog workspaceId={workspaceId} open onOpenChange={setCreating} onCreated={openTask} /> : null}
    </header>
  );
}
