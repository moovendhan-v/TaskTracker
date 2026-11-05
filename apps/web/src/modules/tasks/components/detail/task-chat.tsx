import { useQuery } from '@tanstack/react-query';
import { mentionsToNames } from '@taskflow/shared-types';
import { HashIcon, LockIcon, MessageCircleIcon } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { UserAvatar } from '@/components/common/user-avatar';
import { timeAgo } from '@/lib/relative-time';
import { useMemberName } from '@/modules/members';
import { taskChatApi } from '../../api/task-chat.api';

const taskChatKey = (workspaceId: string, taskId: string) => ['workspaces', workspaceId, 'chat', 'about-task', taskId] as const;

/** Messages you can read that mention this task (#N or a task card) or record its creation. */
export function useTaskChat(workspaceId: string, taskId: string, enabled: boolean) {
  return useQuery({
    queryKey: taskChatKey(workspaceId, taskId),
    queryFn: () => taskChatApi.about(workspaceId, taskId),
    enabled,
    staleTime: 30_000,
  });
}

/**
 * "Discussed in chat": where this task came up in channels you can read. Each one opens
 * the message in chat (its thread, for a reply). Read-only: the conversation stays in chat.
 */
export function TaskChat({ workspaceId, taskId, number }: { workspaceId: string; taskId: string; number: number }) {
  const { data: hits = [], isLoading } = useTaskChat(workspaceId, taskId, true);
  const nameOf = useMemberName(workspaceId);
  if (isLoading) return <p className="text-sm text-muted-foreground">Looking in chat…</p>;
  if (hits.length === 0) return <p className="text-sm text-muted-foreground">Nobody has mentioned this task in a channel you can read. Write #{number} in chat to link it here.</p>;
  return (
    <ul aria-label="Chat messages about this task" className="grid gap-1">
      {hits.map((hit) => {
        const plain = mentionsToNames(hit.message.body, nameOf).replace(/[*_`>~]/g, '').replace(/\s+/g, ' ');
        const where = hit.channelKind === 'dm' ? 'Direct message' : (hit.channelName ?? 'channel');
        const Icon = hit.channelKind === 'dm' ? MessageCircleIcon : hit.channelKind === 'private' ? LockIcon : HashIcon;
        return (
          <li key={hit.message.id}>
            <Link to="/w/$workspaceId/chat/m/$messageId" params={{ workspaceId, messageId: hit.message.id }} className="flex gap-3 rounded-lg px-2 py-2 hover:bg-muted/60">
              <UserAvatar name={hit.message.authorName ?? '?'} className="size-7 shrink-0 text-[10px]" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{hit.message.kind === 'system' ? 'TaskFlow' : (hit.message.authorName ?? 'Former member')}</span>
                  <span aria-hidden>·</span>
                  <Icon aria-hidden className="size-3" />
                  <span>{where}</span>
                  {hit.message.parentId ? <span className="text-subtle-foreground">· in a thread</span> : null}
                  <span className="ml-auto font-mono text-[11px] text-subtle-foreground">{timeAgo(hit.message.createdAt)}</span>
                </span>
                <span className="mt-0.5 line-clamp-2 block text-sm">{plain}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
