import { canStack, cleanLayoutItem, LAYOUT_LIMITS, SECTION_BLOCK, type DashboardResponse, type LayoutItem } from '@taskflow/shared-types';
import { LayoutDashboardIcon, LockIcon, PlusIcon, RotateCcwIcon, Undo2Icon } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import type { BlockState } from '@/components/kit/block-state';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { usePermissions } from '@/modules/workspaces';
import type { ArrangeableLayout } from '../hooks/use-layout';
import { addItem, removeItem } from '../lib/grid';
import { BlockConfigDrawer } from './block-config-drawer';
import { BlockGrid } from './block-grid';
import { ConfiguredBlock, type BlockScope } from './configured-block';
import { LayoutMenu } from './layout-menu';
import { BlockLibrary } from './block-library';
import { HOME_REGISTRY, type BlockRegistry } from './home-blocks';

function isEditable(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

interface ArrangeableGridProps {
  layout: ArrangeableLayout;
  /** Only the layout's owner arranges it; others see it as is. */
  canArrange: boolean;
  data: DashboardResponse | undefined;
  state: BlockState;
  /** Left side of the toolbar row, e.g. a note about who shared the dashboard. */
  leading?: ReactNode;
  /** Which blocks this page offers (Home by default). */
  registry?: BlockRegistry;
  /** Lets blocks pick their own project (Home); without it, blocks follow the page. */
  scope?: BlockScope;
  workspaceId?: string;
  /** A personal page layout: offers version history and, for layout managers, the workspace default. */
  personal?: boolean;
}

/**
 * Home blocks on the grid, with arrange mode for whoever may change the layout:
 * E arranges, A adds a block, ⌘/Ctrl+Z undoes, Esc finishes.
 */
export function ArrangeableGrid({ layout, canArrange: ownerMayArrange, data, state, leading, registry = HOME_REGISTRY, scope, workspaceId, personal = false }: ArrangeableGridProps) {
  const { can } = usePermissions(workspaceId ?? scope?.workspaceId ?? '');
  // A locked workspace layout: only layout managers arrange the page (the server refuses the others' saves too).
  const lockedOut = personal && layout.locked && !can('layout.manage');
  const canArrange = ownerMayArrange && !lockedOut;
  const [configuring, setConfiguring] = useState<string | null>(null);
  const configuringItem = layout.items?.find((item) => item.id === configuring) ?? null;
  const blockOf = (item: LayoutItem) => registry.blocks[item.type];
  const [arrangingState, setArranging] = useState(false);
  const [library, setLibrary] = useState(false);
  const arranging = canArrange && arrangingState;

  const remove = (item: LayoutItem) => {
    if (!layout.items) return;
    layout.setItems(removeItem(layout.items, item.id));
    toast(`Removed ${blockOf(item)?.title ?? 'block'}`, { duration: 10_000, action: { label: 'Undo', onClick: () => layout.undo() } });
  };
  // Stacking: the library opens for one slot and adds the picked block as a tab there.
  const [stackOn, setStackOn] = useState<string | null>(null);
  const add = (type: string) => {
    const block = registry.blocks[type];
    if (!layout.items || !block) return;
    if (stackOn) {
      layout.setItems(layout.items.map((item) => (item.id === stackOn ? cleanLayoutItem({ ...item, tabs: [...(item.tabs ?? []), type] }) : item)));
      setStackOn(null);
      setLibrary(false);
      return;
    }
    // Sections can repeat, so they get the next free id.
    let id = type;
    for (let n = 1; type === SECTION_BLOCK && layout.items.some((item) => item.id === id); n++) id = `${type}-${n}`;
    layout.setItems(addItem(layout.items, { id, type, ...block.size }));
    setLibrary(false);
  };
  const unstack = (item: LayoutItem, type: string) => {
    if (!layout.items) return;
    layout.setItems(layout.items.map((other) => (other.id === item.id ? cleanLayoutItem({ ...other, tabs: (other.tabs ?? []).filter((tab) => tab !== type) }) : other)));
  };
  // Every block on the page, stacked ones included, can be placed once; sections any number of times.
  const placed = new Set((layout.items ?? []).flatMap((item) => [item.type, ...(item.tabs ?? [])]).filter((type) => type !== SECTION_BLOCK));
  const stackTarget = layout.items?.find((item) => item.id === stackOn) ?? null;

  useEffect(() => {
    if (!canArrange) return;
    const onKey = (event: KeyboardEvent) => {
      if (isEditable(event.target) || document.querySelector('[role="dialog"],[role="menu"]')) return;
      const plain = !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
      if (plain && event.key.toLowerCase() === 'e') {
        event.preventDefault();
        setArranging((value) => !value);
      } else if (plain && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        setArranging(true);
        setLibrary(true);
      } else if (arranging && event.key === 'Escape') {
        setArranging(false);
      } else if (arranging && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && layout.undo()) {
        event.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [arranging, canArrange, layout]);

  return (
    <div className="grid gap-4">
      <div className="flex min-h-9 flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          {leading}
          {lockedOut ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <LockIcon className="size-3.5" /> Your workspace admins set and locked this layout.
            </span>
          ) : personal && layout.origin === 'workspace' ? (
            <span className="text-xs text-muted-foreground">Showing the workspace default. Arrange it to make it yours.</span>
          ) : null}
        </div>
        {!canArrange ? null : arranging ? (
          <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Arrange blocks">
            <span className="mr-1 flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-ring">
              <LayoutDashboardIcon className="size-3.5" /> Arranging
            </span>
            <Button variant="outline" size="sm" onClick={() => setLibrary(true)}>
              <PlusIcon /> Add block <kbd className="ml-1 font-mono text-[10.5px] text-subtle-foreground">A</kbd>
            </Button>
            <Button variant="outline" size="sm" disabled={!layout.canUndo} onClick={() => layout.undo()}>
              <Undo2Icon /> Undo
            </Button>
            <ConfirmDialog
              trigger={
                <Button variant="outline" size="sm" disabled={!layout.isCustom}>
                  <RotateCcwIcon /> Reset
                </Button>
              }
              title="Reset this layout?"
              description="Your arrangement goes; you're back on the workspace default (or the built-in one). Earlier saves stay in version history."
              confirmLabel="Reset layout"
              onConfirm={() => layout.reset()}
            >
              <LayoutPreview items={layout.resetTo} titleOf={(type) => registry.blocks[type]?.title ?? type} label="What Reset brings back" />
            </ConfirmDialog>
            {personal && (workspaceId ?? scope?.workspaceId) ? <LayoutMenu workspaceId={(workspaceId ?? scope?.workspaceId)!} layout={layout} /> : null}
            <Button size="sm" onClick={() => setArranging(false)}>
              Done <kbd className="ml-1 font-mono text-[10.5px] opacity-70">E</kbd>
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setArranging(true)} disabled={!layout.items}>
            <LayoutDashboardIcon /> Arrange <kbd className="ml-1 font-mono text-[10.5px] text-subtle-foreground">E</kbd>
          </Button>
        )}
      </div>
      {layout.items ? (
        layout.items.length === 0 ? (
          <div className="grid place-items-center gap-2 rounded-xl border border-dashed p-10 text-center">
            <LayoutDashboardIcon className="size-6 text-ring" />
            <p className="text-sm font-medium">This dashboard is empty</p>
            {canArrange ? (
              <Button size="sm" onClick={() => {
                setArranging(true);
                setLibrary(true);
              }}>
                <PlusIcon /> Add block
              </Button>
            ) : null}
          </div>
        ) : (
          <BlockGrid
            items={layout.items}
            arranging={arranging}
            onChange={(items) => layout.setItems(items)}
            onRemove={remove}
            titleOf={(item) => blockOf(item)?.title ?? 'Block'}
            renderBlock={(item) => {
              const block = blockOf(item);
              if (!block) return null;
              return (
                <ConfiguredBlock
                  item={item}
                  block={block}
                  data={data}
                  state={state}
                  arranging={arranging}
                  canArrange={canArrange}
                  scope={scope}
                  onConfigure={() => setConfiguring(item.id)}
                  onRemove={() => remove(item)}
                  registry={registry}
                  onStack={canArrange && canStack(item.type) && (item.tabs?.length ?? 0) < LAYOUT_LIMITS.tabsMax ? () => {
                    setStackOn(item.id);
                    setLibrary(true);
                  } : undefined}
                  onUnstack={(type) => unstack(item, type)}
                />
              );
            }}
          />
        )
      ) : null}
      {canArrange && configuringItem ? (
        <BlockConfigDrawer
          workspaceId={scope?.workspaceId ?? workspaceId}
          pageKey={layout.pageKey}
          item={configuringItem}
          block={blockOf(configuringItem)}
          onOpenChange={(open) => !open && setConfiguring(null)}
          onChange={(config) => layout.items && layout.setItems(layout.items.map((item) => (item.id === configuringItem.id ? cleanLayoutItem({ ...item, config }) : item)))}
        />
      ) : null}
      {canArrange ? (
        <BlockLibrary
          registry={registry}
          open={library}
          onOpenChange={(open) => {
            setLibrary(open);
            if (!open) setStackOn(null);
          }}
          placed={stackTarget ? new Set([...placed, SECTION_BLOCK]) : placed}
          onAdd={add}
          title={stackTarget ? `Stack a block with ${blockOf(stackTarget)?.title ?? 'this block'}` : undefined}
        />
      ) : null}
    </div>
  );
}

/** A small picture of a layout (block outlines with their names), e.g. what Reset brings back. */
export function LayoutPreview({ items, titleOf, label }: { items: readonly LayoutItem[]; titleOf: (type: string) => string; label: string }) {
  const rows = Math.max(1, ...items.map((item) => item.y + item.h));
  return (
    <figure className="grid gap-1.5">
      <figcaption className="text-xs font-medium text-muted-foreground">{label}</figcaption>
      <div
        role="img"
        aria-label={`${label}: ${items.map((item) => titleOf(item.type)).join(', ')}`}
        className="grid gap-1 rounded-lg border bg-muted/30 p-1.5"
        style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gridTemplateRows: `repeat(${Math.min(rows, 40)}, 6px)` }}
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-start overflow-hidden rounded-sm border bg-card px-1 text-[9px] leading-tight text-muted-foreground"
            style={{ gridColumn: `${item.x + 1} / span ${item.w}`, gridRow: `${item.y + 1} / span ${item.h}` }}
          >
            <span className="truncate">{titleOf(item.type)}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}
