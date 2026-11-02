import { CloudOffIcon, ExternalLinkIcon, GripVerticalIcon, InboxIcon, LockIcon, Maximize2Icon, MoreHorizontalIcon, RotateCwIcon, type LucideIcon } from 'lucide-react';
import { Component, useState, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import type { BlockAccent } from '@taskflow/shared-types';
import { cn } from '@/lib/cn';
import { READY, type BlockState } from './block-state';

export interface BlockAction {
  label: string;
  icon?: LucideIcon;
  shortcut?: string;
  destructive?: boolean;
  onSelect: () => void;
}

interface BlockProps {
  title: ReactNode;
  icon?: LucideIcon;
  /** A pill after the title: the block's filter or scope, or what it's linked to (tone "linked"). */
  chip?: { label: string; icon?: LucideIcon; tone?: 'default' | 'linked' };
  /** Quiet text on the right of the header, e.g. "last 8 weeks". */
  aside?: ReactNode;
  /** Controls on the right of the header, e.g. a view switcher. */
  toolbar?: ReactNode;
  state?: BlockState;
  /** What the loading skeleton looks like. */
  skeleton?: 'rows' | 'chart';
  actions?: BlockAction[];
  /** Adds "Maximise", which shows the block in a large dialog. */
  maximisable?: boolean;
  /** Adds "Open as tab", for blocks that have a full page. */
  onOpenAsTab?: () => void;
  /** Arrange mode: dashed accent outline and a drag grip. */
  arranging?: boolean;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Caps the body height and scrolls inside it. */
  maxBodyHeight?: number;
  /** An accent colour chosen in the block's settings: a top rule and a tinted icon. */
  accent?: BlockAccent;
}

/** Accent colours (BLOCK_ACCENTS), as text and as the block's top rule. */
const ACCENT_TEXT: Record<BlockAccent, string> = {
  orange: 'text-orange-500',
  blue: 'text-sky-500',
  green: 'text-emerald-500',
  violet: 'text-violet-500',
  pink: 'text-pink-500',
  amber: 'text-amber-500',
};
const ACCENT_RULE: Record<BlockAccent, string> = {
  orange: 'border-t-orange-500',
  blue: 'border-t-sky-500',
  green: 'border-t-emerald-500',
  violet: 'border-t-violet-500',
  pink: 'border-t-pink-500',
  amber: 'border-t-amber-500',
};

/** Catches a crash inside one block and shows it in that block only. */
class BlockBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Details go to the console (and any error reporting hooked up there), never into the UI.
    console.error('Block crashed', error, info.componentStack);
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return <StateMessage state={{ kind: 'error', title: 'This block hit a problem', hint: 'The rest of the page still works.', onRetry: () => this.setState({ failed: false }) }} />;
  }
}

function StateMessage({ state }: { state: Exclude<BlockState, { kind: 'ready' } | { kind: 'loading' }> }) {
  const Icon = state.kind === 'error' ? CloudOffIcon : state.kind === 'no-access' ? LockIcon : InboxIcon;
  return (
    <div
      role={state.kind === 'error' ? 'alert' : undefined}
      className={cn(
        'flex h-full min-h-32 flex-col items-center justify-center gap-2 p-3 text-center',
        state.kind === 'no-access' && 'bg-[repeating-linear-gradient(135deg,transparent_0_8px,var(--muted)_8px_9px)]',
      )}
    >
      <Icon aria-hidden className={cn('size-6', state.kind === 'error' ? 'text-critical' : 'text-subtle-foreground')} />
      <p className="text-sm font-medium">{state.title}</p>
      {state.hint ? <p className="max-w-xs text-xs text-pretty text-muted-foreground">{state.hint}</p> : null}
      {state.kind === 'error' && state.onRetry ? (
        <Button variant="outline" size="sm" className="mt-1" onClick={state.onRetry}>
          <RotateCwIcon /> Retry
        </Button>
      ) : null}
    </div>
  );
}

function BlockSkeleton({ kind }: { kind: 'rows' | 'chart' }) {
  return (
    <div aria-hidden className="grid gap-2.5">
      {kind === 'chart' ? (
        <div className="flex h-36 items-end gap-2">
          {[45, 70, 35, 90, 60, 80, 50].map((height, index) => (
            <Skeleton key={index} className="flex-1 rounded-sm" style={{ height: `${height}%` }} />
          ))}
        </div>
      ) : (
        [0, 1, 2, 3].map((row) => (
          <div key={row} className="flex items-center gap-2.5">
            <Skeleton className="size-2 rounded-full" />
            <Skeleton className="h-3 w-11" />
            <Skeleton className="h-3 flex-1" style={{ maxWidth: `${85 - row * 12}%` }} />
          </div>
        ))
      )}
    </div>
  );
}

