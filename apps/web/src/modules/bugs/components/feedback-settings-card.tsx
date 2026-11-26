import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BugIntakeResponse } from '@taskflow/shared-types';
import { CopyIcon, MegaphoneIcon, RefreshCwIcon } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/sonner';
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';
import { intakeApi } from '../api/intake.api';

const copy = (text: string, what: string) => void navigator.clipboard.writeText(text).then(() => toast.success(`${what} copied`));

/**
 * Project settings → Feedback (E6.3): a feedback button for your own sites (one <script> tag) and
 * a hosted feedback portal for clients, both filing into this project.
 */
export function FeedbackSettingsCard({ workspaceId, spaceId, spaceName }: { workspaceId: string; spaceId: string; spaceName: string }) {
  const key = [...queryKeys.workspace(workspaceId), 'bug-intake', spaceId];
  const intake = useQuery({ queryKey: key, queryFn: () => intakeApi.get(workspaceId, spaceId) });
  if (intake.isLoading) return null;
  return <FeedbackForm key={intake.data?.updatedAt ?? 'new'} workspaceId={workspaceId} spaceId={spaceId} spaceName={spaceName} intake={intake.data ?? null} queryKey={key} />;
}

function FeedbackForm({ workspaceId, spaceId, spaceName, intake, queryKey }: { workspaceId: string; spaceId: string; spaceName: string; intake: BugIntakeResponse | null; queryKey: readonly unknown[] }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(intake?.title ?? `Feedback for ${spaceName}`);
  const [intro, setIntro] = useState(intake?.intro ?? '');
  const [sites, setSites] = useState((intake?.allowedOrigins ?? []).join('\n'));
  const [widget, setWidget] = useState(intake?.widgetEnabled ?? false);
  const [portal, setPortal] = useState(intake?.portalEnabled ?? false);
  const done = (saved: BugIntakeResponse) => queryClient.setQueryData(queryKey, saved);
  const save = useMutation({
    mutationFn: () => intakeApi.save(workspaceId, spaceId, { title, intro, allowedOrigins: sites.split(/[\s,]+/).filter(Boolean), widgetEnabled: widget, portalEnabled: portal }),
    onSuccess: (saved) => {
      done(saved);
      toast.success('Feedback settings saved');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const rotate = useMutation({ mutationFn: () => intakeApi.rotate(workspaceId, spaceId), onSuccess: done, onError: (error) => toast.error(getErrorMessage(error)) });

  const origin = window.location.origin;
  const snippet = intake ? `<script src="${origin}/embed/v1/feedback.js" data-key="${intake.publicKey}" async></script>` : '';
  const portalUrl = intake ? `${origin}/f/${intake.publicKey}` : '';

  return (
    <Card role="region" aria-label="Feedback settings">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MegaphoneIcon className="size-4 text-muted-foreground" /> Feedback from outside
        </CardTitle>
        <CardDescription>
          Let your users and clients report bugs and ideas straight into this project: a feedback button on your own website, and a feedback page you can send people to. Reports arrive as bug tasks (filed under your name, with the reporter’s), protected by CAPTCHA and rate limits.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="intake-title">Form title</Label>
          <Input id="intake-title" maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="intake-intro">Intro text (optional)</Label>
          <Textarea id="intake-intro" rows={2} maxLength={1000} value={intro} onChange={(event) => setIntro(event.target.value)} placeholder="Tell us what went wrong or what you’d like to see." />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={widget} onCheckedChange={(value) => setWidget(value === true)} className="mt-0.5" aria-label="Feedback button on my sites" />
          <span>
            <span className="font-medium">Feedback button on my sites</span>
            <span className="block text-xs text-muted-foreground">Captures the page’s errors and failed requests (passwords and tokens removed) and an optional screenshot.</span>
          </span>
        </label>
        {widget ? (
          <div className="grid gap-1.5 pl-6">
            <Label htmlFor="intake-sites">Sites allowed to show it (one per line)</Label>
            <Textarea id="intake-sites" rows={2} value={sites} onChange={(event) => setSites(event.target.value)} placeholder="https://www.example.com" className="font-mono text-xs" />
          </div>
        ) : null}
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={portal} onCheckedChange={(value) => setPortal(value === true)} className="mt-0.5" aria-label="Feedback page" />
          <span>
            <span className="font-medium">Feedback page</span>
            <span className="block text-xs text-muted-foreground">A page on TaskFlow anyone with the link can use. Reporters get a link to follow their report’s progress.</span>
          </span>
        </label>
        <div className="flex justify-end">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Save
          </Button>
        </div>

        {intake && (intake.widgetEnabled || intake.portalEnabled) ? (
          <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
            {intake.widgetEnabled ? (
              <div className="grid gap-1.5">
                <span className="font-medium">Add this to your site’s pages</span>
                <div className="flex items-start gap-2">
                  <code className="min-w-0 flex-1 rounded bg-background p-2 font-mono text-xs break-all" data-testid="embed-snippet">
                    {snippet}
                  </code>
                  <Button variant="outline" size="sm" onClick={() => copy(snippet, 'Snippet')}>
                    <CopyIcon className="mr-1 size-3.5" /> Copy
                  </Button>
                </div>
              </div>
            ) : null}
            {intake.portalEnabled ? (
              <div className="grid gap-1.5">
                <span className="font-medium">Feedback page</span>
                <div className="flex items-center gap-2">
                  <a href={portalUrl} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate font-mono text-xs text-primary hover:underline">
                    {portalUrl}
                  </a>
                  <Button variant="outline" size="sm" onClick={() => copy(portalUrl, 'Link')}>
                    <CopyIcon className="mr-1 size-3.5" /> Copy
                  </Button>
                </div>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="sm" className="text-muted-foreground">
                    <RefreshCwIcon className="mr-1 size-3.5" /> New key
                  </Button>
                }
                title="Replace the key?"
                description="The snippet on your sites and the feedback page link stop working until you update them."
                confirmLabel="Replace"
                onConfirm={() => rotate.mutateAsync()}
              />
              <span className="text-xs text-muted-foreground">If the key is abused: the old snippet and link stop working.</span>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
