import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { LiveDoc, type LiveSnapshot } from './live-doc';

const IDLE: LiveSnapshot = { status: 'unavailable', text: '', readOnly: true, peers: [], savedAt: null, pending: false, error: null };
const noop = () => () => undefined;
const idle = () => IDLE;

/** Holds the current connection, so components re-render when it's opened or closed. */
function connectionHolder() {
  let current: LiveDoc | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set(next: LiveDoc | null) {
      current = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * A page's live connection for as long as it's open (C5). With `enabled` false (or in a
 * browser without WebSocket) it stays 'unavailable' and the page saves on its own.
 */
export function useLiveDoc(workspaceId: string, documentId: string, enabled: boolean) {
  const holder = useMemo(() => connectionHolder(), []);
  useEffect(() => {
    if (!enabled || typeof WebSocket === 'undefined') return;
    const doc = new LiveDoc(workspaceId, documentId);
    holder.set(doc);
    return () => {
      holder.set(null);
      doc.destroy();
    };
  }, [holder, workspaceId, documentId, enabled]);
  const live = useSyncExternalStore(holder.subscribe, holder.get);
  const snapshot = useSyncExternalStore(live?.subscribe ?? noop, live?.getSnapshot ?? idle);
  return { ...snapshot, live };
}
