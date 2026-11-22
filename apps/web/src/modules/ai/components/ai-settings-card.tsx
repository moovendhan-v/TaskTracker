import { SparklesIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { getErrorMessage } from '@/lib/errors';
import { useAiSettings, useUpdateAiSettings } from '../hooks/use-ai';

/**
 * Workspace settings → AI (E5): turn AI on and pick one of the providers the server is set up
 * with (Gemini, Cloudflare Workers AI or any OpenAI-compatible service). Keys stay on the
 * server; changes are audited.
 */
export function AiSettingsCard({ workspaceId }: { workspaceId: string }) {
  const settings = useAiSettings(workspaceId);
  const update = useUpdateAiSettings(workspaceId);
  const [draft, setDraft] = useState<{ enabled: boolean; providerId: string | null; model: string | null } | null>(null);
  const data = settings.data;
  if (!data) return null;
  const value = draft ?? { enabled: data.enabled, providerId: data.providerId ?? data.providers[0]?.id ?? null, model: data.model ?? data.providers[0]?.models[0] ?? null };
  const provider = data.providers.find((item) => item.id === value.providerId);
  const changed = draft !== null && (draft.enabled !== data.enabled || draft.providerId !== data.providerId || draft.model !== data.model);

  return (
    <Card role="region" aria-label="AI settings">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SparklesIcon className="size-4 text-muted-foreground" /> AI
        </CardTitle>
        <CardDescription>Summaries of tasks, docs and chats. Everyone sees only what they can already open; nothing is sent until someone asks.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {!data.available ? (
          <p className="text-sm text-muted-foreground">No AI provider is set up on this server yet. Your administrator adds one with the AI_PROVIDERS settings.</p>
        ) : (
          <>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={value.enabled} onCheckedChange={(checked) => setDraft({ ...value, enabled: checked === true })} aria-label="Turn on AI for this workspace" />
              Turn on AI for this workspace
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="ai-provider">Provider</Label>
                <Select value={value.providerId ?? ''} onValueChange={(providerId) => setDraft({ ...value, providerId, model: data.providers.find((item) => item.id === providerId)?.models[0] ?? null })}>
                  <SelectTrigger id="ai-provider" aria-label="AI provider">
                    <SelectValue placeholder="Pick a provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {data.providers.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ai-model">Model</Label>
                <Select value={value.model ?? ''} onValueChange={(model) => setDraft({ ...value, model })}>
                  <SelectTrigger id="ai-model" aria-label="AI model">
                    <SelectValue placeholder="Pick a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {(provider?.models ?? []).map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                disabled={!changed || update.isPending}
                onClick={() =>
                  update.mutate(value, {
                    onSuccess: (saved) => {
                      setDraft(null);
                      toast.success(saved.enabled ? `AI is on, using ${data.providers.find((item) => item.id === saved.providerId)?.label ?? saved.providerId}` : 'AI is off');
                    },
                    onError: (error) => toast.error(getErrorMessage(error)),
                  })
                }
              >
                Save
              </Button>
              <span className="text-xs text-muted-foreground">Each person can use {data.dailyTokens.toLocaleString()} tokens a day here. You've used {data.usedToday.toLocaleString()} today.</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
