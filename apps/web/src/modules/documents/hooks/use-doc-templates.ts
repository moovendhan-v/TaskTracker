import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SaveDocTemplateRequest } from '@taskflow/shared-types';
import { notify } from '@/components/kit/notify';
import { docTemplatesApi } from '../api/documents.api';

const key = (workspaceId: string) => ['workspaces', workspaceId, 'doc-templates'] as const;

export function useDocTemplates(workspaceId: string, enabled = true) {
  return useQuery({ queryKey: key(workspaceId), queryFn: () => docTemplatesApi.list(workspaceId), staleTime: 60_000, enabled });
}

export function useDocTemplateMutations(workspaceId: string) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: key(workspaceId) });
  return {
    save: useMutation({ mutationFn: (input: SaveDocTemplateRequest) => docTemplatesApi.save(workspaceId, input), onSuccess: refresh, onError: (error) => notify.error(error) }),
    remove: useMutation({ mutationFn: (templateId: string) => docTemplatesApi.remove(workspaceId, templateId), onSuccess: refresh, onError: (error) => notify.error(error) }),
  };
}
