import { BLOCK_ACCENTS, BLOCK_LIMITS, BLOCK_TITLE_MAX, blockConfigKeys, type BlockConfig, type LayoutItem, type LayoutPage } from '@taskflow/shared-types';
import { CheckIcon, RotateCcwIcon } from 'lucide-react';
import { Segmented } from '@/components/kit/segmented';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/cn';
import { useSpaces } from '@/modules/spaces';
import type { BlockDefinition } from './home-blocks';

const SWATCH: Record<(typeof BLOCK_ACCENTS)[number], string> = {
  orange: 'bg-orange-500',
  blue: 'bg-sky-500',
  green: 'bg-emerald-500',
  violet: 'bg-violet-500',
  pink: 'bg-pink-500',
  amber: 'bg-amber-500',
};

interface BlockConfigDrawerProps {
  workspaceId: string | undefined;
  pageKey: LayoutPage;
  item: LayoutItem | null;
  block: BlockDefinition | undefined;
  onOpenChange: (open: boolean) => void;
  /** Applies straight away (the layout saves and can be undone). */
  onChange: (config: BlockConfig) => void;
}

/**
 * Configure a block (Features #11b): its data source kept apart from its view.
 * Changes show live on the page; Reset puts the block back to its defaults.
 */
export function BlockConfigDrawer({ workspaceId, pageKey, item, block, onOpenChange, onChange }: BlockConfigDrawerProps) {
  const { data: spaces = [] } = useSpaces(workspaceId ?? '');
  if (!item || !block) return null;
  const keys = blockConfigKeys(pageKey, item.type);
  const config: BlockConfig = item.config ?? {};
  const set = (patch: Partial<BlockConfig>) => onChange({ ...config, ...patch });
  const includeClosed = config.includeClosed ?? pageKey === 'project';

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent className="flex w-[380px] flex-col gap-5 overflow-y-auto p-5 sm:max-w-[380px]">
        <div>
          <SheetTitle>Configure · {config.title || block.title}</SheetTitle>
          <SheetDescription>{block.description}</SheetDescription>
        </div>

        {keys.includes('spaceId') && workspaceId ? (
          <section aria-labelledby="block-data" className="grid gap-2">
            <h3 id="block-data" className="font-mono text-[10.5px] font-semibold tracking-[0.06em] text-subtle-foreground uppercase">
              Data source
            </h3>
            <Label htmlFor="block-space" className="sr-only">
              Project
            </Label>
            <select
              id="block-space"
              value={config.spaceId ?? ''}
              onChange={(event) => set({ spaceId: event.target.value || undefined })}
              className="h-9 rounded-md border bg-background px-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <option value="">Same as the page (all projects)</option>
              {spaces.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Everyone who sees this block sees it with their own access.</p>
          </section>
        ) : null}

        <section aria-labelledby="block-view" className="grid gap-3">
          <h3 id="block-view" className="font-mono text-[10.5px] font-semibold tracking-[0.06em] text-subtle-foreground uppercase">
            View
          </h3>
          <div className="grid gap-1.5">
            <Label htmlFor="block-title">Title</Label>
            <Input id="block-title" value={config.title ?? ''} maxLength={BLOCK_TITLE_MAX} placeholder={block.title} onChange={(event) => set({ title: event.target.value || undefined })} />
          </div>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">Colour</span>
            <div role="radiogroup" aria-label="Colour" className="flex items-center gap-2">
              <button
                type="button"
                role="radio"
                aria-checked={!config.accent}
                aria-label="No colour"
                onClick={() => set({ accent: undefined })}
                className={cn('grid size-7 place-items-center rounded-full border text-[10px] text-muted-foreground', !config.accent && 'ring-2 ring-ring ring-offset-2 ring-offset-background')}
              >
                –
              </button>
              {BLOCK_ACCENTS.map((accent) => (
                <button
                  key={accent}
                  type="button"
                  role="radio"
                  aria-checked={config.accent === accent}
                  aria-label={accent}
                  onClick={() => set({ accent })}
                  className={cn('grid size-7 place-items-center rounded-full text-white', SWATCH[accent], config.accent === accent && 'ring-2 ring-ring ring-offset-2 ring-offset-background')}
                >
                  {config.accent === accent ? <CheckIcon className="size-3.5" /> : null}
                </button>
              ))}
            </div>
          </div>
          {keys.includes('limit') ? (
            <Segmented
              label="Show"
              value={String(config.limit ?? 'all')}
              onChange={(value) => set({ limit: value === 'all' ? undefined : (Number(value) as BlockConfig['limit']) })}
              options={[...BLOCK_LIMITS.map((limit) => ({ value: String(limit), label: `${limit}` })), { value: 'all', label: 'All' }]}
            />
          ) : null}
          {keys.includes('includeClosed') ? (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={includeClosed} onCheckedChange={(checked) => set({ includeClosed: checked === true })} />
              Include closed work
            </label>
          ) : null}
        </section>

        <div className="mt-auto flex items-center gap-2">
          <Button variant="outline" onClick={() => onChange({})} disabled={!item.config}>
            <RotateCcwIcon /> Reset block
          </Button>
          <span className="flex-1" />
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
