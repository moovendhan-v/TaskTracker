import { PlusIcon, SearchIcon } from 'lucide-react';
import { useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/cn';
import type { BlockCategory, BlockRegistry } from './home-blocks';

const CATEGORIES: BlockCategory[] = ['Project', 'Tasks', 'Insights', 'Time', 'People', 'Layout'];

interface BlockLibraryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Blocks already on the page; each can be placed once. */
  placed: ReadonlySet<string>;
  onAdd: (type: string) => void;
  registry: BlockRegistry;
  /** Replaces the heading, e.g. when stacking a block into a slot. */
  title?: string;
}

/** The block library drawer (design: Platform #6a): search, category chips, and a card per block. */
export function BlockLibrary({ open, onOpenChange, placed, onAdd, registry, title }: BlockLibraryProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<BlockCategory | 'All'>('All');
  const term = search.trim().toLowerCase();
  const types = registry.order.filter((type) => {
    const block = registry.blocks[type]!;
    return (category === 'All' || block.category === category) && (!term || `${block.title} ${block.description}`.toLowerCase().includes(term));
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-[380px] flex-col gap-4 p-5 sm:max-w-[380px]">
        <div>
          <SheetTitle>{title ?? 'Add a block'}</SheetTitle>
          <SheetDescription>Blocks show one view of your workspace. Each can be on the page once.</SheetDescription>
        </div>
        <div className="relative">
          <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search blocks"
            aria-label="Search blocks"
            className="h-9 w-full rounded-md border bg-card pr-2 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-primary-soft"
          />
        </div>
        <div role="radiogroup" aria-label="Category" className="flex flex-wrap gap-1.5">
          {(['All', ...CATEGORIES.filter((value) => registry.order.some((type) => registry.blocks[type]?.category === value))] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={category === value}
              onClick={() => setCategory(value)}
              className={cn(
                'h-7 rounded-full border px-2.5 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                category === value ? 'border-ring bg-primary-soft text-foreground' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {value}
            </button>
          ))}
        </div>
        <ul className="-mr-2 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] content-start gap-2 overflow-y-auto pr-2">
          {types.length === 0 ? <li className="py-8 text-center text-sm text-muted-foreground">No blocks match.</li> : null}
          {types.map((type) => {
            const block = registry.blocks[type]!;
            const onPage = placed.has(type);
            return (
              <li key={type} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                  <block.icon aria-hidden className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{block.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{block.description}</span>
                  <span className="font-mono text-[10.5px] text-subtle-foreground">
                    {block.category} · {block.size.w}×{block.size.h}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={onPage}
                  onClick={() => onAdd(type)}
                  aria-label={onPage ? `${block.title} is on the page` : `Add ${block.title}`}
                  className="flex h-8 shrink-0 items-center gap-1 rounded-md border px-2.5 text-xs font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
                >
                  {onPage ? 'Added' : (
                    <>
                      <PlusIcon className="size-3.5" /> Add
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
