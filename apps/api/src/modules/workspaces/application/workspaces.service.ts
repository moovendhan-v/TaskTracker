import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { CreateWorkspaceRequest, TwoStepPolicyResponse, TwoStepRequirement, UpdateWorkspaceRequest, WorkspaceResponse } from '@taskflow/shared-types';
import { AccessService } from '../../../core/access/access.service.js';
import { AuditLogger } from '../../../core/audit/audit-logger.port.js';
import { UnitOfWork } from '../../../core/database/unit-of-work.port.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import { found } from '../../../core/domain/found.js';
import { Announces } from '../../../core/events/announces.decorator.js';
import { workspaceFromAccess } from '../../../core/runtime/change-target.js';
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
    private readonly accessService: AccessService,
  ) {}

  async listForUser(userId: string): Promise<WorkspaceResponse[]> {
    const memberships = await this.membersService.listMembershipsForUser(userId);
    const workspaces = await this.workspaces.findByIds(memberships.map((m) => m.workspaceId));
    const byId = new Map(workspaces.map((workspace) => [workspace.id, workspace]));

    const result: WorkspaceResponse[] = [];
    for (const membership of memberships) {
      const workspace = byId.get(membership.workspaceId);
      if (!workspace) continue;
      // Sequential on purpose: one transaction connection. Each lookup is cached per role.
      const access = await this.membersService.roleAccessFor(membership.workspaceId, membership.roleId);
      result.push(WorkspaceMapper.toResponse(workspace, membership.roleName, access?.permissions ?? [], access?.spaceRules));
    }
    return result;
  }

  /**
   * Creates the workspace, its built-in roles and the owner membership in one
   * transaction, scoped to the new workspace so row-level security allows the writes.
   */
  async create(actor: Actor, request: CreateWorkspaceRequest): Promise<WorkspaceResponse> {
    const workspaceId = randomUUID();
    return this.unitOfWork.runInScope({ kind: 'workspace', workspaceId, userId: actor.userId }, async () => {
      const workspace = await this.workspaces.create({
        id: workspaceId,
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
    return WorkspaceMapper.toResponse(workspace, await this.roleName(access, userId), access.permissions, access.spaceRules, access.twoStepMissing === true);
  }

  @Announces('workspace.updated', workspaceFromAccess)
  async update(actor: Actor, access: WorkspaceAccess, request: UpdateWorkspaceRequest): Promise<WorkspaceResponse> {
    const workspace = await this.getOrFail(access.workspaceId);
    if (request.name !== undefined) workspace.name = request.name.trim();
    if (request.color !== undefined) workspace.color = request.color;
    const saved = await this.workspaces.save(workspace);

    await this.audit(actor, 'workspace.update', saved, { fields: Object.keys(request) });
    return WorkspaceMapper.toResponse(saved, await this.roleName(access, actor.userId), access.permissions, access.spaceRules, access.twoStepMissing === true);
  }

  /** The workspace's two-step sign-in requirement (A4 / E3), and whether the caller meets it. */
  async twoStepPolicy(access: WorkspaceAccess, userId: string): Promise<TwoStepPolicyResponse> {
    const organization = await this.workspaces.organizationTwoStep(access.workspaceId);
    return {
      id: access.workspaceId,
      workspaceId: access.workspaceId,
      require: await this.workspaces.getTwoStep(access.workspaceId),
      organizationRequire: organization?.require ?? null,
      organizationName: organization?.name ?? null,
      callerHasTwoStep: await this.accessService.hasTwoStep(userId),
    };
  }

  /**
   * Requires two-step sign-in of admins or everyone. You can only require it while you have
   * it yourself, so turning it on never locks out the person doing it. Announced, so every
   * instance drops cached access at once; audited.
   */
  @Announces('workspace.updated', workspaceFromAccess)
  async setTwoStep(actor: Actor, access: WorkspaceAccess, requirement: TwoStepRequirement): Promise<TwoStepPolicyResponse> {
    const before = await this.workspaces.getTwoStep(access.workspaceId);
    if (requirement !== 'off' && !(await this.accessService.hasTwoStep(actor.userId))) {
      throw DomainError.forbidden('Set up two-step sign-in for yourself first (Security), so this can never lock you out');
    }
    await this.workspaces.setTwoStep(access.workspaceId, requirement);
    await this.auditLogger.record(actor, {
      action: 'workspace.two_step.update',
      targetType: 'workspace',
      targetId: access.workspaceId,
      workspaceId: access.workspaceId,
      metadata: { from: before, to: requirement },
    });
    return this.twoStepPolicy(access, actor.userId);
  }

  /** Announced so every instance drops cached access to the workspace at once. */
  @Announces('workspace.deleted', workspaceFromAccess)
  async remove(actor: Actor, access: WorkspaceAccess): Promise<{ id: string }> {
    const workspace = await this.getOrFail(access.workspaceId);
    await this.unitOfWork.run(async () => {
      await this.audit(actor, 'workspace.delete', workspace);
      // Child rows go with it through ON DELETE CASCADE foreign keys.
      await this.workspaces.delete(workspace.id);
    });
    return { id: workspace.id };
  }

  private async getOrFail(id: string): Promise<Workspace> {
    return found(await this.workspaces.findById(id), 'Workspace');
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
