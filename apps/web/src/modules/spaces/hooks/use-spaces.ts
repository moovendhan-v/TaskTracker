import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateSpaceRequest, CustomFieldEntity, UpdateSpaceRequest } from '@taskflow/shared-types';
import { queryKeys } from '@/lib/query-keys';
import { spacesApi } from '../api/spaces.api';

export function useSpaces(workspaceId: string) {
  return useQuery({ queryKey: queryKeys.spaces(workspaceId), queryFn: () => spacesApi.list(workspaceId) });
}

/** Custom field definitions for tasks or spaces, e.g. to label a project's attributes. */
export function useCustomFields(workspaceId: string, entity: CustomFieldEntity) {
  return useQuery({ queryKey: [...queryKeys.spaces(workspaceId), 'custom-fields', entity], queryFn: () => spacesApi.customFields(workspaceId, entity), staleTime: 5 * 60_000 });
}

export function useSpaceMutations(workspaceId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.spaces(workspaceId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.lists(workspaceId) });
  };
  return {
    create: useMutation({ mutationFn: (body: CreateSpaceRequest) => spacesApi.create(workspaceId, body), onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ spaceId, body }: { spaceId: string; body: UpdateSpaceRequest }) => spacesApi.update(workspaceId, spaceId, body),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: (spaceId: string) => spacesApi.remove(workspaceId, spaceId), onSuccess: invalidate }),
  };
}
