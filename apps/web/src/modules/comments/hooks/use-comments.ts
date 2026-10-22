import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/sonner';
import { getErrorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';
import { commentsApi } from '../api/comments.api';

export function useComments(workspaceId: string, taskId: string) {
  return useQuery({ queryKey: queryKeys.comments(workspaceId, taskId), queryFn: () => commentsApi.list(workspaceId, taskId) });
}

export function useCommentMutations(workspaceId: string, taskId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.comments(workspaceId, taskId) });
  const onError = (error: unknown) => toast.error(getErrorMessage(error));
  return {
    create: useMutation({ mutationFn: (body: string) => commentsApi.create(workspaceId, taskId, { body }), onSuccess: invalidate, onError }),
    update: useMutation({
      mutationFn: ({ commentId, body }: { commentId: string; body: string }) => commentsApi.update(workspaceId, commentId, { body }),
      onSuccess: invalidate,
      onError,
    }),
    remove: useMutation({ mutationFn: (commentId: string) => commentsApi.remove(workspaceId, commentId), onSuccess: invalidate, onError }),
  };
}
