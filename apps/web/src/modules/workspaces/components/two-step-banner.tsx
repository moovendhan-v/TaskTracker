import { Link } from '@tanstack/react-router';
import { ShieldAlertIcon } from 'lucide-react';
import { useWorkspace } from '../hooks/use-workspaces';

/** Shown while the workspace requires two-step sign-in and you haven't set it up (A4 / E3). */
export function TwoStepBanner({ workspaceId }: { workspaceId: string }) {
  const { data: workspace } = useWorkspace(workspaceId);
  if (!workspace?.twoStepMissing) return null;
  return (
    <div role="status" className="flex flex-wrap items-center gap-2 border-b border-amber-300/60 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100">
      <ShieldAlertIcon className="size-4 shrink-0" aria-hidden />
      <span className="flex-1">{workspace.name} requires two-step sign-in. Some of what you can do here is on hold until you set it up.</span>
      <Link to="/w/$workspaceId/security" params={{ workspaceId }} className="font-medium underline">
        Set it up
      </Link>
    </div>
  );
}
