import type { BlockConfig, DashboardRequest, DashboardResponse, LayoutItem } from '@taskflow/shared-types';
import { FolderKanbanIcon, SlidersHorizontalIcon, Trash2Icon } from 'lucide-react';
import { Block } from '@/components/kit/block';
import { blockStateOf, type BlockState } from '@/components/kit/block-state';
import { useSpaces } from '@/modules/spaces';
import { useDashboard } from '../hooks/use-dashboard';
import type { BlockDefinition } from './home-blocks';

/** Where a block with its own data source (one project) gets its numbers. */
export interface BlockScope {
  workspaceId: string;
  /** The page's own query, narrowed to one project. */
  inputFor: (spaceId: string) => DashboardRequest;
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
  const spaceId = item.config?.spaceId;
  if (spaceId && scope) return <ScopedBlock item={item} scope={scope} spaceId={spaceId} {...props} />;
  return <BlockView item={item} projectName={undefined} {...props} />;
}

function ScopedBlock({ scope, spaceId, ...props }: Omit<ConfiguredBlockProps, 'scope'> & { scope: BlockScope; spaceId: string }) {
  // Read with the viewer's own access, like every block: a project you can't see shows as no access.
  const scoped = useDashboard(scope.workspaceId, scope.inputFor(spaceId));
  const { data: spaces = [] } = useSpaces(scope.workspaceId);
  const name = spaces.find((space) => space.id === spaceId)?.name;
  return <BlockView {...props} data={scoped.data} state={blockStateOf(scoped, { what: 'this project' })} projectName={name ?? 'A project'} />;
}

function BlockView({
  item,
  block,
  data,
  state,
  arranging,
  canArrange,
  projectName,
  onConfigure,
  onRemove,
}: Omit<ConfiguredBlockProps, 'scope'> & { projectName: string | undefined }) {
  const config: BlockConfig = item.config ?? {};
  const count = data && block.chip?.(data);
  // The chip says where the numbers come from when it isn't the page's own scope.
  const chip = projectName ? { label: count ? `${projectName} · ${count}` : projectName, icon: FolderKanbanIcon, tone: 'linked' as const } : count ? { label: count } : undefined;
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
