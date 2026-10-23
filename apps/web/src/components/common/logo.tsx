import { cn } from '@/lib/cn';

/** TaskFlow's own mark: three stacked lines with an amber dot. */
export function Logo({ className, withWordmark = true }: { className?: string; withWordmark?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-semibold', className)}>
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <rect width="32" height="32" rx="8" className="fill-primary" />
        <path d="M9 11h14M9 16h9M9 21h5" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="22" cy="21" r="3" className="fill-highlight" />
      </svg>
      {withWordmark ? <span className="text-base tracking-tight">TaskFlow</span> : null}
    </span>
  );
}
