import { CHAT_USER_MENTION } from '@taskflow/shared-types';
import { useRef, useState, type KeyboardEvent } from 'react';
import { UserAvatar } from '@/components/common/user-avatar';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUser } from '@/core/auth/use-current-user';
import { cn } from '@/lib/cn';
import { personAt, type Person } from '@/lib/mentions';
import { useMemberName, useMembers } from '@/modules/members';

/**
 * A comment as text, with `@{userId}` mentions shown as the person's name (yours highlighted).
 * Everything stays text: nothing in a comment becomes HTML.
 */
export function CommentBody({ workspaceId, body }: { workspaceId: string; body: string }) {
  const nameOf = useMemberName(workspaceId);
  const { data: me } = useCurrentUser();
  const parts: { text: string; userId?: string }[] = [];
  let last = 0;
  for (const match of body.matchAll(new RegExp(CHAT_USER_MENTION.source, 'g'))) {
    if (match.index > last) parts.push({ text: body.slice(last, match.index) });
    parts.push({ text: match[0], userId: match[1]! });
    last = match.index + match[0].length;
  }
  if (last < body.length) parts.push({ text: body.slice(last) });
  return (
    <p className="mt-1.5 text-sm break-words whitespace-pre-wrap">
      {parts.map((part, index) =>
        part.userId ? (
          <span key={index} className={cn('rounded px-0.5 font-medium', part.userId === me?.id ? 'bg-primary-soft text-ring' : 'text-ring')}>
            @{nameOf(part.userId) ?? 'someone'}
          </span>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </p>
  );
}

/**
 * The comment box with @mentions: typing `@` suggests teammates (↑/↓ to pick, Enter or Tab to
 * insert, Esc to close). The caller turns the picked names into tokens with `namesToTokens`.
 */
export function MentionTextarea({
  workspaceId,
  value,
  onChange,
  people,
  onPeopleChange,
  onSubmit,
  ...props
}: {
  workspaceId: string;
  value: string;
  onChange: (value: string) => void;
  people: Person[];
  onPeopleChange: (people: Person[]) => void;
  onSubmit: () => void;
  maxLength: number;
  placeholder: string;
  'aria-label': string;
  rows: number;
  className?: string;
}) {
  const { data: members = [] } = useMembers(workspaceId);
  const field = useRef<HTMLTextAreaElement | null>(null);
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [index, setIndex] = useState(0);
  const query = mention?.query.toLowerCase() ?? '';
  const options = mention ? members.filter((member) => member.name.toLowerCase().includes(query)).slice(0, 6) : [];

  const pick = (person: Person) => {
    const element = field.current;
    if (!mention || !element) return;
    const caret = element.selectionStart ?? value.length;
    onChange(`${value.slice(0, mention.start)}@${person.name} ${value.slice(caret)}`);
    if (!people.some((item) => item.id === person.id)) onPeopleChange([...people, person]);
    setMention(null);
    const position = mention.start + person.name.length + 2;
    requestAnimationFrame(() => element.setSelectionRange(position, position));
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
        event.stopPropagation();
        setMention(null);
        return;
      }
    }
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') onSubmit();
  };

  return (
    <div className="relative">
      <Textarea
        {...props}
        ref={field}
        value={value}
        role="combobox"
        aria-expanded={options.length > 0}
        aria-autocomplete="list"
        onChange={(event) => {
          onChange(event.target.value);
          setMention(personAt(event.target.value, event.target.selectionStart ?? event.target.value.length));
          setIndex(0);
        }}
        onKeyDown={keys}
        onBlur={() => setTimeout(() => setMention(null), 150)}
      />
      {options.length ? (
        <ul role="listbox" aria-label="People" className="absolute bottom-full left-0 z-30 mb-1 w-64 overflow-hidden rounded-lg border bg-popover p-1 text-sm shadow-popover">
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
    </div>
  );
}
