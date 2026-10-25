import { TASK_PRIORITIES, TASK_STATUSES } from '@taskflow/shared-types';
import { QueryField, QueryResource } from '../../../core/query/query-resource.decorators.js';

/** Most urgent first; a fixed expression with no user input. */
export const PRIORITY_RANK_SQL = `CASE task.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 WHEN 'low' THEN 3 ELSE 4 END`;

export const TASK_RESOURCE = 'tasks';

/**
 * How tasks can be filtered, sorted and paged. Clients read this through
 * `resourceSchema(resource: "tasks")` and build their tables from it.
 */
@QueryResource({
  name: 'tasks',
  label: 'Tasks',
  permission: 'task.view',
  idColumn: 'task.id',
  defaultSort: [{ field: 'position', direction: 'asc' }],
  defaultPageSize: 50,
  maxPageSize: 100,
  search: ['task.title'],
})
export class TaskQueryResource {
  @QueryField({ type: 'string', column: 'task.title', label: 'Name', sortable: true, width: 360 })
  title: string;

  @QueryField({ type: 'enum', column: 'task.status', options: TASK_STATUSES, sortable: true, display: 'badge', width: 140 })
  status: string;

  @QueryField({ type: 'enum', column: 'task.priority', sortColumn: PRIORITY_RANK_SQL, options: TASK_PRIORITIES, sortable: true, display: 'priority', width: 120 })
  priority: string;

  @QueryField({ type: 'user', column: 'task.assignee_id', label: 'Assignee', display: 'avatar', width: 120 })
  assigneeId: string;

  @QueryField({ type: 'datetime', column: 'task.due_date', label: 'Due date', sortable: true, display: 'date', width: 140 })
  dueDate: string;

  @QueryField({ type: 'uuid', column: 'task.list_id', label: 'List', defaultVisible: false })
  listId: string;

  @QueryField({ type: 'uuid', column: 'task.sprint_id', label: 'Sprint', defaultVisible: false })
  sprintId: string;

  @QueryField({ type: 'user', column: 'task.created_by_id', label: 'Created by', defaultVisible: false, display: 'avatar' })
  createdById: string;

  @QueryField({ type: 'datetime', column: 'task.created_at', label: 'Created', sortable: true, defaultVisible: false, display: 'relative' })
  createdAt: string;

  @QueryField({ type: 'datetime', column: 'task.updated_at', label: 'Updated', sortable: true, defaultVisible: false, display: 'relative' })
  updatedAt: string;

  @QueryField({ type: 'number', column: 'task.position', label: 'Manual order', sortable: true, filterable: false, defaultVisible: false })
  position: number;

  @QueryField({ type: 'json', column: 'task.metadata', label: 'Metadata', defaultVisible: false, display: 'code' })
  metadata: string;
}
