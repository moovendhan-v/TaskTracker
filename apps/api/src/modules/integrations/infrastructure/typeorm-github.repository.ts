import { Injectable } from '@nestjs/common';
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
}
