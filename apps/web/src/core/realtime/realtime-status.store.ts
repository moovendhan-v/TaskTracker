import { create } from 'zustand';
import type { RealtimeStatus } from '@taskflow/sdk';

/** Whether live updates are flowing, for the indicator in the top bar. */
export const useRealtimeStatus = create<{ status: RealtimeStatus }>(() => ({ status: 'connecting' }));
