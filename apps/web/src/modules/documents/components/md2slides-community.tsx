import type { Md2SlidesTemplate } from '@taskflow/shared-types';
import { ExternalLinkIcon, PresentationIcon, SearchIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { useMd2SlidesCatalog } from '../hooks/use-md2slides';
import { openInMd2Slides } from '../lib/md2slides-share';

const REPO = 'https://github.com/moovendhan-v/md2-slides';

/**
 * md2slides community templates (read from the md2slides project, refreshed daily), each credited
 * to whoever made it, and the people behind them, most templates first.
 */
export function Md2SlidesCommunity({ workspaceId, onUse, busy }: { workspaceId: string; onUse: (page: { title: string; content: string }) => void; busy?: boolean }) {
  const catalog = useMd2SlidesCatalog(workspaceId);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  if (catalog.isLoading) return <p className="text-sm text-muted-foreground">Loading md2slides templates…</p>;
  if (!catalog.data) return <p className="text-sm text-muted-foreground">md2slides templates aren't available right now.</p>;
  const { templates, contributors } = catalog.data;
  const categories = [...new Set(templates.map((template) => template.category))].sort();
  const needle = search.trim().toLowerCase();
  const shown = templates.filter((template) => (!category || template.category === category) && (!needle || `${template.name} ${template.description} ${template.author}`.toLowerCase().includes(needle)));
  const current: Md2SlidesTemplate | undefined = shown.find((template) => template.id === selected) ?? shown[0];

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search md2slides templates" placeholder={`Search ${templates.length} templates`} value={search} onChange={(event) => setSearch(event.target.value)} className="h-8 pl-8" />
        </div>
        <div role="group" aria-label="Categories" className="flex max-w-full gap-1 overflow-x-auto">
          {[null, ...categories].map((value) => (
            <button
              key={value ?? 'all'}
              type="button"
              aria-pressed={category === value}
              onClick={() => setCategory(value)}
              className={cn('shrink-0 rounded-full border px-2.5 py-0.5 text-xs', category === value ? 'border-primary bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-muted')}
            >
              {value ?? 'All'}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
        <ul aria-label="md2slides templates" className="grid max-h-80 content-start gap-1 overflow-y-auto">
          {shown.map((template) => (
            <li key={template.id}>
              <button
                type="button"
                aria-pressed={current?.id === template.id}
                onClick={() => setSelected(template.id)}
                onDoubleClick={() => onUse({ title: template.name, content: template.md })}
                className={cn('grid w-full gap-0.5 rounded-lg border-l-[3px] border-transparent px-3 py-2 text-left text-sm hover:bg-muted', current?.id === template.id && 'bg-muted')}
                style={template.accent ? { borderLeftColor: template.accent } : undefined}
              >
                <span className="font-medium">{template.name}</span>
                <span className="text-[11px] text-muted-foreground">
                  {template.category} · by {template.authorGithub ? `@${template.authorGithub}` : template.author}
                </span>
              </button>
            </li>
          ))}
          {shown.length === 0 ? <li className="px-3 py-2 text-sm text-muted-foreground">No template matches.</li> : null}
        </ul>
        {current ? (
          <div className="grid min-w-0 content-start gap-2">
            <p className="text-sm text-muted-foreground">{current.description}</p>
            <pre aria-label={`Preview of ${current.name}`} className="max-h-56 overflow-auto rounded-lg border bg-muted/30 p-3 font-mono text-xs whitespace-pre-wrap">
              {current.md}
            </pre>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Made by{' '}
                {current.authorGithub ? (
                  <a href={`https://github.com/${current.authorGithub}`} target="_blank" rel="noopener noreferrer" className="font-medium text-foreground hover:underline">
                    {current.author}
                  </a>
                ) : (
                  <span className="font-medium text-foreground">{current.author}</span>
                )}
              </span>
              <span className="flex-1" />
              <Button variant="outline" size="sm" onClick={() => void openInMd2Slides(current.md, current.name)}>
                <PresentationIcon /> Preview in md2slides
              </Button>
              <Button size="sm" disabled={busy} onClick={() => onUse({ title: current.name, content: current.md })}>
                Use template
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      <section aria-label="md2slides contributors" className="grid gap-2 border-t pt-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {templates.length} templates by {contributors.length} {contributors.length === 1 ? 'contributor' : 'contributors'}, from the open-source md2slides project
            {catalog.data.source === 'snapshot' ? ' (saved copy)' : ''}.
          </span>
          <a href={`${REPO}/blob/main/CONTRIBUTING.md`} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 font-medium text-primary hover:underline">
            Add yours <ExternalLinkIcon className="size-3" />
          </a>
        </div>
        <ol className="flex flex-wrap gap-1.5">
          {contributors.map((person, index) => (
            <li key={person.github}>
              <a
                href={`https://github.com/${person.github}`}
                target="_blank"
                rel="noopener noreferrer"
                title={`${person.name}, ${person.role}: ${person.templates} ${person.templates === 1 ? 'template' : 'templates'}`}
                className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs hover:bg-muted', index === 0 && person.templates > 0 && 'border-primary/50 bg-primary/5')}
              >
                <span className="font-medium">@{person.github}</span>
                <span className="text-muted-foreground tabular-nums">{person.templates}</span>
              </a>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
