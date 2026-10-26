import { Injectable } from '@nestjs/common';
import type { DashboardTask, ForecastKind, SpaceStatus, StatusCategory, TaskPriority } from '@taskflow/shared-types';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import { AnalyticsRepository, type DashboardScope } from '../domain/analytics.repository.js';

/*
 * Every query below is fixed SQL. Values (workspace, space, people, dates, time
 * zone) are bound parameters, and "no filter" is a NULL parameter, so no SQL is
 * ever built from input.
 *
 * Task queries take $1 workspace, $2 space, $3 assignees; time queries take
 * $1 workspace, $2 space, $3 people, $4 from, $5 to and, where days matter,
 * $6 time zone. Queries that mix both move the people filter to $6.
 */
const SCOPED_TASKS = `
  scoped AS (
    SELECT t.id, t.number, t.title, t.priority, t.due_date, t.assignee_id, t.parent_id, t.created_at, t.updated_at, t.completed_at,
           l.space_id, st.name AS status_name, st.color AS status_color, st.category AS status_category,
           st.category IN ('done', 'cancelled') AS closed
    FROM task t
    JOIN task_list l ON l.id = t.list_id AND l.workspace_id = t.workspace_id
    JOIN task_status st ON st.id = t.status_id
    WHERE t.workspace_id = $1 AND ($2::uuid IS NULL OR l.space_id = $2::uuid) AND ($3::text[] IS NULL OR t.assignee_id = ANY($3::text[]))
  )`;

/** Finished entries in the window; `people` is the parameter holding the people filter. */
const scopedTime = (people = 3) => `
  entries AS (
    SELECT e.* FROM time_entry e
    WHERE e.workspace_id = $1 AND ($2::uuid IS NULL OR e.space_id = $2::uuid) AND ($${people}::text[] IS NULL OR e.user_id = ANY($${people}::text[]))
      AND e.ended_at IS NOT NULL AND e.started_at >= $4 AND e.started_at < $5
  )`;
const SCOPED_TIME = scopedTime();

const CATEGORY_RANK = `CASE status_category WHEN 'unstarted' THEN 0 WHEN 'started' THEN 1 WHEN 'review' THEN 2 WHEN 'blocked' THEN 3 WHEN 'done' THEN 4 ELSE 5 END`;

const num = (value: unknown): number => Number(value ?? 0);
const day = (value: unknown): string => (value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10));

