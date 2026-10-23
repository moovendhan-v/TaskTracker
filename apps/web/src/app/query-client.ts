import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { isClientError, isUnauthenticated } from '@/lib/errors';

const PUBLIC_PATHS = ['/sign-in', '/sign-up', '/forgot-password', '/reset-password'];

/** An expired session anywhere sends the user back to sign in. */
function handleUnauthorized(error: unknown): void {
  if (isUnauthenticated(error) && !PUBLIC_PATHS.includes(window.location.pathname)) {
    window.location.assign('/sign-in');
  }
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({ onError: handleUnauthorized }),
    mutationCache: new MutationCache({ onError: handleUnauthorized }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        // Client errors (forbidden, not found, validation) won't succeed on retry.
        retry: (failureCount, error) => !isClientError(error) && failureCount < 2,
      },
    },
  });
}
