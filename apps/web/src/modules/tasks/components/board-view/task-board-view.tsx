import { ChevronRightIcon } from 'lucide-react';
import { useState, type DragEvent } from 'react';
import type { TaskResponse, TaskStatusResponse, UpdateTaskRequest } from '@taskflow/shared-types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/cn';
import { useStoredChoice } from '@/lib/use-stored-choice';
import { useMemberName } from '@/modules/members';
import { usePermissions } from '@/modules/workspaces';
import { useStatuses } from '../../hooks/use-tasks';
import { useTaskMutations } from '../../hooks/use-task-mutations';
import { boardLanes, SWIMLANE_LABELS, SWIMLANES, type Lane, type Swimlane } from '../../lib/board-lanes';
import { positionBetween } from '../../lib/task-meta';
import { useShareTaskOrder } from '../../store/task-sequence.store';
import { BoardColumn, ColumnHeader } from './board-column';
import { TASK_DRAG_TYPE } from './task-card';

interface TaskBoardViewProps {
  workspaceId: string;
  /** Space whose statuses make the columns (fetched when `statuses` isn't given). */
  spaceId: string;
  statuses?: readonly TaskStatusResponse[];
  /** Set when new cards can be added in place; boards spanning lists leave it out. */
  listId?: string;
  tasks: readonly TaskResponse[];
  onOpen: (taskId: string) => void;
}

/**
 * One column per status; drag a card to change its status or order. Swimlanes
 * split the rows by assignee, priority or type (remembered per project in this
 * browser); dropping a card into another lane sets that too. Columns with a
 * work-in-progress limit show how full they are.
 */
export function TaskBoardView({ workspaceId, spaceId, statuses: given, listId, tasks, onOpen }: TaskBoardViewProps) {
  const { update } = useTaskMutations(workspaceId);
  const { can, canIn } = usePermissions(workspaceId);
  const memberName = useMemberName(workspaceId);
  const { data: fetched = [] } = useStatuses(workspaceId, given ? undefined : spaceId);
  const statuses = given ?? fetched;
  const [laneBy, setLaneBy] = useStoredChoice<Swimlane>(`board-lanes:${spaceId}`, SWIMLANES, 'none');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const lanes = boardLanes(tasks, laneBy, memberName);
  const inStatus = (laneTasks: readonly TaskResponse[], statusId: string) => laneTasks.filter((task) => task.statusId === statusId).sort((a, b) => a.position - b.position);
  const columnCount = (statusId: string) => tasks.filter((task) => task.statusId === statusId).length;
  const canEdit = spaceId ? canIn(spaceId, 'task.update') : can('task.update');
  const canCreate = Boolean(listId) && (spaceId ? canIn(spaceId, 'task.create') : can('task.create'));
  // The preview steps lane by lane, column by column, top to bottom, as the board reads.
  useShareTaskOrder(lanes.flatMap((lane) => (collapsed.has(lane.key) ? [] : statuses.flatMap((status) => inStatus(lane.tasks, status.id).map((task) => task.id)))));

  function handleDrop(event: DragEvent, lane: Lane, status: TaskStatusResponse, beforeTaskId: string | null) {
    event.preventDefault();
    const taskId = event.dataTransfer.getData(TASK_DRAG_TYPE);
    if (!taskId || taskId === beforeTaskId) return;
    const task = tasks.find((item) => item.id === taskId);
    const cell = inStatus(lane.tasks, status.id).filter((item) => item.id !== taskId);
    const index = beforeTaskId ? cell.findIndex((item) => item.id === beforeTaskId) : cell.length;
    const body: UpdateTaskRequest = { statusId: status.id, position: positionBetween(cell[index - 1]?.position, cell[index]?.position) };
    // Into another lane: take on that lane's value too (only what differs).
    if (task && lane.sets.priority && lane.sets.priority !== task.priority) body.priority = lane.sets.priority;
    if (task && lane.sets.type && lane.sets.type !== task.type) body.type = lane.sets.type;
    if (task && 'assigneeId' in lane.sets && lane.sets.assigneeId !== task.assigneeId) body.assigneeId = lane.sets.assigneeId ?? null;
    update.mutate({ taskId, body, status });
  }

  const picker = (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Swimlanes</span>
      <Select value={laneBy} onValueChange={(value: Swimlane) => setLaneBy(value)}>
        <SelectTrigger aria-label="Swimlanes" className="h-8 w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SWIMLANES.map((option) => (
            <SelectItem key={option} value={option}>
              {SWIMLANE_LABELS[option]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  if (laneBy === 'none') {
    const lane = lanes[0]!;
    return (
      <div className="flex h-full flex-col gap-3">
        {picker}
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-2">
          {statuses.map((status) => (
            <BoardColumn
              key={status.id}
              workspaceId={workspaceId}
              listId={listId}
              spaceId={spaceId}
              status={status}
              tasks={inStatus(lane.tasks, status.id)}
              columnCount={columnCount(status.id)}
              canEdit={canEdit}
              canCreate={canCreate}
              onOpen={onOpen}
              onDrop={(event, target, before) => handleDrop(event, lane, target, before)}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {picker}
      <div className="min-h-0 flex-1 overflow-auto pb-2">
        <div className="grid w-max gap-2">
          {/* One header per column, above every lane. */}
          <div className="sticky top-0 z-10 flex gap-3 bg-background">
            {statuses.map((status) => (
              <div key={status.id} className="w-72 shrink-0 rounded-xl border bg-muted/40">
                <ColumnHeader status={status} count={columnCount(status.id)} />
              </div>
            ))}
          </div>
          {lanes.length === 0 ? <p className="px-1 py-6 text-sm text-muted-foreground">No tasks to show.</p> : null}
          {lanes.map((lane) => {
            const open = !collapsed.has(lane.key);
            return (
              <section key={lane.key} aria-label={`Swimlane ${lane.label}`} className="grid gap-2">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() =>
                    setCollapsed((previous) => {
                      const next = new Set(previous);
                      if (next.has(lane.key)) next.delete(lane.key);
                      else next.add(lane.key);
                      return next;
                    })
                  }
                  className="sticky left-0 flex w-fit items-center gap-1.5 rounded-md px-1 py-1 text-sm font-semibold hover:bg-muted"
                >
                  <ChevronRightIcon className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-90')} />
                  {lane.label}
                  <span className="text-xs font-normal tabular-nums text-muted-foreground">{lane.tasks.length}</span>
                </button>
                {open ? (
                  <div className="flex gap-3">
                    {statuses.map((status) => (
                      <BoardColumn
                        key={status.id}
                        workspaceId={workspaceId}
                        listId={listId}
                        spaceId={spaceId}
                        status={status}
                        tasks={inStatus(lane.tasks, status.id)}
                        laneLabel={lane.label}
                        canEdit={canEdit}
                        canCreate={false}
                        onOpen={onOpen}
                        onDrop={(event, target, before) => handleDrop(event, lane, target, before)}
                      />
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
