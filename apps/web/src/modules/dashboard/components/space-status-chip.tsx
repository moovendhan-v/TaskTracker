import { CircleCheckIcon, CircleDashedIcon, CirclePauseIcon, OctagonAlertIcon, TriangleAlertIcon } from 'lucide-react';
import type { SpaceStatus } from '@taskflow/shared-types';
import { cn } from '@/lib/cn';

const META: Record<SpaceStatus, { label: string; icon: typeof CircleCheckIcon; className: string }> = {
  on_track: { label: 'On track', icon: CircleCheckIcon, className: 'bg-good/15 [&_svg]:text-good' },
  at_risk: { label: 'At risk', icon: TriangleAlertIcon, className: 'bg-warning/15 [&_svg]:text-warning' },
  off_track: { label: 'Off track', icon: OctagonAlertIcon, className: 'bg-critical/15 [&_svg]:text-critical' },
  on_hold: { label: 'On hold', icon: CirclePauseIcon, className: 'bg-muted [&_svg]:text-muted-foreground' },
  complete: { label: 'Complete', icon: CircleDashedIcon, className: 'bg-chart-1/15 [&_svg]:text-chart-1' },
};

/** A project's health: icon and word, so it never relies on colour alone. */
export function SpaceStatusChip({ status, className }: { status: SpaceStatus; className?: string }) {
  const meta = META[status];
  const Icon = meta.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap', meta.className, className)}>
      <Icon className="size-3.5" /> {meta.label}
    </span>
  );
}
