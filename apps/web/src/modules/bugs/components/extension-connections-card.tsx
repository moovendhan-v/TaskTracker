import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PuzzleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/sonner';
import { getErrorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';
import { timeAgo } from '@/lib/relative-time';
import { extensionApi } from '../api/extension.api';

/** Security → your connected browser extensions in this workspace, with Disconnect. */
export function ExtensionConnectionsCard({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const key = [...queryKeys.workspace(workspaceId), 'api-tokens'];
  const tokens = useQuery({ queryKey: key, queryFn: () => extensionApi.list(workspaceId) });
  const revoke = useMutation({
    mutationFn: (tokenId: string) => extensionApi.revoke(workspaceId, tokenId),
    onSuccess: () => {
      toast.success('Disconnected');
      void queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <Card role="region" aria-label="Browser extension">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PuzzleIcon className="size-4 text-muted-foreground" /> Browser extension
        </CardTitle>
        <CardDescription>
          Report bugs from any website with a screenshot, a recording and the page’s console and network. Install the TaskFlow extension (Chrome or Firefox), press Connect in it, and allow it here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {tokens.data?.length ? (
          <ul aria-label="Connected extensions" className="divide-y rounded-lg border">
            {tokens.data.map((token) => (
              <li key={token.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{token.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {token.pending ? 'Waiting for the extension…' : `${token.prefix ?? ''}… · ${token.lastUsedAt ? `used ${timeAgo(token.lastUsedAt)}` : 'not used yet'}`} · expires {new Date(token.expiresAt).toLocaleDateString()}
                  </span>
                </span>
                <Button variant="outline" size="sm" disabled={revoke.isPending} onClick={() => revoke.mutate(token.id)}>
                  Disconnect
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No extension is connected to this workspace.</p>
        )}
      </CardContent>
    </Card>
  );
}
