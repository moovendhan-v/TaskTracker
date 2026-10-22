import { Outlet } from '@tanstack/react-router';
import {
  Building2Icon,
  FileTextIcon,
  HomeIcon,
  InboxIcon,
  PalmtreeIcon,
  ScrollTextIcon,
  SettingsIcon,
  ShieldIcon,
  TagsIcon,
  UsersIcon,
  UsersRoundIcon,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { SidebarLink } from '@/components/layout/sidebar-link';
import { SidebarSection } from '@/components/layout/sidebar-section';
import { Topbar } from '@/components/layout/topbar';
import { SpaceTree } from '@/modules/spaces';
import { usePermissions, useWorkspace, useWorkspaceUiStore, WorkspaceSwitcher } from '@/modules/workspaces';
import { UserMenu } from './user-menu';

/** Composition root for a workspace page: sidebar made from feature modules, page in the outlet. */
export function WorkspaceLayout({ workspaceId }: { workspaceId: string }) {
  const sidebarOpen = useWorkspaceUiStore((state) => state.sidebarOpen);
  const toggleSidebar = useWorkspaceUiStore((state) => state.toggleSidebar);
  const { data: workspace } = useWorkspace(workspaceId);
  const { can } = usePermissions(workspaceId);
  const params = { workspaceId };

  const sidebar = (
    <>
      <WorkspaceSwitcher workspaceId={workspaceId} />
      <nav className="flex-1 overflow-y-auto pb-4">
        <SidebarSection title="Workspace">
          <SidebarLink to="/w/$workspaceId" params={params} activeOptions={{ exact: true }} icon={<HomeIcon />}>
            Home
          </SidebarLink>
          <SidebarLink to="/w/$workspaceId/docs" params={params} icon={<FileTextIcon />}>
            Docs
          </SidebarLink>
          <SidebarLink to="/w/$workspaceId/members" params={params} icon={<UsersIcon />}>
            Members
          </SidebarLink>
          <SidebarLink to="/w/$workspaceId/roles" params={params} icon={<ShieldIcon />}>
            Roles
          </SidebarLink>
          {can('audit.view') ? (
            <SidebarLink to="/w/$workspaceId/audit-log" params={params} icon={<ScrollTextIcon />}>
              Audit log
            </SidebarLink>
          ) : null}
          <SidebarLink to="/w/$workspaceId/settings" params={params} icon={<SettingsIcon />}>
            Settings
          </SidebarLink>
        </SidebarSection>
        <SpaceTree workspaceId={workspaceId} />
        <SidebarSection title="People">
          {can('hr.view') ? (
            <SidebarLink to="/w/$workspaceId/people" params={params} activeOptions={{ exact: true }} icon={<UsersRoundIcon />}>
              Directory
            </SidebarLink>
          ) : null}
          {can('leave.request') ? (
            <SidebarLink to="/w/$workspaceId/people/time-off" params={params} icon={<PalmtreeIcon />}>
              Time off
            </SidebarLink>
          ) : null}
          {can('leave.approve') ? (
            <SidebarLink to="/w/$workspaceId/people/approvals" params={params} icon={<InboxIcon />}>
              Approvals
            </SidebarLink>
          ) : null}
          {can('hr.view') ? (
            <SidebarLink to="/w/$workspaceId/people/departments" params={params} icon={<Building2Icon />}>
              Departments
            </SidebarLink>
          ) : null}
          {can('hr.manage') ? (
            <SidebarLink to="/w/$workspaceId/people/leave-types" params={params} icon={<TagsIcon />}>
              Leave types
            </SidebarLink>
          ) : null}
        </SidebarSection>
      </nav>
      <div className="border-t border-sidebar-border p-2">
        <UserMenu />
      </div>
    </>
  );

  return (
    <AppShell sidebar={sidebar} sidebarOpen={sidebarOpen}>
      <Topbar onToggleSidebar={toggleSidebar} breadcrumbs={workspace?.name} />
      <Outlet />
    </AppShell>
  );
}
