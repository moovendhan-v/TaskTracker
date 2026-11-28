import { Injectable } from '@nestjs/common';
import type { BugCaptureResponse, BugFilter, SimilarBugResponse } from '@taskflow/shared-types';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import type { CleanCapture } from '../domain/bug.policy.js';
import { BugRepository, type BugChanges, type BugRecord, type NewBugRecord } from '../domain/bug.repository.js';

const COLUMNS = `b.task_id, b.workspace_id, b.kind, b.severity, b.environment, b.module, b.expected, b.actual, b.steps, b.qa_state, b.source,
  b.page_url, b.browser, b.os, b.viewport, b.user_agent, b.reporter_id, b.reporter_name, b.reporter_email, b.created_at, b.updated_at,
  COALESCE(c.console_errors, 0) AS console_errors, COALESCE(c.failed_requests, 0) AS failed_requests,
  (SELECT r.related_task_id FROM task_relation r WHERE r.workspace_id = b.workspace_id AND r.task_id = b.task_id AND r.kind = 'duplicates' ORDER BY r.created_at DESC LIMIT 1) AS duplicate_of`;
const FROM = `FROM bug_report b JOIN task t ON t.id = b.task_id LEFT JOIN bug_capture c ON c.task_id = b.task_id`;

/** Fixed column names per field; never built from input. */
const UPDATE_COLUMNS: Record<keyof BugChanges, string> = {
  kind: 'kind',
  severity: 'severity',
  environment: 'environment',
  module: 'module',
  expected: 'expected',
  actual: 'actual',
  steps: 'steps',
  qaState: 'qa_state',
};

const toRecord = (row: Record<string, unknown>): BugRecord => ({
  taskId: row['task_id'] as string,
  workspaceId: row['workspace_id'] as string,
  kind: row['kind'] as BugRecord['kind'],
  severity: row['severity'] as BugRecord['severity'],
  environment: row['environment'] as BugRecord['environment'],
  module: (row['module'] as string | null) ?? null,
  expected: row['expected'] as string,
  actual: row['actual'] as string,
  steps: (row['steps'] as BugRecord['steps']) ?? [],
  qaState: row['qa_state'] as BugRecord['qaState'],
  source: row['source'] as BugRecord['source'],
  pageUrl: (row['page_url'] as string | null) ?? null,
  browser: (row['browser'] as string | null) ?? null,
  os: (row['os'] as string | null) ?? null,
  viewport: (row['viewport'] as string | null) ?? null,
  userAgent: (row['user_agent'] as string | null) ?? null,
  reporterId: (row['reporter_id'] as string | null) ?? null,
  reporterName: (row['reporter_name'] as string | null) ?? null,
  reporterEmail: (row['reporter_email'] as string | null) ?? null,
  consoleErrors: Number(row['console_errors'] ?? 0),
  failedRequests: Number(row['failed_requests'] ?? 0),
  duplicateOfTaskId: (row['duplicate_of'] as string | null) ?? null,
  createdAt: new Date(row['created_at'] as string),
  updatedAt: new Date(row['updated_at'] as string),
});

