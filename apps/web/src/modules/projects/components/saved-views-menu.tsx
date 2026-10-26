import { BookmarkIcon, BookmarkPlusIcon, TrashIcon } from 'lucide-react';
import type { FilterNode, SavedView } from '@taskflow/shared-types';
import { NameDialog } from '@/components/common/name-dialog';
import { notify } from '@/components/kit/notify';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { usePreferenceMutations, usePreferences } from '@/core/preferences/use-preferences';

interface SavedViewsMenuProps {
  /** Views saved for this scope (or for everywhere) show up. */
  scope: string;
  filter: FilterNode | null;
  onApply: (view: SavedView) => void;
}

/** Named filter sets, saved in the user's preferences so they follow them to every device. */
export function SavedViewsMenu({ scope, filter, onApply }: SavedViewsMenuProps) {
  const { savedViews } = usePreferences();
  const { saveView, deleteView } = usePreferenceMutations();
  const views = savedViews.filter((view) => view.resource === 'tasks' && (!view.scope || view.scope === scope));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <BookmarkIcon /> Views
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Saved views</DropdownMenuLabel>
        {views.length === 0 ? <p className="px-2 py-1.5 text-sm text-muted-foreground">None yet. Filter the list, then save it.</p> : null}
        {views.map((view) => (
          <DropdownMenuItem key={view.id} onSelect={() => onApply(view)} className="group">
            <BookmarkIcon /> <span className="flex-1 truncate">{view.name}</span>
            <button
              type="button"
              aria-label={`Delete ${view.name}`}
              className="rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-muted"
              onClick={(event) => {
                event.stopPropagation();
                deleteView.mutate(view.id);
              }}
            >
              <TrashIcon className="size-3.5" />
            </button>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <NameDialog
          formName="view.save"
          title="Save view"
          description="Saves the current filters under a name. Views follow you to every device."
          submitLabel="Save view"
          placeholder="e.g. My overdue bugs"
          trigger={
            <DropdownMenuItem onSelect={(event) => event.preventDefault()} disabled={!filter}>
              <BookmarkPlusIcon /> Save current filters…
            </DropdownMenuItem>
          }
          onSubmit={(values) =>
            saveView
              .mutateAsync({ name: values.name, resource: 'tasks', scope, filter: filter as never, pinned: false })
              .then(() => notify.success('View saved'))
          }
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
