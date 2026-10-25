import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { resourcesApi } from '../api/resources.api';

/** What the API says a resource offers: fields, operators, options, paging. Trimmed to what the caller may see. */
export function useResourceSchema(workspaceId: string, resource: string) {
  return useQuery({ queryKey: queryKeys.resourceSchema(workspaceId, resource), queryFn: () => resourcesApi.schema(workspaceId, resource), staleTime: 5 * 60_000 });
}
