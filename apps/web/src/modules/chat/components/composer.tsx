import { CHAT_ATTACHMENTS_PER_MESSAGE, CHAT_MESSAGE_MAX, CHAT_TYPING_EVERY_MS, CHAT_UPLOAD_MAX_BYTES, type ChatAttachmentResponse } from '@taskflow/shared-types';
import { ArrowUpIcon, FileIcon, PaperclipIcon, XIcon } from 'lucide-react';
import { useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent } from 'react';
import { UserAvatar } from '@/components/common/user-avatar';
import { cn } from '@/lib/cn';
import { TaskMentionTextarea, useDocWorkspace } from '@/modules/documents';
import { useMembers } from '@/modules/members';
import { notify } from '@/components/kit/notify';
import { formatBytes, UPLOAD_ACCEPT } from '@/lib/upload';
import { discardChatFile, uploadChatFile } from '../api/chat.api';
import { namesToTokens, personAt, type Person } from '@/lib/mentions';

interface ComposerProps {
  placeholder: string;
  /** Gets the body with mentions as tokens, and any attached files. Resolves when sent; the draft clears only then, so nothing is lost on an error. */
  onSend: (body: string, attachmentIds: string[]) => Promise<unknown>;
  /** Lets people attach files to this channel. */
  uploadChannelId?: string;
  /** ↑ in an empty composer: edit your last message. */
  onEditLast?: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Starts with this text and these mentioned people, e.g. when editing a message. */
  initialValue?: string;
  initialPeople?: Person[];
  /** Called while you type (at most every few seconds), to tell others. */
  onTyping?: () => void;
}

