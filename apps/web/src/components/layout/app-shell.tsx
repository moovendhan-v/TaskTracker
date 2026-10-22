import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface AppShellProps {
  sidebar: ReactNode;
  children: ReactNode;
  sidebarOpen: boolean;
}

/** Two-column frame: dark sidebar on the left, page on the right. Content comes in through props. */
export function AppShell({ sidebar, children, sidebarOpen }: AppShellProps) {
  return (
    <div className="flex h-full overflow-hidden">
      <aside
        className={cn(
          'flex h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200',
          sidebarOpen ? 'w-64' : 'w-0 overflow-hidden border-r-0',
        )}
        aria-label="Workspace navigation"
      >
        {sidebar}
      </aside>
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}