@Injectable()
export class TypeOrmBugRepository extends BugRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  private query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]> {
    return this.transactional.manager.query(sql, params);
  }

  async insert(record: NewBugRecord, capture: CleanCapture): Promise<void> {
    await this.query(
      `INSERT INTO bug_report (task_id, workspace_id, kind, severity, environment, module, expected, actual, steps, qa_state, source,
         page_url, browser, os, viewport, user_agent, reporter_id, reporter_name, reporter_email)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
      [
        record.taskId,
        record.workspaceId,
        record.kind,
        record.severity,
        record.environment,
        record.module,
        record.expected,
        record.actual,
        JSON.stringify(record.steps),
        record.qaState,
        record.source,
        record.pageUrl,
        record.browser,
        record.os,
        record.viewport,
        record.userAgent,
        record.reporterId,
        record.reporterName,
        record.reporterEmail,
      ],
    );
    await this.query(
      `INSERT INTO bug_capture (task_id, workspace_id, console, network, actions, console_errors, failed_requests) VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6, $7)`,
      [record.taskId, record.workspaceId, JSON.stringify(capture.console), JSON.stringify(capture.network), JSON.stringify(capture.actions), capture.consoleErrors, capture.failedRequests],
    );
  }

  async find(workspaceId: string, taskId: string): Promise<BugRecord | null> {
    const [row] = await this.query(`SELECT ${COLUMNS} ${FROM} WHERE b.workspace_id = $1 AND b.task_id = $2`, [workspaceId, taskId]);
    return row ? toRecord(row) : null;
  }

  async list(workspaceId: string, spaceId: string, filter: BugFilter, limit: number): Promise<BugRecord[]> {
    const rows = await this.query(
      `SELECT ${COLUMNS} ${FROM}
        WHERE b.workspace_id = $1 AND t.space_id = $2
          AND (cardinality($3::text[]) = 0 OR b.kind = ANY($3::text[]))
          AND (cardinality($4::text[]) = 0 OR b.severity = ANY($4::text[]))
          AND (cardinality($5::text[]) = 0 OR b.environment = ANY($5::text[]))
          AND (cardinality($6::text[]) = 0 OR b.qa_state = ANY($6::text[]))
          AND ($7::text IS NULL OR t.title ILIKE '%' || $7 || '%' OR ('#' || t.number::text) = $7)
        ORDER BY b.severity, b.created_at DESC
        LIMIT $8`,
      [workspaceId, spaceId, filter.kinds ?? [], filter.severities ?? [], filter.environments ?? [], filter.qaStates ?? [], escapeLike(filter.search), limit],
    );
    return rows.map(toRecord);
  }

  async update(workspaceId: string, taskId: string, changes: BugChanges): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [workspaceId, taskId];
    for (const [key, column] of Object.entries(UPDATE_COLUMNS) as [keyof BugChanges, string][]) {
      if (changes[key] === undefined) continue;
      params.push(key === 'steps' ? JSON.stringify(changes.steps) : changes[key]);
      sets.push(`${column} = $${params.length}${key === 'steps' ? '::jsonb' : ''}`);
    }
    if (sets.length === 0) return;
    await this.query(`UPDATE bug_report SET ${sets.join(', ')}, updated_at = now() WHERE workspace_id = $1 AND task_id = $2`, params);
  }

  async capture(workspaceId: string, taskId: string): Promise<BugCaptureResponse | null> {
    const [row] = await this.query(`SELECT console, network, actions FROM bug_capture WHERE workspace_id = $1 AND task_id = $2`, [workspaceId, taskId]);
    return row ? { console: row['console'] as BugCaptureResponse['console'], network: row['network'] as BugCaptureResponse['network'], actions: row['actions'] as BugCaptureResponse['actions'] } : null;
  }

  async similar(workspaceId: string, spaceId: string, title: string, excludeTaskId: string | null, limit: number): Promise<SimilarBugResponse[]> {
    const rows = await this.query(
      `SELECT t.id, t.number, t.title, b.qa_state, similarity(t.title, $3) AS score
         FROM bug_report b JOIN task t ON t.id = b.task_id
        WHERE b.workspace_id = $1 AND t.space_id = $2 AND ($4::uuid IS NULL OR t.id <> $4) AND similarity(t.title, $3) >= 0.3
        ORDER BY score DESC, t.created_at DESC
        LIMIT $5`,
      [workspaceId, spaceId, title, excludeTaskId, limit],
    );
    return rows.map((row) => ({
      taskId: row['id'] as string,
      number: Number(row['number']),
      title: row['title'] as string,
      qaState: row['qa_state'] as SimilarBugResponse['qaState'],
      score: Math.round(Number(row['score']) * 100) / 100,
    }));
  }
}

/** A search term for ILIKE, with its wildcards escaped; null when empty. */
function escapeLike(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim().slice(0, 100);
  return trimmed ? trimmed.replace(/[\\%_]/g, (char) => `\\${char}`) : null;
}
