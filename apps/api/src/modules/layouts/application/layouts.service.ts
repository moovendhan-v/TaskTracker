import { Injectable } from '@nestjs/common';
import { cleanLayoutItem, LAYOUT_VERSIONS_KEPT, validateLayoutItems, type DashboardLayout, type LayoutItem, type LayoutPage, type LayoutVersion, type WorkspaceLayout } from '@taskflow/shared-types';
import { AuditLogger } from '../../../core/audit/audit-logger.port.js';
import type { Actor } from '../../../core/http/types/authenticated-request.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import { LayoutRepository } from '../domain/layout.repository.js';

/** The signed-in user's own dashboard layouts. The user id always comes from the session. */
@Injectable()
export class LayoutsService {
  constructor(
    private readonly repository: LayoutRepository,
    private readonly auditLogger: AuditLogger,
  ) {}

  get(workspaceId: string, userId: string, pageKey: LayoutPage): Promise<DashboardLayout | null> {
    return this.repository.find({ workspaceId, userId, pageKey });
  }

  async save(workspaceId: string, userId: string, pageKey: LayoutPage, baseVersion: number | null, items: LayoutItem[]): Promise<DashboardLayout> {
    // Only the fields we know (and no empty settings), then the shared rules.
    const clean = items.map(cleanLayoutItem);
    const problems = validateLayoutItems(pageKey, clean);
    if (problems.length) throw DomainError.invalid(`Invalid layout: ${problems.join('; ')}`);
    const saved = await this.repository.saveIfVersion({ workspaceId, userId, pageKey }, baseVersion, clean);
    if (!saved) throw DomainError.conflict('This layout was changed on another device');
    await this.repository.addVersion({ workspaceId, userId, pageKey }, saved.version, clean, LAYOUT_VERSIONS_KEPT);
    return saved;
  }

  async reset(workspaceId: string, userId: string, pageKey: LayoutPage): Promise<boolean> {
    await this.repository.remove({ workspaceId, userId, pageKey });
    return true;
  }

  /** Your recent saves of a page, newest first. Restoring one is just saving its items again. */
  versions(workspaceId: string, userId: string, pageKey: LayoutPage): Promise<LayoutVersion[]> {
    return this.repository.listVersions({ workspaceId, userId, pageKey }, LAYOUT_VERSIONS_KEPT);
  }

  /** What people see before they arrange a page themselves; null means the built-in layout. */
  workspaceDefault(workspaceId: string, pageKey: LayoutPage): Promise<WorkspaceLayout | null> {
    return this.repository.findDefault(workspaceId, pageKey);
  }

  /** Needs layout.manage (checked by the resolver). Audited, like other admin changes. */
  async setWorkspaceDefault(actor: Actor, workspaceId: string, pageKey: LayoutPage, items: LayoutItem[]): Promise<WorkspaceLayout> {
    const clean = items.map(cleanLayoutItem);
    const problems = validateLayoutItems(pageKey, clean);
    if (problems.length) throw DomainError.invalid(`Invalid layout: ${problems.join('; ')}`);
    const saved = await this.repository.saveDefault(workspaceId, pageKey, clean, actor.userId);
    await this.auditLogger.record(actor, { action: 'layout.default.set', targetType: 'layout_default', targetId: pageKey, workspaceId, metadata: { pageKey, blocks: clean.length } });
    return saved;
  }

  async clearWorkspaceDefault(actor: Actor, workspaceId: string, pageKey: LayoutPage): Promise<boolean> {
    const removed = await this.repository.removeDefault(workspaceId, pageKey);
    if (removed) await this.auditLogger.record(actor, { action: 'layout.default.clear', targetType: 'layout_default', targetId: pageKey, workspaceId, metadata: { pageKey } });
    return removed;
  }
}
