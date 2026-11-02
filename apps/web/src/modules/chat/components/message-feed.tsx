import type { ChatMessageResponse } from '@taskflow/shared-types';
import { Fragment, useLayoutEffect, useRef, type ReactNode } from 'react';
import { toRows } from '../lib/chat-display';

interface MessageFeedProps {
  /** Oldest first. */
  messages: ChatMessageResponse[];
  renderMessage: (message: ChatMessageResponse, head: boolean) => ReactNode;
  /** Shown above the first message, e.g. "Load earlier" or the channel intro. */
  top?: ReactNode;
  label: string;
}

/**
 * A scrolling list of messages that stays pinned to the newest one while you're at the
 * bottom, and keeps your place when older messages load above.
 */
export function MessageFeed({ messages, renderMessage, top, label }: MessageFeedProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const shape = useRef({ first: '', height: 0 });

  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const first = messages[0]?.id ?? '';
    if (shape.current.first && first !== shape.current.first && !pinned.current) {
      // Older messages arrived above: keep what you were reading where it was.
      element.scrollTop += element.scrollHeight - shape.current.height;
    } else if (pinned.current) {
      element.scrollTop = element.scrollHeight;
    }
    shape.current = { first, height: element.scrollHeight };
  }, [messages]);

  return (
    <div
      ref={scroller}
      role="log"
      aria-label={label}
      aria-live="polite"
      onScroll={(event) => {
        const element = event.currentTarget;
        pinned.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
      }}
      className="min-h-0 flex-1 overflow-y-auto px-3 pb-3"
    >
      {top}
      {toRows(messages).map(({ message, head, day }) => (
        <Fragment key={message.id}>
          {day ? (
            <div className="sticky top-0 z-10 my-3 flex items-center gap-3" role="separator" aria-label={day}>
              <span className="h-px flex-1 bg-border" />
              <span className="rounded-full border bg-background px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">{day}</span>
              <span className="h-px flex-1 bg-border" />
            </div>
          ) : null}
          {renderMessage(message, head)}
        </Fragment>
      ))}
    </div>
  );
}
