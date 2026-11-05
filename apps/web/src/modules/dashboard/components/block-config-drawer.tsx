import {
  BLOCK_ACCENTS,
  BLOCK_ASSIGNEES_MAX,
  BLOCK_CHARTS,
  BLOCK_LIMITS,
  OPEN_STATUS_CATEGORIES,
  BLOCK_TITLE_MAX,
  TASK_LIST_FIELDS,
  TASK_PRIORITIES,
  blockConfigKeys,
  type BlockConfig,
  type LayoutItem,
  type LayoutPage,
  type BlockChart,
  type StatusCategory,
  type TaskListField,
  type TaskPriority,
} from '@taskflow/shared-types';
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, RotateCcwIcon } from 'lucide-react';
import { Segmented } from '@/components/kit/segmented';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/cn';
import { useMembers } from '@/modules/members';
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

const PRIORITY_LABEL: Record<TaskPriority, string> = { urgent: 'Urgent', high: 'High', normal: 'Normal', low: 'Low', none: 'No priority' };
const CATEGORY_LABEL: Record<StatusCategory, string> = { unstarted: 'To do', started: 'In progress', review: 'In review', blocked: 'Blocked', done: 'Done', cancelled: 'Cancelled' };
const CHART_LABEL: Record<BlockChart, string> = { bar: 'Bars', line: 'Line' };

const FIELD_LABEL: Record<TaskListField, string> = { number: 'Number', status: 'Status', priority: 'Priority', date: 'Date', assignee: 'Assignee', project: 'Project' };

