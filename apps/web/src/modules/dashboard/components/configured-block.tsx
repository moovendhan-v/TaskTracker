import type { BlockConfig, DashboardRequest, DashboardResponse, LayoutItem, StatusCategory, TaskPriority } from '@taskflow/shared-types';
import { FilterIcon, FolderKanbanIcon, LinkIcon, Layers2Icon, SlidersHorizontalIcon, Trash2Icon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { Block } from '@/components/kit/block';
import { blockStateOf, type BlockState } from '@/components/kit/block-state';
import { useMembers } from '@/modules/members';
import { useSpaces } from '@/modules/spaces';
import { useDashboard } from '../hooks/use-dashboard';
import { usePageSelection, type PageSelection } from '../lib/page-selection';
import type { BlockDefinition, BlockRegistry } from './home-blocks';

/** How a block narrows the page's data: one project, your own tasks, some priorities. */
export interface BlockNarrowing {
  spaceId?: string;
  mine?: boolean;
  /** People whose tasks to show; overrides the page's people filter for this block. */
  userIds?: string[];
  priorities?: TaskPriority[];
  categories?: StatusCategory[];
}

/** Where a block with its own data source gets its numbers. */
export interface BlockScope {
  workspaceId: string;
  /** The page's own query, narrowed as the block asks. */
  inputFor: (narrowing: BlockNarrowing) => DashboardRequest;
}

const CATEGORY_SHORT: Record<StatusCategory, string> = { unstarted: 'To do', started: 'In progress', review: 'In review', blocked: 'Blocked', done: 'Done', cancelled: 'Cancelled' };

const PRIORITY_SHORT: Record<TaskPriority, string> = { urgent: 'Urgent', high: 'High', normal: 'Normal', low: 'Low', none: 'No priority' };

/**
 * The block's own data settings, with the page's selection when the block
 * follows it, or null when it reads the page's data as is. A followed person
 * replaces the block's own people ("mine" included); a followed project
 * replaces its own project.
 */
export function narrowingOf(config: BlockConfig | null | undefined, selection: PageSelection | null = null): BlockNarrowing | null {
  const linked = config?.followContext ? selection : null;
  const person = linked?.kind === 'person' ? linked.id : null;
  const spaceId = linked?.kind === 'project' ? linked.id : config?.spaceId;
  const mine = person ? undefined : config?.mine;
  const userIds = person ? [person] : config?.assigneeIds?.length ? config.assigneeIds : undefined;
  if (!spaceId && !mine && !userIds && !config?.priorities?.length && !config?.categories?.length) return null;
  return { spaceId, mine, userIds, priorities: config?.priorities, categories: config?.categories };
}

interface ConfiguredBlockProps {
  item: LayoutItem;
  block: BlockDefinition;
  data: DashboardResponse | undefined;
  state: BlockState;
  arranging: boolean;
  canArrange: boolean;
  scope?: BlockScope;
  onConfigure: () => void;
  onRemove: () => void;
  /** For stacked tabs: the page's blocks (to draw the other tabs), and stacking actions while arranging. */
  registry?: BlockRegistry;
  onStack?: () => void;
  onUnstack?: (type: string) => void;
}

/** A block drawn with its own settings: title and accent (view), and its own project (data) when it has one. */
export function ConfiguredBlock({ item, scope, ...props }: ConfiguredBlockProps) {
  if (item.type === 'section') return <SectionHeading item={item} arranging={props.arranging} canArrange={props.canArrange} onConfigure={props.onConfigure} onRemove={props.onRemove} />;
  return <BlockWithData item={item} scope={scope} {...props} />;
}

function BlockWithData({ item, scope, ...props }: ConfiguredBlockProps) {
  const page = usePageSelection();
  const linked = item.config?.followContext ? (page?.selection ?? null) : null;
  const narrowing = narrowingOf(item.config, page?.selection ?? null);
  if (narrowing && scope) return <ScopedBlock item={item} scope={scope} narrowing={narrowing} linked={linked} onUnlink={page?.clear} {...props} />;
  return <BlockView item={item} source={undefined} {...props} />;
}

function ScopedBlock({ scope, narrowing, linked, onUnlink, ...props }: Omit<ConfiguredBlockProps, 'scope'> & { scope: BlockScope; narrowing: BlockNarrowing; linked: PageSelection | null; onUnlink?: () => void }) {
  // Read with the viewer's own access, like every block: a project you can't see shows as no access.
  const scoped = useDashboard(scope.workspaceId, scope.inputFor(narrowing));
  const { data: spaces = [] } = useSpaces(scope.workspaceId);
  const { data: members = [] } = useMembers(scope.workspaceId);
  const people = narrowing.userIds && !linked ? narrowing.userIds.map((id) => members.find((member) => member.userId === id)?.name ?? 'Someone') : [];
  const parts = [
    linked ? `Linked to ${linked.name}` : null,
    narrowing.spaceId && linked?.kind !== 'project' ? (spaces.find((space) => space.id === narrowing.spaceId)?.name ?? 'A project') : null,
    narrowing.mine ? 'Mine' : null,
    people.length ? (people.length > 2 ? `${people.slice(0, 2).join(', ')} +${people.length - 2}` : people.join(', ')) : null,
    narrowing.priorities?.length ? narrowing.priorities.map((priority) => PRIORITY_SHORT[priority]).join(', ') : null,
    narrowing.categories?.length ? narrowing.categories.map((category) => CATEGORY_SHORT[category]).join(', ') : null,
  ].filter((part): part is string => part !== null);
  // Counts in the chip come from the page's totals, which a priority filter doesn't narrow, so they're left out then.
  const source = { label: parts.join(' · '), project: Boolean(narrowing.spaceId), linked: Boolean(linked), counts: !narrowing.priorities?.length && !narrowing.categories?.length, onClear: linked ? onUnlink : undefined };
  return <BlockView {...props} data={scoped.data} state={blockStateOf(scoped, { what: narrowing.spaceId ? 'this project' : 'this block' })} source={source} />;
}

function BlockView({
  item,
  block,
  data,
  state,
  arranging,
  canArrange,
  source,
  onConfigure,
  onRemove,
  registry,
  onStack,
  onUnstack,
}: Omit<ConfiguredBlockProps, 'scope'> & { source: { label: string; project: boolean; linked?: boolean; counts: boolean; onClear?: () => void } | undefined }) {
  const config: BlockConfig = item.config ?? {};
  // Stacked tabs: this block first, then the others; which one shows is per viewer and not saved.
  const stack = [item.type, ...(item.tabs ?? [])].filter((type, index) => index === 0 || registry?.blocks[type]);
  const [active, setActive] = useState(item.type);
  const shownType = stack.includes(active) ? active : item.type;
  const shown = shownType === item.type ? block : (registry?.blocks[shownType] ?? block);
  const count = data && shown.chip?.(data);
  // The chip says where the numbers come from when it isn't the page's own scope.
  const chip = source
    ? { label: count && source.counts ? `${source.label} · ${count}` : source.label, icon: source.linked ? LinkIcon : source.project ? FolderKanbanIcon : FilterIcon, tone: 'linked' as const, onClear: source.onClear, clearLabel: 'Clear the page selection' }
    : count
      ? { label: count }
      : undefined;
  return (
    <Block
      title={stack.length > 1 ? (shownType === item.type ? config.title || block.title : shown.title) : config.title || block.title}
      icon={shown.icon}
      accent={config.accent}
      aside={stack.length > 1 ? undefined : shown.aside}
      toolbar={
        stack.length > 1 ? (
          <div role="tablist" aria-label="Stacked blocks" className="flex items-center gap-0.5">
            {stack.map((type) => {
              const tab = type === item.type ? block : registry!.blocks[type]!;
              const TabIcon = tab.icon;
              return (
                <span key={type} className="flex items-center">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={type === shownType}
                    title={type === item.type ? config.title || tab.title : tab.title}
                    aria-label={type === item.type ? config.title || tab.title : tab.title}
                    onClick={() => setActive(type)}
                    className={cn('grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted', type === shownType && 'bg-muted text-foreground')}
                  >
                    <TabIcon className="size-3.5" />
                  </button>
                  {arranging && onUnstack && type !== item.type ? (
                    <button type="button" aria-label={`Unstack ${tab.title}`} onClick={() => onUnstack(type)} className="grid size-4 place-items-center rounded text-muted-foreground hover:text-critical">
                      <XIcon className="size-3" />
                    </button>
                  ) : null}
                </span>
              );
            })}
          </div>
        ) : undefined
      }
      chip={chip}
      state={state}
      skeleton={shown.skeleton}
      arranging={arranging}
      maximisable
      actions={
        canArrange
          ? [
              { label: 'Configure…', icon: SlidersHorizontalIcon, onSelect: onConfigure },
              ...(onStack ? [{ label: 'Stack another block here…', icon: Layers2Icon, onSelect: onStack }] : []),
              { label: 'Remove', icon: Trash2Icon, destructive: true, onSelect: onRemove },
            ]
          : []
      }
      bodyClassName="overflow-y-auto"
    >
      {data ? shown.render(data, shownType === item.type ? config : {}) : null}
    </Block>
  );
}

/** A section divider: a full-width heading between regions of the page. */
function SectionHeading({ item, arranging, canArrange, onConfigure, onRemove }: Pick<ConfiguredBlockProps, 'item' | 'arranging' | 'canArrange' | 'onConfigure' | 'onRemove'>) {
  const title = item.config?.title || 'Section';
  return (
    <div className={cn('group/section flex h-full items-end gap-2 border-b-2 pb-1', item.config?.accent ? ACCENT_BORDER[item.config.accent] : 'border-border', arranging && 'rounded-md border-dashed px-2')}>
      <h2 className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight">{title}</h2>
      {canArrange && arranging ? (
        <>
          <button type="button" aria-label={`Configure section ${title}`} onClick={onConfigure} className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted">
            <SlidersHorizontalIcon className="size-3.5" />
          </button>
          <button type="button" aria-label={`Remove section ${title}`} onClick={onRemove} className="grid size-6 place-items-center rounded text-muted-foreground hover:text-critical">
            <Trash2Icon className="size-3.5" />
          </button>
        </>
      ) : null}
    </div>
  );
}

const ACCENT_BORDER: Record<NonNullable<BlockConfig['accent']>, string> = {
  orange: 'border-orange-500',
  blue: 'border-sky-500',
  green: 'border-emerald-500',
  violet: 'border-violet-500',
  pink: 'border-pink-500',
  amber: 'border-amber-500',
};
