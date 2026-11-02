import { Injectable } from '@nestjs/common';
import { cleanLayoutItem, DASHBOARD_LIMITS, DEFAULT_LAYOUTS, validateLayoutItems, type NamedDashboardResponse, type DashboardVisibility, type LayoutItem } from '@taskflow/shared-types';
import { DomainError } from '../../../core/domain/domain-error.js';
import { DashboardRepository, type DashboardRecord } from '../domain/dashboard.repository.js';

const clean = (items: readonly LayoutItem[]) => items.map(cleanLayoutItem);

function toResponse(record: DashboardRecord, userId: string): NamedDashboardResponse {
  return {
    id: record.id,
    name: record.name,
    visibility: record.visibility,
    ownerId: record.ownerId,
    mine: record.ownerId === userId,
    version: record.version,
    items: record.items,
    updatedAt: record.updatedAt.toISOString(),
  };
}

/**
 * Named Home dashboards. Anyone in the workspace sees the shared ones; only the owner
 * sees a private one and only the owner may change any of theirs. The blocks load their
 * data with the viewer's own access, so sharing a dashboard never shares data.
 */
@Injectable()
export class DashboardsService {
  constructor(private readonly dashboards: DashboardRepository) {}

  async list(workspaceId: string, userId: string): Promise<NamedDashboardResponse[]> {
    return (await this.dashboards.listVisible(workspaceId, userId)).map((record) => toResponse(record, userId));
  }

  async create(workspaceId: string, userId: string, input: { name: string; visibility: DashboardVisibility; items?: LayoutItem[] | null }): Promise<NamedDashboardResponse> {
    if ((await this.dashboards.countOwned(workspaceId, userId)) >= DASHBOARD_LIMITS.perOwner) {
      throw DomainError.invalid(`You can have at most ${DASHBOARD_LIMITS.perOwner} dashboards`);
    }
    const items = clean(input.items ?? DEFAULT_LAYOUTS.home);
    this.assertValid(items);
    return toResponse(await this.dashboards.create({ workspaceId, ownerId: userId, name: input.name.trim(), visibility: input.visibility, items }), userId);
  }

  async update(workspaceId: string, userId: string, id: string, changes: { name?: string | null; visibility?: DashboardVisibility | null }): Promise<NamedDashboardResponse> {
    await this.assertOwner(workspaceId, userId, id);
    const saved = await this.dashboards.rename(workspaceId, userId, id, { name: changes.name?.trim() || undefined, visibility: changes.visibility ?? undefined });
    if (!saved) throw DomainError.notFound('Dashboard');
    return toResponse(saved, userId);
  }

  async saveLayout(workspaceId: string, userId: string, id: string, baseVersion: number, items: LayoutItem[]): Promise<NamedDashboardResponse> {
    await this.assertOwner(workspaceId, userId, id);
    const cleaned = clean(items);
    this.assertValid(cleaned);
    const saved = await this.dashboards.saveItemsIfVersion(workspaceId, userId, id, baseVersion, cleaned);
    if (!saved) throw DomainError.conflict('This dashboard was changed on another device');
    return toResponse(saved, userId);
  }

  async remove(workspaceId: string, userId: string, id: string): Promise<boolean> {
    await this.assertOwner(workspaceId, userId, id);
    return this.dashboards.remove(workspaceId, userId, id);
  }

  /** Not visible: not found. Visible but someone else's: forbidden. */
  private async assertOwner(workspaceId: string, userId: string, id: string): Promise<void> {
    const found = await this.dashboards.findVisible(workspaceId, userId, id);
    if (!found) throw DomainError.notFound('Dashboard');
    if (found.ownerId !== userId) throw DomainError.forbidden('Only the owner can change this dashboard');
  }

  private assertValid(items: LayoutItem[]): void {
    const problems = validateLayoutItems('home', items);
    if (problems.length) throw DomainError.invalid(`Invalid layout: ${problems.join('; ')}`);
  }
}
