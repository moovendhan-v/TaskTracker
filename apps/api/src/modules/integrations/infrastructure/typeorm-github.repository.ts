import { Injectable } from '@nestjs/common';
import { GITHUB_SYNC_LOG_KEPT, type GithubInboxPullRequestResponse, type GithubSyncConflictResponse, type GithubSyncEventResponse, type GithubSyncOutcome, type PullRequestState } from '@taskflow/shared-types';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import type { GithubConnection, NewGithubConnection, PullRequestLink, PullRequestLinkInput } from '../domain/github.js';
import { GithubRepository } from '../domain/github.repository.js';
import { GithubConnectionOrmEntity, PullRequestLinkOrmEntity } from './github.orm-entities.js';

/** Deliveries remembered per connection, to recognise redeliveries. */
const DELIVERIES_KEPT_DAYS = 14;

@Injectable()
export class TypeOrmGithubRepository extends GithubRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  private get connections() {
    return this.transactional.repository(GithubConnectionOrmEntity);
  }

  private get links() {
    return this.transactional.repository(PullRequestLinkOrmEntity);
  }

  list(workspaceId: string): Promise<GithubConnection[]> {
    return this.connections.find({ where: { workspaceId }, order: { createdAt: 'ASC' } });
  }

  findInWorkspace(workspaceId: string, connectionId: string): Promise<GithubConnection | null> {
    return this.connections.findOneBy({ id: connectionId, workspaceId });
  }

  async findWorkspaceOf(connectionId: string): Promise<string | null> {
    const rows: { workspace_id: string }[] = await this.transactional.manager.query('SELECT workspace_id FROM github_connection WHERE id = $1', [connectionId]);
    return rows[0]?.workspace_id ?? null;
  }

  create(connection: NewGithubConnection): Promise<GithubConnection> {
    return this.connections.save(this.connections.create(connection));
  }

  save(connection: GithubConnection): Promise<GithubConnection> {
    return this.connections.save(this.connections.create(connection));
  }

  async delete(workspaceId: string, connectionId: string): Promise<void> {
    await this.connections.delete({ id: connectionId, workspaceId });
  }

  async noteDelivery(workspaceId: string, connectionId: string, at: Date, status: string): Promise<void> {
    await this.transactional.manager.query(`UPDATE github_connection SET last_delivery_at = $3, last_delivery_status = $4 WHERE workspace_id = $1 AND id = $2`, [workspaceId, connectionId, at, status]);
  }

  async claimDelivery(workspaceId: string, connectionId: string, deliveryId: string): Promise<boolean> {
    const rows: unknown[] = await this.transactional.manager.query(
      `INSERT INTO github_delivery (workspace_id, connection_id, delivery_id) VALUES ($1, $2, $3)
       ON CONFLICT (connection_id, delivery_id) DO NOTHING RETURNING id`,
      [workspaceId, connectionId, deliveryId],
    );
    await this.transactional.manager.query(`DELETE FROM github_delivery WHERE connection_id = $1 AND received_at < now() - make_interval(days => $2)`, [
      connectionId,
      DELIVERIES_KEPT_DAYS,
    ]);
    return rows.length > 0;
  }

  async upsertLink(link: PullRequestLinkInput): Promise<void> {
    await this.transactional.manager.query(
      `INSERT INTO github_pull_request (workspace_id, connection_id, task_id, repo, number, title, url, state, author, branch)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (task_id, connection_id, number) DO UPDATE
         SET title = EXCLUDED.title, url = EXCLUDED.url, state = EXCLUDED.state, author = EXCLUDED.author, branch = EXCLUDED.branch, updated_at = now()`,
      [link.workspaceId, link.connectionId, link.taskId, link.repo, link.number, link.title, link.url, link.state, link.author, link.branch],
    );
  }

  listLinksForTask(workspaceId: string, taskId: string): Promise<PullRequestLink[]> {
    return this.links.find({ where: { workspaceId, taskId }, order: { updatedAt: 'DESC' }, take: 50 });
  }

  async logEvent(entry: { workspaceId: string; connectionId: string; event: string; outcome: GithubSyncOutcome; detail: string; prNumber: number | null; taskNumbers: number[] }): Promise<void> {
    const q = this.transactional.manager;
    await q.query(
      `INSERT INTO github_sync_event (workspace_id, connection_id, event, outcome, detail, pr_number, task_numbers) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [entry.workspaceId, entry.connectionId, entry.event.slice(0, 40), entry.outcome, entry.detail.slice(0, 200), entry.prNumber, entry.taskNumbers.slice(0, 20)],
    );
    await q.query(
      `DELETE FROM github_sync_event WHERE workspace_id = $1 AND connection_id = $2 AND id NOT IN (
         SELECT id FROM github_sync_event WHERE workspace_id = $1 AND connection_id = $2 ORDER BY created_at DESC LIMIT $3)`,
      [entry.workspaceId, entry.connectionId, GITHUB_SYNC_LOG_KEPT],
    );
  }

  async listEvents(workspaceId: string, connectionId: string, limit: number): Promise<GithubSyncEventResponse[]> {
    const rows: Record<string, unknown>[] = await this.transactional.manager.query(
      `SELECT id, connection_id, event, outcome, detail, pr_number, task_numbers, created_at FROM github_sync_event
       WHERE workspace_id = $1 AND connection_id = $2 ORDER BY created_at DESC LIMIT $3`,
      [workspaceId, connectionId, limit],
    );
    return rows.map((row) => ({
      id: String(row['id']),
      connectionId: String(row['connection_id']),
      event: String(row['event']),
      outcome: row['outcome'] as GithubSyncOutcome,
      detail: String(row['detail']),
      prNumber: row['pr_number'] === null ? null : Number(row['pr_number']),
      taskNumbers: ((row['task_numbers'] as number[] | null) ?? []).map(Number),
      createdAt: new Date(row['created_at'] as string).toISOString(),
    }));
  }

  async upsertInbox(entry: Omit<GithubInboxPullRequestResponse, 'id' | 'updatedAt'> & { workspaceId: string }): Promise<void> {
    await this.transactional.manager.query(
      `INSERT INTO github_pr_inbox (workspace_id, connection_id, repo, number, title, url, author, branch, state)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (connection_id, number) DO UPDATE
         SET title = EXCLUDED.title, url = EXCLUDED.url, author = EXCLUDED.author, branch = EXCLUDED.branch, state = EXCLUDED.state, updated_at = now()`,
      [entry.workspaceId, entry.connectionId, entry.repo, entry.number, entry.title, entry.url, entry.author, entry.branch, entry.state],
    );
  }

  async removeFromInbox(workspaceId: string, connectionId: string, number: number): Promise<void> {
    await this.transactional.manager.query(`DELETE FROM github_pr_inbox WHERE workspace_id = $1 AND connection_id = $2 AND number = $3`, [workspaceId, connectionId, number]);
  }

  async listInbox(workspaceId: string, limit: number): Promise<GithubInboxPullRequestResponse[]> {
    const rows: Record<string, unknown>[] = await this.transactional.manager.query(
      `SELECT ${INBOX_COLUMNS} FROM github_pr_inbox WHERE workspace_id = $1 ORDER BY updated_at DESC LIMIT $2`,
      [workspaceId, limit],
    );
    return rows.map(toInbox);
  }

  async findInboxItem(workspaceId: string, id: string): Promise<GithubInboxPullRequestResponse | null> {
    const [row] = (await this.transactional.manager.query(`SELECT ${INBOX_COLUMNS} FROM github_pr_inbox WHERE workspace_id = $1 AND id = $2`, [workspaceId, id])) as Record<string, unknown>[];
    return row ? toInbox(row) : null;
  }

  async deleteInboxItem(workspaceId: string, id: string): Promise<boolean> {
    const result: unknown = await this.transactional.manager.query(`DELETE FROM github_pr_inbox WHERE workspace_id = $1 AND id = $2 RETURNING id`, [workspaceId, id]);
    const rows = Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;
    return Array.isArray(rows) && rows.length > 0;
  }
  async syncedStatus(workspaceId: string, connectionId: string, taskId: string, prNumber: number): Promise<string | null> {
    const [row] = (await this.transactional.manager.query(
      `SELECT synced_status_id FROM github_pull_request WHERE workspace_id = $1 AND connection_id = $2 AND task_id = $3 AND number = $4`,
      [workspaceId, connectionId, taskId, prNumber],
    )) as { synced_status_id: string | null }[];
    return row?.synced_status_id ?? null;
  }

  async setSyncedStatus(workspaceId: string, connectionId: string, taskId: string, prNumber: number, statusId: string): Promise<void> {
    await this.transactional.manager.query(
      `UPDATE github_pull_request SET synced_status_id = $5 WHERE workspace_id = $1 AND connection_id = $2 AND task_id = $3 AND number = $4`,
      [workspaceId, connectionId, taskId, prNumber, statusId],
    );
  }

  async upsertConflict(c: { workspaceId: string; connectionId: string; taskId: string; prNumber: number; prTitle: string; prUrl: string; event: PullRequestState; wantedStatusId: string }): Promise<void> {
    await this.transactional.manager.query(
      `INSERT INTO github_sync_conflict (workspace_id, connection_id, task_id, pr_number, pr_title, pr_url, event, wanted_status_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (connection_id, task_id, pr_number) DO UPDATE
         SET pr_title = EXCLUDED.pr_title, pr_url = EXCLUDED.pr_url, event = EXCLUDED.event, wanted_status_id = EXCLUDED.wanted_status_id, created_at = now()`,
      [c.workspaceId, c.connectionId, c.taskId, c.prNumber, c.prTitle.slice(0, 300), c.prUrl.slice(0, 500), c.event, c.wantedStatusId],
    );
  }

  private conflictSelect = `
    SELECT c.id, c.connection_id, c.task_id, c.pr_number, c.pr_title, c.pr_url, c.event, c.created_at, s.id AS status_id, s.name AS status_name, s.color AS status_color
    FROM github_sync_conflict c JOIN task_status s ON s.id = c.wanted_status_id`;

  private toConflict = (row: Record<string, unknown>): GithubSyncConflictResponse & { connectionId: string } => ({
    id: row['id'] as string,
    connectionId: row['connection_id'] as string,
    taskId: row['task_id'] as string,
    prNumber: row['pr_number'] as number,
    prTitle: row['pr_title'] as string,
    prUrl: row['pr_url'] as string,
    event: row['event'] as PullRequestState,
    wantedStatus: { id: row['status_id'] as string, name: row['status_name'] as string, color: row['status_color'] as string },
    createdAt: new Date(row['created_at'] as string).toISOString(),
  });

  async listConflictsForTask(workspaceId: string, taskId: string): Promise<GithubSyncConflictResponse[]> {
    const rows = (await this.transactional.manager.query(`${this.conflictSelect} WHERE c.workspace_id = $1 AND c.task_id = $2 ORDER BY c.created_at DESC LIMIT 20`, [workspaceId, taskId])) as Record<string, unknown>[];
    return rows.map((row) => {
      const { connectionId: _connection, ...conflict } = this.toConflict(row);
      return conflict;
    });
  }

  async findConflict(workspaceId: string, id: string): Promise<(GithubSyncConflictResponse & { connectionId: string }) | null> {
    const [row] = (await this.transactional.manager.query(`${this.conflictSelect} WHERE c.workspace_id = $1 AND c.id = $2`, [workspaceId, id])) as Record<string, unknown>[];
    return row ? this.toConflict(row) : null;
  }

  async deleteConflict(workspaceId: string, id: string): Promise<boolean> {
    const result: unknown = await this.transactional.manager.query(`DELETE FROM github_sync_conflict WHERE workspace_id = $1 AND id = $2 RETURNING id`, [workspaceId, id]);
    const rows = Array.isArray(result) && Array.isArray(result[0]) ? (result[0] as unknown[]) : (result as unknown[]);
    return rows.length > 0;
  }
}

const INBOX_COLUMNS = 'id, connection_id, repo, number, title, url, author, branch, state, updated_at';
const toInbox = (row: Record<string, unknown>): GithubInboxPullRequestResponse => ({
  id: String(row['id']),
  connectionId: String(row['connection_id']),
  repo: String(row['repo']),
  number: Number(row['number']),
  title: String(row['title']),
  url: String(row['url']),
  author: String(row['author']),
  branch: String(row['branch']),
  state: row['state'] as GithubInboxPullRequestResponse['state'],
  updatedAt: new Date(row['updated_at'] as string).toISOString(),
});
