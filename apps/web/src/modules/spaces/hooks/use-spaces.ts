import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateSpaceRequest, CustomFieldEntity, SaveCustomFieldRequest, SaveTaskStatusRequest, UpdateSpaceRequest } from '@taskflow/shared-types';
import { toast } from '@/components/ui/sonner';
import { getErrorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';
import { customFieldsApi, spacesApi, statusesApi } from '../api/spaces.api';

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

export function useStatusMutations(workspaceId: string, spaceId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.statuses(workspaceId, spaceId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.tasksRoot(workspaceId) });
  };
  const onError = (error: unknown) => toast.error(getErrorMessage(error));
  return {
    create: useMutation({ mutationFn: (body: SaveTaskStatusRequest) => statusesApi.create(workspaceId, spaceId, body), onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ statusId, body }: { statusId: string; body: Partial<SaveTaskStatusRequest> }) => statusesApi.update(workspaceId, statusId, body),
      onSuccess: invalidate,
      onError,
    }),
    remove: useMutation({
      mutationFn: ({ statusId, moveTasksTo }: { statusId: string; moveTasksTo: string }) => statusesApi.remove(workspaceId, statusId, moveTasksTo),
      onSuccess: invalidate,
      onError,
    }),
    reorder: useMutation({ mutationFn: (statusIds: string[]) => statusesApi.reorder(workspaceId, spaceId, statusIds), onSuccess: invalidate, onError }),
  };
}

export function useCustomFieldMutations(workspaceId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.spaces(workspaceId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.tasksRoot(workspaceId) });
  };
  const onError = (error: unknown) => toast.error(getErrorMessage(error));
  return {
    create: useMutation({ mutationFn: (body: SaveCustomFieldRequest) => customFieldsApi.create(workspaceId, body), onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ fieldId, body }: { fieldId: string; body: Pick<SaveCustomFieldRequest, 'name' | 'options' | 'required'> }) => customFieldsApi.update(workspaceId, fieldId, body),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: (fieldId: string) => customFieldsApi.remove(workspaceId, fieldId), onSuccess: invalidate, onError }),
  };
}
