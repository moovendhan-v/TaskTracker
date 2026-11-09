import { lazy, Suspense } from 'react';
import { useCall } from './call-store';

// The lobby and the dock (and the media library they use) load only when a call is opened.
const CallLobby = lazy(() => import('./call-components').then((module) => ({ default: module.CallLobby })));
const CallDock = lazy(() => import('./call-components').then((module) => ({ default: module.CallDock })));

/** Calls (D2) over every page: the lobby when it's open, and the call you're in. */
export function CallOverlay() {
  const active = useCall((state) => state.lobby !== null || state.call !== null);
  if (!active) return null;
  return (
    <Suspense fallback={null}>
      <CallLobby />
      <CallDock />
    </Suspense>
  );
}
