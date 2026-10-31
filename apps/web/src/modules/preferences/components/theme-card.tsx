import type { Theme } from '@taskflow/shared-types';
import { cn } from '@/lib/cn';

/** Fixed light and dark colours, so each card shows its theme whatever the app is in now. */
const LIGHT = { bg: '#ffffff', rail: '#f4f4f5', line: '#e4e4e7', card: '#fafafa' };
const DARK = { bg: '#09090b', rail: '#18181b', line: '#27272a', card: '#111113' };

function Mini({ colors, className }: { colors: typeof LIGHT; className?: string }) {
  return (
    <div className={cn('grid h-full grid-cols-[22px_1fr] gap-1.5 p-2', className)} style={{ background: colors.bg }}>
      <span className="rounded-[4px]" style={{ background: colors.rail }} />
      <div className="flex flex-col gap-1.5">
        <span className="h-2 w-3/5 rounded-[3px]" style={{ background: colors.line }} />
        <span className="flex-1 rounded-[5px] border" style={{ background: colors.card, borderColor: colors.line }} />
        <span className="h-2 w-2/5 rounded-[3px] bg-ring" />
      </div>
    </div>
  );
}

interface ThemeCardProps {
  theme: Theme;
  label: string;
  selected: boolean;
  onSelect: () => void;
}

export function ThemeCard({ theme, label, selected, onSelect }: ThemeCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className="group flex flex-col gap-2 rounded-xl text-left text-sm focus-visible:outline-none"
    >
      <span
        className={cn(
          'relative block h-26 overflow-hidden rounded-xl border-2 transition-colors group-focus-visible:ring-[3px] group-focus-visible:ring-primary-soft',
          selected ? 'border-ring' : 'border-border group-hover:border-border-strong',
        )}
      >
        {theme === 'system' ? (
          <>
            <Mini colors={LIGHT} className="absolute inset-0 [clip-path:polygon(0_0,100%_0,0_100%)]" />
            <Mini colors={DARK} className="absolute inset-0 [clip-path:polygon(100%_0,100%_100%,0_100%)]" />
          </>
        ) : (
          <Mini colors={theme === 'dark' ? DARK : LIGHT} />
        )}
      </span>
      <span className="flex items-center gap-2">
        <span className={cn('grid size-3.5 place-items-center rounded-full border-[1.5px]', selected ? 'border-ring' : 'border-border-strong')}>
          {selected ? <span className="size-1.5 rounded-full bg-ring" /> : null}
        </span>
        {label}
      </span>
    </button>
  );
}
