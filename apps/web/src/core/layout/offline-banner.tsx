import { WifiOffIcon } from 'lucide-react';
import { useSyncExternalStore } from 'react';

function subscribe(callback: () => void): () => void {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

/** Whether the browser thinks it has a connection. */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}

/** Shown while offline (F1): the app opens from its saved shell, but nothing new loads or saves. */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-foreground px-3 py-1.5 pt-[max(0.375rem,env(safe-area-inset-top))] text-xs text-background animate-in fade-in-0 slide-in-from-top-2"
    >
      <WifiOffIcon aria-hidden className="size-3.5" />
      You’re offline. What you see may be out of date, and changes can’t be saved until you’re back.
    </div>
  );
}
