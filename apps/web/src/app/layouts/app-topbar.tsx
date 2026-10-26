import { Link } from '@tanstack/react-router';
import { BellIcon, PanelLeftIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { usePreferenceMutations, usePreferences } from '@/core/preferences/use-preferences';
import { RealtimeIndicator } from '@/core/realtime/realtime-indicator';
import { CommandSearch, NewTaskDialog, useOpenTask } from '@/modules/tasks';
import { TimerIndicator } from '@/modules/time';
import { usePermissions, WorkspaceSwitcher } from '@/modules/workspaces';
import { UserMenu } from './user-menu';

export function AppTopbar({ workspaceId, unread }: { workspaceId: string; unread: number }) {
  const { sidebarCollapsed } = usePreferences();
  const { update } = usePreferenceMutations();
  const { can } = usePermissions(workspaceId);
  const openTask = useOpenTask();
  const [creating, setCreating] = useState(false);

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-background px-3">
      <Button variant="ghost" size="icon-sm" onClick={() => update.mutate({ sidebarCollapsed: !sidebarCollapsed })} aria-label="Toggle sidebar" aria-pressed={!sidebarCollapsed}>
        <PanelLeftIcon />
      </Button>
      <WorkspaceSwitcher workspaceId={workspaceId} variant="chip" />
      <div className="flex min-w-0 flex-1 justify-center">
        <CommandSearch workspaceId={workspaceId} onOpen={openTask} />
      </div>
      <TimerIndicator workspaceId={workspaceId} onOpenTask={openTask} />
      <RealtimeIndicator />
      <Link to="/w/$workspaceId/inbox" params={{ workspaceId }} className="relative rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={unread ? `Inbox, ${unread} unread` : 'Inbox'}>
        <BellIcon className="size-5" />
        {unread ? <span className="absolute top-1 right-1 size-2 rounded-full bg-critical" aria-hidden /> : null}
      </Link>
      {can('task.create') ? (
        <Button size="sm" onClick={() => setCreating(true)}>
          <PlusIcon /> Task
        </Button>
      ) : null}
      <UserMenu variant="avatar" />
      {creating ? <NewTaskDialog workspaceId={workspaceId} open onOpenChange={setCreating} onCreated={openTask} /> : null}
    </header>
  );
}
