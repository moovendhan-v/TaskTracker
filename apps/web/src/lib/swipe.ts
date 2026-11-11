import { useRef, useState, type CSSProperties, type TouchEvent } from 'react';

export type SwipeDirection = 'left' | 'right' | 'down';

/** Phone width, where dialogs are bottom sheets that swipe down to close. */
export const isPhone = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 639px)').matches;

/** A swipe far enough (or quick enough) in its direction closes; anything else springs back. */
export function swipeDismisses(direction: SwipeDirection, dx: number, dy: number, ms: number): boolean {
  const along = direction === 'down' ? dy : direction === 'left' ? -dx : dx;
  const across = direction === 'down' ? Math.abs(dx) : Math.abs(dy);
  if (along <= 0 || across > along) return false;
  const speed = along / Math.max(ms, 1);
  return along > 80 || (along > 30 && speed > 0.5);
}

/** How far the panel follows the finger: fully along the direction, never backwards. */
export function swipeOffset(direction: SwipeDirection, dx: number, dy: number): { x: number; y: number } {
  if (direction === 'down') return { x: 0, y: Math.max(0, dy) };
  if (direction === 'left') return { x: Math.min(0, dx), y: 0 };
  return { x: Math.max(0, dx), y: 0 };
}

/**
 * Swipe to close (F1): the panel follows a finger moving in `direction` and closes when let go
 * far enough. A downward swipe starts on the top strip, or anywhere while the panel is scrolled
 * to the top, so it never fights with scrolling; sideways swipes only when the finger moves
 * mostly sideways.
 */
export function useSwipeDismiss(direction: SwipeDirection, onDismiss: () => void, enabled = true) {
  const start = useRef<{ x: number; y: number; at: number; active: boolean } | null>(null);
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null);

  const handlers = {
    onTouchStart(event: TouchEvent<HTMLElement>) {
      if (!enabled || event.touches.length !== 1) return;
      const touch = event.touches[0]!;
      // Scrolled down, a downward swipe only starts on the top strip (where the grab handle is).
      const fromHandle = touch.clientY - event.currentTarget.getBoundingClientRect().top < 40;
      const scrolled = direction === 'down' && event.currentTarget.scrollTop > 0 && !fromHandle;
      start.current = { x: touch.clientX, y: touch.clientY, at: Date.now(), active: !scrolled };
    },
    onTouchMove(event: TouchEvent<HTMLElement>) {
      const origin = start.current;
      if (!origin?.active) return;
      const touch = event.touches[0]!;
      const dx = touch.clientX - origin.x;
      const dy = touch.clientY - origin.y;
      // Decide once the finger has moved a little: a swipe in our direction, or not ours at all.
      if (!offset && Math.hypot(dx, dy) > 8) {
        const ours = direction === 'down' ? dy > Math.abs(dx) : Math.abs(dx) > Math.abs(dy) && (direction === 'left' ? dx < 0 : dx > 0);
        if (!ours) {
          origin.active = false;
          return;
        }
      }
      if (Math.hypot(dx, dy) > 8) setOffset(swipeOffset(direction, dx, dy));
    },
    onTouchEnd(event: TouchEvent<HTMLElement>) {
      const origin = start.current;
      start.current = null;
      if (!origin?.active || !offset) return setOffset(null);
      const touch = event.changedTouches[0]!;
      const close = swipeDismisses(direction, touch.clientX - origin.x, touch.clientY - origin.y, Date.now() - origin.at);
      setOffset(null);
      if (close) onDismiss();
    },
    onTouchCancel() {
      start.current = null;
      setOffset(null);
    },
  };
  const style: CSSProperties | undefined = offset ? { transform: `translate(${offset.x}px, ${offset.y}px)`, transition: 'none' } : undefined;
  return { handlers, style, dragging: offset !== null };
}
