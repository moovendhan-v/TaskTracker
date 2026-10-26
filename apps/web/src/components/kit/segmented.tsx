import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
}

interface SegmentedProps<T extends string> {
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  label: string;
  /** `pills`: separate rounded chips; `joined`: one bar with the choice highlighted. */
  variant?: 'pills' | 'joined';
  size?: 'sm' | 'md';
  className?: string;
}

/** One choice out of a few, shown all at once: periods, scopes, view sizes. */
export function Segmented<T extends string>({ value, options, onChange, label, variant = 'joined', size = 'sm', className }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex items-center', variant === 'joined' ? 'gap-0.5 rounded-lg bg-muted p-0.5' : 'flex-wrap gap-1.5', className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&_svg]:size-3.5',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-sm',
              variant === 'joined'
                ? cn('rounded-md', active ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground')
                : cn('rounded-full border', active ? 'border-primary/60 bg-primary/15 text-foreground' : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'),
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
