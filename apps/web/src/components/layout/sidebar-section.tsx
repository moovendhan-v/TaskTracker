import type { ReactNode } from 'react';

interface SidebarSectionProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}

export function SidebarSection({ title, action, children }: SidebarSectionProps) {
  return (
    <section className="px-2 py-2">
      <div className="flex items-center justify-between px-2 pb-1">
        <h2 className="text-[11px] font-semibold tracking-wider text-sidebar-muted uppercase">{title}</h2>
        {action}
      </div>
      <div className="grid gap-0.5">{children}</div>
    </section>
  );
}
