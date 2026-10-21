import { Injectable } from '@nestjs/common';
import type { CreateWorkspaceRequest, UpdateWorkspaceRequest, WorkspaceResponse } from '@taskflow/shared-types';
import { AuditLogger } from '../../../core/audit/audit-logger.port.js';
import { UnitOfWork } from '../../../core/database/unit-of-work.port.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { MembersService } from '../../members/application/members.service.js';
import { RolesService } from '../../roles/application/roles.service.js';
import { DEFAULT_WORKSPACE_COLOR, type Workspace } from '../domain/workspace.js';
import { WorkspaceRepository } from '../domain/workspace.repository.js';
import { WorkspaceMapper } from './workspace.mapper.js';

const PLATFORM_ADMIN_ROLE_NAME = 'Platform admin';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly rolesService: RolesService,
    private readonly membersService: MembersService,
    private readonly unitOfWork: UnitOfWork,
    private readonly auditLogger: AuditLogger,
  ) {}

  async listForUser(userId: string): Promise<WorkspaceResponse[]> {
    const memberships = await this.membersService.listMembershipsForUser(userId);
    const workspaces = await this.workspaces.findByIds(memberships.map((m) => m.workspaceId));
    const byId = new Map(workspaces.map((workspace) => [workspace.id, workspace]));

    return memberships.flatMap((membership) => {
      const workspace = byId.get(membership.workspaceId);
      return workspace ? [WorkspaceMapper.toResponse(workspace, membership.roleName, membership.permissions)] : [];
    });
  }

  /** Creates the workspace, its built-in roles and the owner membership in one transaction. */
  async create(actor: Actor, request: CreateWorkspaceRequest): Promise<WorkspaceResponse> {
    return this.unitOfWork.run(async () => {
      const workspace = await this.workspaces.create({
        name: request.name.trim(),
        color: request.color ?? DEFAULT_WORKSPACE_COLOR,
        ownerId: actor.userId,
      });
      const roles = await this.rolesService.seedSystemRoles(workspace.id);
      const ownerRole = roles.find((role) => role.systemKey === 'owner');
      if (!ownerRole) throw new Error('Owner role was not seeded');
      await this.membersService.addOwner(workspace.id, actor.userId, ownerRole.id);

      await this.audit(actor, 'workspace.create', workspace);
      return WorkspaceMapper.toResponse(workspace, ownerRole.name, ownerRole.permissions);
    });
  }

  async get(access: WorkspaceAccess, userId: string): Promise<WorkspaceResponse> {
    const workspace = await this.getOrFail(access.workspaceId);
    return WorkspaceMapper.toResponse(workspace, await this.roleName(access, userId), access.permissions);
  }

  async update(actor: Actor, access: WorkspaceAccess, request: UpdateWorkspaceRequest): Promise<WorkspaceResponse> {
    const workspace = await this.getOrFail(access.workspaceId);
    if (request.name !== undefined) workspace.name = request.name.trim();
    if (request.color !== undefined) workspace.color = request.color;
    const saved = await this.workspaces.save(workspace);

    await this.audit(actor, 'workspace.update', saved, { fields: Object.keys(request) });
    return WorkspaceMapper.toResponse(saved, await this.roleName(access, actor.userId), access.permissions);
  }

  async remove(actor: Actor, access: WorkspaceAccess): Promise<void> {
    const workspace = await this.getOrFail(access.workspaceId);
    await this.unitOfWork.run(async () => {
      await this.audit(actor, 'workspace.delete', workspace);
      // Child rows go with it through ON DELETE CASCADE foreign keys.
      await this.workspaces.delete(workspace.id);
    });
  }

  private async getOrFail(id: string): Promise<Workspace> {
    const workspace = await this.workspaces.findById(id);
    if (!workspace) throw DomainError.notFound('Workspace');
    return workspace;
  }

  private async roleName(access: WorkspaceAccess, userId: string): Promise<string> {
    if (access.viaPlatformRole) return PLATFORM_ADMIN_ROLE_NAME;
    const memberships = await this.membersService.listMembershipsForUser(userId);
    return memberships.find((m) => m.workspaceId === access.workspaceId)?.roleName ?? '';
  }

  private audit(actor: Actor, action: string, workspace: Workspace, metadata?: Record<string, unknown>) {
    return this.auditLogger.record(actor, {
      action,
      targetType: 'workspace',
      targetId: workspace.id,
      workspaceId: workspace.id,
      metadata: { name: workspace.name, ...metadata },
    });
  }
}
