import { Outlet, useNavigate } from '@tanstack/react-router';
import { BellIcon } from 'lucide-react';
import { VerifyEmailBanner } from '@/core/auth/verify-email-banner';
import { useWorkspaceEvents } from '@/core/realtime/use-workspace-events';
import { toast } from '@/components/ui/sonner';
import { describeNotification, inboxApi, useUnreadCount } from '@/modules/inbox';
import { TaskDetail, useOpenTask } from '@/modules/tasks';
import { AppTopbar } from './app-topbar';
import { WorkbenchTabs } from './workbench-tabs';
import { WorkspaceSidebar } from './workspace-sidebar';

/**
 * Composition root for a workspace: sidebar, top bar, workbench
 * tabs and the page. The open task (`?task=`) shows over any page.
 */
export function WorkspaceLayout({ workspaceId, openTaskId }: { workspaceId: string; openTaskId: string | undefined }) {
  const { data: unread = 0 } = useUnreadCount(workspaceId);
  const navigate = useNavigate();
  const openTask = useOpenTask();

  // Live updates for this workspace, and a toast when something new lands in your inbox.
  const showLatestNotification = async () => {
    const latest = (await inboxApi.list(workspaceId, true).catch(() => null))?.items[0];
    if (!latest) return;
    toast(describeNotification(latest), {
      icon: <BellIcon className="size-4" />,
      action: { label: 'Open inbox', onClick: () => void navigate({ to: '/w/$workspaceId/inbox', params: { workspaceId } }) },
    });
  };
  useWorkspaceEvents(workspaceId, () => void showLatestNotification());

  return (
    <div className="flex h-full overflow-hidden">
      <WorkspaceSidebar workspaceId={workspaceId} unread={unread} />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AppTopbar workspaceId={workspaceId} unread={unread} />
        <WorkbenchTabs workspaceId={workspaceId} />
        <VerifyEmailBanner />
        <Outlet />
      </main>
      <TaskDetail workspaceId={workspaceId} taskId={openTaskId} onClose={() => openTask(undefined)} onOpen={openTask} />
    </div>
  );
}
