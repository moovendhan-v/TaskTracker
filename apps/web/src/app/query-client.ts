import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from '@taskflow/sdk';

const PUBLIC_PATHS = ['/sign-in', '/sign-up', '/forgot-password', '/reset-password'];

/** An expired session anywhere sends the user back to sign in. */
function handleUnauthorized(error: unknown): void {
  if (error instanceof ApiError && error.status === 401 && !PUBLIC_PATHS.includes(window.location.pathname)) {
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
        // Client errors (403, 404, validation) won't succeed on retry.
        retry: (failureCount, error) => !(error instanceof ApiError && error.status < 500) && failureCount < 2,
      },
    },
  });
}
