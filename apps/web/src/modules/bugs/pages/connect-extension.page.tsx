import { useMutation } from '@tanstack/react-query';
import { CheckCircle2Icon, PuzzleIcon, ShieldCheckIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getErrorMessage } from '@/lib/errors';
import { useWorkspaces } from '@/modules/workspaces';
import { extensionApi } from '../api/extension.api';

const CHALLENGE = /^[A-Za-z0-9_-]{43}$/;

/**
 * Where the TaskFlow browser extension sends you to connect. You pick the workspace and allow it;
 * the extension (which holds the secret half of the link) then picks up its own token. Nothing
 * secret is in this page's address, so a copied or leaked link can't connect anyone.
 */
export function ConnectExtensionPage({ challenge, name }: { challenge: string | undefined; name: string | undefined }) {
  const workspaces = useWorkspaces();
  const [picked, setPicked] = useState<string | null>(null);
  const workspaceId = picked ?? workspaces.data?.[0]?.id ?? null;
  const label = (name ?? '').replace(/[^\p{L}\p{N} ._()-]/gu, '').trim().slice(0, 60) || 'Browser extension';
  const approve = useMutation({ mutationFn: () => extensionApi.approve(workspaceId!, challenge!, label) });

  const valid = Boolean(challenge && CHALLENGE.test(challenge));

  return (
    <div className="mx-auto grid max-w-lg gap-4 px-4 py-12">
      <Card role="region" aria-label="Connect the browser extension">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PuzzleIcon className="size-5 text-primary" /> Connect the TaskFlow extension
          </CardTitle>
          <CardDescription>
            “{label}” wants to file bug reports as you. It can file reports and read them back (to warn about duplicates) in the workspace you pick, and only in projects your role allows.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {!valid ? (
            <p className="text-sm text-critical">This link is incomplete. Open the extension and press “Connect” again.</p>
          ) : approve.isSuccess ? (
            <div className="grid gap-2 text-sm" role="status">
              <p className="flex items-center gap-2 font-medium text-good">
                <CheckCircle2Icon className="size-5" /> Connected
              </p>
              <p className="text-muted-foreground">Go back to the extension: it finishes on its own within a few seconds. You can close this tab.</p>
            </div>
          ) : (
            <>
              <label className="grid gap-1.5 text-sm font-medium">
                Workspace
                <Select value={workspaceId ?? undefined} onValueChange={setPicked}>
                  <SelectTrigger aria-label="Workspace">
                    <SelectValue placeholder="Pick a workspace" />
                  </SelectTrigger>
                  <SelectContent>
                    {(workspaces.data ?? []).map((workspace) => (
                      <SelectItem key={workspace.id} value={workspace.id}>
                        {workspace.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <ul className="grid gap-1 text-xs text-muted-foreground">
                <li className="flex gap-2">
                  <ShieldCheckIcon className="size-3.5 shrink-0 text-good" /> Expires in 90 days; disconnect it any time under Security.
                </li>
                <li className="flex gap-2">
                  <ShieldCheckIcon className="size-3.5 shrink-0 text-good" /> Can’t change settings, members or other tasks.
                </li>
              </ul>
              {approve.isError ? <p className="text-sm text-critical">{getErrorMessage(approve.error)}</p> : null}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => window.close()}>
                  Cancel
                </Button>
                <Button onClick={() => approve.mutate()} disabled={!workspaceId || approve.isPending}>
                  Allow
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
