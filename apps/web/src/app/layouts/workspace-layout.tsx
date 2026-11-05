import { Outlet, useRouterState } from '@tanstack/react-router';
import { BellIcon } from 'lucide-react';
import { useEffect } from 'react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useNavDrawer, useViewport } from '@/core/layout/use-viewport';
import { VerifyEmailBanner } from '@/core/auth/verify-email-banner';
import { useWorkspaceEvents } from '@/core/realtime/use-workspace-events';
import { toast } from '@/components/ui/sonner';
import { describeNotification, InboxPanel, inboxApi, useInboxPanel, useUnreadCount } from '@/modules/inbox';
import { TaskDetail, useOpenTask } from '@/modules/tasks';
import { AppRail } from './app-rail';
import { AppTopbar } from './app-topbar';
import { BottomTabBar } from './bottom-tab-bar';
import { WorkbenchTabs } from './workbench-tabs';
import { WorkspaceSidebar } from './workspace-sidebar';

/**
 * Composition root for a workspace: app rail, side panel, top bar, workbench
 * tabs and the page. The open task (`?task=`) shows over any page.
 */
export function WorkspaceLayout({ workspaceId, openTaskId }: { workspaceId: string; openTaskId: string | undefined }) {
  const { data: unread = 0 } = useUnreadCount(workspaceId);
  const openTask = useOpenTask();

  // Live updates for this workspace, and a toast when something new lands in your inbox.
  const showLatestNotification = async () => {
    const latest = (await inboxApi.list(workspaceId, true).catch(() => null))?.items[0];
    if (!latest) return;
    toast(describeNotification(latest), {
      icon: <BellIcon className="size-4" />,
      action: { label: 'Open inbox', onClick: () => useInboxPanel.getState().setOpen(true) },
    });
  };
  useWorkspaceEvents(workspaceId, () => void showLatestNotification());

  // Phones and tablets (F1): the navigation slides over the page instead of taking room beside it.
  const viewport = useViewport();
  const drawer = useNavDrawer();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  useEffect(() => useNavDrawer.getState().setOpen(false), [pathname]);
  const docked = viewport === 'desktop';

  return (
    <div className="flex h-full overflow-hidden">
      {viewport !== 'phone' ? <AppRail workspaceId={workspaceId} unread={unread} /> : null}
      {docked ? <WorkspaceSidebar workspaceId={workspaceId} unread={unread} /> : null}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AppTopbar workspaceId={workspaceId} compact={viewport === 'phone'} showMenu={!docked} />
        {viewport !== 'phone' ? <WorkbenchTabs workspaceId={workspaceId} /> : null}
        <VerifyEmailBanner />
        <Outlet />
        {viewport === 'phone' ? <BottomTabBar workspaceId={workspaceId} unread={unread} /> : null}
      </main>
      {!docked ? (
        <Sheet open={drawer.open} onOpenChange={drawer.setOpen}>
          <SheetContent side="left" className="w-[85vw] max-w-80 p-0" onOpenAutoFocus={(event) => event.preventDefault()} aria-describedby={undefined}>
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <WorkspaceSidebar workspaceId={workspaceId} unread={unread} variant="drawer" />
          </SheetContent>
        </Sheet>
      ) : null}
      <InboxPanel workspaceId={workspaceId} onOpenTask={openTask} />
      <TaskDetail workspaceId={workspaceId} taskId={openTaskId} onClose={() => openTask(undefined)} onOpen={openTask} />
    </div>
  );
}
