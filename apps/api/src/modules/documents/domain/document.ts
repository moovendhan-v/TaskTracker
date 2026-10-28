import type { DocKind, IconKey } from '@taskflow/shared-types';

export interface Document {
  id: string;
  workspaceId: string;
  spaceId: string | null;
  parentId: string | null;
  kind: DocKind;
  title: string;
  icon: IconKey | null;
  /** Markdown, already passed through the ContentSanitizer. */
  content: string;
  position: number;
  createdById: string;
  updatedById: string;
  createdAt: Date;
  updatedAt: Date;
}

export type DocumentSummary = Omit<Document, 'content' | 'updatedById'>;

export type NewDocument = Omit<Document, 'id' | 'createdAt' | 'updatedAt'>;

export const DOC_POSITION_STEP = 1024;
