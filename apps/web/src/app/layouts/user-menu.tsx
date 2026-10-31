import { Link, useParams } from '@tanstack/react-router';
import { LogOutIcon, MoonIcon, PaletteIcon, ShieldAlertIcon, SunIcon } from 'lucide-react';
import { UserAvatar } from '@/components/common/user-avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useCurrentUser } from '@/core/auth/use-current-user';
import { useRealtimeStatus } from '@/core/realtime/realtime-status.store';
import { cn } from '@/lib/cn';
import { resolvedTheme } from '@/core/preferences/appearance';
import { usePreferenceMutations, usePreferences } from '@/core/preferences/use-preferences';
import { useSignOut } from '@/modules/auth';

/** The signed-in person's menu: a full row, just the avatar (top bar) or the avatar with a presence dot (rail). */
export function UserMenu({ variant = 'row' }: { variant?: 'row' | 'avatar' | 'rail' }) {
  const { data: me } = useCurrentUser();
  const status = useRealtimeStatus((state) => state.status);
  const signOut = useSignOut();
  const { workspaceId } = useParams({ strict: false });
  const theme = resolvedTheme(usePreferences().theme);
  const { update } = usePreferenceMutations();
  const toggleTheme = () => update.mutate({ theme: theme === 'dark' ? 'light' : 'dark' });

  return (
    <DropdownMenu>
      {variant === 'rail' ? (
        <DropdownMenuTrigger className="relative rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" aria-label={`Account: ${me?.name ?? ''}`}>
          <UserAvatar name={me?.name ?? '?'} className="size-8" />
          <span
            aria-hidden
            className={cn('absolute -right-px -bottom-px size-[11px] rounded-full border-2 border-rail', status === 'live' ? 'bg-status-done' : status === 'connecting' ? 'bg-status-in-review' : 'bg-subtle-foreground')}
          />
        </DropdownMenuTrigger>
      ) : variant === 'avatar' ? (
        <DropdownMenuTrigger className="rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" aria-label={`Account: ${me?.name ?? ''}`}>
          <UserAvatar name={me?.name ?? '?'} className="size-8" />
        </DropdownMenuTrigger>
      ) : (
        <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          <UserAvatar name={me?.name ?? '?'} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm">{me?.name}</span>
            <span className="block truncate text-xs text-sidebar-muted">{me?.email}</span>
          </span>
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent side={variant === 'avatar' ? 'bottom' : variant === 'rail' ? 'right' : 'top'} align={variant === 'avatar' || variant === 'rail' ? 'end' : 'start'} className="w-56">
        {variant !== 'row' && me ? (
          <div className="px-2 py-1.5">
            <div className="truncate text-sm font-medium">{me.name}</div>
            <div className="truncate text-xs text-muted-foreground">{me.email}</div>
          </div>
        ) : null}
        <DropdownMenuLabel>{me?.platformRole === 'SUPER_ADMIN' ? 'Platform admin' : 'Account'}</DropdownMenuLabel>
        {me?.platformRole === 'SUPER_ADMIN' ? (
          <DropdownMenuItem asChild>
            <Link to="/admin/users">
              <ShieldAlertIcon /> Platform admin
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={toggleTheme}>
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />} {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </DropdownMenuItem>
        {workspaceId ? (
          <DropdownMenuItem asChild>
            <Link to="/w/$workspaceId/appearance" params={{ workspaceId }}>
              <PaletteIcon /> Appearance…
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => signOut.mutate()}>
          <LogOutIcon /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
