import { useQuery } from '@tanstack/react-query';
import { unwrap } from '@taskflow/sdk';
import { api } from '@/core/api/sdk-client';
import { queryKeys } from '@/lib/query-keys';

export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => unwrap(api.GET('/api/me')),
    staleTime: 5 * 60_000,
  });
}
