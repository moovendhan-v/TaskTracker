import type { WorkspaceEventResponse } from '@taskflow/shared-types';

type Listener = (workspaceId: string, event: Pick<WorkspaceEventResponse, 'type' | 'entityType' | 'entityId' | 'actorId'>) => void;

const listeners = new Set<Listener>();

/**
 * Live workspace events for features that react to them directly (e.g. "typing")
 * rather than by refetching. The one WebSocket subscription feeds this.
 */
export const liveEvents = {
  emit: (...args: Parameters<Listener>) => listeners.forEach((listener) => listener(...args)),
  listen: (listener: Listener) => {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
};
