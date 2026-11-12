import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SaveGithubConnectionRequest } from '@taskflow/shared-types';
import { toast } from '@/components/ui/sonner';
import { getErrorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';
import { integrationsApi } from '../api/integrations.api';

export function useGithubConnections(workspaceId: string, enabled: boolean) {
  return useQuery({ queryKey: queryKeys.integrations(workspaceId), queryFn: () => integrationsApi.githubConnections(workspaceId), enabled });
}

export function useTaskPullRequests(workspaceId: string, taskId: string) {
  return useQuery({ queryKey: queryKeys.taskPullRequests(workspaceId, taskId), queryFn: () => integrationsApi.taskPullRequests(workspaceId, taskId) });
}

/** The connection's latest deliveries; refreshed every 15 s while open, so new ones show up. */
export function useGithubSyncLog(workspaceId: string, connectionId: string, enabled: boolean) {
  return useQuery({ queryKey: [...queryKeys.integrations(workspaceId), 'log', connectionId], queryFn: () => integrationsApi.syncLog(workspaceId, connectionId), enabled, refetchInterval: enabled ? 15_000 : false });
}

export function useGithubInbox(workspaceId: string, enabled: boolean) {
  return useQuery({ queryKey: [...queryKeys.integrations(workspaceId), 'inbox'], queryFn: () => integrationsApi.inbox(workspaceId), enabled });
}

export function useGithubInboxMutations(workspaceId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.integrations(workspaceId) });
  const onError = (error: unknown) => toast.error(getErrorMessage(error));
  return {
    link: useMutation({ mutationFn: ({ itemId, taskNumber }: { itemId: string; taskNumber: number }) => integrationsApi.linkInbox(workspaceId, itemId, taskNumber), onSuccess: invalidate, onError }),
    dismiss: useMutation({ mutationFn: (itemId: string) => integrationsApi.dismissInbox(workspaceId, itemId), onSuccess: invalidate, onError }),
  };
}

export function useGithubMutations(workspaceId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.integrations(workspaceId) });
  const onError = (error: unknown) => toast.error(getErrorMessage(error));
  return {
    connect: useMutation({ mutationFn: (body: SaveGithubConnectionRequest) => integrationsApi.connectGithub(workspaceId, body), onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ connectionId, body }: { connectionId: string; body: Omit<SaveGithubConnectionRequest, 'repo'> }) => integrationsApi.updateGithub(workspaceId, connectionId, body),
      onSuccess: invalidate,
      onError,
    }),
    rotate: useMutation({ mutationFn: (connectionId: string) => integrationsApi.rotateGithubSecret(workspaceId, connectionId), onSuccess: invalidate, onError }),
    disconnect: useMutation({ mutationFn: (connectionId: string) => integrationsApi.disconnectGithub(workspaceId, connectionId), onSuccess: invalidate, onError }),
  };
}

/** Conflict cards for a task: GitHub events sync didn't apply because the task was moved by hand. */
export function useGithubConflicts(workspaceId: string, taskId: string) {
  return useQuery({ queryKey: [...queryKeys.taskPullRequests(workspaceId, taskId), 'conflicts'], queryFn: () => integrationsApi.conflicts(workspaceId, taskId) });
}

export function useResolveGithubConflict(workspaceId: string, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conflictId, useGithub }: { conflictId: string; useGithub: boolean }) => integrationsApi.resolveConflict(workspaceId, conflictId, useGithub),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.taskPullRequests(workspaceId, taskId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.task(workspaceId, taskId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasksRoot(workspaceId) });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

/** Whether this server has the GitHub App, and the workspace's installations of it. */
export function useGithubApp(workspaceId: string, enabled: boolean) {
  const info = useQuery({ queryKey: [...queryKeys.integrations(workspaceId), 'app'], queryFn: () => integrationsApi.githubApp(workspaceId), enabled, staleTime: 5 * 60_000 });
  const installations = useQuery({
    queryKey: [...queryKeys.integrations(workspaceId), 'installations'],
    queryFn: () => integrationsApi.installations(workspaceId),
    enabled: enabled && info.data?.enabled === true,
  });
  return { info, installations };
}

export function useInstallationRepositories(workspaceId: string, installationId: string | null) {
  return useQuery({
    queryKey: [...queryKeys.integrations(workspaceId), 'installation-repos', installationId],
    queryFn: () => integrationsApi.installationRepositories(workspaceId, installationId!),
    enabled: installationId !== null,
  });
}

export function useGithubAppMutations(workspaceId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.integrations(workspaceId) });
  const onError = (error: unknown) => toast.error(getErrorMessage(error));
  return {
    // Off to GitHub to install; GitHub sends the person back to this workspace's settings.
    install: useMutation({ mutationFn: () => integrationsApi.installUrl(workspaceId), onSuccess: (url) => window.location.assign(url), onError }),
    connect: useMutation({ mutationFn: (input: { installationId: string; repo: string; taskPrefix?: string }) => integrationsApi.connectRepository(workspaceId, input), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: (installationId: string) => integrationsApi.removeInstallation(workspaceId, installationId), onSuccess: invalidate, onError }),
  };
}

/** A task's GitHub issues, and where new ones can be opened. Refreshes while a change is on its way. */
export function useTaskGithubIssues(workspaceId: string, taskId: string) {
  const issues = useQuery({
    queryKey: [...queryKeys.taskPullRequests(workspaceId, taskId), 'issues'],
    queryFn: () => integrationsApi.taskIssues(workspaceId, taskId),
    refetchInterval: (query) => (query.state.data?.some((issue) => issue.pending) ? 3_000 : false),
  });
  const repositories = useQuery({ queryKey: [...queryKeys.integrations(workspaceId), 'issue-repos'], queryFn: () => integrationsApi.issueRepositories(workspaceId), staleTime: 60_000 });
  return { issues, repositories };
}

export function useCreateGithubIssue(workspaceId: string, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: string) => integrationsApi.createIssue(workspaceId, taskId, connectionId),
    onSuccess: (issue) => {
      toast.success(`Opened issue #${issue.number} in ${issue.repo}`);
      void queryClient.invalidateQueries({ queryKey: queryKeys.taskPullRequests(workspaceId, taskId) });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
