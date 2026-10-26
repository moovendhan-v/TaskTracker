import { ChevronRightIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface SectionProps {
  title: ReactNode;
  /** Shown next to the title, e.g. the number of rows inside. */
  count?: number;
  /** Controls after the title; clicks on them don't toggle the section. */
  actions?: ReactNode;
  children: ReactNode;
  /** Remembered in this browser under this key when given. */
  storageKey?: string;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  variant?: 'plain' | 'card';
  className?: string;
}

function readStored(key: string | undefined): boolean | null {
  if (!key) return null;
  try {
    const value = window.localStorage.getItem(`section:${key}`);
    return value === null ? null : value === '1';
  } catch {
    return null;
  }
}

/**
 * A collapsible block (accordion item): grouped list sections, detail panels,
 * settings groups. Works controlled (`open`) or on its own, optionally
 * remembering its state per browser.
 */
export function Section({ title, count, actions, children, storageKey, defaultOpen = true, open, onOpenChange, variant = 'plain', className }: SectionProps) {
  const [ownOpen, setOwnOpen] = useState(() => readStored(storageKey) ?? defaultOpen);
  const isOpen = open ?? ownOpen;
  const toggle = () => {
    const next = !isOpen;
    setOwnOpen(next);
    onOpenChange?.(next);
    if (storageKey) {
      try {
        window.localStorage.setItem(`section:${storageKey}`, next ? '1' : '0');
      } catch {
        // Private windows may refuse storage; the section still works.
      }
    }
  };

  return (
    <section className={cn(variant === 'card' && 'rounded-xl border bg-card', className)}>
      <div className={cn('flex items-center gap-2', variant === 'card' ? 'px-3 py-2' : 'py-1.5')}>
        <button type="button" onClick={toggle} aria-expanded={isOpen} className="flex min-w-0 items-center gap-2 rounded-md text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          <ChevronRightIcon className={cn('size-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-90')} />
          {title}
        </button>
        {count !== undefined ? <span className="text-xs tabular-nums text-muted-foreground">{count}</span> : null}
        {actions ? <div className="flex items-center gap-1">{actions}</div> : null}
      </div>
      {isOpen ? <div>{children}</div> : null}
    </section>
  );
}
