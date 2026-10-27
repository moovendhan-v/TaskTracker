import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateFromTemplateRequest, ImportTemplateRequest, SaveAsTemplateRequest } from '@taskflow/shared-types';
import { toast } from '@/components/ui/sonner';
import { getErrorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';
import { templatesApi } from '../api/templates.api';

export function useTemplates(workspaceId: string, enabled = true) {
  return useQuery({ queryKey: queryKeys.templates(workspaceId), queryFn: () => templatesApi.list(workspaceId), enabled, staleTime: 60_000 });
}

export function useTemplateMutations(workspaceId: string) {
  const queryClient = useQueryClient();
  const onError = (error: unknown) => toast.error(getErrorMessage(error));
  const refreshTemplates = () => queryClient.invalidateQueries({ queryKey: queryKeys.templates(workspaceId) });
  const refreshEverything = () => queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId] });
  return {
    apply: useMutation({
      mutationFn: ({ templateId, body }: { templateId: string; body: CreateFromTemplateRequest }) => templatesApi.apply(workspaceId, templateId, body),
      // A new space brings lists, folders, statuses, tasks and docs with it.
      onSuccess: refreshEverything,
      onError,
    }),
    saveFromSpace: useMutation({
      mutationFn: ({ spaceId, body }: { spaceId: string; body: SaveAsTemplateRequest }) => templatesApi.saveFromSpace(workspaceId, spaceId, body),
      onSuccess: refreshTemplates,
      onError,
    }),
    importJson: useMutation({ mutationFn: (body: ImportTemplateRequest) => templatesApi.importJson(workspaceId, body), onSuccess: refreshTemplates, onError }),
    remove: useMutation({ mutationFn: (templateId: string) => templatesApi.remove(workspaceId, templateId), onSuccess: refreshTemplates, onError }),
  };
}
