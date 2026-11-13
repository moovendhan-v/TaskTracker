import { Injectable } from '@nestjs/common';
import type { PullRequestState } from '@taskflow/shared-types';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import type { AppConnectionRef, GithubInstallation, IssueLink, IssuePush } from '../domain/github-app.js';
import { GithubAppRepository } from '../domain/github-app.repository.js';

type Row = Record<string, unknown>;

/** UPDATE … RETURNING comes back as [rows, count] through TypeORM; SELECT and INSERT as rows. */
function rowsOf(result: unknown): Row[] {
  if (Array.isArray(result) && result.length === 2 && Array.isArray(result[0]) && typeof result[1] === 'number') return result[0] as Row[];
  return (result as Row[]) ?? [];
}

const INSTALLATION_COLUMNS = 'id, workspace_id, installation_id, account_login, account_type, installed_by_id, created_at';
const LINK_COLUMNS = 'id, workspace_id, connection_id, task_id, number, url, synced_title, synced_closed, push_due, push_version, push_attempts, last_error, created_at';

function toInstallation(row: Row): GithubInstallation {
  return {
    id: String(row['id']),
    workspaceId: String(row['workspace_id']),
    installationId: Number(row['installation_id']),
    accountLogin: String(row['account_login']),
    accountType: row['account_type'] === 'Organization' ? 'Organization' : 'User',
    installedById: (row['installed_by_id'] as string | null) ?? null,
    createdAt: new Date(row['created_at'] as string),
  };
}

function toLink(row: Row): IssueLink {
  return {
    id: String(row['id']),
    workspaceId: String(row['workspace_id']),
    connectionId: String(row['connection_id']),
    taskId: String(row['task_id']),
    number: Number(row['number']),
    url: String(row['url']),
    syncedTitle: String(row['synced_title']),
    syncedClosed: row['synced_closed'] === true,
    pushDue: row['push_due'] === true,
    pushVersion: Number(row['push_version']),
    pushAttempts: Number(row['push_attempts']),
    lastError: (row['last_error'] as string | null) ?? null,
    createdAt: new Date(row['created_at'] as string),
  };
}

/** Closed in GitHub terms: the task's status means done or cancelled. */
const CLOSED_SQL = `(SELECT s.category IN ('done', 'cancelled') FROM task_status s WHERE s.id = t.status_id)`;

