import { Injectable } from '@nestjs/common';
import { cleanLayoutItem, validateLayoutItems, type DashboardLayout, type LayoutItem, type LayoutPage } from '@taskflow/shared-types';
import { DomainError } from '../../../core/domain/domain-error.js';
import { LayoutRepository } from '../domain/layout.repository.js';

/** The signed-in user's own dashboard layouts. The user id always comes from the session. */
@Injectable()
export class LayoutsService {
  constructor(private readonly repository: LayoutRepository) {}

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
    return saved;
  }

  async reset(workspaceId: string, userId: string, pageKey: LayoutPage): Promise<boolean> {
    await this.repository.remove({ workspaceId, userId, pageKey });
    return true;
  }
}
