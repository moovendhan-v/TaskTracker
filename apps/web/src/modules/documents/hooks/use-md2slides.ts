import { useQuery } from '@tanstack/react-query';
import { md2slidesApi } from '../api/md2slides.api';

/** md2slides' community templates, contributors and snippets (the server refreshes them daily). */
export function useMd2SlidesCatalog(workspaceId: string, enabled = true) {
  return useQuery({ queryKey: ['workspaces', workspaceId, 'md2slides'], queryFn: () => md2slidesApi.catalog(workspaceId), staleTime: 60 * 60_000, enabled });
}
