import { Link, Outlet } from '@tanstack/react-router';
import { ArrowLeftIcon, BuildingIcon, ScrollTextIcon, UsersIcon } from 'lucide-react';
import { Logo } from '@/components/common/logo';
import { AppShell } from '@/components/layout/app-shell';
import { SidebarLink } from '@/components/layout/sidebar-link';
import { SidebarSection } from '@/components/layout/sidebar-section';

/** Frame for the SUPER_ADMIN console. The API checks the role on every admin request. */
export function AdminLayout() {
  const sidebar = (
    <>
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <Logo className="text-sidebar-foreground" />
        <span className="rounded bg-highlight px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-black uppercase">Admin</span>
      </div>
      <nav className="flex-1 overflow-y-auto">
        <SidebarSection title="Platform">
          <SidebarLink to="/admin/users" icon={<UsersIcon />}>
            Users
          </SidebarLink>
          <SidebarLink to="/admin/workspaces" icon={<BuildingIcon />}>
            Workspaces
          </SidebarLink>
          <SidebarLink to="/admin/audit-log" icon={<ScrollTextIcon />}>
            Audit log
          </SidebarLink>
        </SidebarSection>
      </nav>
      <div className="border-t border-sidebar-border p-2">
        <Link to="/" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground/85 hover:bg-sidebar-accent">
          <ArrowLeftIcon className="size-4" /> Back to workspaces
        </Link>
      </div>
    </>
  );

  return (
    <AppShell sidebar={sidebar} sidebarOpen>
      <Outlet />
    </AppShell>
  );
}
