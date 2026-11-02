import type { DashboardResponse, LayoutItem } from '@taskflow/shared-types';
import { LayoutDashboardIcon, PlusIcon, RotateCcwIcon, Trash2Icon, Undo2Icon } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Block } from '@/components/kit/block';
import type { BlockState } from '@/components/kit/block-state';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import type { ArrangeableLayout } from '../hooks/use-layout';
import { addItem, removeItem } from '../lib/grid';
import { BlockGrid } from './block-grid';
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
}

/**
 * Home blocks on the grid, with arrange mode for whoever may change the layout:
 * E arranges, A adds a block, ⌘/Ctrl+Z undoes, Esc finishes.
 */
export function ArrangeableGrid({ layout, canArrange, data, state, leading, registry = HOME_REGISTRY }: ArrangeableGridProps) {
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
        <div className="min-w-0 flex-1">{leading}</div>
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
              description="The blocks go back to the default arrangement. This can't be undone."
              confirmLabel="Reset layout"
              onConfirm={() => layout.reset()}
            />
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
              const chip = data && block.chip?.(data);
              return (
                <Block
                  title={block.title}
                  icon={block.icon}
                  aside={block.aside}
                  chip={chip ? { label: chip } : undefined}
                  state={state}
                  skeleton={block.skeleton}
                  arranging={arranging}
                  maximisable
                  actions={canArrange ? [{ label: 'Remove', icon: Trash2Icon, destructive: true, onSelect: () => remove(item) }] : []}
                  bodyClassName="overflow-y-auto"
                >
                  {data ? block.render(data) : null}
                </Block>
              );
            }}
          />
        )
      ) : null}
      {canArrange ? <BlockLibrary registry={registry} open={library} onOpenChange={setLibrary} placed={new Set((layout.items ?? []).map((item) => item.type))} onAdd={add} /> : null}
    </div>
  );
}
