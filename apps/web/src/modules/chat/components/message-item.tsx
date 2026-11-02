import type { ChatMessageResponse } from '@taskflow/shared-types';
import { CheckSquareIcon, LinkIcon, MessageSquareTextIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import type { ReactNode } from 'react';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { UserAvatar } from '@/components/common/user-avatar';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import { MarkdownPreview, useDocWorkspace } from '@/modules/documents';
import { useMemberName } from '@/modules/members';
import { timeAgo } from '@/lib/relative-time';
import { timeOfDay } from '../lib/chat-display';
import { tokensToNames } from '../lib/chat-mentions';
import { Composer } from './composer';

interface MessageItemProps {
  message: ChatMessageResponse;
  head: boolean;
  mine: boolean;
  editing: boolean;
  onEditing: (editing: boolean) => void;
  onSaveEdit: (body: string) => Promise<unknown>;
  onDelete: () => void;
  onReply?: () => void;
  onCreateTask?: () => void;
  onCopyLink: () => void;
}

function Action({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <Tooltip label={label} side="top">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&_svg]:size-3.5"
      >
        {children}
      </button>
    </Tooltip>
  );
}

/** One message. Hover or focus shows its actions; the thread summary sits under roots with replies. */
export function MessageItem({ message, head, mine, editing, onEditing, onSaveEdit, onDelete, onReply, onCreateTask, onCopyLink }: MessageItemProps) {
  if (message.kind === 'system') {
    return (
      <div className="flex items-center gap-2 py-1 pl-[52px] text-[13px] text-muted-foreground">
        <CheckSquareIcon aria-hidden className="size-3.5" />
        <span className="font-medium text-foreground">{message.authorName ?? 'Someone'}</span>
        <MarkdownPreview content={message.body} className="gap-0 [&_p]:m-0" />
        <span className="font-mono text-[11px] text-subtle-foreground">{timeOfDay(message.createdAt)}</span>
      </div>
    );
  }

  return (
    <article
      aria-label={`${message.authorName ?? 'Someone'} at ${timeOfDay(message.createdAt)}`}
      data-message-id={message.id}
      className={cn('group/message relative flex gap-3 rounded-lg px-2 hover:bg-muted/40 focus-within:bg-muted/40', head ? 'mt-2 pt-1.5 pb-1' : 'py-0.5')}
    >
      <div className="w-9 shrink-0">
        {head ? (
          <UserAvatar name={message.authorName ?? '?'} className="size-9 text-xs" />
        ) : (
          <span className="block pt-1 text-right font-mono text-[10px] text-subtle-foreground opacity-0 group-hover/message:opacity-100">{timeOfDay(message.createdAt)}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {head ? (
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">{message.authorName ?? 'Former member'}</span>
            <time dateTime={message.createdAt} className="font-mono text-[11px] text-subtle-foreground">
              {timeOfDay(message.createdAt)}
            </time>
          </div>
        ) : null}
        {message.deleted ? (
          <p className="text-sm text-subtle-foreground italic">Message deleted</p>
        ) : editing ? (
          <div className="py-1">
            <EditBox initial={message.body} onCancel={() => onEditing(false)} onSave={onSaveEdit} />
          </div>
        ) : (
          <div className="text-sm leading-relaxed">
            <MarkdownPreview content={message.body} className="gap-1.5 text-sm [&_li]:my-0 [&_ol]:my-0.5 [&_p]:m-0 [&_pre]:my-1 [&_ul]:my-0.5" />
            {message.editedAt ? <span className="text-[11px] text-subtle-foreground">(edited)</span> : null}
          </div>
        )}
        {message.replyCount > 0 && onReply ? (
          <button
            type="button"
            onClick={onReply}
            className="mt-1 flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium text-ring hover:bg-primary-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <MessageSquareTextIcon aria-hidden className="size-3.5" />
            {message.replyCount} {message.replyCount === 1 ? 'reply' : 'replies'}
            {message.lastReplyAt ? <span className="font-normal text-subtle-foreground">· {timeAgo(message.lastReplyAt)}</span> : null}
          </button>
        ) : null}
      </div>
      {!message.deleted && !editing ? (
        <div
          role="toolbar"
          aria-label="Message actions"
          className="absolute -top-3 right-2 hidden items-center gap-0.5 rounded-lg border bg-card p-0.5 shadow-popover group-hover/message:flex group-focus-within/message:flex"
        >
          {onReply ? (
            <Action label="Reply in thread" onClick={onReply}>
              <MessageSquareTextIcon />
            </Action>
          ) : null}
          {onCreateTask ? (
            <Action label="Create task" onClick={onCreateTask}>
              <CheckSquareIcon />
            </Action>
          ) : null}
          <Action label="Copy link" onClick={onCopyLink}>
            <LinkIcon />
          </Action>
          {mine ? (
            <>
              <Action label="Edit" onClick={() => onEditing(true)}>
                <PencilIcon />
              </Action>
              <ConfirmDialog
                title="Delete this message?"
                description="It will show as “Message deleted”. Replies stay."
                confirmLabel="Delete"
                onConfirm={onDelete}
                trigger={
                  <button
                    type="button"
                    aria-label="Delete"
                    className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&_svg]:size-3.5"
                  >
                    <Trash2Icon />
                  </button>
                }
              />
            </>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function EditBox({ initial, onCancel, onSave }: { initial: string; onCancel: () => void; onSave: (body: string) => Promise<unknown> }) {
  const workspaceId = useDocWorkspace();
  const nameOf = useMemberName(workspaceId ?? '');
  const seeded = tokensToNames(initial, nameOf);
  return (
    <div
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      <Composer placeholder="Edit message" onSend={onSave} autoFocus initialValue={seeded.text} initialPeople={seeded.people} />
      <p className="mt-1 text-[11px] text-subtle-foreground">Esc to cancel · ↵ to save</p>
    </div>
  );
}
