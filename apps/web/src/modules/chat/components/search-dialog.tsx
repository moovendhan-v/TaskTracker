import { useNavigate } from '@tanstack/react-router';
import { mentionsToNames, type ChatSearchHit } from '@taskflow/shared-types';
import { HashIcon, LockIcon, MessageCircleIcon, SearchIcon } from 'lucide-react';
import { useEffect, useState, type KeyboardEvent } from 'react';
import { UserAvatar } from '@/components/common/user-avatar';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/cn';
import { timeAgo } from '@/lib/relative-time';
import { useMemberName } from '@/modules/members';
import { useChatSearch } from '../hooks/use-chat';
import { highlight } from '../lib/highlight';

/** Finds messages in every channel you can read; ↑/↓ to pick, Enter to open it in its channel. */
export function SearchDialog({ workspaceId, open, onOpenChange }: { workspaceId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const nameOf = useMemberName(workspaceId);
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const search = useChatSearch(workspaceId, query);
  const hits = query.trim().length >= 2 ? (search.data ?? []) : [];

  // A short pause before searching, so every keystroke doesn't send a query.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(text);
      setIndex(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [text]);

  const openHit = (hit: ChatSearchHit) => {
    onOpenChange(false);
    void navigate({ to: '/w/$workspaceId/chat/m/$messageId', params: { workspaceId, messageId: hit.message.id } });
  };
  const keys = (event: KeyboardEvent) => {
    if (!hits.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setIndex((current) => (current + (event.key === 'ArrowDown' ? 1 : hits.length - 1)) % hits.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      openHit(hits[index]!);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-24 translate-y-0 gap-0 p-0 sm:max-w-xl">
        <DialogTitle className="sr-only">Search messages</DialogTitle>
        <DialogDescription className="sr-only">Messages in the channels and direct messages you can read.</DialogDescription>
        <div className="flex items-center gap-2 border-b px-4">
          <SearchIcon aria-hidden className="size-4 text-muted-foreground" />
          <input
            autoFocus
            value={text}
            maxLength={100}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={keys}
            placeholder="Search messages"
            aria-label="Search messages"
            role="combobox"
            aria-expanded={hits.length > 0}
            aria-controls="chat-search-results"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle-foreground"
          />
        </div>
        <ul id="chat-search-results" role="listbox" aria-label="Results" className="max-h-[60vh] overflow-y-auto p-1.5">
          {hits.map((hit, position) => {
            const plain = mentionsToNames(hit.message.body, nameOf).replace(/[*_`>#~]/g, '').replace(/\s+/g, ' ');
            return (
              <li
                key={hit.message.id}
                role="option"
                aria-selected={position === index}
                onMouseEnter={() => setIndex(position)}
                onClick={() => openHit(hit)}
                className={cn('flex cursor-pointer gap-3 rounded-lg px-3 py-2.5', position === index && 'bg-selected')}
              >
                <UserAvatar name={hit.message.authorName ?? '?'} className="size-7 shrink-0 text-[10px]" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{hit.message.authorName ?? 'Former member'}</span>
                    <span aria-hidden>·</span>
                    {hit.channelKind === 'dm' ? <MessageCircleIcon aria-hidden className="size-3" /> : hit.channelKind === 'private' ? <LockIcon aria-hidden className="size-3" /> : <HashIcon aria-hidden className="size-3" />}
                    <span>{hit.channelKind === 'dm' ? 'Direct message' : hit.channelName}</span>
                    <span className="ml-auto font-mono text-[11px] text-subtle-foreground">{timeAgo(hit.message.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-sm">
                    {highlight(plain, query).map((part, at) =>
                      part.hit ? (
                        <mark key={at} className="rounded-sm bg-primary-soft px-0.5 text-foreground">
                          {part.text}
                        </mark>
                      ) : (
                        <span key={at}>{part.text}</span>
                      ),
                    )}
                  </p>
                </div>
              </li>
            );
          })}
          {query.trim().length >= 2 && search.data && hits.length === 0 ? <li className="px-3 py-6 text-center text-sm text-muted-foreground">No messages match “{query.trim()}”.</li> : null}
          {query.trim().length < 2 ? <li className="px-3 py-6 text-center text-sm text-muted-foreground">Type at least two characters. Every word has to match.</li> : null}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
