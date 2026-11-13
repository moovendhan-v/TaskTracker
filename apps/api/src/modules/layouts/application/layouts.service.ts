import { Injectable } from '@nestjs/common';
import { cleanLayoutItem, LAYOUT_VERSIONS_KEPT, validateLayoutItems, withPinnedBlocks, type DashboardLayout, type LayoutItem, type LayoutPage, type LayoutVersion, type TeamLayout, type TeamLayoutTarget, type WorkspaceLayout } from '@taskflow/shared-types';
import { AuditLogger } from '../../../core/audit/audit-logger.port.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import { LayoutRepository } from '../domain/layout.repository.js';

/** The signed-in user's own dashboard layouts. The user id always comes from the session. */
@Injectable()
export class LayoutsService {
  constructor(
    private readonly repository: LayoutRepository,
    private readonly auditLogger: AuditLogger,
  ) {}

  /**
   * Your layout of a page. While the workspace default is locked, people who
   * can't manage layouts get null, so they see the locked layout.
   */
  async get(workspaceId: string, userId: string, pageKey: LayoutPage, canManage = false): Promise<DashboardLayout | null> {
    const workspaceDefault = canManage ? null : await this.repository.findDefault(workspaceId, pageKey);
    if (workspaceDefault?.locked) return null;
    const mine = await this.repository.find({ workspaceId, userId, pageKey });
    // Blocks pinned in the workspace default are in everyone's layout, as set; layout managers see their own draft.
    return mine && !canManage ? { ...mine, items: withPinnedBlocks(mine.items, workspaceDefault?.items) } : mine;
  }

  async save(workspaceId: string, userId: string, pageKey: LayoutPage, baseVersion: number | null, items: LayoutItem[], canManage = false): Promise<DashboardLayout> {
    const workspaceDefault = canManage ? null : await this.repository.findDefault(workspaceId, pageKey);
    if (workspaceDefault?.locked) throw DomainError.forbidden('This page’s layout is locked by your workspace admins');
    // Only the fields we know (and no empty settings). Others can't pin, move or drop the pinned blocks: they're put back as set.
    const clean = canManage ? items.map(cleanLayoutItem) : withPinnedBlocks(items, workspaceDefault?.items);
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

  /** Locks or unlocks the workspace default (layout.manage, checked by the resolver). Audited. */
  async setWorkspaceDefaultLocked(actor: Actor, workspaceId: string, pageKey: LayoutPage, locked: boolean): Promise<WorkspaceLayout> {
    if (!(await this.repository.setDefaultLocked(workspaceId, pageKey, locked))) throw DomainError.invalid('Make a workspace default for this page before locking it');
    await this.auditLogger.record(actor, { action: locked ? 'layout.default.lock' : 'layout.default.unlock', targetType: 'layout_default', targetId: pageKey, workspaceId, metadata: { pageKey } });
    return (await this.repository.findDefault(workspaceId, pageKey))!;
  }

  /** Your team's default for a page (your HR department's), if it has one: your starting point before the workspace default. */
  myTeamDefault(workspaceId: string, userId: string, pageKey: LayoutPage): Promise<TeamLayout | null> {
    return this.repository.findTeamDefaultFor(workspaceId, userId, pageKey);
  }

  /** Teams whose default you may set: every team with layout.manage, otherwise the ones you head. */
  teamTargets(access: WorkspaceAccess, userId: string, pageKey: LayoutPage): Promise<TeamLayoutTarget[]> {
    return this.repository.teamTargets(access.workspaceId, userId, access.permissions.has('layout.manage'), pageKey);
  }

  /** Makes a layout a team's starting point for a page. Layout managers, or the team's head; audited. */
  async setTeamDefault(actor: Actor, access: WorkspaceAccess, departmentId: string, pageKey: LayoutPage, items: LayoutItem[]): Promise<TeamLayoutTarget> {
    const team = await this.manageableTeam(actor, access, departmentId);
    const clean = items.map(cleanLayoutItem);
    const problems = validateLayoutItems(pageKey, clean);
    if (problems.length) throw DomainError.invalid(`Invalid layout: ${problems.join('; ')}`);
    await this.repository.saveTeamDefault(access.workspaceId, team.id, pageKey, clean, actor.userId);
    await this.auditLogger.record(actor, { action: 'layout.team_default.set', targetType: 'department', targetId: team.id, workspaceId: access.workspaceId, metadata: { pageKey, team: team.name, blocks: clean.length } });
    return { departmentId: team.id, name: team.name, hasDefault: true };
  }

  async clearTeamDefault(actor: Actor, access: WorkspaceAccess, departmentId: string, pageKey: LayoutPage): Promise<boolean> {
    const team = await this.manageableTeam(actor, access, departmentId);
    const removed = await this.repository.removeTeamDefault(access.workspaceId, team.id, pageKey);
    if (removed) await this.auditLogger.record(actor, { action: 'layout.team_default.clear', targetType: 'department', targetId: team.id, workspaceId: access.workspaceId, metadata: { pageKey, team: team.name } });
    return removed;
  }

  private async manageableTeam(actor: Actor, access: WorkspaceAccess, departmentId: string): Promise<{ id: string; name: string }> {
    const team = await this.repository.findDepartment(access.workspaceId, departmentId);
    if (!team) throw DomainError.notFound('Team');
    if (!access.permissions.has('layout.manage') && team.headUserId !== actor.userId) throw DomainError.forbidden('Only layout managers and the team’s head can set its default');
    return team;
  }

  async clearWorkspaceDefault(actor: Actor, workspaceId: string, pageKey: LayoutPage): Promise<boolean> {
    const removed = await this.repository.removeDefault(workspaceId, pageKey);
    if (removed) await this.auditLogger.record(actor, { action: 'layout.default.clear', targetType: 'layout_default', targetId: pageKey, workspaceId, metadata: { pageKey } });
    return removed;
  }
}
