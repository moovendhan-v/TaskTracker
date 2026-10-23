import { useNavigate } from '@tanstack/react-router';
import { KanbanIcon, ListIcon, SearchIcon } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { ErrorState } from '@/components/common/error-state';
import { FullPageSpinner } from '@/components/common/full-page-spinner';
import { PageHeader } from '@/components/common/page-header';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TaskBoardView, TaskDetailSheet, TaskListView, useTasks, useTaskViewStore, type TaskViewMode } from '@/modules/tasks';
import { useList } from '../hooks/use-lists';

interface ListPageProps {
  workspaceId: string;
  listId: string;
  /** Task open in the side panel, kept in the URL so it can be shared. */
  openTaskId: string | undefined;
}

export function ListPage({ workspaceId, listId, openTaskId }: ListPageProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const view = useTaskViewStore((state) => state.viewByList[listId] ?? 'list');
  const setView = useTaskViewStore((state) => state.setView);
  const { data: list } = useList(workspaceId, listId);
  const tasks = useTasks(workspaceId, listId, deferredSearch ? { search: deferredSearch } : {});

  const openTask = (taskId: string | undefined) =>
    void navigate({ to: '/w/$workspaceId/l/$listId', params: { workspaceId, listId }, search: { task: taskId } });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={list?.name ?? 'List'}
        description={tasks.data ? `${tasks.data.total} tasks` : undefined}
        icon={<ListIcon className="size-5 text-muted-foreground" />}
        actions={
          <>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search tasks"
                aria-label="Search tasks"
                maxLength={100}
                className="h-8 w-48 pl-8"
              />
            </div>
            <Tabs value={view} onValueChange={(value) => setView(listId, value as TaskViewMode)}>
              <TabsList>
                <TabsTrigger value="list">
                  <ListIcon /> List
                </TabsTrigger>
                <TabsTrigger value="board">
                  <KanbanIcon /> Board
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </>
        }
      />
      <div className="min-h-0 flex-1 overflow-auto p-6">
        {tasks.isLoading ? <FullPageSpinner /> : null}
        {tasks.isError ? <ErrorState error={tasks.error} onRetry={() => void tasks.refetch()} /> : null}
        {tasks.data ? (
          view === 'board' ? (
            <TaskBoardView workspaceId={workspaceId} listId={listId} tasks={tasks.data.items} onOpen={openTask} />
          ) : (
            <TaskListView workspaceId={workspaceId} listId={listId} tasks={tasks.data.items} onOpen={openTask} />
          )
        ) : null}
      </div>
      <TaskDetailSheet workspaceId={workspaceId} taskId={openTaskId} onClose={() => openTask(undefined)} />
    </div>
  );
}
