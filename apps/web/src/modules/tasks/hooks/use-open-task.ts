import { useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';

/**
 * Opens a task over whatever page is showing by putting its id in the URL
 * (`?task=`), so the open task can be shared and survives a reload.
 */
export function useOpenTask() {
  const navigate = useNavigate();
  return useCallback(
    (taskId: string | undefined) =>
      void navigate({ to: '.', search: (previous: Record<string, unknown>) => ({ ...previous, task: taskId }), replace: false }),
    [navigate],
  );
}
