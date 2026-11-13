import { CHAT_REACTIONS, type ChatAttachmentResponse, type ChatMessageResponse, type ChatReactionSummary } from '@taskflow/shared-types';
import { CheckSquareIcon, DownloadIcon, FileTextIcon, LinkIcon, MessageSquareTextIcon, PencilIcon, SmilePlusIcon, Trash2Icon } from 'lucide-react';
import type { ReactNode } from 'react';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { UserAvatar } from '@/components/common/user-avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import { MarkdownPreview, useDocWorkspace } from '@/modules/documents';
import { useMemberName } from '@/modules/members';
import { timeAgo } from '@/lib/relative-time';
import { timeOfDay } from '../lib/chat-display';
import { tokensToNames } from '../lib/chat-mentions';
import { formatBytes } from '@/lib/upload';
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
  /** Adds or removes your reaction; absent when you can't react (e.g. archived). */
  onReact?: (emoji: string) => void;
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
export function MessageItem({ message, head, mine, editing, onEditing, onSaveEdit, onDelete, onReply, onCreateTask, onCopyLink, onReact }: MessageItemProps) {
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
            {message.body ? <MarkdownPreview content={message.body} className="gap-1.5 text-sm [&_li]:my-0 [&_ol]:my-0.5 [&_p]:m-0 [&_pre]:my-1 [&_ul]:my-0.5" /> : null}
            {message.editedAt ? <span className="text-[11px] text-subtle-foreground">(edited)</span> : null}
          </div>
        )}
        {!message.deleted && message.attachments.length ? <Attachments files={message.attachments} /> : null}
        {!message.deleted && message.reactions.length ? <Reactions reactions={message.reactions} onReact={onReact} /> : null}
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
          {onReact ? <ReactionPicker onPick={onReact} /> : null}
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

function Reactions({ reactions, onReact }: { reactions: ChatReactionSummary[]; onReact?: (emoji: string) => void }) {
  return (
    <ul aria-label="Reactions" className="mt-1 flex flex-wrap gap-1">
      {reactions.map((reaction) => {
        const who = reaction.names.join(', ') + (reaction.count > reaction.names.length ? ` and ${reaction.count - reaction.names.length} more` : '');
        return (
          <li key={reaction.emoji}>
            <Tooltip label={`${who} reacted with ${reaction.emoji}`} side="top">
              <button
                type="button"
                disabled={!onReact}
                aria-pressed={reaction.mine}
                aria-label={`${reaction.emoji} ${reaction.count}${reaction.mine ? ', including you' : ''}`}
                onClick={() => onReact?.(reaction.emoji)}
                className={cn(
                  'flex h-6 items-center gap-1 rounded-full border px-2 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  reaction.mine ? 'border-ring/60 bg-primary-soft text-foreground' : 'bg-card text-muted-foreground hover:border-border-strong',
                )}
              >
                <span aria-hidden>{reaction.emoji}</span>
                <span className="font-mono text-[11px]">{reaction.count}</span>
              </button>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
}

function ReactionPicker({ onPick }: { onPick: (emoji: string) => void }) {
  return (
    <Popover>
      <Tooltip label="Add reaction" side="top">
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Add reaction"
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&_svg]:size-3.5"
          >
            <SmilePlusIcon />
          </button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent align="end" className="w-auto p-1">
        <div role="group" aria-label="Reactions to add" className="grid grid-cols-6 gap-0.5">
          {CHAT_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={`React with ${emoji}`}
              onClick={() => onPick(emoji)}
              className="grid size-8 place-items-center rounded-md text-lg hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Images as thumbnails (open full size in a new tab), other files as download cards. Links are short-lived and same-origin. */
function Attachments({ files }: { files: ChatAttachmentResponse[] }) {
  const images = files.filter((file) => file.isImage);
  const others = files.filter((file) => !file.isImage);
  return (
    <div className="mt-1.5 grid gap-1.5">
      {images.length ? (
        <ul aria-label="Images" className="flex flex-wrap gap-1.5">
          {images.map((file) => (
            <li key={file.id}>
              <a href={file.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                <img src={file.thumbnailUrl ?? file.url} alt={file.fileName} loading="lazy" className="max-h-60 max-w-80 object-contain" />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {others.length ? (
        <ul aria-label="Files" className="flex flex-wrap gap-1.5">
          {others.map((file) => (
            <li key={file.id}>
              <a
                href={file.url}
                download={file.fileName}
                className="flex h-12 max-w-72 items-center gap-2.5 rounded-lg border bg-card px-3 text-sm hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <FileTextIcon aria-hidden className="size-5 shrink-0 text-ring" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{file.fileName}</span>
                  <span className="block font-mono text-[11px] text-subtle-foreground">{formatBytes(file.size)}</span>
                </span>
                <DownloadIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
