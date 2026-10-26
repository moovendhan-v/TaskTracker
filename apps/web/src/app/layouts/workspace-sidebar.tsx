import { Link, useRouterState } from '@tanstack/react-router';
import {
  Building2Icon,
  CalendarCheckIcon,
  CheckSquareIcon,
  ClipboardCheckIcon,
  FileTextIcon,
  HomeIcon,
  InboxIcon,
  PalmtreeIcon,
  ScrollTextIcon,
  SearchIcon,
  SettingsIcon,
  ShieldIcon,
  TagsIcon,
  TimerIcon,
  UsersIcon,
  UsersRoundIcon,
} from 'lucide-react';
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { PREFERENCE_LIMITS } from '@taskflow/shared-types';
import { Logo } from '@/components/common/logo';
import { SidebarLink } from '@/components/layout/sidebar-link';
import { SidebarSection } from '@/components/layout/sidebar-section';
import { usePreferenceMutations, usePreferences } from '@/core/preferences/use-preferences';
import { useDashboard, dashboardInput } from '@/modules/dashboard';
import { SpaceTree, type SpaceStats } from '@/modules/spaces';
import { usePermissions } from '@/modules/workspaces';

const TITLES: [RegExp, string][] = [
  [/\/p\//, 'Projects'],
  [/\/my-tasks/, 'My tasks'],
  [/\/daily-log/, 'Daily log'],
  [/\/timesheets/, 'Timesheets'],
  [/\/inbox/, 'Inbox'],
  [/\/docs/, 'Docs'],
  [/\/people/, 'People'],
  [/\/settings|\/members|\/roles|\/audit-log/, 'Workspace'],
];

/** The context column: navigation, projects with live counts, workspace and people pages. Drag its edge to resize. */
export function WorkspaceSidebar({ workspaceId, unread }: { workspaceId: string; unread: number }) {
  const params = { workspaceId };
  const { can } = usePermissions(workspaceId);
  const preferences = usePreferences();
  const { update } = usePreferenceMutations();
  const [filter, setFilter] = useState('');
  const [liveWidth, setLiveWidth] = useState<number | null>(null);
  const startX = useRef(0);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const title = TITLES.find(([pattern]) => pattern.test(pathname))?.[1] ?? 'Home';
  const { weekStart, defaultTaskView } = preferences;
  const { data: dashboard } = useDashboard(workspaceId, dashboardInput('this_week', weekStart));
  const stats: Record<string, SpaceStats> = Object.fromEntries((dashboard?.projects ?? []).map((project) => [project.spaceId, { open: project.open, overdue: project.overdue, dueSoon: project.dueSoon }]));
  const width = liveWidth ?? preferences.sidebarWidth;

  const resize = (event: ReactPointerEvent) => {
    startX.current = event.clientX;
    const from = preferences.sidebarWidth;
    const clamp = (value: number) => Math.min(PREFERENCE_LIMITS.sidebarWidthMax, Math.max(PREFERENCE_LIMITS.sidebarWidthMin, value));
    const onMove = (move: PointerEvent) => setLiveWidth(clamp(from + move.clientX - startX.current));
    const onUp = (up: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setLiveWidth(null);
      update.mutate({ sidebarWidth: clamp(from + up.clientX - startX.current) });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  if (preferences.sidebarCollapsed) return null;

  return (
    <aside aria-label="Workspace navigation" className="relative flex h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground" style={{ width }}>
      <div className="flex h-12 items-center gap-2.5 px-4">
        <Link to="/w/$workspaceId" params={params} aria-label="TaskFlow home" className="shrink-0">
          <Logo withWordmark={false} />
        </Link>
        <h2 className="truncate text-base font-semibold">{title}</h2>
      </div>
      <div className="px-3 pb-2">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-sidebar-muted" />
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Search spaces"
            aria-label="Search spaces"
            className="h-8 w-full rounded-md bg-sidebar-accent pr-2 pl-8 text-sm text-sidebar-foreground outline-none placeholder:text-sidebar-muted focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>
      <nav aria-label="Main" className="flex-1 overflow-y-auto pb-4">
        <div className="grid gap-0.5 px-2">
          <SidebarLink to="/w/$workspaceId" params={params} activeOptions={{ exact: true }} icon={<HomeIcon />}>
            Home
          </SidebarLink>
          <SidebarLink to="/w/$workspaceId/inbox" params={params} icon={<InboxIcon />} badge={unread ? (unread > 99 ? '99+' : String(unread)) : undefined}>
            Inbox
          </SidebarLink>
          <SidebarLink to="/w/$workspaceId/docs" params={params} icon={<FileTextIcon />}>
            Docs
          </SidebarLink>
          <SidebarLink to="/w/$workspaceId/my-tasks" params={params} icon={<CheckSquareIcon />}>
            My tasks
          </SidebarLink>
          <SidebarLink to="/w/$workspaceId/daily-log" params={params} icon={<CalendarCheckIcon />}>
            Daily log
          </SidebarLink>
          <SidebarLink to="/w/$workspaceId/timesheets" params={params} icon={<TimerIcon />}>
            Timesheets
          </SidebarLink>
        </div>
        <SpaceTree workspaceId={workspaceId} stats={stats} filter={filter} defaultView={defaultTaskView} />
        <SidebarSection title="Workspace">
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
            <SidebarLink to="/w/$workspaceId/people/approvals" params={params} icon={<ClipboardCheckIcon />}>
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
      <span role="separator" aria-orientation="vertical" aria-label="Resize sidebar" onPointerDown={resize} className="absolute top-0 -right-1 bottom-0 w-2 cursor-col-resize hover:bg-primary/30" />
    </aside>
  );
}
