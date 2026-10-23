import type { QueryClient } from '@tanstack/react-query';
import { authClient } from './auth-client';

const SESSION_KEY = ['auth', 'session'] as const;
/** How long a session check is reused by route guards. The API still checks every request. */
const SESSION_CACHE_MS = 60_000;

async function fetchHasSession(): Promise<boolean> {
  const { data, error } = await authClient.getSession();
  // A rate-limit or server error isn't proof of being signed out; let the API's own 401 decide.
  if (error && error.status !== 401) throw new Error(error.message ?? 'Session check failed');
  return Boolean(data?.session);
}

/** Used by route guards before rendering. Cached briefly so navigation doesn't hit the auth API each time. */
export async function hasSession(queryClient: QueryClient): Promise<boolean> {
  try {
    return await queryClient.ensureQueryData({ queryKey: SESSION_KEY, queryFn: fetchHasSession, staleTime: SESSION_CACHE_MS });
  } catch {
    return true;
  }
}
