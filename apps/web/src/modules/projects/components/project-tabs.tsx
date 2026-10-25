import { Link } from '@tanstack/react-router';
import { cn } from '@/lib/cn';
import { PROJECT_VIEWS, VIEW_META, type ProjectView } from '../lib/views';

/** The project's views as tabs; each is a link, so views can be bookmarked and shared. */
export function ProjectTabs({ workspaceId, spaceId, current, listId }: { workspaceId: string; spaceId: string; current: ProjectView; listId?: string }) {
  return (
    <nav aria-label="Project views" className="-mb-px flex gap-1 overflow-x-auto border-b">
      {PROJECT_VIEWS.map((view) => {
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
              'flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
              active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className={cn('size-4', meta.tint)} />
            {meta.label}
          </Link>
        );
      })}
    </nav>
  );
}
