import { Link, useRouterState } from '@tanstack/react-router';
import { CheckSquareIcon, HomeIcon, InboxIcon, MessagesSquareIcon, PlusIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useChatUnread } from '@/modules/chat';
import { NewTaskDialog, useOpenTask } from '@/modules/tasks';
import { usePermissions } from '@/modules/workspaces';

/**
 * The phone's main navigation (F1): Home, My tasks, a quick-add button,
 * Inbox and Chat. Everything else is in the menu (top left).
 */
export function BottomTabBar({ workspaceId, unread }: { workspaceId: string; unread: number }) {
  const { can } = usePermissions(workspaceId);
  const chatUnread = useChatUnread(workspaceId, can('chat.use'));
  const openTask = useOpenTask();
  const [creating, setCreating] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const base = `/w/${workspaceId}`;
  const params = { workspaceId };

  return (
    <nav aria-label="Main sections" className="grid shrink-0 grid-cols-5 border-t bg-background pb-[env(safe-area-inset-bottom)]">
      <Tab to="/w/$workspaceId" params={params} label="Home" icon={<HomeIcon />} active={pathname === base || pathname === `${base}/`} />
      <Tab to="/w/$workspaceId/my-tasks" params={params} label="My tasks" icon={<CheckSquareIcon />} active={pathname.startsWith(`${base}/my-tasks`)} />
      <div className="grid place-items-center">
        {can('task.create') ? (
          <button
            type="button"
            aria-label="New task"
            onClick={() => setCreating(true)}
            className="grid size-11 place-items-center rounded-full bg-primary text-primary-foreground shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <PlusIcon className="size-5" />
          </button>
        ) : null}
      </div>
      <Tab to="/w/$workspaceId/inbox" params={params} label="Inbox" icon={<InboxIcon />} active={pathname.startsWith(`${base}/inbox`)} badge={unread} />
      {can('chat.use') ? <Tab to="/w/$workspaceId/chat" params={params} label="Chat" icon={<MessagesSquareIcon />} active={pathname.startsWith(`${base}/chat`)} badge={chatUnread} /> : <span />}
      {creating ? <NewTaskDialog workspaceId={workspaceId} open onOpenChange={setCreating} onCreated={openTask} /> : null}
    </nav>
  );
}

function Tab({ to, params, label, icon, active, badge = 0 }: { to: string; params: { workspaceId: string }; label: string; icon: ReactNode; active: boolean; badge?: number }) {
  return (
    <Link
      to={to}
      params={params}
      aria-current={active ? 'page' : undefined}
      className={cn('relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground [&_svg]:size-5', active && 'text-ring')}
    >
      {icon}
      <span>{label}</span>
      {badge > 0 ? (
        <span aria-label={`${badge} unread`} className="absolute top-1.5 left-1/2 ml-2 min-w-4 rounded-full bg-ring px-1 text-center text-[10px] leading-4 text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </Link>
  );
}
