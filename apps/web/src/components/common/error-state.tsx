import { Link, useRouterState } from '@tanstack/react-router';
import { LockIcon, TriangleAlertIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getErrorMessage, missingPermissionOf, workspaceInPath } from '@/lib/errors';

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
}

/**
 * A failed load. When the server refused for want of a permission, it says which
 * one and links to "Why?": the access checker on that permission for you, which
 * shows what decides it and lets you request access.
 */
export function ErrorState({ error, onRetry }: ErrorStateProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const missing = missingPermissionOf(error);
  const workspaceId = workspaceInPath(pathname);
  if (missing) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 p-10 text-center">
        <LockIcon className="size-6 text-muted-foreground" />
        <p className="text-sm font-medium">You don’t have access to this</p>
        <p className="text-sm text-muted-foreground">
          It needs the <code className="rounded bg-muted px-1 font-mono text-xs">{missing.permission}</code> permission{missing.spaceId ? ' in this project' : ''}.
        </p>
        {workspaceId ? (
          <Button asChild variant="outline" size="sm">
            <Link to="/w/$workspaceId/access" params={{ workspaceId }} search={{ permission: missing.permission, space: missing.spaceId ?? undefined }}>
              Why? Request access
            </Link>
          </Button>
        ) : null}
      </div>
    );
  }
  return (
    <div role="alert" className="flex flex-col items-center gap-3 p-10 text-center">
      <TriangleAlertIcon className="size-6 text-destructive" />
      <p className="text-sm text-muted-foreground">{getErrorMessage(error)}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
