import type { BugShareScope } from '@taskflow/shared-types';

export interface IntakeRecord {
  id: string;
  workspaceId: string;
  spaceId: string;
  spaceName: string;
  publicKey: string;
  title: string;
  intro: string;
  allowedOrigins: string[];
  widgetEnabled: boolean;
  portalEnabled: boolean;
  createdBy: string;
  updatedAt: Date;
}

export interface IntakeSettings {
  title: string;
  intro: string;
  allowedOrigins: string[];
  widgetEnabled: boolean;
  portalEnabled: boolean;
}

export interface ShareRecord {
  id: string;
  workspaceId: string;
  taskId: string;
  scope: BugShareScope;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  lastViewedAt: Date | null;
}

export abstract class IntakeRepository {
  // Members (workspace scope).
  abstract findBySpace(workspaceId: string, spaceId: string): Promise<IntakeRecord | null>;
  abstract save(workspaceId: string, spaceId: string, createdBy: string, publicKey: string, settings: IntakeSettings): Promise<IntakeRecord>;
  abstract rotateKey(workspaceId: string, spaceId: string, publicKey: string): Promise<IntakeRecord | null>;
  abstract countPublicReports(workspaceId: string, spaceId: string, since: Date): Promise<number>;
  abstract insertShare(share: { workspaceId: string; taskId: string; tokenHash: string; scope: BugShareScope; createdBy: string | null; expiresAt: Date }): Promise<ShareRecord>;
  abstract listShares(workspaceId: string, taskId: string): Promise<ShareRecord[]>;
  abstract revokeShare(workspaceId: string, shareId: string): Promise<ShareRecord | null>;
  abstract touchShare(workspaceId: string, shareId: string): Promise<void>;
  // Before anyone is known (platform scope, services only).
  abstract findByKey(publicKey: string): Promise<IntakeRecord | null>;
  abstract findShareByHash(tokenHash: string): Promise<ShareRecord | null>;
}
