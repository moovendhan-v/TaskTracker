import { BlocksIcon, SearchIcon } from 'lucide-react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useMd2SlidesCatalog } from '../hooks/use-md2slides';

/**
 * Every md2slides block, from md2slides' own snippet list (so blocks contributors add there
 * appear here too), searchable and grouped like in md2slides. Picking one inserts its Markdown.
 */
export function Md2SlidesBlockPicker({ workspaceId, open, onOpenChange, onInsert }: { workspaceId: string; open: boolean; onOpenChange: (open: boolean) => void; onInsert: (markdown: string) => void }) {
  const catalog = useMd2SlidesCatalog(workspaceId, open);
  const [search, setSearch] = useState('');
  const needle = search.trim().toLowerCase();
  const snippets = (catalog.data?.snippets ?? []).filter((snippet) => !needle || `${snippet.label} ${snippet.category} ${snippet.md}`.toLowerCase().includes(needle));
  const groups = [...new Set(snippets.map((snippet) => snippet.category))];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BlocksIcon className="size-4 text-muted-foreground" /> md2slides blocks
          </DialogTitle>
          <DialogDescription>Slides, cards, stats, charts, flows, timelines, diagrams and more. They present in md2slides exactly as written.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search md2slides blocks" placeholder="Search blocks" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-8" autoFocus />
        </div>
        <div className="grid max-h-[60vh] gap-4 overflow-y-auto pr-1">
          {catalog.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
          {groups.map((group) => (
            <section key={group} aria-label={group} className="grid gap-1.5">
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{group}</h3>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {snippets
                  .filter((snippet) => snippet.category === group)
                  .map((snippet) => (
                    <button
                      key={snippet.label}
                      type="button"
                      onClick={() => {
                        onInsert(snippet.md);
                        onOpenChange(false);
                      }}
                      className="grid gap-1 rounded-lg border p-2.5 text-left hover:border-primary/50 hover:bg-muted/50"
                    >
                      <span className="text-sm font-medium">{snippet.label}</span>
                      <code className="line-clamp-2 font-mono text-[11px] whitespace-pre-wrap text-muted-foreground">{snippet.md}</code>
                    </button>
                  ))}
              </div>
            </section>
          ))}
          {!catalog.isLoading && snippets.length === 0 ? <p className="text-sm text-muted-foreground">No block matches “{search}”.</p> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
