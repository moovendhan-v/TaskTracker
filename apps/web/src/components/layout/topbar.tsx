import { PanelLeftIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface TopbarProps {
  onToggleSidebar: () => void;
  breadcrumbs?: ReactNode;
  actions?: ReactNode;
}

export function Topbar({ onToggleSidebar, breadcrumbs, actions }: TopbarProps) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b bg-card px-3">
      <Button variant="ghost" size="icon-sm" onClick={onToggleSidebar} aria-label="Toggle sidebar">
        <PanelLeftIcon />
      </Button>
      <div className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{breadcrumbs}</div>
      {actions}
    </div>
  );
}
