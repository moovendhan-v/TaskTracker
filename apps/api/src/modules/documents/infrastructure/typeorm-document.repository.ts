import { Injectable } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import { escapeLike } from '../../../core/http/utils/escape-like.js';
import type { Document, DocumentSummary, NewDocument } from '../domain/document.js';
import { DocumentRepository } from '../domain/document.repository.js';
import { DocumentOrmEntity } from './document.orm-entity.js';

/** Hard stop for the recursive queries, well above DOC_MAX_DEPTH, in case of bad data. */
const RECURSION_GUARD = 50;

@Injectable()
export class TypeOrmDocumentRepository extends DocumentRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  private get repository() {
    return this.transactional.repository(DocumentOrmEntity);
  }

  listSummaries(workspaceId: string, limit: number, search?: string): Promise<DocumentSummary[]> {
    const query = this.repository
      .createQueryBuilder('doc')
      .select([
        'doc.id',
        'doc.workspaceId',
        'doc.spaceId',
        'doc.parentId',
        'doc.title',
        'doc.position',
        'doc.createdById',
        'doc.createdAt',
        'doc.updatedAt',
      ])
      .where('doc.workspace_id = :workspaceId', { workspaceId });
    if (search) query.andWhere('doc.title ILIKE :search', { search: `%${escapeLike(search)}%` });
    return query.orderBy('doc.position', 'ASC').addOrderBy('doc.created_at', 'ASC').take(limit).getMany();
  }

  findInWorkspace(workspaceId: string, documentId: string): Promise<Document | null> {
    return this.repository.findOneBy({ id: documentId, workspaceId });
  }

  async ancestorChain(workspaceId: string, documentId: string): Promise<string[]> {
    const rows: { id: string }[] = await this.transactional.manager.query(
      `WITH RECURSIVE chain AS (
         SELECT id, parent_id, 1 AS depth FROM document WHERE id = $1 AND workspace_id = $2
         UNION ALL
         SELECT d.id, d.parent_id, chain.depth + 1
         FROM document d JOIN chain ON d.id = chain.parent_id
         WHERE d.workspace_id = $2 AND chain.depth < $3
       )
       SELECT id FROM chain ORDER BY depth`,
      [documentId, workspaceId, RECURSION_GUARD],
    );
    return rows.map((row) => row.id);
  }

  async subtreeHeight(workspaceId: string, documentId: string): Promise<number> {
    const rows: { height: number | string }[] = await this.transactional.manager.query(
      `WITH RECURSIVE subtree AS (
         SELECT id, 1 AS level FROM document WHERE id = $1 AND workspace_id = $2
         UNION ALL
         SELECT d.id, subtree.level + 1
         FROM document d JOIN subtree ON d.parent_id = subtree.id
         WHERE d.workspace_id = $2 AND subtree.level < $3
       )
       SELECT MAX(level) AS height FROM subtree`,
      [documentId, workspaceId, RECURSION_GUARD],
    );
    return Number(rows[0]?.height ?? 1);
  }

  async maxSiblingPosition(workspaceId: string, parentId: string | null): Promise<number> {
    const row = await this.repository
      .createQueryBuilder('doc')
      .select('MAX(doc.position)', 'max')
      .where({ workspaceId, parentId: parentId ?? IsNull() })
      .getRawOne<{ max: number | null }>();
    return Number(row?.max ?? 0);
  }

  create(document: NewDocument): Promise<Document> {
    return this.repository.save(this.repository.create(document));
  }

  save(document: Document): Promise<Document> {
    return this.repository.save(this.repository.create(document));
  }

  async delete(workspaceId: string, documentId: string): Promise<void> {
    await this.repository.delete({ id: documentId, workspaceId });
  }
}
