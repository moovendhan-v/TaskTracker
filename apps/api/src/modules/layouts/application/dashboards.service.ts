import { Injectable } from '@nestjs/common';
import { cleanLayoutItem, CUSTOM_PERIOD_DAYS_MAX, DASHBOARD_LIMITS, isDashboardPeriod, DEFAULT_LAYOUTS, validateLayoutItems, LAYOUT_VERSIONS_KEPT, type LayoutVersion, type NamedDashboardResponse, type DashboardPeriod, type DashboardTeam, type DashboardVisibility, type LayoutItem } from '@taskflow/shared-types';
import { SpaceGuard } from '../../../core/access/space-guard.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import { SpacesService } from '../../spaces/application/spaces.service.js';
import { DashboardRepository, type DashboardRecord } from '../domain/dashboard.repository.js';

const clean = (items: readonly LayoutItem[]) => items.map(cleanLayoutItem);

function toResponse(record: DashboardRecord, userId: string): NamedDashboardResponse {
  return {
    id: record.id,
    name: record.name,
    visibility: record.visibility,
    ownerId: record.ownerId,
    spaceId: record.spaceId,
    mine: record.ownerId === userId,
    version: record.version,
    items: record.items,
    period: record.period ?? null,
    departmentId: record.departmentId,
    departmentName: record.departmentName,
    updatedAt: record.updatedAt.toISOString(),
  };
}

/**
 * Named dashboards, on Home or on a project's page. Anyone in the workspace sees the shared ones; only the owner
 * sees a private one and only the owner may change any of theirs. The blocks load their
 * data with the viewer's own access, so sharing a dashboard never shares data.
 */
@Injectable()
export class DashboardsService {
  constructor(
    private readonly dashboards: DashboardRepository,
    private readonly spacesService: SpacesService,
  ) {}

  /** Home's dashboards, or a project's (needs task.view in it; RLS hides other spaces' too). */
  async list(workspaceId: string, userId: string, spaceId: string | null = null): Promise<NamedDashboardResponse[]> {
    if (spaceId) await this.assertCanSeeSpace(workspaceId, spaceId);
    return (await this.dashboards.listVisible(workspaceId, userId, spaceId)).map((record) => toResponse(record, userId));
  }

  async create(workspaceId: string, userId: string, input: { name: string; visibility: DashboardVisibility; items?: LayoutItem[] | null; spaceId?: string | null }): Promise<NamedDashboardResponse> {
    const spaceId = input.spaceId ?? null;
    if (spaceId) await this.assertCanSeeSpace(workspaceId, spaceId);
    // A team share needs a department; it's set afterwards, with updateDashboard.
    if (input.visibility === 'department') throw DomainError.invalid('Create the dashboard first, then share it with a team');
    if ((await this.dashboards.countOwned(workspaceId, userId)) >= DASHBOARD_LIMITS.perOwner) {
      throw DomainError.invalid(`You can have at most ${DASHBOARD_LIMITS.perOwner} dashboards`);
    }
    const items = clean(input.items ?? DEFAULT_LAYOUTS[spaceId ? 'project' : 'home']);
    this.assertValid(items, spaceId);
    return toResponse(await this.dashboards.create({ workspaceId, ownerId: userId, spaceId, name: input.name.trim(), visibility: input.visibility, items }), userId);
  }

  /** Teams the user can share a dashboard with: the departments they're in or head. */
  async teams(workspaceId: string, userId: string): Promise<DashboardTeam[]> {
    return this.dashboards.teamsOf(workspaceId, userId);
  }

  async update(
    workspaceId: string,
    userId: string,
    id: string,
    changes: { name?: string | null; visibility?: DashboardVisibility | null; departmentId?: string | null; period?: DashboardPeriod | null },
  ): Promise<NamedDashboardResponse> {
    if (changes.period && !isDashboardPeriod(changes.period)) throw DomainError.invalid(`Pick a range, or days that exist, in order and at most ${CUSTOM_PERIOD_DAYS_MAX} days apart`);
    if (changes.departmentId && changes.visibility !== 'department') throw DomainError.invalid('A department goes with sharing to that team');
    await this.assertOwner(workspaceId, userId, id);
    if (changes.visibility === 'department') {
      // Only a team you're in: you can't post a dashboard into another team's view.
      const teams = await this.dashboards.teamsOf(workspaceId, userId);
      if (!changes.departmentId || !teams.some((team) => team.id === changes.departmentId)) throw DomainError.invalid('Share with a department you belong to or lead');
    }
    const saved = await this.dashboards.rename(workspaceId, userId, id, {
      name: changes.name?.trim() || undefined,
      visibility: changes.visibility ?? undefined,
      departmentId: changes.visibility === 'department' ? changes.departmentId : null,
      period: changes.period ?? undefined,
    });
    if (!saved) throw DomainError.notFound('Dashboard');
    return toResponse(saved, userId);
  }

  async saveLayout(workspaceId: string, userId: string, id: string, baseVersion: number, items: LayoutItem[]): Promise<NamedDashboardResponse> {
    const record = await this.assertOwner(workspaceId, userId, id);
    const cleaned = clean(items);
    this.assertValid(cleaned, record.spaceId);
    const saved = await this.dashboards.saveItemsIfVersion(workspaceId, userId, id, baseVersion, cleaned);
    if (!saved) throw DomainError.conflict('This dashboard was changed on another device');
    await this.dashboards.addVersion(workspaceId, id, saved.version, cleaned, LAYOUT_VERSIONS_KEPT);
    return toResponse(saved, userId);
  }

  /** Your dashboard's recent saves, newest first (yours only). Restoring one is saving its blocks again. */
  async versions(workspaceId: string, userId: string, id: string): Promise<LayoutVersion[]> {
    await this.assertOwner(workspaceId, userId, id);
    return this.dashboards.listVersions(workspaceId, id, LAYOUT_VERSIONS_KEPT);
  }

  async remove(workspaceId: string, userId: string, id: string): Promise<boolean> {
    await this.assertOwner(workspaceId, userId, id);
    return this.dashboards.remove(workspaceId, userId, id);
  }

  /** Not visible: not found. Visible but someone else's: forbidden. */
  private async assertOwner(workspaceId: string, userId: string, id: string): Promise<DashboardRecord> {
    const found = await this.dashboards.findVisible(workspaceId, userId, id);
    if (!found) throw DomainError.notFound('Dashboard');
    if (found.ownerId !== userId) throw DomainError.forbidden('Only the owner can change this dashboard');
    return found;
  }

  private async assertCanSeeSpace(workspaceId: string, spaceId: string): Promise<void> {
    await this.spacesService.getInWorkspace(workspaceId, spaceId);
    SpaceGuard.assert(spaceId, 'task.view');
  }

  /** Home dashboards hold Home blocks; a project's hold project blocks. */
  private assertValid(items: LayoutItem[], spaceId: string | null): void {
    const problems = validateLayoutItems(spaceId ? 'project' : 'home', items);
    if (problems.length) throw DomainError.invalid(`Invalid layout: ${problems.join('; ')}`);
  }
}
