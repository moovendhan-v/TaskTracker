import { createRealtimeClient } from '@taskflow/sdk';
import { useRealtimeStatus } from '@/core/realtime/realtime-status.store';

/**
 * The app's single WebSocket connection for live updates, to /api/graphql on
 * the same origin (the Vite proxy or nginx forwards it). Connects on first use.
 */
export const realtime = createRealtimeClient({ onStatus: (status) => useRealtimeStatus.setState({ status }) });
