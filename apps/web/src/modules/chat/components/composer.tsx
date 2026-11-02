import { CHAT_MESSAGE_MAX } from '@taskflow/shared-types';
import { ArrowUpIcon } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';
import { TaskMentionTextarea } from '@/modules/documents';

interface ComposerProps {
  placeholder: string;
  /** Resolves when sent; the draft clears only then, so nothing is lost on an error. */
  onSend: (body: string) => Promise<unknown>;
  /** ↑ in an empty composer: edit your last message. */
  onEditLast?: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Starts with this text, e.g. when editing a message. */
  initialValue?: string;
}

/** Enter sends, Shift+Enter adds a line, `#` suggests tasks. */
export function Composer({ placeholder, onSend, onEditLast, disabled, autoFocus, initialValue = '' }: ComposerProps) {
  const [draft, setDraft] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const length = draft.trim().length;
  const tooLong = length > CHAT_MESSAGE_MAX;

  const send = async () => {
    if (!length || tooLong || busy) return;
    setBusy(true);
    try {
      await onSend(draft.trim());
      setDraft('');
    } finally {
      setBusy(false);
    }
  };

  const keys = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    } else if (event.key === 'ArrowUp' && draft === '' && onEditLast) {
      event.preventDefault();
      onEditLast();
    }
  };

  return (
    <div className={cn('rounded-xl border bg-card shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-primary-soft', disabled && 'opacity-60')}>
      <TaskMentionTextarea
        value={draft}
        onValueChange={setDraft}
        onKeyDown={keys}
        disabled={disabled}
        autoFocus={autoFocus}
        rows={1}
        placeholder={placeholder}
        aria-label={placeholder}
        className="field-sizing-content max-h-48 min-h-10 w-full resize-none bg-transparent px-3 pt-2.5 text-sm outline-none placeholder:text-subtle-foreground"
      />
      <div className="flex items-center gap-2 px-2 pb-2">
        <span className="font-mono text-[11px] text-subtle-foreground">
          <kbd>↵</kbd> send · <kbd>⇧↵</kbd> newline · <kbd>#</kbd> task
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
