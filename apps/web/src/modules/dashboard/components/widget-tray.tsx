import { SECTION_BLOCK } from '@taskflow/shared-types';
import { GripVerticalIcon, SearchIcon } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { endTrayDrag, startTrayDrag } from './block-grid';
import type { BlockRegistry } from './home-blocks';

interface WidgetTrayProps {
  registry: BlockRegistry;
  /** Blocks already on the page (sections can repeat). */
  placed: ReadonlySet<string>;
  /** Click (or Enter) adds the widget in the first gap. */
  onAdd: (type: string) => void;
}

/**
 * The widget tray docked beside the grid while arranging (B2): drag a widget onto
 * the grid and the others make room, or click it to drop it in the first gap.
 */
export function WidgetTray({ registry, placed, onAdd }: WidgetTrayProps) {
  const [search, setSearch] = useState('');
  const term = search.trim().toLowerCase();
  const types = registry.order.filter((type) => {
    const block = registry.blocks[type];
    return block && (type === SECTION_BLOCK || !placed.has(type)) && (!term || `${block.title} ${block.description}`.toLowerCase().includes(term));
  });
  return (
    <aside aria-label="Widgets" className="sticky top-4 flex max-h-[calc(100vh-8rem)] flex-col gap-3 rounded-xl border bg-card/80 p-3 shadow-sm backdrop-blur animate-in fade-in-0 slide-in-from-right-4">
      <div>
        <h2 className="text-sm font-semibold">Widgets</h2>
        <p className="text-xs text-muted-foreground">Drag one onto the grid, or click to add it.</p>
      </div>
      <div className="relative">
        <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Find a widget"
          aria-label="Find a widget"
          className="h-8 w-full rounded-md border bg-background pr-2 pl-8 text-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-primary-soft"
        />
      </div>
      <ul className="-mr-1 grid min-h-0 content-start gap-2 overflow-y-auto pr-1">
        {types.length === 0 ? <li className="py-6 text-center text-xs text-muted-foreground">{term ? 'No widgets match.' : 'Every widget is on the page.'}</li> : null}
        {types.map((type) => {
          const block = registry.blocks[type]!;
          return (
            <li key={type}>
              <button
                type="button"
                draggable
                onDragStart={(event) => startTrayDrag(event, { type, title: block.title, w: block.size.w, h: block.size.h })}
                onDragEnd={endTrayDrag}
                onClick={() => onAdd(type)}
                aria-label={`Place ${block.title}`}
                title={block.description}
                className={cn(
                  'group flex w-full cursor-grab items-center gap-2.5 rounded-lg border bg-background p-2.5 text-left shadow-xs transition-all duration-200',
                  'hover:-translate-y-0.5 hover:border-ring/50 hover:shadow-md active:cursor-grabbing active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                )}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary-soft text-ring transition-transform duration-200 group-hover:scale-110">
                  <block.icon aria-hidden className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{block.title}</span>
                  <span className="block font-mono text-[10.5px] text-subtle-foreground">
                    {block.size.w} × {block.size.h} cells
                  </span>
                </span>
                <GripVerticalIcon aria-hidden className="size-4 text-subtle-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
