import { Link, type LinkProps } from '@tanstack/react-router';
import { CalendarCheckIcon, CheckSquareIcon, FileTextIcon, HomeIcon, InboxIcon, LogOutIcon, SettingsIcon, TimerIcon, UsersRoundIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Logo } from '@/components/common/logo';
import { useSignOut } from '@/modules/auth';
import { usePermissions } from '@/modules/workspaces';

function RailLink({ icon, label, badge, ...link }: LinkProps & { icon: ReactNode; label: string; badge?: number }) {
  return (
    <Link
      {...link}
      className="relative flex w-14 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground [&_svg]:size-5"
      activeProps={{ className: 'bg-sidebar-accent text-sidebar-foreground [&_svg]:text-primary' }}
    >
      {icon}
      <span className="leading-none">{label}</span>
      {badge ? (
        <span className="absolute top-1 right-1.5 min-w-4 rounded-full bg-highlight px-1 text-center text-[10px] leading-4 font-semibold text-[oklch(0.25_0.05_70)]" aria-label={`${badge} unread`}>
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </Link>
  );
}

/** The far-left strip: the places people jump between all day. */
export function IconRail({ workspaceId, unread }: { workspaceId: string; unread: number }) {
  const params = { workspaceId };
  const { can } = usePermissions(workspaceId);
  const signOut = useSignOut();
  return (
    <nav aria-label="Main" className="flex h-full w-16 shrink-0 flex-col items-center gap-1 border-r border-sidebar-border bg-rail py-3 text-sidebar-foreground">
      <Link to="/w/$workspaceId" params={params} aria-label="TaskFlow home" className="mb-2">
        <Logo withWordmark={false} />
      </Link>
      <RailLink to="/w/$workspaceId" params={params} activeOptions={{ exact: true }} icon={<HomeIcon />} label="Home" />
      <RailLink to="/w/$workspaceId/my-tasks" params={params} icon={<CheckSquareIcon />} label="My tasks" />
      <RailLink to="/w/$workspaceId/daily-log" params={params} icon={<CalendarCheckIcon />} label="Daily log" />
      <RailLink to="/w/$workspaceId/timesheets" params={params} icon={<TimerIcon />} label="Timesheets" />
      <RailLink to="/w/$workspaceId/inbox" params={params} icon={<InboxIcon />} label="Inbox" badge={unread} />
      <RailLink to="/w/$workspaceId/docs" params={params} icon={<FileTextIcon />} label="Docs" />
      {can('hr.view') ? <RailLink to="/w/$workspaceId/people" params={params} icon={<UsersRoundIcon />} label="People" /> : null}
      <span className="flex-1" />
      <RailLink to="/w/$workspaceId/settings" params={params} icon={<SettingsIcon />} label="Settings" />
      <button
        type="button"
        onClick={() => signOut.mutate()}
        className="flex w-14 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground [&_svg]:size-5"
      >
        <LogOutIcon />
        <span className="leading-none">Sign out</span>
      </button>
    </nav>
  );
}
