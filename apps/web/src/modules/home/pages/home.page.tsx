import { Link } from '@tanstack/react-router';
import { FolderPlusIcon, HomeIcon, ListIcon } from 'lucide-react';
import { ColorDot } from '@/components/common/color-dot';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentUser } from '@/core/auth/use-current-user';
import { useLists } from '@/modules/lists';
import { useSpaces } from '@/modules/spaces';
import { useWorkspace } from '@/modules/workspaces';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function HomePage({ workspaceId }: { workspaceId: string }) {
  const { data: me } = useCurrentUser();
  const { data: workspace } = useWorkspace(workspaceId);
  const { data: spaces = [] } = useSpaces(workspaceId);
  const { data: lists = [] } = useLists(workspaceId);

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader
        title={`${greeting()}${me ? `, ${me.name.split(' ')[0]}` : ''}`}
        description={workspace ? `Here's what's in ${workspace.name}.` : undefined}
        icon={<HomeIcon className="size-5 text-muted-foreground" />}
      />
      <div className="mx-auto max-w-5xl p-6">
        {spaces.length === 0 ? (
          <EmptyState
            icon={<FolderPlusIcon />}
            title="Create your first space"
            description="Use the + next to Spaces in the sidebar. A space groups lists for a team, client or project."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {spaces.map((space) => {
              const spaceLists = lists.filter((list) => list.spaceId === space.id);
              return (
                <Card key={space.id} className="overflow-hidden">
                  <div className="h-1.5" style={{ backgroundColor: space.color }} />
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ColorDot color={space.color} /> {space.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-1 pt-2">
                    {spaceLists.length === 0 ? <p className="text-sm text-muted-foreground">No lists yet</p> : null}
                    {spaceLists.map((list) => (
                      <Link
                        key={list.id}
                        to="/w/$workspaceId/l/$listId"
                        params={{ workspaceId, listId: list.id }}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                      >
                        <ListIcon className="size-4 text-muted-foreground" /> {list.name}
                      </Link>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
