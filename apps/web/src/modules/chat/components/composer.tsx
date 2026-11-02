import { CHAT_MESSAGE_MAX, CHAT_TYPING_EVERY_MS } from '@taskflow/shared-types';
import { ArrowUpIcon } from 'lucide-react';
import { useRef, useState, type KeyboardEvent } from 'react';
import { UserAvatar } from '@/components/common/user-avatar';
import { cn } from '@/lib/cn';
import { TaskMentionTextarea, useDocWorkspace } from '@/modules/documents';
import { useMembers } from '@/modules/members';
import { namesToTokens, personAt, type Person } from '../lib/chat-mentions';

interface ComposerProps {
  placeholder: string;
  /** Gets the body with mentions as tokens. Resolves when sent; the draft clears only then, so nothing is lost on an error. */
  onSend: (body: string) => Promise<unknown>;
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
export function Composer({ placeholder, onSend, onEditLast, disabled, autoFocus, initialValue = '', initialPeople = [], onTyping }: ComposerProps) {
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
    if (!length || tooLong || busy) return;
    setBusy(true);
    try {
      await onSend(namesToTokens(draft.trim(), people));
      setDraft('');
      setPeople([]);
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
    <div className={cn('relative rounded-xl border bg-card shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-primary-soft', disabled && 'opacity-60')}>
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
          disabled={!length || tooLong || busy || disabled}
          className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-40"
        >
          <ArrowUpIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}
