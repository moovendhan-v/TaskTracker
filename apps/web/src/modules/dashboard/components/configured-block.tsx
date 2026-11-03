import type { BlockConfig, DashboardRequest, DashboardResponse, LayoutItem, TaskPriority } from '@taskflow/shared-types';
import { FilterIcon, FolderKanbanIcon, SlidersHorizontalIcon, Trash2Icon } from 'lucide-react';
import { Block } from '@/components/kit/block';
import { blockStateOf, type BlockState } from '@/components/kit/block-state';
import { useSpaces } from '@/modules/spaces';
import { useDashboard } from '../hooks/use-dashboard';
import type { BlockDefinition } from './home-blocks';

/** How a block narrows the page's data: one project, your own tasks, some priorities. */
export interface BlockNarrowing {
  spaceId?: string;
  mine?: boolean;
  priorities?: TaskPriority[];
}

/** Where a block with its own data source gets its numbers. */
export interface BlockScope {
  workspaceId: string;
  /** The page's own query, narrowed as the block asks. */
  inputFor: (narrowing: BlockNarrowing) => DashboardRequest;
}

const PRIORITY_SHORT: Record<TaskPriority, string> = { urgent: 'Urgent', high: 'High', normal: 'Normal', low: 'Low', none: 'No priority' };

/** The block's own data settings, or null when it reads the page's data as is. */
export function narrowingOf(config: BlockConfig | null | undefined): BlockNarrowing | null {
  if (!config?.spaceId && !config?.mine && !config?.priorities?.length) return null;
  return { spaceId: config.spaceId, mine: config.mine, priorities: config.priorities };
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
}

/** A block drawn with its own settings: title and accent (view), and its own project (data) when it has one. */
export function ConfiguredBlock({ item, scope, ...props }: ConfiguredBlockProps) {
  const narrowing = narrowingOf(item.config);
  if (narrowing && scope) return <ScopedBlock item={item} scope={scope} narrowing={narrowing} {...props} />;
  return <BlockView item={item} source={undefined} {...props} />;
}

function ScopedBlock({ scope, narrowing, ...props }: Omit<ConfiguredBlockProps, 'scope'> & { scope: BlockScope; narrowing: BlockNarrowing }) {
  // Read with the viewer's own access, like every block: a project you can't see shows as no access.
  const scoped = useDashboard(scope.workspaceId, scope.inputFor(narrowing));
  const { data: spaces = [] } = useSpaces(scope.workspaceId);
  const parts = [
    narrowing.spaceId ? (spaces.find((space) => space.id === narrowing.spaceId)?.name ?? 'A project') : null,
    narrowing.mine ? 'Mine' : null,
    narrowing.priorities?.length ? narrowing.priorities.map((priority) => PRIORITY_SHORT[priority]).join(', ') : null,
  ].filter((part): part is string => part !== null);
  // Counts in the chip come from the page's totals, which a priority filter doesn't narrow, so they're left out then.
  const source = { label: parts.join(' · '), project: Boolean(narrowing.spaceId), counts: !narrowing.priorities?.length };
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
}: Omit<ConfiguredBlockProps, 'scope'> & { source: { label: string; project: boolean; counts: boolean } | undefined }) {
  const config: BlockConfig = item.config ?? {};
  const count = data && block.chip?.(data);
  // The chip says where the numbers come from when it isn't the page's own scope.
  const chip = source
    ? { label: count && source.counts ? `${source.label} · ${count}` : source.label, icon: source.project ? FolderKanbanIcon : FilterIcon, tone: 'linked' as const }
    : count
      ? { label: count }
      : undefined;
  return (
    <Block
      title={config.title || block.title}
      icon={block.icon}
      accent={config.accent}
      aside={block.aside}
      chip={chip}
      state={state}
      skeleton={block.skeleton}
      arranging={arranging}
      maximisable
      actions={
        canArrange
          ? [
              { label: 'Configure…', icon: SlidersHorizontalIcon, onSelect: onConfigure },
              { label: 'Remove', icon: Trash2Icon, destructive: true, onSelect: onRemove },
            ]
          : []
      }
      bodyClassName="overflow-y-auto"
    >
      {data ? block.render(data, config) : null}
    </Block>
  );
}
