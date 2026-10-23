import type { Permission } from '@taskflow/shared-types';
import { DomainError } from '../../../core/domain/domain-error.js';
import type { Document } from './document.js';

/** doc.manage edits any page; doc.create edits only pages you wrote. */
export const DocumentAccessPolicy = {
  canEdit(document: Pick<Document, 'createdById'>, userId: string, held: ReadonlySet<Permission>): boolean {
    return held.has('doc.manage') || (held.has('doc.create') && document.createdById === userId);
  },

  assertCanEdit(document: Pick<Document, 'createdById'>, userId: string, held: ReadonlySet<Permission>): void {
    if (!DocumentAccessPolicy.canEdit(document, userId, held)) {
      throw DomainError.forbidden('You can only change pages you created');
    }
  },
};
