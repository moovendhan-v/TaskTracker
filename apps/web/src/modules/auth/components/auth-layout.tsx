import { CalendarRangeIcon, FileTextIcon, ListChecksIcon, UsersIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Logo } from '@/components/common/logo';

const HIGHLIGHTS = [
  { icon: <ListChecksIcon />, text: 'Plan work in lists and boards' },
  { icon: <CalendarRangeIcon />, text: 'Run sprints with a clear goal' },
  { icon: <FileTextIcon />, text: 'Keep docs next to the work' },
  { icon: <UsersIcon />, text: 'Manage your team and time off' },
];

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Split screen: brand panel on wide screens, form card on the right. */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="grid min-h-full lg:grid-cols-[1fr_1.1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <Logo className="text-sidebar-foreground" />
        <div className="relative z-10 max-w-sm">
          <p className="text-3xl font-semibold leading-tight">One calm place for your team's work.</p>
          <ul className="mt-8 grid gap-4">
            {HIGHLIGHTS.map((item) => (
              <li key={item.text} className="flex items-center gap-3 text-sidebar-foreground/85 [&_svg]:size-5 [&_svg]:text-primary">
                {item.icon}
                {item.text}
              </li>
            ))}
          </ul>
        </div>
        <div aria-hidden className="absolute -right-24 -bottom-24 size-96 rounded-full bg-primary/20 blur-3xl" />
        <p className="relative z-10 text-xs text-sidebar-muted">TaskFlow</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Logo className="mb-8 lg:hidden" />
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">{subtitle}</p>
          {children}
          {footer ? <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}
