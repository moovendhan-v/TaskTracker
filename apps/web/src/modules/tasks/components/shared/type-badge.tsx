import type { TaskType } from '@taskflow/shared-types';
import { cn } from '@/lib/cn';
import { TYPE_META } from '../../lib/task-meta';

export function TypeBadge({ type, className }: { type: TaskType; className?: string }) {
  return <span className={cn('inline-flex h-5 items-center rounded px-1.5 text-[11px] font-semibold', TYPE_META[type].className, className)}>{TYPE_META[type].label}</span>;
}
