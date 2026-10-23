import { Link, type LinkProps } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type SidebarLinkProps = LinkProps & {
  icon?: ReactNode;
  /** A short count shown on the right, e.g. unread items. */
  badge?: string;
  children: ReactNode;
  className?: string;
};

/** Navigation row in the dark sidebar; highlights itself when its route is active. */
export function SidebarLink({ icon, badge, children, className, activeOptions, ...linkProps }: SidebarLinkProps) {
  return (
    <Link
      {...linkProps}
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-sidebar-muted',
        className,
      )}
      activeProps={{ className: 'bg-sidebar-accent text-sidebar-foreground font-medium [&_svg]:text-primary' }}
      activeOptions={{ exact: false, includeSearch: false, ...activeOptions }}
    >
      {icon}
      <span className="truncate">{children}</span>
      {badge ? (
        <span className="ml-auto rounded-full bg-highlight px-1.5 text-[11px] font-semibold leading-5 text-[oklch(0.25_0.05_70)]" aria-label={`${badge} unread`}>
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
