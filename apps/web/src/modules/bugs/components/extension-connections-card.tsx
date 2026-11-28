import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DownloadIcon, PuzzleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/sonner';
import { getErrorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';
import { timeAgo } from '@/lib/relative-time';
import { extensionApi } from '../api/extension.api';

type Browser = 'chrome' | 'edge' | 'firefox' | 'safari' | 'other';

/** Which browser this is, for the right download and install steps. */
export function detectBrowser(userAgent: string): Browser {
  if (/Firefox\/|FxiOS\//.test(userAgent)) return 'firefox';
  if (/Edg\//.test(userAgent)) return 'edge';
  if (/Chrome\/|Chromium\/|CriOS\//.test(userAgent)) return 'chrome';
  if (/Safari\//.test(userAgent)) return 'safari';
  return 'other';
}

const INSTALL: Record<'chrome' | 'edge' | 'firefox', { name: string; steps: string[] }> = {
  chrome: { name: 'Chrome', steps: ['Unzip the download', 'Open chrome://extensions and turn on Developer mode', 'Click “Load unpacked” and pick the unzipped folder'] },
  edge: { name: 'Edge', steps: ['Unzip the download', 'Open edge://extensions and turn on Developer mode', 'Click “Load unpacked” and pick the unzipped folder'] },
  firefox: { name: 'Firefox', steps: ['Open about:debugging#/runtime/this-firefox', 'Click “Load Temporary Add-on…” and pick the downloaded zip', 'For a permanent install, your admin signs it on addons.mozilla.org'] },
};

/** Download the latest extension for this browser (the other one too), with how to install it. */
function ExtensionDownload() {
  const browser = detectBrowser(navigator.userAgent);
  const latest = useQuery({
    queryKey: ['extension-latest'],
    queryFn: async () => {
      const response = await fetch('/downloads/extension/latest.json', { credentials: 'omit' });
      if (!response.ok) throw new Error('No extension build on this server');
      return (await response.json()) as { version: string };
    },
    staleTime: 10 * 60_000,
    retry: false,
  });
  const primary = browser === 'firefox' ? 'firefox' : browser === 'edge' ? 'edge' : 'chrome';
  const install = INSTALL[primary];
  if (latest.isError) return <p className="text-sm text-muted-foreground">The extension isn’t available for download on this server.</p>;
  return (
    <div className="grid gap-2 rounded-lg border bg-muted/30 p-3" data-testid="extension-download">
      {browser === 'safari' || browser === 'other' ? <p className="text-xs text-muted-foreground">The extension works in Chrome, Edge and Firefox.</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="sm">
          <a href={`/downloads/extension/latest?browser=${primary === 'firefox' ? 'firefox' : 'chrome'}`} download>
            <DownloadIcon className="mr-1 size-4" /> Download for {install.name}
          </a>
        </Button>
        <a href={`/downloads/extension/latest?browser=${primary === 'firefox' ? 'chrome' : 'firefox'}`} download className="text-xs text-primary hover:underline">
          {primary === 'firefox' ? 'Chrome or Edge instead' : 'Firefox instead'}
        </a>
        {latest.data ? <span className="ml-auto text-xs text-muted-foreground">Version {latest.data.version}</span> : null}
      </div>
      <ol className="list-decimal pl-5 text-xs text-muted-foreground">
        {install.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </div>
  );
}

/** Security → your connected browser extensions in this workspace, with Disconnect. */
export function ExtensionConnectionsCard({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const key = [...queryKeys.workspace(workspaceId), 'api-tokens'];
  const tokens = useQuery({ queryKey: key, queryFn: () => extensionApi.list(workspaceId), select: (all) => all.filter((token) => token.client === 'extension') });
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
      <CardContent className="grid gap-4">
        <ExtensionDownload />
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
