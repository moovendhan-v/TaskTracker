import { MessageSquareIcon, TrashIcon } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { COMMENT_BODY_MAX } from '@taskflow/shared-types';
import { UserAvatar } from '@/components/common/user-avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUser } from '@/core/auth/use-current-user';
import { formatLongDate } from '@/lib/dates';
import { usePermissions } from '@/modules/workspaces';
import { useCommentMutations, useComments } from '../hooks/use-comments';

interface CommentThreadProps {
  workspaceId: string;
  taskId: string;
}

/** Comments are plain text and rendered as text (whitespace-pre-wrap), so no HTML from users reaches the DOM. */
export function CommentThread({ workspaceId, taskId }: CommentThreadProps) {
  const [draft, setDraft] = useState('');
  const { data: comments = [] } = useComments(workspaceId, taskId);
  const { data: me } = useCurrentUser();
  const { can } = usePermissions(workspaceId);
  const mutations = useCommentMutations(workspaceId, taskId);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    mutations.create.mutate(draft, { onSuccess: () => setDraft('') });
  }

  return (
    <section className="grid gap-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <MessageSquareIcon className="size-4 text-muted-foreground" /> Comments
        <span className="text-xs font-normal text-muted-foreground">{comments.length}</span>
      </h3>
      <ol className="grid gap-3">
        {comments.map((comment) => (
          <li key={comment.id} className="group flex gap-3">
            <UserAvatar name={comment.authorName} className="size-7" />
            <div className="min-w-0 flex-1 rounded-lg bg-muted/60 px-3 py-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold">{comment.authorName}</span>
                <span className="text-muted-foreground">{formatLongDate(comment.createdAt)}</span>
                <span className="flex-1" />
                {comment.authorId === me?.id || can('task.delete') ? (
                  <button
                    type="button"
                    onClick={() => mutations.remove.mutate(comment.id)}
                    className="text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
                    aria-label="Delete comment"
                  >
                    <TrashIcon className="size-3.5" />
                  </button>
                ) : null}
              </div>
              <p className="mt-1 text-sm break-words whitespace-pre-wrap">{comment.body}</p>
            </div>
          </li>
        ))}
      </ol>
      {can('task.update') ? (
        <form onSubmit={submit} className="grid gap-2">
          <Textarea
            value={draft}
            maxLength={COMMENT_BODY_MAX}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Write a comment…"
            aria-label="New comment"
            rows={3}
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={!draft.trim() || mutations.create.isPending}>
              Comment
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
