import { Link } from '@tanstack/react-router';
import { LogOutIcon, MoonIcon, ShieldAlertIcon, SunIcon } from 'lucide-react';
import { UserAvatar } from '@/components/common/user-avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useCurrentUser } from '@/core/auth/use-current-user';
import { resolvedTheme } from '@/core/preferences/appearance';
import { usePreferenceMutations, usePreferences } from '@/core/preferences/use-preferences';
import { useSignOut } from '@/modules/auth';

export function UserMenu() {
  const { data: me } = useCurrentUser();
  const signOut = useSignOut();
  const theme = resolvedTheme(usePreferences().theme);
  const { update } = usePreferenceMutations();
  const toggleTheme = () => update.mutate({ theme: theme === 'dark' ? 'light' : 'dark' });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        <UserAvatar name={me?.name ?? '?'} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{me?.name}</span>
          <span className="block truncate text-xs text-sidebar-muted">{me?.email}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
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
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => signOut.mutate()}>
          <LogOutIcon /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
