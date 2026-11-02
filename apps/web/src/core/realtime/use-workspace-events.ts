import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { WorkspaceEventsDocument } from '@taskflow/sdk';
import { realtime } from '@/core/api/realtime-client';
import { keysToRefresh } from './invalidations';
import { liveEvents } from './live-events';

/**
 * Keeps a workspace's views fresh while it is open: every change someone makes
 * arrives over the WebSocket and refreshes the affected queries. Events carry ids
 * only, so the refetch goes through the normal, permission-checked API.
 * `onNotification` runs when the signed-in user gets a new notification.
 */
export function useWorkspaceEvents(workspaceId: string, onNotification: () => void): void {
  const queryClient = useQueryClient();
  const notify = useRef(onNotification);
  useEffect(() => {
    notify.current = onNotification;
  });

  useEffect(() => {
    return realtime.subscribe(WorkspaceEventsDocument, { workspaceId }, {
      next: ({ workspaceEvents: event }) => {
        // Our own changes are refreshed too: the same person may have the workspace open in another tab.
        for (const queryKey of keysToRefresh(workspaceId, event.entityType)) void queryClient.invalidateQueries({ queryKey });
        if (event.type === 'notification.created') notify.current();
        liveEvents.emit(workspaceId, event);
      },
    });
  }, [workspaceId, queryClient]);
}
