import { STATUS_CATEGORIES, TASK_PRIORITIES, TASK_TYPES } from '@taskflow/shared-types';
import { QueryField, QueryResource } from '../../../core/query/query-resource.decorators.js';

export const TASK_RESOURCE = 'tasks';

/** Most urgent first; a fixed expression with no user input. */
export const PRIORITY_RANK_SQL = `CASE task.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 WHEN 'low' THEN 3 ELSE 4 END`;

/** The category of the task's status; a fixed expression with no user input. */
export const STATUS_CATEGORY_SQL = `(SELECT task_status.category FROM task_status WHERE task_status.id = task.status_id)`;

/**
 * The task's linked pull requests at a glance: open if any is open, else merged, else closed;
 * null with none. Fixed expressions with no user input (the link table has its own RLS).
 */
const PULL_REQUEST_STATES = ['open', 'merged', 'closed'] as const;
const PR_EXISTS = (state: string) => `EXISTS (SELECT 1 FROM github_pull_request pr WHERE pr.task_id = task.id AND pr.state = '${state}')`;
export const PULL_REQUEST_STATE_SQL = `(CASE WHEN ${PR_EXISTS('open')} THEN 'open' WHEN ${PR_EXISTS('merged')} THEN 'merged' WHEN ${PR_EXISTS('closed')} THEN 'closed' END)`;
const PULL_REQUEST_RANK_SQL = `(CASE WHEN ${PR_EXISTS('open')} THEN 0 WHEN ${PR_EXISTS('merged')} THEN 1 WHEN ${PR_EXISTS('closed')} THEN 2 ELSE 3 END)`;

/** True when the task's status is done or cancelled. */
export const CLOSED_STATUS_SQL = `(${STATUS_CATEGORY_SQL} IN ('done', 'cancelled'))`;

/**
 * How tasks can be filtered, sorted and paged. Clients read this through
 * `resourceSchema(resource: "tasks")` and build their tables from it. Status
 * options and custom fields (`custom.<id>`) are added per workspace.
 */
@QueryResource({
  name: TASK_RESOURCE,
  label: 'Tasks',
  permission: 'task.view',
  idColumn: 'task.id',
  defaultSort: [{ field: 'position', direction: 'asc' }],
  defaultPageSize: 50,
  maxPageSize: 100,
  search: ['task.title', `('#' || task.number::text)`],
})
export class TaskQueryResource {
  @QueryField({ type: 'number', column: 'task.number', label: 'ID', sortable: true, display: 'number', width: 64 })
  number: number;

  @QueryField({ type: 'string', column: 'task.title', label: 'Name', sortable: true, width: 360 })
  title: string;

  @QueryField({ type: 'uuid', column: 'task.status_id', label: 'Status', display: 'status', width: 140 })
  statusId: string;

  @QueryField({ type: 'enum', column: STATUS_CATEGORY_SQL, label: 'Status group', options: STATUS_CATEGORIES, sortable: true, defaultVisible: false })
  statusCategory: string;

  @QueryField({ type: 'enum', column: 'task.priority', sortColumn: PRIORITY_RANK_SQL, options: TASK_PRIORITIES, sortable: true, display: 'priority', width: 120 })
  priority: string;

  @QueryField({ type: 'enum', column: 'task.type', options: TASK_TYPES, sortable: true, display: 'badge', width: 100, defaultVisible: false })
  type: string;

  @QueryField({ type: 'user', column: 'task.assignee_id', label: 'Assignee', display: 'avatar', width: 120 })
  assigneeId: string;

  @QueryField({ type: 'enum', column: PULL_REQUEST_STATE_SQL, sortColumn: PULL_REQUEST_RANK_SQL, label: 'Pull request', options: PULL_REQUEST_STATES, sortable: true, width: 130 })
  pullRequests: string;

  @QueryField({ type: 'datetime', column: 'task.start_date', label: 'Start date', sortable: true, display: 'date', width: 130, defaultVisible: false })
  startDate: string;

  @QueryField({ type: 'datetime', column: 'task.due_date', label: 'Due date', sortable: true, display: 'date', width: 130 })
  dueDate: string;

  @QueryField({ type: 'number', column: 'task.estimate_minutes', label: 'Estimate (min)', sortable: true, display: 'duration', defaultVisible: false })
  estimateMinutes: number;

  @QueryField({ type: 'number', column: 'task.story_points', label: 'Story points', sortable: true, display: 'number', defaultVisible: false })
  storyPoints: number;

  @QueryField({ type: 'number', column: 'task.progress', label: '% complete', sortable: true, display: 'progress', defaultVisible: false })
  progress: number;

  @QueryField({ type: 'uuid', column: 'task.list_id', label: 'List', defaultVisible: false })
  listId: string;

  @QueryField({ type: 'uuid', column: 'task.parent_id', label: 'Parent', defaultVisible: false })
  parentId: string;

  @QueryField({ type: 'uuid', column: 'task.sprint_id', label: 'Sprint', defaultVisible: false })
  sprintId: string;

  @QueryField({ type: 'user', column: 'task.created_by_id', label: 'Created by', defaultVisible: false, display: 'avatar' })
  createdById: string;

  @QueryField({ type: 'datetime', column: 'task.created_at', label: 'Created', sortable: true, defaultVisible: false, display: 'relative' })
  createdAt: string;

  @QueryField({ type: 'datetime', column: 'task.updated_at', label: 'Updated', sortable: true, defaultVisible: false, display: 'relative' })
  updatedAt: string;

  @QueryField({ type: 'datetime', column: 'task.completed_at', label: 'Completed', sortable: true, defaultVisible: false, display: 'relative' })
  completedAt: string;

  @QueryField({ type: 'number', column: 'task.position', label: 'Manual order', sortable: true, filterable: false, defaultVisible: false })
  position: number;

  @QueryField({ type: 'json', column: 'task.metadata', field: 'task.metadata', label: 'Metadata', defaultVisible: false, display: 'code' })
  metadata: string;

  @QueryField({ type: 'json', column: 'task.custom_fields', label: 'Custom fields', defaultVisible: false })
  custom: string;
}