/** Enter sends, Shift+Enter adds a line, `#` suggests tasks and `@` suggests people. */
export function Composer({ placeholder, onSend, onEditLast, disabled, autoFocus, initialValue = '', initialPeople = [], onTyping, uploadChannelId }: ComposerProps) {
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const lastTyping = useRef(0);
  const workspaceId = useDocWorkspace();
  const { data: members = [] } = useMembers(workspaceId ?? '');
  const field = useRef<HTMLTextAreaElement | null>(null);
  const [draft, setDraft] = useState(initialValue);
  const [people, setPeople] = useState<Person[]>(initialPeople);
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const length = draft.trim().length;
  const tooLong = length > CHAT_MESSAGE_MAX;
  const ready = files.filter((file) => file.attachment).map((file) => file.attachment!.id);
  const uploading = files.some((file) => !file.attachment);
  const canSend = (length > 0 || ready.length > 0) && !tooLong && !busy && !uploading;

  const addFiles = (list: FileList | File[]) => {
    if (!uploadChannelId || !workspaceId) return;
    const room = CHAT_ATTACHMENTS_PER_MESSAGE - files.length;
    const chosen = [...list].slice(0, Math.max(0, room));
    if (list.length > room) notify.info(`Up to ${CHAT_ATTACHMENTS_PER_MESSAGE} files per message`);
    for (const file of chosen) {
      if (file.size > CHAT_UPLOAD_MAX_BYTES) {
        notify.info(`${file.name} is over 10 MB`);
        continue;
      }
      const key = `${file.name}-${file.size}-${Math.random()}`;
      const controller = new AbortController();
      setFiles((current) => [...current, { key, name: file.name, size: file.size, progress: 0, controller }]);
      const update = (patch: Partial<PendingFile>) => setFiles((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
      uploadChatFile(workspaceId, uploadChannelId, file, (progress) => update({ progress }), controller.signal).then(
        (attachment) => update({ attachment, progress: 1 }),
        (error: unknown) => {
          setFiles((current) => current.filter((item) => item.key !== key));
          if (!(error instanceof DOMException && error.name === 'AbortError')) notify.error(error);
        },
      );
    }
  };

  const removeFile = (file: PendingFile) => {
    setFiles((current) => current.filter((item) => item.key !== file.key));
    if (file.attachment && workspaceId) void discardChatFile(workspaceId, file.attachment.id).catch(() => undefined);
    else file.controller.abort();
  };

  const paste = (event: ClipboardEvent) => {
    if (!uploadChannelId || event.clipboardData.files.length === 0) return;
    event.preventDefault();
    addFiles(event.clipboardData.files);
  };
  const drop = (event: DragEvent) => {
    if (!uploadChannelId) return;
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  };

  const query = mention?.query.toLowerCase() ?? '';
  const options = mention ? members.filter((member) => member.name.toLowerCase().includes(query)).slice(0, 6) : [];

  const change = (value: string) => {
    setDraft(value);
    if (onTyping && value.trim() && Date.now() - lastTyping.current > CHAT_TYPING_EVERY_MS) {
      lastTyping.current = Date.now();
      onTyping();
    }
    setMention(personAt(value, field.current?.selectionStart ?? value.length));
    setIndex(0);
  };

  const pick = (person: Person) => {
    const element = field.current;
    if (!mention || !element) return;
    const caret = element.selectionStart ?? draft.length;
    const next = `${draft.slice(0, mention.start)}@${person.name} ${draft.slice(caret)}`;
    setDraft(next);
    setPeople((current) => (current.some((item) => item.id === person.id) ? current : [...current, person]));
    setMention(null);
    const position = mention.start + person.name.length + 2;
    requestAnimationFrame(() => element.setSelectionRange(position, position));
  };

  const send = async () => {
    if (!canSend) return;
    setBusy(true);
    try {
      await onSend(namesToTokens(draft.trim(), people), ready);
      setDraft('');
      setPeople([]);
      setFiles([]);
    } finally {
      setBusy(false);
    }
  };

  const keys = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (options.length) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setIndex((current) => (current + (event.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        const member = options[index]!;
        pick({ id: member.userId, name: member.name });
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setMention(null);
        return;
      }
    }
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    } else if (event.key === 'ArrowUp' && draft === '' && onEditLast) {
      event.preventDefault();
      onEditLast();
    }
  };

  return (
    <div
      onDragOver={(event) => {
        if (!uploadChannelId || !event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={drop}
      onPaste={paste}
      className={cn(
        'relative rounded-xl border bg-card shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-primary-soft',
        disabled && 'opacity-60',
        dragging && 'border-dashed border-ring bg-primary-soft/40',
      )}
    >
      {files.length ? (
        <ul aria-label="Files to send" className="flex flex-wrap gap-1.5 px-2 pt-2">
          {files.map((file) => (
            <li key={file.key} className="relative flex h-9 max-w-56 items-center gap-2 overflow-hidden rounded-lg border bg-background pr-1 pl-2 text-xs">
              <FileIcon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 truncate">{file.name}</span>
              <span className="shrink-0 font-mono text-[10.5px] text-subtle-foreground">{file.attachment ? formatBytes(file.size) : `${Math.round(file.progress * 100)}%`}</span>
              <button type="button" aria-label={`Remove ${file.name}`} onClick={() => removeFile(file)} className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                <XIcon className="size-3" />
              </button>
              {!file.attachment ? <span aria-hidden className="absolute bottom-0 left-0 h-0.5 bg-ring transition-[width]" style={{ width: `${file.progress * 100}%` }} /> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {options.length ? (
        <ul role="listbox" aria-label="People" className="absolute bottom-full left-2 z-30 mb-1 w-72 overflow-hidden rounded-lg border bg-popover p-1 text-sm shadow-popover">
          {options.map((member, position) => (
            <li
              key={member.userId}
              role="option"
              aria-selected={position === index}
              onMouseDown={(event) => {
                event.preventDefault();
                pick({ id: member.userId, name: member.name });
              }}
              className={cn('flex cursor-default items-center gap-2 rounded-md px-2 py-1.5', position === index && 'bg-selected')}
            >
              <UserAvatar name={member.name} className="size-5 text-[9px]" />
              <span className="truncate">{member.name}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <TaskMentionTextarea
        ref={field}
        value={draft}
        onValueChange={change}
        onKeyDown={keys}
        onBlur={() => setTimeout(() => setMention(null), 150)}
        disabled={disabled}
        autoFocus={autoFocus}
        suggestionsAbove
        rows={1}
        placeholder={placeholder}
        aria-label={placeholder}
        className="field-sizing-content max-h-48 min-h-10 w-full resize-none bg-transparent px-3 pt-2.5 text-sm outline-none placeholder:text-subtle-foreground"
      />
      <div className="flex items-center gap-2 px-2 pb-2">
        {uploadChannelId ? (
          <>
            <input
              ref={picker}
              type="file"
              multiple
              hidden
              accept={UPLOAD_ACCEPT}
              onChange={(event) => {
                if (event.target.files) addFiles(event.target.files);
                event.target.value = '';
              }}
            />
            <button
              type="button"
              aria-label="Attach files"
              onClick={() => picker.current?.click()}
              disabled={disabled || files.length >= CHAT_ATTACHMENTS_PER_MESSAGE}
              className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-40"
            >
              <PaperclipIcon className="size-4" />
            </button>
          </>
        ) : null}
        <span className="font-mono text-[11px] text-subtle-foreground">
          <kbd>↵</kbd> send · <kbd>⇧↵</kbd> newline · <kbd>@</kbd> person · <kbd>#</kbd> task
        </span>
        <span className="flex-1" />
        {length > CHAT_MESSAGE_MAX - 400 ? (
          <span className={cn('font-mono text-[11px]', tooLong ? 'text-destructive' : 'text-subtle-foreground')}>{CHAT_MESSAGE_MAX - length}</span>
        ) : null}
        <button
          type="button"
          aria-label="Send"
          onClick={() => void send()}
          disabled={!canSend || disabled}
          className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-40"
        >
          <ArrowUpIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}

interface PendingFile {
  key: string;
  name: string;
  size: number;
  progress: number;
  controller: AbortController;
  attachment?: ChatAttachmentResponse;
}
