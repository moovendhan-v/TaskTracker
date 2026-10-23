import { Injectable } from '@nestjs/common';
import type { CreateSpaceRequest, SpaceResponse, UpdateSpaceRequest } from '@taskflow/shared-types';
import { AuditLogger } from '../../../core/audit/audit-logger.port.js';
import { changeOfAction, domainEvent } from '../../../core/events/domain-event.js';
import { EventBus } from '../../../core/events/event-bus.port.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import type { Actor } from '../../../core/http/types/authenticated-request.js';
import { DEFAULT_SPACE_COLOR, type Space } from '../domain/space.js';
import { SpaceRepository } from '../domain/space.repository.js';
import { SpaceMapper } from './space.mapper.js';

@Injectable()
export class SpacesService {
  constructor(
    private readonly spaces: SpaceRepository,
    private readonly auditLogger: AuditLogger,
    private readonly eventBus: EventBus,
  ) {}

  async list(workspaceId: string): Promise<SpaceResponse[]> {
    const spaces = await this.spaces.listByWorkspace(workspaceId);
    return spaces.map(SpaceMapper.toResponse);
  }

  async create(actor: Actor, workspaceId: string, request: CreateSpaceRequest): Promise<SpaceResponse> {
    const space = await this.spaces.create({
      workspaceId,
      name: request.name.trim(),
      color: request.color ?? DEFAULT_SPACE_COLOR,
    });
    await this.audit(actor, 'space.create', space);
    return SpaceMapper.toResponse(space);
  }

  async update(actor: Actor, workspaceId: string, spaceId: string, request: UpdateSpaceRequest): Promise<SpaceResponse> {
    const space = await this.getInWorkspace(workspaceId, spaceId);
    if (request.name !== undefined) space.name = request.name.trim();
    if (request.color !== undefined) space.color = request.color;
    const saved = await this.spaces.save(space);
    await this.audit(actor, 'space.update', saved);
    return SpaceMapper.toResponse(saved);
  }

  async remove(actor: Actor, workspaceId: string, spaceId: string): Promise<void> {
    const space = await this.getInWorkspace(workspaceId, spaceId);
    await this.spaces.delete(workspaceId, spaceId);
    await this.audit(actor, 'space.delete', space);
  }

  async getInWorkspace(workspaceId: string, spaceId: string): Promise<Space> {
    const space = await this.spaces.findInWorkspace(workspaceId, spaceId);
    if (!space) throw DomainError.notFound('Space');
    return space;
  }

  private async audit(actor: Actor, action: string, space: Space): Promise<void> {
    await this.auditLogger.record(actor, {
      action,
      targetType: 'space',
      targetId: space.id,
      workspaceId: space.workspaceId,
      metadata: { name: space.name },
    });
    // Live updates for everyone looking at this workspace.
    await this.eventBus.publish(domainEvent('space', changeOfAction(action), { workspaceId: space.workspaceId, entityId: space.id, actorId: actor.userId }));
  }
}
