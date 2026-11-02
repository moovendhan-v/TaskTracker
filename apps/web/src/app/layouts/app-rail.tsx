import { useRouter, useRouterState } from '@tanstack/react-router';
import { BellIcon, PanelLeftIcon, SlidersHorizontalIcon } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import { usePreferenceMutations, usePreferences } from '@/core/preferences/use-preferences';
import { cn } from '@/lib/cn';
import { useChatUnread } from '@/modules/chat';
import { useInboxPanel } from '@/modules/inbox';
import { usePermissions } from '@/modules/workspaces';
import { goToPath, RAIL_ITEMS, railAreaOf } from './rail-areas';
import { UserMenu } from './user-menu';

const GO_TIMEOUT_MS = 1200;

function isEditable(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

function Hint({ label, keys }: { label: string; keys?: string }) {
  return (
    <span className="flex items-center gap-2">
      {label}
      {keys ? <kbd className="rounded border border-background/30 px-1 font-mono text-[10.5px] opacity-80">{keys}</kbd> : null}
    </span>
  );
}

const ITEM =
  'relative grid size-10 place-items-center rounded-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&_svg]:size-5';

interface RailLinkProps {
  to: string;
  label: string;
  keys?: string;
  active?: boolean;
  go: (path: string) => void;
  children: ReactNode;
}

/** A plain link (so middle-click opens a browser tab) that navigates in-app on a normal click. */
function RailLink({ to, label, keys, active, go, children }: RailLinkProps) {
  return (
    <Tooltip label={<Hint label={label} keys={keys} />} side="right">
      <a
        href={to}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        className={cn(ITEM, active && 'bg-selected text-foreground shadow-[inset_0_0_0_1px_var(--border-strong)]')}
        onClick={(event) => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          go(to);
        }}
      >
        {active ? <span aria-hidden className="absolute top-1/2 -left-[10px] h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-ring" /> : null}
        {children}
      </a>
    </Tooltip>
  );
}

/**
 * The 60px app rail (design: TF2 Rail): home, the apps, inbox, the side panel toggle,
 * appearance and the account. "G then H / I / T / D / M / P" jumps between apps.
 */
export function AppRail({ workspaceId, unread }: { workspaceId: string; unread: number }) {
  const router = useRouter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const area = railAreaOf(pathname);
  const { sidebarCollapsed } = usePreferences();
  const { update } = usePreferenceMutations();
  const base = `/w/${workspaceId}`;
  const goPending = useRef(0);
  const inboxOpen = useInboxPanel((state) => state.open);
  const canChat = usePermissions(workspaceId).can('chat.use');
  const chatUnread = useChatUnread(workspaceId, canChat);
  const toggleInbox = useInboxPanel((state) => state.toggle);

  const go = (path: string) => router.history.push(path);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isEditable(event.target)) return;
      const key = event.key.toLowerCase();
      if (Date.now() - goPending.current < GO_TIMEOUT_MS) {
        goPending.current = 0;
        const path = goToPath(key);
        if (path === null) return;
        event.preventDefault();
        router.history.push(base + path);
        return;
      }
      if (key === 'g' && !event.shiftKey) goPending.current = Date.now();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router, base]);

  return (
    <nav aria-label="Apps" className="flex h-full w-[60px] shrink-0 flex-col items-center gap-1 border-r bg-rail py-2.5">
      <Tooltip label="TaskFlow home" side="right">
        <a
          href={base}
          aria-label="TaskFlow home"
          onClick={(event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            go(base);
          }}
          className="mb-2 grid size-[38px] place-items-center rounded-[10px] bg-gradient-to-br from-ring to-primary shadow-[0_0_18px_-4px_var(--ring)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-rail focus-visible:outline-none"
        >
          <svg viewBox="0 0 32 32" className="size-6" aria-hidden>
            <path d="M8 10h16M8 16h11M8 22h6" stroke="white" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
        </a>
      </Tooltip>

      <Tooltip label={<Hint label={unread ? `Inbox, ${unread} unread` : 'Inbox'} keys="G I opens the full inbox" />} side="right">
        <button
          type="button"
          onClick={toggleInbox}
          aria-label={unread ? `Inbox, ${unread} unread` : 'Inbox'}
          aria-pressed={inboxOpen}
          className={cn(ITEM, (inboxOpen || pathname.startsWith(`${base}/inbox`)) && 'bg-selected text-foreground shadow-[inset_0_0_0_1px_var(--border-strong)]')}
        >
          <BellIcon />
          {unread ? <span aria-hidden className="absolute top-[9px] right-[10px] size-[7px] rounded-full border-2 border-rail bg-ring box-content" /> : null}
        </button>
      </Tooltip>

      <span aria-hidden className="my-1 h-px w-7 bg-border" />

      {RAIL_ITEMS.filter((item) => item.area !== 'chat' || canChat).map((item) => (
        <RailLink
          go={go}
          key={item.area}
          to={base + item.path}
          label={item.area === 'chat' && chatUnread ? `Chat, ${chatUnread} unread` : item.label}
          keys={item.goKey ? `G ${item.goKey.toUpperCase()}` : undefined}
          active={area === item.area}
        >
          <item.icon />
          {item.area === 'chat' && chatUnread ? <span aria-hidden className="absolute top-[9px] right-[10px] size-[7px] rounded-full border-2 border-rail bg-ring box-content" /> : null}
        </RailLink>
      ))}

      <div className="flex-1" />

      <Tooltip label={sidebarCollapsed ? 'Show side panel' : 'Hide side panel'} side="right">
        <button
          type="button"
          onClick={() => update.mutate({ sidebarCollapsed: !sidebarCollapsed })}
          aria-label="Side panel"
          aria-pressed={!sidebarCollapsed}
          className={ITEM}
        >
          <PanelLeftIcon />
        </button>
      </Tooltip>
      <RailLink go={go} to={`${base}/appearance`} label="Appearance" active={pathname.startsWith(`${base}/appearance`)}>
        <SlidersHorizontalIcon />
      </RailLink>
      <div className="mt-1.5">
        <UserMenu variant="rail" />
      </div>
    </nav>
  );
}
