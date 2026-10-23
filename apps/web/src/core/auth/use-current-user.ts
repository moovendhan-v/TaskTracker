import { useQuery } from '@tanstack/react-query';
import { fetchCurrentUser } from '@/core/api/current-user.api';
import { queryKeys } from '@/lib/query-keys';

export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: fetchCurrentUser,
    staleTime: 5 * 60_000,
  });
}