function Body({ state, skeleton, children }: { state: BlockState; skeleton: 'rows' | 'chart'; children: ReactNode }) {
  if (state.kind === 'loading') return <BlockSkeleton kind={skeleton} />;
  if (state.kind !== 'ready') return <StateMessage state={state} />;
  return <BlockBoundary>{children}</BlockBoundary>;
}

/**
 * The frame every block (widget) sits in (design: Features #11a): a 40px header with icon,
 * title, chip, controls and a ⋯ menu, and a body that shows loading, empty, error and
 * no-access states on its own. A crash inside the body stays inside the block.
 */
export function Block({
  title,
  icon: Icon,
  accent,
  chip,
  aside,
  toolbar,
  state = READY,
  skeleton = 'rows',
  actions = [],
  maximisable = false,
  onOpenAsTab,
  arranging = false,
  children,
  className,
  bodyClassName,
  maxBodyHeight,
}: BlockProps) {
  const [maximised, setMaximised] = useState(false);
  // While arranging, the grid puts its own controls (remove, resize) where the menu would be.
  const hasMenu = !arranging && (actions.length > 0 || maximisable || Boolean(onOpenAsTab));
  const busy = state.kind === 'loading';

  return (
    <section
      aria-busy={busy || undefined}
      className={cn(
        'relative flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card transition-[border-color,box-shadow]',
        'has-[:focus-visible]:border-ring has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-primary-soft has-[[data-state=open]]:border-ring has-[[data-state=open]]:ring-[3px] has-[[data-state=open]]:ring-primary-soft',
        arranging && 'border-dashed border-ring',
        accent && !arranging && `border-t-2 ${ACCENT_RULE[accent]}`,
        className,
      )}
    >
      <header className={cn('flex h-10 shrink-0 items-center gap-2 border-b pr-2 pl-3', arranging && 'bg-primary-soft pr-10')}>
        {arranging ? <GripVerticalIcon aria-hidden className="size-4 shrink-0 cursor-grab text-subtle-foreground" /> : null}
        {Icon ? <Icon aria-hidden className={cn('size-4 shrink-0', accent ? ACCENT_TEXT[accent] : 'text-muted-foreground')} /> : null}
        <h2 className="min-w-0 truncate text-[13px] font-semibold">{title}</h2>
        {chip ? (
          <span
            className={cn(
              'flex h-[22px] shrink-0 items-center gap-1 rounded-full px-2 text-[11px] whitespace-nowrap',
              chip.tone === 'linked' ? 'bg-primary-soft text-ring' : 'bg-selected text-muted-foreground',
            )}
          >
            {chip.icon ? <chip.icon aria-hidden className="size-3" /> : null}
            {chip.label}
          </span>
        ) : null}
        <div className="flex-1" />
        {aside ? <span className="shrink-0 truncate text-xs text-muted-foreground">{aside}</span> : null}
        {toolbar}
        {hasMenu ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Block options"
              className="grid size-7 shrink-0 place-items-center rounded-md text-subtle-foreground hover:bg-selected hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none data-[state=open]:bg-selected data-[state=open]:text-foreground"
            >
              <MoreHorizontalIcon className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {maximisable ? (
                <DropdownMenuItem onSelect={() => setMaximised(true)}>
                  <Maximize2Icon /> Maximise
                </DropdownMenuItem>
              ) : null}
              {onOpenAsTab ? (
                <DropdownMenuItem onSelect={onOpenAsTab}>
                  <ExternalLinkIcon /> Open as tab
                </DropdownMenuItem>
              ) : null}
              {actions.length && (maximisable || onOpenAsTab) ? <DropdownMenuSeparator /> : null}
              {actions.map((action) => (
                <DropdownMenuItem key={action.label} variant={action.destructive ? 'destructive' : 'default'} onSelect={action.onSelect}>
                  {action.icon ? <action.icon /> : null}
                  {action.label}
                  {action.shortcut ? <span className="ml-auto pl-4 font-mono text-[10.5px] text-subtle-foreground">{action.shortcut}</span> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </header>
      <div
        className={cn('min-h-0 flex-1', state.kind === 'ready' || state.kind === 'loading' ? 'p-4' : '', maxBodyHeight && 'overflow-y-auto', bodyClassName)}
        style={maxBodyHeight ? { maxHeight: maxBodyHeight } : undefined}
      >
        <Body state={state} skeleton={skeleton}>
          {children}
        </Body>
      </div>
      {maximisable ? (
        <Dialog open={maximised} onOpenChange={setMaximised}>
          <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-5xl">
            <DialogTitle className="flex items-center gap-2">
              {Icon ? <Icon aria-hidden className="size-4 text-muted-foreground" /> : null}
              {title}
            </DialogTitle>
            <DialogDescription className="sr-only">The block, enlarged.</DialogDescription>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <Body state={state} skeleton={skeleton}>
                {children}
              </Body>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </section>
  );
}
