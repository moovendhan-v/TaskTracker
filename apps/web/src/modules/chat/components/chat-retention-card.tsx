import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CHAT_RETENTION_DAYS } from '@taskflow/shared-types';
import { MessagesSquareIcon } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/sonner';
import { getErrorMessage } from '@/lib/errors';
import { chatApi } from '../api/chat.api';
import { chatKeys, useChatRetention } from '../hooks/use-chat';

/** "Keep chat for 90 days" reads better than a number of days for the longer ones. */
export function retentionLabel(days: number | null): string {
  if (days === null) return 'Forever';
  if (days === 365) return '1 year';
  if (days === 730) return '2 years';
  return `${days} days`;
}

/**
 * Workspace settings → Chat history: how long chat is kept. Shortening it removes old
 * threads for everyone within the hour, so it asks first. Changes are audited.
 */
export function ChatRetentionCard({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const { data: days = null, isLoading } = useChatRetention(workspaceId);
  const [picked, setPicked] = useState<string | null>(null);
  const value = picked ?? (days === null ? 'forever' : String(days));
  const next = value === 'forever' ? null : Number(value);
  const save = useMutation({
    mutationFn: () => chatApi.setRetention(workspaceId, next),
    onSuccess: (saved) => {
      queryClient.setQueryData(chatKeys.retention(workspaceId), saved);
      setPicked(null);
      toast.success(saved === null ? 'Chat is kept forever' : `Chat is kept for ${retentionLabel(saved).toLowerCase()}`);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const changed = !isLoading && next !== days;
  // Only a shorter (or first) limit deletes anything.
  const deletes = next !== null && (days === null || next < days);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessagesSquareIcon className="size-4 text-muted-foreground" /> Chat history
        </CardTitle>
        <CardDescription>How long messages, threads and their files are kept. A thread goes once its last message is older than this.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="chat-retention">Keep chat for</Label>
          <select
            id="chat-retention"
            value={value}
            disabled={isLoading || save.isPending}
            onChange={(event) => setPicked(event.target.value)}
            className="h-9 rounded-md border bg-background px-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <option value="forever">Forever</option>
            {CHAT_RETENTION_DAYS.map((option) => (
              <option key={option} value={String(option)}>
                {retentionLabel(option)}
              </option>
            ))}
          </select>
        </div>
        {changed && deletes ? (
          <ConfirmDialog
            trigger={<Button disabled={save.isPending}>Save</Button>}
            title={`Keep chat for ${retentionLabel(next).toLowerCase()}?`}
            description="Threads with no message in that time are deleted for everyone, with their files, within the hour. This can't be undone."
            confirmLabel="Delete older chat"
            onConfirm={() => save.mutateAsync()}
          />
        ) : (
          <Button disabled={!changed || save.isPending} onClick={() => save.mutate()}>
            Save
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
