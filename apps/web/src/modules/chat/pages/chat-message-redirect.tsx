import { useNavigate } from '@tanstack/react-router';
import { MessagesSquareIcon } from 'lucide-react';
import { useEffect } from 'react';
import { EmptyState } from '@/components/common/empty-state';
import { useChatMessage } from '../hooks/use-chat';

/** `/chat/m/<messageId>` (links from the inbox): opens the message's channel, with its thread when it has one. */
export function ChatMessageRedirect({ workspaceId, messageId }: { workspaceId: string; messageId: string }) {
  const navigate = useNavigate();
  const { data, isError } = useChatMessage(workspaceId, messageId);
  useEffect(() => {
    if (!data) return;
    void navigate({
      to: '/w/$workspaceId/chat/$channelId',
      params: { workspaceId, channelId: data.channelId },
      search: { thread: data.parentId ?? (data.replyCount > 0 ? data.id : undefined) },
      replace: true,
    });
  }, [data, navigate, workspaceId]);
  if (!isError) return null;
  return (
    <div className="grid flex-1 place-items-center">
      <EmptyState icon={<MessagesSquareIcon />} title="Message not available" description="It may have been in a channel you've left." />
    </div>
  );
}
