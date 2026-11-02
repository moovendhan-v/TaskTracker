import { cleanLayoutItem, type DashboardResponse, type LayoutItem } from '@taskflow/shared-types';
import { LayoutDashboardIcon, PlusIcon, RotateCcwIcon, Undo2Icon } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import type { BlockState } from '@/components/kit/block-state';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
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
export function ArrangeableGrid({ layout, canArrange, data, state, leading, registry = HOME_REGISTRY, scope, workspaceId, personal = false }: ArrangeableGridProps) {
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
  const add = (type: string) => {
    const block = registry.blocks[type];
    if (!layout.items || !block) return;
    layout.setItems(addItem(layout.items, { id: type, type, ...block.size }));
    setLibrary(false);
  };

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
          {personal && layout.origin === 'workspace' ? (
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
            />
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
      {canArrange ? <BlockLibrary registry={registry} open={library} onOpenChange={setLibrary} placed={new Set((layout.items ?? []).map((item) => item.type))} onAdd={add} /> : null}
    </div>
  );
}
