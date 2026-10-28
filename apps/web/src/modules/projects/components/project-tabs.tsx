import { Link } from '@tanstack/react-router';
import { ChevronDownIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/cn';
import { VIEW_META, type ProjectView } from '../lib/views';

/** Core views always visible as primary tabs. */
const CORE_VIEWS: readonly ProjectView[] = ['list', 'board', 'table', 'calendar', 'timeline'];

/** Secondary views and tools available in the More views menu. */
const TOOL_VIEWS: readonly ProjectView[] = ['planner', 'dashboard', 'sprints', 'time', 'automations'];
const PROJECT_MANAGEMENT_VIEWS: readonly ProjectView[] = ['members', 'settings'];

/** The project's views as tabs with a responsive "More views" menu so tabs never awkwardly overflow. */
export function ProjectTabs({
  workspaceId,
  spaceId,
  current,
  listId,
  className,
}: {
  workspaceId: string;
  spaceId: string;
  current: ProjectView;
  listId?: string;
  className?: string;
}) {
  // If the active view is one of the secondary views, pin it to the tab bar so the user always sees it
  const isMoreView = !CORE_VIEWS.includes(current);
  const visibleTabs: ProjectView[] = isMoreView ? [...CORE_VIEWS, current] : [...CORE_VIEWS];

  return (
    <nav aria-label="Project views" className={cn('flex items-center gap-1', className)}>
      {visibleTabs.map((view) => {
        const meta = VIEW_META[view];
        const Icon = meta.icon;
        const active = view === current;
        return (
          <Link
            key={view}
            to="/w/$workspaceId/p/$spaceId/$view"
            params={{ workspaceId, spaceId, view }}
            search={listId ? { list: listId } : {}}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors',
              active
                ? 'bg-primary/15 text-foreground font-semibold ring-1 ring-primary/40'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className={cn('size-3.5', meta.tint)} />
            {meta.label}
          </Link>
        );
      })}

      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            'flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors outline-none cursor-pointer',
            isMoreView
              ? 'text-foreground font-semibold bg-primary/10'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
          aria-label="More views and tools"
        >
          <span>More views</span>
          <ChevronDownIcon className="size-3 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Views & Tools</div>
          {TOOL_VIEWS.map((view) => {
            const meta = VIEW_META[view];
            const Icon = meta.icon;
            const active = view === current;
            return (
              <DropdownMenuItem key={view} asChild>
                <Link
                  to="/w/$workspaceId/p/$spaceId/$view"
                  params={{ workspaceId, spaceId, view }}
                  search={listId ? { list: listId } : {}}
                  className={cn('flex items-center gap-2 cursor-pointer', active && 'bg-accent font-medium')}
                >
                  <Icon className={cn('size-4', meta.tint)} />
                  <span className="flex-1">{meta.label}</span>
                  {active ? <span className="size-1.5 rounded-full bg-primary" /> : null}
                </Link>
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Project</div>
          {PROJECT_MANAGEMENT_VIEWS.map((view) => {
            const meta = VIEW_META[view];
            const Icon = meta.icon;
            const active = view === current;
            return (
              <DropdownMenuItem key={view} asChild>
                <Link
                  to="/w/$workspaceId/p/$spaceId/$view"
                  params={{ workspaceId, spaceId, view }}
                  search={listId ? { list: listId } : {}}
                  className={cn('flex items-center gap-2 cursor-pointer', active && 'bg-accent font-medium')}
                >
                  <Icon className={cn('size-4', meta.tint)} />
                  <span className="flex-1">{meta.label}</span>
                  {active ? <span className="size-1.5 rounded-full bg-primary" /> : null}
                </Link>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
