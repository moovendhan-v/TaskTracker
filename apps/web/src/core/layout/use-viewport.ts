import { useSyncExternalStore } from 'react';
import { create } from 'zustand';

/** Phone under 768px, tablet up to 1024px, desktop above. Matches Tailwind's md and lg. */
export type Viewport = 'phone' | 'tablet' | 'desktop';

const PHONE = '(max-width: 767px)';
const TABLET = '(min-width: 768px) and (max-width: 1023px)';

function current(): Viewport {
  if (typeof window === 'undefined' || !window.matchMedia) return 'desktop';
  if (window.matchMedia(PHONE).matches) return 'phone';
  if (window.matchMedia(TABLET).matches) return 'tablet';
  return 'desktop';
}

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const queries = [window.matchMedia(PHONE), window.matchMedia(TABLET)];
  for (const query of queries) query.addEventListener('change', callback);
  return () => {
    for (const query of queries) query.removeEventListener('change', callback);
  };
}

/** Which layout the shell uses; re-renders when the window crosses a breakpoint. */
export function useViewport(): Viewport {
  return useSyncExternalStore(subscribe, current, () => 'desktop');
}

/** The slide-over navigation on phones and tablets. */
export const useNavDrawer = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