@Injectable()
export class TypeOrmGithubAppRepository extends GithubAppRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  private async query(sql: string, params: unknown[]): Promise<Row[]> {
    return rowsOf(await this.transactional.manager.query(sql, params));
  }

  async listInstallations(workspaceId: string): Promise<GithubInstallation[]> {
    return (await this.query(`SELECT ${INSTALLATION_COLUMNS} FROM github_installation WHERE workspace_id = $1 ORDER BY created_at`, [workspaceId])).map(toInstallation);
  }

  async findInstallation(workspaceId: string, id: string): Promise<GithubInstallation | null> {
    const [row] = await this.query(`SELECT ${INSTALLATION_COLUMNS} FROM github_installation WHERE workspace_id = $1 AND id = $2`, [workspaceId, id]);
    return row ? toInstallation(row) : null;
  }

  async saveInstallation(installation: Omit<GithubInstallation, 'id' | 'createdAt'>): Promise<GithubInstallation> {
    const [row] = await this.query(
      `INSERT INTO github_installation (workspace_id, installation_id, account_login, account_type, installed_by_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (workspace_id, installation_id) DO UPDATE
         SET account_login = EXCLUDED.account_login, account_type = EXCLUDED.account_type, installed_by_id = EXCLUDED.installed_by_id, updated_at = now()
       RETURNING ${INSTALLATION_COLUMNS}`,
      [installation.workspaceId, installation.installationId, installation.accountLogin, installation.accountType, installation.installedById],
    );
    return toInstallation(row!);
  }

  async deleteInstallation(workspaceId: string, id: string): Promise<void> {
    await this.query(`DELETE FROM github_installation WHERE workspace_id = $1 AND id = $2`, [workspaceId, id]);
  }

  async connectionsForRepo(installationId: number, repo: string): Promise<{ workspaceId: string; connectionId: string }[]> {
    const rows = await this.query(
      `SELECT c.id, c.workspace_id FROM github_connection c
         JOIN github_installation i ON i.id = c.installation_ref AND i.workspace_id = c.workspace_id
        WHERE i.installation_id = $1 AND lower(c.repo) = lower($2)
        LIMIT 100`,
      [installationId, repo],
    );
    return rows.map((row) => ({ workspaceId: String(row['workspace_id']), connectionId: String(row['id']) }));
  }

  async deleteInstallationEverywhere(installationId: number): Promise<number> {
    return (await this.query(`DELETE FROM github_installation WHERE installation_id = $1 RETURNING id`, [installationId])).length;
  }

  async workspacesToSync(now: Date, polledBefore: Date, limit: number): Promise<string[]> {
    const rows = await this.query(
      `SELECT workspace_id FROM github_connection WHERE installation_ref IS NOT NULL AND (polled_at IS NULL OR polled_at < $2)
       UNION
       SELECT workspace_id FROM github_issue WHERE push_due AND (push_at IS NULL OR push_at <= $1)
       LIMIT $3`,
      [now, polledBefore, limit],
    );
    return rows.map((row) => String(row['workspace_id']));
  }

  async claimPolls(workspaceId: string, now: Date, polledBefore: Date, limit: number): Promise<AppConnectionRef[]> {
    const rows = await this.query(
      `UPDATE github_connection c SET polled_at = $2
         FROM github_installation i
        WHERE i.id = c.installation_ref AND i.workspace_id = c.workspace_id
          AND c.id IN (SELECT id FROM github_connection
                        WHERE workspace_id = $1 AND installation_ref IS NOT NULL AND (polled_at IS NULL OR polled_at < $3)
                        ORDER BY polled_at NULLS FIRST LIMIT $4 FOR UPDATE SKIP LOCKED)
        RETURNING c.id, i.installation_id`,
      [workspaceId, now, polledBefore, limit],
    );
    return rows.map((row) => ({ connectionId: String(row['id']), installationId: Number(row['installation_id']) }));
  }

  async setCursors(workspaceId: string, connectionId: string, cursors: { pullsCursor?: Date; issuesCursor?: Date }): Promise<void> {
    await this.query(
      `UPDATE github_connection SET pulls_cursor = COALESCE($3, pulls_cursor), issues_cursor = COALESCE($4, issues_cursor) WHERE workspace_id = $1 AND id = $2`,
      [workspaceId, connectionId, cursors.pullsCursor ?? null, cursors.issuesCursor ?? null],
    );
  }

  async knownPullState(workspaceId: string, connectionId: string, number: number): Promise<PullRequestState | null> {
    const [row] = await this.query(
      `SELECT state FROM github_pull_request WHERE workspace_id = $1 AND connection_id = $2 AND number = $3
       UNION ALL
       SELECT state FROM github_pr_inbox WHERE workspace_id = $1 AND connection_id = $2 AND number = $3
       LIMIT 1`,
      [workspaceId, connectionId, number],
    );
    return row ? (String(row['state']) as PullRequestState) : null;
  }

  async createIssueLink(link: { workspaceId: string; connectionId: string; taskId: string; number: number; url: string; syncedTitle: string; syncedClosed: boolean; createdById: string }): Promise<IssueLink> {
    const [row] = await this.query(
      `INSERT INTO github_issue (workspace_id, connection_id, task_id, number, url, synced_title, synced_closed, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING ${LINK_COLUMNS}`,
      [link.workspaceId, link.connectionId, link.taskId, link.number, link.url, link.syncedTitle, link.syncedClosed, link.createdById],
    );
    return toLink(row!);
  }

  async findIssueLink(workspaceId: string, connectionId: string, number: number): Promise<IssueLink | null> {
    const [row] = await this.query(`SELECT ${LINK_COLUMNS} FROM github_issue WHERE workspace_id = $1 AND connection_id = $2 AND number = $3`, [workspaceId, connectionId, number]);
    return row ? toLink(row) : null;
  }

  async listIssueLinksForTask(workspaceId: string, taskId: string): Promise<(IssueLink & { repo: string })[]> {
    const rows = await this.query(
      `SELECT ${LINK_COLUMNS.split(', ').map((column) => `gi.${column}`).join(', ')}, c.repo
         FROM github_issue gi JOIN github_connection c ON c.id = gi.connection_id
        WHERE gi.workspace_id = $1 AND gi.task_id = $2 ORDER BY gi.created_at`,
      [workspaceId, taskId],
    );
    return rows.map((row) => ({ ...toLink(row), repo: String(row['repo']) }));
  }

  async setSynced(workspaceId: string, linkId: string, title: string, closed: boolean): Promise<void> {
    await this.query(`UPDATE github_issue SET synced_title = $3, synced_closed = $4, updated_at = now() WHERE workspace_id = $1 AND id = $2`, [workspaceId, linkId, title, closed]);
  }

  async markPushDue(workspaceId: string, taskId: string): Promise<number> {
    const rows = await this.query(
      `UPDATE github_issue gi SET push_due = true, push_version = push_version + 1, push_attempts = 0, push_at = NULL, updated_at = now()
         FROM task t
        WHERE gi.workspace_id = $1 AND gi.task_id = $2 AND t.id = gi.task_id
          AND (left(t.title, 300) <> gi.synced_title OR ${CLOSED_SQL} <> gi.synced_closed)
        RETURNING gi.id`,
      [workspaceId, taskId],
    );
    return rows.length;
  }

  async leasePushes(workspaceId: string, now: Date, leaseUntil: Date, limit: number): Promise<IssuePush[]> {
    const rows = await this.query(
      `UPDATE github_issue gi SET push_at = $3, push_attempts = gi.push_attempts + 1
         FROM github_connection c, github_installation i, task t
        WHERE c.id = gi.connection_id AND i.id = c.installation_ref AND t.id = gi.task_id
          AND gi.id IN (SELECT id FROM github_issue
                         WHERE workspace_id = $1 AND push_due AND (push_at IS NULL OR push_at <= $2)
                         ORDER BY push_at NULLS FIRST LIMIT $4 FOR UPDATE SKIP LOCKED)
        RETURNING ${LINK_COLUMNS.split(', ').map((column) => `gi.${column}`).join(', ')}, c.repo, i.installation_id, left(t.title, 300) AS task_title, ${CLOSED_SQL} AS task_closed`,
      [workspaceId, now, leaseUntil, limit],
    );
    return rows.map((row) => ({ link: toLink(row), repo: String(row['repo']), installationId: Number(row['installation_id']), title: String(row['task_title']), closed: row['task_closed'] === true }));
  }

  async pushed(workspaceId: string, linkId: string, version: number, title: string, closed: boolean): Promise<void> {
    await this.query(
      `UPDATE github_issue SET synced_title = $4, synced_closed = $5, push_due = (push_version <> $3), push_at = NULL, push_attempts = 0, last_error = NULL, updated_at = now()
        WHERE workspace_id = $1 AND id = $2`,
      [workspaceId, linkId, version, title, closed],
    );
  }

  async pushFailed(workspaceId: string, linkId: string, error: string, retryAt: Date | null): Promise<void> {
    await this.query(
      `UPDATE github_issue SET last_error = $3, push_at = $4, push_due = ($4::timestamptz IS NOT NULL), updated_at = now() WHERE workspace_id = $1 AND id = $2`,
      [workspaceId, linkId, error.slice(0, 200), retryAt],
    );
  }
}