@Injectable()
export class SqlAnalyticsRepository extends AnalyticsRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  private query<T>(sql: string, params: unknown[]): Promise<T[]> {
    return this.transactional.manager.query(sql, params);
  }

  private taskParams(scope: DashboardScope): unknown[] {
    return [scope.workspaceId, scope.spaceId, scope.assigneeIds];
  }

  private timeParams(scope: DashboardScope, withZone = false): unknown[] {
    const params = [scope.workspaceId, scope.spaceId, scope.timeUserIds, scope.from, scope.to];
    return withZone ? [...params, scope.timeZone] : params;
  }

  async taskSummary(scope: DashboardScope) {
    const [row] = await this.query<Record<string, string>>(
      `WITH ${SCOPED_TASKS}
       SELECT count(*) FILTER (WHERE NOT closed) AS open, count(*) FILTER (WHERE closed) AS closed,
              count(*) FILTER (WHERE NOT closed AND due_date < now()) AS overdue,
              count(*) FILTER (WHERE NOT closed AND due_date >= now() AND due_date < now() + interval '7 days') AS due_soon,
              count(*) FILTER (WHERE NOT closed AND assignee_id IS NULL) AS unassigned,
              (SELECT count(*) FROM space s WHERE s.workspace_id = $1 AND ($2::uuid IS NULL OR s.id = $2::uuid)) AS projects
       FROM scoped`,
      this.taskParams(scope),
    );
    return {
      projects: num(row?.['projects']),
      openTasks: num(row?.['open']),
      closedTasks: num(row?.['closed']),
      overdue: num(row?.['overdue']),
      dueSoon: num(row?.['due_soon']),
      unassigned: num(row?.['unassigned']),
    };
  }

  async byStatus(scope: DashboardScope) {
    const rows = await this.query<{ name: string; color: string; category: StatusCategory; count: string }>(
      `WITH ${SCOPED_TASKS}
       SELECT min(status_name) AS name, min(status_color) AS color, min(status_category) AS category, count(*) AS count
       FROM scoped GROUP BY lower(status_name) ORDER BY min(${CATEGORY_RANK}), min(status_name)`,
      this.taskParams(scope),
    );
    return rows.map((row) => ({ name: row.name, color: row.color, category: row.category, count: num(row.count) }));
  }

  async byPriority(scope: DashboardScope) {
    const rows = await this.query<{ priority: TaskPriority; open: string; overdue: string }>(
      `WITH ${SCOPED_TASKS}
       SELECT priority, count(*) AS open, count(*) FILTER (WHERE due_date < now()) AS overdue
       FROM scoped WHERE NOT closed GROUP BY priority
       ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 WHEN 'low' THEN 3 ELSE 4 END`,
      this.taskParams(scope),
    );
    return rows.map((row) => ({ priority: row.priority, open: num(row.open), overdue: num(row.overdue) }));
  }

  async overdueAging(scope: DashboardScope) {
    const [row] = await this.query<Record<string, string>>(
      `WITH ${SCOPED_TASKS}
       SELECT count(*) FILTER (WHERE now() - due_date <= interval '7 days') AS a,
              count(*) FILTER (WHERE now() - due_date > interval '7 days' AND now() - due_date <= interval '30 days') AS b,
              count(*) FILTER (WHERE now() - due_date > interval '30 days' AND now() - due_date <= interval '90 days') AS c,
              count(*) FILTER (WHERE now() - due_date > interval '90 days') AS d
       FROM scoped WHERE NOT closed AND due_date < now()`,
      this.taskParams(scope),
    );
    return ['a', 'b', 'c', 'd'].map((key) => num(row?.[key]));
  }

  async dueForecast(scope: DashboardScope) {
    const rows = await this.query<{ kind: ForecastKind; week_start: Date | string | null; count: string }>(
      `WITH ${SCOPED_TASKS},
       open AS (SELECT due_date FROM scoped WHERE NOT closed),
       this_week AS (SELECT date_trunc('week', now() AT TIME ZONE $4)::date AS start),
       weeks AS (SELECT (start + n * 7)::date AS week_start FROM this_week, generate_series(0, 7) AS n)
       SELECT 'overdue' AS kind, NULL AS week_start, (SELECT count(*) FROM open WHERE due_date < now()) AS count, -1 AS ord
       UNION ALL
       SELECT 'week', w.week_start, (SELECT count(*) FROM open WHERE due_date >= now() AND (due_date AT TIME ZONE $4)::date >= w.week_start AND (due_date AT TIME ZONE $4)::date < w.week_start + 7), 0
       FROM weeks w
       UNION ALL
       SELECT 'later', NULL, (SELECT count(*) FROM open, this_week WHERE due_date >= now() AND (due_date AT TIME ZONE $4)::date >= this_week.start + 56), 1
       UNION ALL
       SELECT 'none', NULL, (SELECT count(*) FROM open WHERE due_date IS NULL), 2
       ORDER BY ord, week_start`,
      [...this.taskParams(scope), scope.timeZone],
    );
    const labels = { overdue: 'Overdue', later: 'Later', none: 'No date' } as const;
    return rows.map((row) => ({
      kind: row.kind,
      weekStart: row.week_start ? day(row.week_start) : null,
      label: row.kind === 'week' ? day(row.week_start) : labels[row.kind],
      count: num(row.count),
    }));
  }

  async createdVsClosed(scope: DashboardScope) {
    const rows = await this.query<{ week_start: Date | string; created: string; closed: string }>(
      `WITH ${SCOPED_TASKS},
       weeks AS (SELECT (date_trunc('week', now() AT TIME ZONE $4)::date - n * 7) AS week_start FROM generate_series(0, 7) AS n)
       SELECT w.week_start,
              (SELECT count(*) FROM scoped WHERE (created_at AT TIME ZONE $4)::date >= w.week_start AND (created_at AT TIME ZONE $4)::date < w.week_start + 7) AS created,
              (SELECT count(*) FROM scoped WHERE closed AND (completed_at AT TIME ZONE $4)::date >= w.week_start AND (completed_at AT TIME ZONE $4)::date < w.week_start + 7) AS closed
       FROM weeks w ORDER BY w.week_start`,
      [...this.taskParams(scope), scope.timeZone],
    );
    return rows.map((row) => ({ weekStart: day(row.week_start), created: num(row.created), closed: num(row.closed) }));
  }

  async timeTotals(scope: DashboardScope) {
    const [row] = await this.query<Record<string, string>>(
      `WITH ${SCOPED_TIME}
       SELECT (SELECT COALESCE(sum(minutes), 0) FROM entries) AS minutes, (SELECT count(*) FROM entries) AS entries,
              (SELECT COALESCE(sum(minutes), 0) FROM time_entry e WHERE e.workspace_id = $1 AND ($2::uuid IS NULL OR e.space_id = $2::uuid)
                 AND ($3::text[] IS NULL OR e.user_id = ANY($3::text[])) AND e.ended_at IS NOT NULL) AS all_time`,
      this.timeParams(scope),
    );
    return { minutes: num(row?.['minutes']), entries: num(row?.['entries']), allTime: num(row?.['all_time']) };
  }

  async minutesPerDay(scope: DashboardScope) {
    const rows = await this.query<{ day: Date | string; minutes: string }>(
      `WITH ${SCOPED_TIME},
       days AS (SELECT generate_series(($4::timestamptz AT TIME ZONE $6)::date, (($5::timestamptz - interval '1 second') AT TIME ZONE $6)::date, interval '1 day')::date AS day)
       SELECT d.day, COALESCE(sum(e.minutes), 0) AS minutes
       FROM days d LEFT JOIN entries e ON (e.started_at AT TIME ZONE $6)::date = d.day
       GROUP BY d.day ORDER BY d.day`,
      this.timeParams(scope, true),
    );
    return rows.map((row) => ({ day: day(row.day), minutes: num(row.minutes) }));
  }

  async minutesByPerson(scope: DashboardScope) {
    const rows = await this.query<{ user_id: string; name: string | null; minutes: string }>(
      `WITH ${SCOPED_TIME}
       SELECT e.user_id, u.name, sum(e.minutes) AS minutes FROM entries e LEFT JOIN "user" u ON u.id = e.user_id
       GROUP BY e.user_id, u.name ORDER BY sum(e.minutes) DESC`,
      this.timeParams(scope),
    );
    return rows.map((row) => ({ userId: row.user_id, name: row.name ?? 'Former member', minutes: num(row.minutes) }));
  }

  async minutesByProject(scope: DashboardScope) {
    const rows = await this.query<{ space_id: string | null; name: string | null; minutes: string }>(
      `WITH ${SCOPED_TIME}
       SELECT e.space_id, s.name, sum(e.minutes) AS minutes FROM entries e LEFT JOIN space s ON s.id = e.space_id AND s.workspace_id = e.workspace_id
       GROUP BY e.space_id, s.name ORDER BY sum(e.minutes) DESC`,
      this.timeParams(scope),
    );
    return rows.map((row) => ({ spaceId: row.space_id, name: row.name ?? 'No project', minutes: num(row.minutes) }));
  }

  async minutesByTask(scope: DashboardScope, limit: number) {
    const rows = await this.query<{ task_id: string; number: number; title: string; minutes: string }>(
      `WITH ${SCOPED_TIME}
       SELECT t.id AS task_id, t.number, t.title, sum(e.minutes) AS minutes
       FROM entries e JOIN task t ON t.id = e.task_id AND t.workspace_id = e.workspace_id
       GROUP BY t.id ORDER BY sum(e.minutes) DESC, t.number LIMIT $6`,
      [...this.timeParams(scope), limit],
    );
    return rows.map((row) => ({ taskId: row.task_id, number: row.number, title: row.title, minutes: num(row.minutes) }));
  }

  async people(scope: DashboardScope) {
    const rows = await this.query<{ user_id: string | null; name: string | null; open: string; overdue: string; minutes: string }>(
      `WITH ${SCOPED_TASKS},
       ${scopedTime(6)},
       members AS (SELECT m.user_id FROM workspace_member m WHERE m.workspace_id = $1 AND ($3::text[] IS NULL OR m.user_id = ANY($3::text[])))
       SELECT m.user_id, u.name,
              (SELECT count(*) FROM scoped s WHERE s.assignee_id = m.user_id AND NOT s.closed) AS open,
              (SELECT count(*) FROM scoped s WHERE s.assignee_id = m.user_id AND NOT s.closed AND s.due_date < now()) AS overdue,
              (SELECT COALESCE(sum(minutes), 0) FROM entries e WHERE e.user_id = m.user_id) AS minutes
       FROM members m LEFT JOIN "user" u ON u.id = m.user_id
       UNION ALL
       SELECT NULL, NULL, (SELECT count(*) FROM scoped WHERE assignee_id IS NULL AND NOT closed), (SELECT count(*) FROM scoped WHERE assignee_id IS NULL AND NOT closed AND due_date < now()), 0
       WHERE $3::text[] IS NULL`,
      [scope.workspaceId, scope.spaceId, scope.assigneeIds, scope.from, scope.to, scope.timeUserIds],
    );
    return rows
      .map((row) => ({ userId: row.user_id, name: row.user_id ? (row.name ?? 'Former member') : 'Unassigned', open: num(row.open), overdue: num(row.overdue), minutes: num(row.minutes) }))
      .filter((row) => row.userId !== null || row.open > 0)
      .sort((a, b) => (a.userId === null ? 1 : b.userId === null ? -1 : b.open - a.open || b.minutes - a.minutes || a.name.localeCompare(b.name)));
  }

  async projects(scope: DashboardScope) {
    const rows = await this.query<Record<string, string | Date | null>>(
      `WITH ${SCOPED_TASKS},
       ${scopedTime(6)}
       SELECT sp.id, sp.name, sp.status,
              count(t.id) FILTER (WHERE NOT t.closed) AS open, count(t.id) FILTER (WHERE t.closed) AS closed,
              count(t.id) FILTER (WHERE NOT t.closed AND t.due_date < now()) AS overdue,
              count(t.id) FILTER (WHERE NOT t.closed AND t.due_date >= now() AND t.due_date < now() + interval '7 days') AS due_soon,
              count(DISTINCT t.assignee_id) AS assignees, max(t.updated_at) AS updated_at,
              (SELECT COALESCE(sum(minutes), 0) FROM entries e WHERE e.space_id = sp.id) AS minutes
       FROM space sp LEFT JOIN scoped t ON t.space_id = sp.id
       WHERE sp.workspace_id = $1 AND ($2::uuid IS NULL OR sp.id = $2::uuid)
       GROUP BY sp.id ORDER BY sp.name`,
      [scope.workspaceId, scope.spaceId, scope.assigneeIds, scope.from, scope.to, scope.timeUserIds],
    );
    return rows.map((row) => {
      const open = num(row['open']);
      const closed = num(row['closed']);
      return {
        spaceId: String(row['id']),
        name: String(row['name']),
        status: row['status'] as SpaceStatus,
        open,
        closed,
        overdue: num(row['overdue']),
        dueSoon: num(row['due_soon']),
        progress: open + closed === 0 ? 0 : Math.round((closed / (open + closed)) * 100),
        minutes: num(row['minutes']),
        assignees: num(row['assignees']),
        updatedAt: row['updated_at'] instanceof Date ? row['updated_at'].toISOString() : null,
      };
    });
  }

  async phases(scope: DashboardScope, limit: number) {
    const rows = await this.query<Record<string, string | number | Date | null>>(
      `WITH ${SCOPED_TASKS}
       SELECT p.id, p.number, p.title, p.due_date, p.status_name, p.status_color, p.status_category, u.name AS assignee_name,
              count(c.id) AS total, count(c.id) FILTER (WHERE cs.category IN ('done', 'cancelled')) AS done,
              (SELECT COALESCE(sum(e.minutes), 0) FROM time_entry e WHERE e.workspace_id = $1 AND e.ended_at IS NOT NULL
                 AND (e.task_id = p.id OR e.task_id IN (SELECT id FROM task WHERE parent_id = p.id AND workspace_id = $1))) AS minutes
       FROM scoped p
       JOIN task c ON c.parent_id = p.id AND c.workspace_id = $1
       JOIN task_status cs ON cs.id = c.status_id
       LEFT JOIN "user" u ON u.id = p.assignee_id
       WHERE p.parent_id IS NULL
       GROUP BY p.id, p.number, p.title, p.due_date, p.status_name, p.status_color, p.status_category, p.closed, u.name, p.created_at
       ORDER BY p.closed, p.created_at DESC LIMIT $4`,
      [...this.taskParams(scope), limit],
    );
    return rows.map((row) => ({
      id: String(row['id']),
      number: num(row['number']),
      title: String(row['title']),
      assigneeName: (row['assignee_name'] as string | null) ?? null,
      dueDate: row['due_date'] instanceof Date ? row['due_date'].toISOString() : null,
      done: num(row['done']),
      total: num(row['total']),
      minutes: num(row['minutes']),
      status: { name: String(row['status_name']), color: String(row['status_color']), category: row['status_category'] as StatusCategory },
    }));
  }

  async taskList(scope: DashboardScope, kind: 'overdue' | 'dueSoon' | 'recent', limit: number): Promise<DashboardTask[]> {
    const condition = {
      overdue: `NOT t.closed AND t.due_date < now() ORDER BY t.due_date ASC, t.number`,
      dueSoon: `NOT t.closed AND t.due_date >= now() AND t.due_date < now() + interval '14 days' ORDER BY t.due_date ASC, t.number`,
      recent: `TRUE ORDER BY t.updated_at DESC, t.number DESC`,
    }[kind];
    const rows = await this.query<Record<string, string | number | Date | null>>(
      `WITH ${SCOPED_TASKS}
       SELECT t.*, sp.name AS space_name, u.name AS assignee_name
       FROM scoped t JOIN space sp ON sp.id = t.space_id LEFT JOIN "user" u ON u.id = t.assignee_id
       WHERE ${condition} LIMIT $4`,
      [...this.taskParams(scope), limit],
    );
    return rows.map((row) => ({
      id: String(row['id']),
      number: num(row['number']),
      title: String(row['title']),
      spaceId: String(row['space_id']),
      spaceName: String(row['space_name']),
      assigneeName: (row['assignee_name'] as string | null) ?? null,
      status: { name: String(row['status_name']), color: String(row['status_color']), category: row['status_category'] as StatusCategory },
      dueDate: row['due_date'] instanceof Date ? row['due_date'].toISOString() : null,
      updatedAt: (row['updated_at'] as Date).toISOString(),
    }));
  }
}