/** What a task list shows when its columns were never picked: the same as the default look. */
export function defaultFields(pageKey: LayoutPage): TaskListField[] {
  return pageKey === 'project' ? ['number', 'status', 'date'] : ['status', 'date', 'project', 'assignee'];
}

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
  const { data: members = [] } = useMembers(workspaceId ?? '');
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

        {(keys.includes('spaceId') && workspaceId) || keys.includes('mine') || keys.includes('followContext') ? (
          <section aria-labelledby="block-data" className="grid gap-3">
            <h3 id="block-data" className="font-mono text-[10.5px] font-semibold tracking-[0.06em] text-subtle-foreground uppercase">
              Data source
            </h3>
            {keys.includes('spaceId') && workspaceId ? (
              <>
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
              </>
            ) : null}
            {keys.includes('mine') ? (
              <label className="flex items-center gap-2 text-sm">
                {/* "Mine" and chosen people don't mix: picking one clears the other. */}
                <Checkbox checked={config.mine === true} onCheckedChange={(checked) => set({ mine: checked === true ? true : undefined, assigneeIds: checked === true ? undefined : config.assigneeIds })} />
                Only tasks assigned to me
              </label>
            ) : null}
            {keys.includes('assigneeIds') && workspaceId ? (
              <div className="grid gap-1.5">
                <span id="block-assignees" className="text-sm font-medium">
                  Assigned to
                </span>
                <div role="group" aria-labelledby="block-assignees" className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
                  {members.map((member) => {
                    const on = config.assigneeIds?.includes(member.userId) ?? false;
                    const full = !on && (config.assigneeIds?.length ?? 0) >= BLOCK_ASSIGNEES_MAX;
                    return (
                      <button
                        key={member.userId}
                        type="button"
                        aria-pressed={on}
                        disabled={full}
                        onClick={() => {
                          const next = on ? (config.assigneeIds ?? []).filter((id) => id !== member.userId) : [...(config.assigneeIds ?? []), member.userId];
                          set({ assigneeIds: next.length ? next : undefined, mine: next.length ? undefined : config.mine });
                        }}
                        className={cn('rounded-full border px-2.5 py-1 text-xs disabled:opacity-50', on ? 'border-ring bg-primary-soft text-ring' : 'text-muted-foreground hover:bg-muted')}
                      >
                        {member.name}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">None picked shows everyone the page shows. Up to {BLOCK_ASSIGNEES_MAX} people.</p>
              </div>
            ) : null}
            {keys.includes('followContext') ? (
              <div className="grid gap-1">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={config.followContext === true} onCheckedChange={(checked) => set({ followContext: checked === true ? true : undefined })} />
                  Follow the page's selection
                </label>
                <p className="pl-6 text-xs text-muted-foreground">
                  {pageKey === 'home' ? 'Click a person or a project in People, Hours by person or Hours by project to narrow this block to them.' : 'Click a person in People to narrow this block to their work.'}
                </p>
              </div>
            ) : null}
            {keys.includes('priorities') ? (
              <div className="grid gap-1.5">
                <span className="text-sm font-medium">Priority</span>
                <div role="group" aria-label="Priority" className="flex flex-wrap gap-1.5">
                  {TASK_PRIORITIES.map((priority) => {
                    const on = config.priorities?.includes(priority) ?? false;
                    return (
                      <button
                        key={priority}
                        type="button"
                        aria-pressed={on}
                        onClick={() => {
                          const next = on ? (config.priorities ?? []).filter((item) => item !== priority) : [...(config.priorities ?? []), priority];
                          set({ priorities: next.length ? TASK_PRIORITIES.filter((item) => next.includes(item)) : undefined });
                        }}
                        className={cn('rounded-full border px-2.5 py-1 text-xs', on ? 'border-ring bg-primary-soft text-ring' : 'text-muted-foreground hover:bg-muted')}
                      >
                        {PRIORITY_LABEL[priority]}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">None picked shows every priority.</p>
              </div>
            ) : null}
            {keys.includes('categories') ? (
              <div className="grid gap-1.5">
                <span className="text-sm font-medium">Status</span>
                <div role="group" aria-label="Status" className="flex flex-wrap gap-1.5">
                  {OPEN_STATUS_CATEGORIES.map((category) => {
                    const on = config.categories?.includes(category) ?? false;
                    return (
                      <button
                        key={category}
                        type="button"
                        aria-pressed={on}
                        onClick={() => {
                          const next = on ? (config.categories ?? []).filter((item) => item !== category) : [...(config.categories ?? []), category];
                          set({ categories: next.length ? OPEN_STATUS_CATEGORIES.filter((item) => next.includes(item)) : undefined });
                        }}
                        className={cn('rounded-full border px-2.5 py-1 text-xs', on ? 'border-ring bg-primary-soft text-ring' : 'text-muted-foreground hover:bg-muted')}
                      >
                        {CATEGORY_LABEL[category]}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
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
          {keys.includes('chart') ? (
            <Segmented
              label="Chart"
              value={config.chart ?? 'bar'}
              onChange={(value) => set({ chart: value === 'bar' ? undefined : (value as BlockChart) })}
              options={BLOCK_CHARTS.map((chart) => ({ value: chart, label: CHART_LABEL[chart] }))}
            />
          ) : null}
          {keys.includes('fields') ? <FieldPicker value={config.fields ?? defaultFields(pageKey)} onChange={(fields) => set({ fields })} /> : null}
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

/** Which columns a task list shows, and in what order: tick to show, arrows to move. The number always sits before the title. */
function FieldPicker({ value, onChange }: { value: TaskListField[]; onChange: (fields: TaskListField[]) => void }) {
  const ordered: TaskListField[] = value.filter((field) => field !== 'number');
  const hasNumber = value.includes('number');
  const emit = (columns: TaskListField[], number = hasNumber) => onChange(number ? ['number', ...columns] : columns);
  // Shown columns first, in their order, then the hidden ones.
  const rows: TaskListField[] = [...ordered, ...TASK_LIST_FIELDS.filter((field) => field !== 'number' && !ordered.includes(field))];
  const move = (field: TaskListField, by: -1 | 1) => {
    const index = ordered.indexOf(field);
    const next = [...ordered];
    next.splice(index, 1);
    next.splice(index + by, 0, field);
    emit(next);
  };
  return (
    <div className="grid gap-1.5">
      <span className="text-sm font-medium">Columns</span>
      <ul aria-label="Columns" className="grid rounded-md border">
        <li className="flex items-center gap-2 border-b px-2 py-1.5 text-sm">
          <label className="flex flex-1 items-center gap-2">
            <Checkbox checked={hasNumber} onCheckedChange={(checked) => emit(ordered, checked === true)} />
            Number <span className="text-xs text-muted-foreground">(before the title)</span>
          </label>
        </li>
        <li className="flex items-center gap-2 border-b px-2 py-1.5 text-sm text-muted-foreground">
          <Checkbox checked disabled aria-label="Title (always shown)" /> Title
        </li>
        {rows.map((field) => {
          const index = ordered.indexOf(field);
          const shown = index >= 0;
          return (
            <li key={field} className="flex items-center gap-2 border-b px-2 py-1 text-sm last:border-b-0">
              <label className="flex flex-1 items-center gap-2">
                <Checkbox checked={shown} onCheckedChange={(checked) => emit(checked === true ? [...ordered, field] : ordered.filter((item) => item !== field))} />
                {FIELD_LABEL[field]}
              </label>
              <Button variant="ghost" size="icon" className="size-7" aria-label={`Move ${FIELD_LABEL[field]} up`} disabled={!shown || index === 0} onClick={() => move(field, -1)}>
                <ArrowUpIcon />
              </Button>
              <Button variant="ghost" size="icon" className="size-7" aria-label={`Move ${FIELD_LABEL[field]} down`} disabled={!shown || index === ordered.length - 1} onClick={() => move(field, 1)}>
                <ArrowDownIcon />
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
