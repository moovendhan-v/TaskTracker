import { useQueryClient } from '@tanstack/react-query';
import { RefreshCwIcon } from 'lucide-react';
import { useRef, useState, type ReactNode, type TouchEvent } from 'react';
import { cn } from '@/lib/cn';

/** How far to pull before letting go refreshes; the indicator stops following a bit after. */
export const PULL_TO_REFRESH_AT = 70;
const PULL_MAX = 110;

/** The pull distance shown for a finger moved `dy`: resisting more the further it goes. */
export function pullDistance(dy: number): number {
  if (dy <= 0) return 0;
  return Math.min(PULL_MAX, dy * 0.55);
}

/** The nearest element that scrolls vertically, from where the finger landed. */
function scrollerOf(target: EventTarget | null, boundary: HTMLElement): HTMLElement | null {
  let element = target instanceof HTMLElement ? target : null;
  while (element && element !== boundary.parentElement) {
    const overflow = getComputedStyle(element).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll') && element.scrollHeight > element.clientHeight) return element;
    element = element.parentElement;
  }
  return null;
}

/**
 * Pull to refresh (F1, phones): pulling down at the top of a page refetches what's on screen.
 * It only starts when the scrolling area under the finger is already at its top, so it never
 * gets in the way of scrolling, and not inside fields or dialogs.
 */
export function PullToRefresh({ enabled, children, className }: { enabled: boolean; children: ReactNode; className?: string }) {
  const queryClient = useQueryClient();
  const start = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onTouchStart = (event: TouchEvent<HTMLElement>) => {
    if (!enabled || refreshing || event.touches.length !== 1) return;
    const target = event.target as HTMLElement;
    if (target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="application"]')) return;
    const scroller = scrollerOf(event.target, event.currentTarget);
    if (scroller && scroller.scrollTop > 0) return;
    start.current = event.touches[0]!.clientY;
  };
  const onTouchMove = (event: TouchEvent<HTMLElement>) => {
    if (start.current === null) return;
    const distance = pullDistance(event.touches[0]!.clientY - start.current);
    setPull(distance);
  };
  const onTouchEnd = () => {
    if (start.current === null) return;
    start.current = null;
    const reached = pull >= pullDistance(PULL_TO_REFRESH_AT);
    setPull(0);
    if (!reached) return;
    setRefreshing(true);
    void queryClient.invalidateQueries({ refetchType: 'active' }).finally(() => setRefreshing(false));
  };

  const onTouchCancel = () => {
    start.current = null;
    setPull(0);
  };

  const shown = refreshing ? 48 : pull;
  return (
    <main className={className} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchCancel}>
      {shown > 0 ? (
        <div aria-hidden className="pointer-events-none flex shrink-0 items-end justify-center overflow-hidden transition-[height] duration-150" style={{ height: shown }}>
          <RefreshCwIcon
            className={cn('mb-2 size-5 text-muted-foreground', refreshing && 'animate-spin text-primary', pull >= pullDistance(PULL_TO_REFRESH_AT) && 'text-primary')}
            style={refreshing ? undefined : { transform: `rotate(${pull * 3}deg)` }}
          />
        </div>
      ) : null}
      {refreshing ? <span role="status" className="sr-only">Refreshing</span> : null}
      {children}
    </main>
  );
}
